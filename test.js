'use strict'

const test = require('tap').test
const concat = require('concat-stream')
const fs = require('fs')
const path = require('path')
const upring = require('./')
const packageFile = path.join(__dirname, 'package.json')

function opts (opts) {
  opts = opts || {}
  opts.hashring = opts.hashring || {}
  opts.hashring.joinTimeout = 200
  return opts
}

// returns a key allocated to the passed instance
function getKey (instance) {
  let key = 'hello'

  while (!instance.allocatedToMe(key)) {
    key += '1'
  }

  return key
}

test('request to two nodes', { timeout: 5000 }, (t) => {
  t.plan(10)

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
})

test('streams!', { timeout: 5000 }, (t) => {
  t.plan(7)

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

      let i2Key = getKey(i2)

      i1.request({
        key: i2Key,
        hello: 42
      }, (err, response) => {
        t.error(err)
        t.equal(response.replying, 'i2', 'response matches')
        response.streams$.p
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
          streams$: {
            p: stream
          }
        })
      })
    })
  })
})
