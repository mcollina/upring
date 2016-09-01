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
    t.equal(i1.peers()[0].id, i2.id, 'the other peer is i2')

    i1.on('request', (req, reply) => {
      t.fail('no request should happen to i1')
      reply(new Error('no request should happen to i1'))
    })

    i2.on('request', (req, reply) => {
      t.pass('request to i2')
      t.deepEqual(req, { hello: 'world' }, 'correct message')
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
