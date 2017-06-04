'use strict'

const hashring = require('swim-hashring')
const EE = require('events').EventEmitter
const inherits = require('util').inherits
const net = require('net')
const tentacoli = require('tentacoli')
const pump = require('pump')
const dezalgo = require('fastzalgo')
const networkAddress = require('network-address')
const bloomrun = require('bloomrun')
const pino = require('pino')
const tinysonic = require('tinysonic')
const tracker = require('./lib/tracker')
const replicator = require('./lib/replicator')
const serializers = require('./lib/serializers')
const monitoring = require('./lib/monitoring')

function UpRing (opts) {
  if (!(this instanceof UpRing)) {
    return new UpRing(opts)
  }

  opts = opts || {}
  opts.port = opts.port || 0
  opts.host = opts.host || networkAddress()

  const hashringOpts = opts.hashring || {}
  hashringOpts.base = hashringOpts.base || opts.base
  hashringOpts.name = hashringOpts.name || opts.name
  hashringOpts.client = hashringOpts.client || opts.client
  hashringOpts.host = opts.host

  this._inbound = new Set()
  this.logger = opts.logger ? opts.logger.child({ serializers }) : pino({ serializers })
  this.info = {}
  this.ready = false

  if (!opts.logger) {
    this.logger.level = opts.logLevel || 'info'
  }

  this._dispatch = (req, reply) => {
    if (!this.ready) {
      this.on('up', this._dispatch.bind(this, req, reply))
      return
    }

    var func
    this.emit('prerequest', req)
    if (this._router) {
      func = this._router.lookup(req)
      if (func) {
        var result = func(req, reply)
        if (result && typeof result.then === 'function') {
          result
            .then(res => reply(null, res))
            .catch(err => reply(err, null))
        }
      } else {
        reply(new Error('message does not match any pattern'))
      }
    } else {
      this.emit('request', req, reply)
    }
  }

  this._server = net.createServer((stream) => {
    if (this.closed) {
      stream.on('error', noop)
      stream.destroy()
      return
    }

    this.logger.debug({ address: stream.address() }, 'incoming connection')

    const instance = tentacoli()
    this._inbound.add(instance)
    pump(stream, instance, stream, () => {
      this.logger.debug({ address: stream.address() }, 'closed connection')
      this._inbound.delete(instance)
    })
    instance.on('request', this._dispatch)
  })
  this._server.listen(opts.port, opts.host, () => {
    this.logger.debug({ address: this._server.address() }, 'listening')
    const local = hashringOpts.local = hashringOpts.local || {}
    const meta = local.meta = local.meta || {}
    meta.upring = {
      address: opts.host,
      port: this._server.address().port
    }
    this._hashring = hashring(hashringOpts)
    this._tracker = tracker(this._hashring)
    this._replicator = replicator(this._hashring)
    this.track = this._tracker.track
    this.replica = this._replicator.replica

    // needed because of request retrials
    this._hashring.setMaxListeners(0)
    this._hashring.on('up', () => {
      this.ready = true
      this.logger = this.logger.child({ id: this.whoami() })
      this.logger.info({ address: this._server.address() }, 'node up')
      this.emit('up')
    })

    this._hashring.on('move', this._tracker.check)
    this._hashring.on('move', (info) => {
      this.logger.trace(info, 'move')
      this.emit('move', info)
    })
    this._hashring.on('steal', this._replicator.check)
    this._hashring.on('steal', (info) => {
      this.logger.trace(info, 'steal')
      this.emit('steal', info)
    })
    this._hashring.on('error', this.emit.bind(this, 'error'))
    this._hashring.on('peerUp', this.emit.bind(this, 'peerUp'))
    this._hashring.on('peerDown', this.emit.bind(this, 'peerDown'))
  })

  this._server.on('error', this.emit.bind(this, 'error'))

  this._peers = {}
}

inherits(UpRing, EE)

UpRing.prototype.whoami = function () {
  return this._hashring.whoami()
}

UpRing.prototype.join = function (peers, cb) {
  if (!Array.isArray(peers)) {
    peers = [peers]
  }
  return this._hashring.swim.join(peers, cb)
}

UpRing.prototype.allocatedToMe = function (key) {
  return this._hashring.allocatedToMe(key)
}

