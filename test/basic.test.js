'use strict'

const test = require('tap').test
const concat = require('concat-stream')
const fs = require('fs')
const path = require('path')
const upring = require('..')
const helper = require('./helper')
const packageFile = path.join(__dirname, '..', 'package.json')
const maxInt = Math.pow(2, 32) - 1

const getKey = helper.getKey
const bootTwo = helper.bootTwo
const opts = helper.opts

test('request to two nodes', { timeout: 5000 }, (t) => {
  t.plan(10)

  bootTwo(t, (i1, i2) => {
    let i1Key = getKey(i1)
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      hello: 42
    }, (err, response) => {
      t.error(err)
      t.deepEqual(response, {
        replying: 'i2'
      }, 'response matches')
    })

    i2.request({
      key: i1Key,
      hello: 42
    }, (err, response) => {
      t.error(err)
      t.deepEqual(response, {
        replying: 'i1'
      }, 'response matches')
    })

    i1.on('request', (req, reply) => {
      t.equal(req.key, i1Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      reply(null, { replying: 'i1' })
    })

    i2.on('request', (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      reply(null, { replying: 'i2' })
    })
  })
})

test('streams!', { timeout: 5000 }, (t) => {
  t.plan(7)

  bootTwo(t, (i1, i2) => {
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      hello: 42
    }, (err, response) => {
      t.error(err)
      t.equal(response.replying, 'i2', 'response matches')
      response.streams.p
        .pipe(concat((list) => {
          t.equal(list.toString(), fs.readFileSync(packageFile).toString())
        }))
    })

    i2.on('request', (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      let stream = fs.createReadStream(packageFile)
      reply(null, {
        replying: 'i2',
        streams: {
          p: stream
        }
      })
    })
  })
})

test('streams with error', { timeout: 5000 }, (t) => {
  t.plan(7)

  bootTwo(t, (i1, i2) => {
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      hello: 42
    }, (err, response) => {
      t.error(err)
      t.equal(response.replying, 'i2', 'response matches')
      response.streams.p
        .on('error', () => {
          t.pass('error happened')
        })
        .pipe(concat((list) => {
          t.fail('stream should never end')
        }))
    })

    i2.on('request', (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      let stream = fs.createReadStream('path/to/nowhere')
      reply(null, {
        replying: 'i2',
        streams: {
          p: stream
        }
      })
    })
  })
})

test('client', { timeout: 5000 }, (t) => {
  t.plan(6)

  bootTwo(t, (i1, i2) => {
    const client = upring(opts({
      client: true,
      logLevel: 'error',
      base: [i1.whoami(), i2.whoami()]
    }))

    t.tearDown(client.close.bind(client))

    client.on('up', () => {
      t.pass('client up')

      for (var i = 0; i < maxInt; i += 1000) {
        if (client.allocatedToMe(i)) {
          t.fail('nothing should be allocated to a client')
          return
        }
      }

      client.request({
        key: 'hello'
      }, (err, res) => {
        t.error(err)
        t.equal(res.hello, 'world')
        t.notEqual(res.from, client.whoami())
      })
    })

    i1.on('request', handle)
    i2.on('request', handle)
    client.on('request', handle)

    function handle (req, reply) {
      reply(null, { hello: 'world', from: this.whoami() })
    }
  })
})

test('request to node 2', { timeout: 5000 }, (t) => {
  t.plan(8)

  bootTwo(t, (i1, i2) => {
    t.equal(i1.peers().length, 1, 'there is only one other peer')
    t.equal(i1.peers()[0].id, i2.mymeta().id, 'the other peer is i2')

    i1.on('request', (req, reply) => {
      t.fail('no request should happen to i1')
      reply(new Error('no request should happen to i1'))
    })

    i2.on('request', (req, reply) => {
      t.pass('request to i2')
      t.strictEqual(req.hello, 'world', 'correct message')
      reply(null, { a: 'response' })
    })

    i1.peerConn(i1.peers()[0]).request({
      hello: 'world'
    }, (err, res) => {
      t.error(err)
      t.deepEqual(res, { a: 'response' })
    })
  })
})

test('request should wait for "up" event', { timeout: 5000 }, (t) => {
  t.plan(5)

  const instance = upring(opts({
    logLevel: 'error',
    base: []
  }))

  var key = 'hello'

  instance.on('request', (req, reply) => {
    t.equal(req.key, key, 'key matches')
    t.equal(req.hello, 42, 'other key matches')
    reply(null, { replying: req.key })
  })

  instance.request({
    key: key,
    hello: 42
  }, (err, response) => {
    t.error(err)
    t.deepEqual(response, {
      replying: key
    }, 'response matches')
    instance.close(t.error)
  })
})

