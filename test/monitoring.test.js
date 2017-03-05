'use strict'

const t = require('tap')
const test = t.test
const helper = require('./helper')

const boot = helper.boot

boot(t, (i) => {
  t.pass('instance up')

  i.add('cmd:something', function (req, reply) {
    reply(null, {})
  })

  const conn = i.peerConn(i.mymeta())

  test('memoryUsage', { timeout: 5000 }, (t) => {
    t.plan(4)

    conn.request({
      ns: 'monitoring',
      cmd: 'memoryUsage'
    }, (err, response) => {
      t.error(err)
      t.ok(response.rss)
      t.ok(response.heapTotal)
      t.ok(response.heapUsed)
    })
  })

  test('info', { timeout: 5000 }, (t) => {
    t.plan(2)

    conn.request({
      ns: 'monitoring',
      cmd: 'info'
    }, (err, response) => {
      t.error(err)
      t.deepEqual(response, {
        id: i.whoami(),
        upring: i.mymeta().meta.upring
      })
    })
  })

  test('custom info', { timeout: 5000 }, (t) => {
    t.plan(3)

    i.info.hello = 'world'
    i.info.an = {
      object: 42
    }

    conn.request({
      ns: 'monitoring',
      cmd: 'info'
    }, (err, response) => {
      t.error(err)
      t.deepEqual(response, {
        id: i.whoami(),
        upring: i.mymeta().meta.upring,
        hello: 'world',
        an: {
          object: 42
        }
      })
      t.deepEqual(i.info, {
        hello: 'world',
        an: {
          object: 42
        }
      })
    })
  })

  test('last requests', { timeout: 5000 }, (t) => {
    t.plan(5)

    conn.request({
      ns: 'monitoring',
      cmd: 'trace'
    }, (err, response) => {
      t.error(err)
      const stream = response.streams.trace
      t.ok(stream, 'stream exists')

      stream.on('data', function (data) {
        t.deepEqual(data, {
          id: i.whoami(),
          keys: [{
            key: 'world',
            hash: i._hashring.hash('world')
          }, {
            key: 'hello',
            hash: i._hashring.hash('hello')
          }]
        })
      })

      i.request({
        cmd: 'something',
        key: 'hello'
      }, function (err) {
        t.error(err)
      })

      i.request({
        cmd: 'something',
        key: 'world'
      }, function (err) {
        t.error(err)
      })
    })
  })
})