UpRing.prototype.peerConn = function (peer) {
  let conn = this._peers[peer.id]

  if (!conn) {
    this.logger.debug({ peer: peer }, 'connecting to peer')
    const upring = peer.meta.upring
    const stream = net.connect(upring.port, upring.address)
    conn = setupConn(this, peer, stream)
  }

  return conn
}

function setupConn (that, peer, stream, retry) {
  const conn = tentacoli()

  pump(stream, conn, stream, function () {
    that.logger.debug({ peer: peer }, 'peer disconnected')
    var nustream = null
    that._hashring.on('peerDown', onPeerDown)

    if (!retry) {
      that.logger.debug({ peer: peer }, 'reconnecting to peer')
      nustream = net.connect(peer.meta.upring.port, peer.meta.upring.address)
      nustream.on('connect', onConnect)
      nustream.on('error', onError)
    }

    function onPeerDown (peerDown) {
      if (peerDown.id === peer.id) {
        that.logger.debug({ peer: peer }, 'peer down')
        delete that._peers[peer.id]
        that._hashring.removeListener('peerDown', onPeerDown)
        if (nustream) {
          nustream.destroy()
        }
      }
    }

    function onConnect () {
      that.logger.debug({ peer: peer }, 'reconnected')
      setupConn(that, peer, nustream, true)
      that._hashring.removeListener('peerDown', onPeerDown)
    }

    function onError () {
      // do nothing, let's wait for peerDown
      // TODO that might never come, how to signal the hashring?
    }
  })

  setTimeout(function () {
    retry = true
  }, 10 * 1000).unref() // 10 seconds

  that._peers[peer.id] = conn
  return conn
}

UpRing.prototype.peers = function (myself) {
  return this._hashring.peers(myself)
}

UpRing.prototype.mymeta = function () {
  return this._hashring.mymeta()
}

UpRing.prototype.request = function (obj, callback, _count) {
  if (this._hashring.allocatedToMe(obj.key)) {
    this.logger.trace({ msg: obj }, 'local call')
    this._dispatch(obj, dezalgo(callback))
  } else {
    let peer = this._hashring.lookup(obj.key)
    this.logger.trace({ msg: obj, peer }, 'remote call')

    let upring = peer.meta.upring
    if (!upring || !upring.address || !upring.port) {
      callback(new Error('peer has invalid upring metadata'))
      return
    }

    // TODO simplify all this logic
    // and avoid allocating a closure
    if (typeof _count !== 'number') {
      _count = 0
    } else if (_count === 3) {
      callback(new Error('retried three times'))
      return
    } else {
      _count++
    }

    const conn = this.peerConn(peer)

    if (conn.destroyed) {
      // TODO make this dependent on the gossip interval
      setTimeout(retry, 500, this, obj, callback, _count)
      return
    }

    conn.request(obj, (err, result) => {
      if (err) {
        // the peer has changed
        if (this._hashring.lookup(obj.key).id !== peer.id || conn.destroyed) {
          // TODO make this dependent on the gossip interval
          setTimeout(retry, 500, this, obj, callback, _count)
          return
        }
      }
      callback(err, result)
    })
  }

  return this
}

function retry (that, obj, callback, _count) {
  that.request(obj, callback, _count)
}

UpRing.prototype.add = function (pattern, func) {
  if (!this._router) {
    this._router = bloomrun()
    monitoring(this)
  }

  if (typeof pattern === 'string') {
    let sonic = tinysonic(pattern)

    if (sonic) {
      pattern = sonic
    } else {
      pattern = { cmd: pattern }
    }
  }

  this._router.add(pattern, func)
}

UpRing.prototype.close = function (cb) {
  cb = cb || noop

  if (this.closed) {
    return cb()
  }

  if (this._tracker) {
    this._tracker.clear()
  }

  this.closed = true

  Object.keys(this._peers).forEach((id) => {
    this._peers[id].destroy()
  })

  this._inbound.forEach((s) => {
    s.destroy()
  })
  this._hashring.close()
  this._server.close((err) => {
    this.logger.info('closed')
    this.emit('close')
    cb(err)
  })

  return this
}

function noop () {}

module.exports = UpRing