test('join should wait for "up" event', { timeout: 5000 }, (t) => {
  t.plan(1)

  const instance1 = upring(opts({
    logLevel: 'error',
    base: []
  }))

  instance1.on('up', () => {
    const instance2 = upring(opts({
      logLevel: 'error',
      base: []
    }))

    instance2.join(instance1.whoami(), () => {
      t.pass('everything ok!')
      instance1.close()
      instance2.close()
    })
  })
})

test('allocatedToMe should return null if upring is not ready', { timeout: 5000 }, (t) => {
  t.plan(2)

  const instance = upring(opts({
    logLevel: 'error',
    base: []
  }))

  t.equal(instance.allocatedToMe(), null)

  instance.on('up', () => {
    instance.close(t.error)
  })
})

test('whoami should throw if upring is not ready, and not after', { timeout: 5000, only: true }, (t) => {
  t.plan(3)

  const instance = upring(opts({
    logLevel: 'error',
    base: []
  }))

  t.tearDown(instance.close.bind(instance))

  t.throws(instance.whoami.bind(instance))

  instance.on('up', () => {
    t.ok(instance.whoami())
  })

  instance.ready(() => {
    t.ok(instance.whoami())
  })
})

test('requestp should support promises', { timeout: 5000 }, (t) => {
  t.plan(8)

  bootTwo(t, (i1, i2) => {
    let i1Key = getKey(i1)
    let i2Key = getKey(i2)

    i1
      .requestp({
        key: i2Key,
        hello: 42
      })
      .then(response => {
        t.deepEqual(response, {
          replying: 'i2'
        }, 'response matches')
      })
      .catch(err => {
        t.error(err)
      })

    i2
      .requestp({
        key: i1Key,
        hello: 42
      })
      .then(response => {
        t.deepEqual(response, {
          replying: 'i1'
        }, 'response matches')
      })
      .catch(err => {
        t.error(err)
      })

    i1.on('request', (req, reply) => {
      t.equal(req.key, i1Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      reply(null, { replying: 'i1' })
    })

    i2.on('request', (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      reply(null, { replying: 'i2' })
    })
  })
})

test('async await support', t => {
  if (Number(process.versions.node[0]) >= 8) {
    require('./async-await').asyncAwaitTestRequest(t.test)
  } else {
    t.pass('Skip because Node version < 8')
  }
  t.end()
})

test('every request should have an id and a child logger', { timeout: 5000 }, (t) => {
  t.plan(12)

  bootTwo(t, (i1, i2) => {
    let i1Key = getKey(i1)
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      hello: 42
    }, (err, response) => {
      t.error(err)
      t.ok(response.log)
      delete response.log
      t.deepEqual(response, {
        replying: 'i2',
        id: 1
      }, 'response matches')
    })

    i2.request({
      key: i1Key,
      hello: 42
    }, (err, response) => {
      t.error(err)
      t.ok(response.log)
      delete response.log
      t.deepEqual(response, {
        replying: 'i1',
        id: 1
      }, 'response matches')
    })

    i1.on('request', (req, reply) => {
      t.ok(req.id === 1)
      t.ok(req.log)
      reply(null, { replying: 'i1' })
    })

    i2.on('request', (req, reply) => {
      t.ok(req.id === 1)
      t.ok(req.log)
      reply(null, { replying: 'i2' })
    })
  })
})

test('request and response should keep the id', { timeout: 5000 }, (t) => {
  t.plan(12)

  bootTwo(t, (i1, i2) => {
    let i1Key = getKey(i1)
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      hello: 42,
      id: 'abc'
    }, (err, response) => {
      t.error(err)
      t.ok(response.log)
      delete response.log
      t.deepEqual(response, {
        replying: 'i2',
        id: 'abc'
      }, 'response matches')
    })

    i2.request({
      key: i1Key,
      hello: 42,
      id: 123
    }, (err, response) => {
      t.error(err)
      t.ok(response.log)
      delete response.log
      t.deepEqual(response, {
        replying: 'i1',
        id: 123
      }, 'response matches')
    })

    i1.on('request', (req, reply) => {
      t.ok(req.id === 123)
      t.ok(req.log)
      reply(null, { replying: 'i1' })
    })

    i2.on('request', (req, reply) => {
      t.ok(req.id === 'abc')
      t.ok(req.log)
      reply(null, { replying: 'i2' })
    })
  })
})
