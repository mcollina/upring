'use strict'

const hashring = require('swim-hashring')
const tracker = require('./tracker')
const replicator = require('./replicator')

module.exports = function hashringPlugin (upring, opts, next) {
  const hashringOpts = opts.hashring || {}
  hashringOpts.base = hashringOpts.base || opts.base
  hashringOpts.name = hashringOpts.name || opts.name
  hashringOpts.client = hashringOpts.client || opts.client
  hashringOpts.host = opts.host

  const local = hashringOpts.local = hashringOpts.local || {}
  const meta = local.meta = local.meta || {}
  meta.upring = {
    address: opts.host,
    port: upring._server.address().port
  }
  upring._hashring = hashring(hashringOpts)
  upring._tracker = tracker(upring._hashring)
  upring._replicator = replicator(upring._hashring)
  upring.track = upring._tracker.track
  upring.replica = upring._replicator.replica

  // needed because of request retrials
  upring._hashring.setMaxListeners(0)
  upring._hashring.on('up', () => {
    // we must use the hashring whoami because the UpRing is
    // not ready yet
    upring.log = upring.log.child({ id: upring._hashring.whoami() })
    upring.log.info({ address: upring._server.address() }, 'node up')
    next()
  })

  upring._hashring.on('move', upring._tracker.check)
  upring._hashring.on('move', (info) => {
    upring.log.trace(info, 'move')
    upring.emit('move', info)
  })
  upring._hashring.on('steal', upring._replicator.check)
  upring._hashring.on('steal', (info) => {
    upring.log.trace(info, 'steal')
    upring.emit('steal', info)
  })
  upring._hashring.on('error', upring.emit.bind(upring, 'error'))
  upring._hashring.on('peerUp', upring.emit.bind(upring, 'peerUp'))
  upring._hashring.on('peerDown', upring.emit.bind(upring, 'peerDown'))
}
