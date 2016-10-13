'use strict'

const upring = require('..')

// returns a key allocated to the passed instance
function getKey (instance) {
  let key = 'hello'

  while (!instance.allocatedToMe(key)) {
    key += '1'
  }

  return key
}

module.exports.getKey = getKey

function opts (opts) {
  opts = opts || {}
  opts.hashring = opts.hashring || {}
  opts.hashring.joinTimeout = 200
  opts.hashring.replicaPoints = 10
  return opts
}

module.exports.opts = opts

// boot one instance
function boot (t, parent, cb) {
  if (typeof parent === 'function') {
    cb = parent
    parent = null
  }

  const base = []
  if (parent) {
    base.push(parent.whoami())
  }

  const instance = upring(opts({
    logLevel: 'error',
    base: base
  }))

  t.tearDown(instance.close.bind(instance))

  instance.on('up', () => {
    cb(instance)
  })
}

module.exports.boot = boot

// boot two instances
function bootTwo (t, cb) {
  boot(t, (i1) => {
    t.pass('i1 up')
    boot(t, i1, (i2) => {
      t.pass('i2 up')
      cb(i1, i2)
    })
  })
}

module.exports.bootTwo = bootTwo
