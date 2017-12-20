'use strict'

const net = require('net')
const tentacoli = require('tentacoli')
const pump = require('pump')

module.exports = function serverPlugin (upring, opts, next) {
  upring._server = net.createServer(handler)
  upring._server.listen(opts.port, opts.host, onListen)
  upring._server.on('error', upring.emit.bind(upring, 'error'))

  const genReqId = opts.genReqId || reqIdGenFactory()
  upring.genReqId = genReqId

  function handler (stream) {
    if (upring.closed) {
      stream.on('error', noop)
      stream.destroy()
      return
    }

    upring.log.debug({ address: stream.address() }, 'incoming connection')

    const instance = tentacoli()
    upring._inbound.add(instance)
    pump(stream, instance, stream, () => {
      upring.log.debug({ address: stream.address() }, 'closed connection')
      upring._inbound.delete(instance)
    })
    instance.on('request', onRequest)
  }

  function onRequest (req, reply) {
    req.id = genReqId(req)
    req.log = upring.log.child({ reqId: req.id })
    upring._dispatch(req, reply)
  }

  function onListen () {
    upring.log.debug({ address: upring._server.address() }, 'listening')
    next()
  }

  function reqIdGenFactory () {
    var maxInt = 2147483647
    var nextReqId = 0
    return function _genReqId (req) {
      return req.id || (nextReqId = (nextReqId + 1) & maxInt)
    }
  }
}

function noop () {}
