'use strict'

const LRU = require('lru-cache')
const from = require('from2')
const eos = require('end-of-stream')
const maxAge = 1000

function monitoring (upring) {
  const lru = LRU({
    max: 100,
    maxAge
  })

  var streams = 0

  upring.add('ns:monitoring,cmd:memoryUsage', function (req, reply) {
    reply(null, process.memoryUsage())
  })

  upring.add('ns:monitoring,cmd:info', function (req, reply) {
    reply(null, Object.assign({
      id: upring.whoami(),
      upring: upring.mymeta().meta.upring
    }, upring.info))
  })

  function trace (req) {
    const key = req.key
    const hash = upring._hashring.hash(key)
    // max one value for each hash
    lru.set('' + hash, { key, hash })
  }

  upring.add('ns:monitoring,cmd:trace', function (req, reply) {
    streams++
    const stream = from.obj(function (n, cb) {
      setTimeout(function () {
        cb(null, {
          id: upring.whoami(),
          keys: lru.values()
        })
        lru.prune()
      }, maxAge)
    })

    upring.on('prerequest', trace)

    eos(stream, function () {
      streams--
      if (streams === 0) {
        upring.removeListener('prerequest', trace)
      }
    })

    reply(null, {
      streams: {
        trace: stream
      }
    })
  })
}

module.exports = monitoring
