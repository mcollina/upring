'use strict'

const test = require('tap').test
const upring = require('./')

function opts (opts) {
  opts = opts || {}
  opts.hashring = opts.hashring || {}
  opts.hashring.joinTimeout = 200
  return opts
}

test('request to two nodes', { timeout: 5000 }, (t) => {
  t.plan(10)

  let i1Key = 'hello'
  let i2Key = 'hello'
  const i1 = upring(opts())
  t.tearDown(i1.close.bind(i1))
  i1.on('up', () => {
    t.pass('i1 up')
    const i2 = upring(opts({
      base: [i1.whoami()]
    }))
    t.tearDown(i2.close.bind(i2))
    i2.on('up', () => {
      t.pass('i2 up')

      while (!i1.allocatedToMe(i1Key)) {
        i1Key += '1'
      }

      while (!i2.allocatedToMe(i2Key)) {
        i2Key += '1'
      }

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
    })

    i2.on('request', (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.hello, 42, 'other key matches')
      reply(null, { replying: 'i2' })
    })
  })

  i1.on('request', (req, reply) => {
    t.equal(req.key, i1Key, 'key matches')
    t.equal(req.hello, 42, 'other key matches')
    reply(null, { replying: 'i1' })
  })
})
