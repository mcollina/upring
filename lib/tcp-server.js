'use strict'

const net = require('net')
const tentacoli = require('tentacoli')
const pump = require('pump')

module.exports = function serverPlugin (upring, opts, next) {
  upring._server = net.createServer(handler)
  upring._server.listen(opts.port, opts.host, onListen)
  upring._server.on('error', upring.emit.bind(upring, 'error'))

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
    instance.on('request', upring._dispatch)
  }

  function onListen () {
    upring.log.debug({ address: upring._server.address() }, 'listening')
    next()
  }
}

function noop () {}
