'use strict'

const test = require('tap').test
const helper = require('./helper')

const getKey = helper.getKey
const bootTwo = helper.bootTwo

test('using the request router', { timeout: 5000 }, (t) => {
  t.plan(10)

  bootTwo(t, (i1, i2) => {
    let i1Key = getKey(i1)
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      cmd: 'parse',
      value: 42
    }, (err, response) => {
      t.error(err, 'no error')
      t.deepEqual(response, {
        replying: 'i2'
      }, 'response matches')
    })

    i2.request({
      key: i1Key,
      cmd: 'parse',
      value: 42
    }, (err, response) => {
      t.error(err)
      t.deepEqual(response, {
        replying: 'i1'
      }, 'response matches')
    })

    i1.add({ cmd: 'parse' }, (req, reply) => {
      t.equal(req.key, i1Key, 'key matches')
      t.equal(req.value, 42, 'other key matches')
      reply(null, { replying: 'i1' })
    })

    i2.add({ cmd: 'parse' }, (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.value, 42, 'other key matches')
      reply(null, { replying: 'i2' })
    })
  })
})

test('not found', { timeout: 5000 }, (t) => {
  t.plan(5)

  bootTwo(t, (i1, i2) => {
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      cmd: 'another',
      value: 42
    }, (err, response) => {
      t.ok(err)
      t.equal(err.message, 'message does not match any pattern')
      t.notOk(response, 'no response')
    })

    i2.add({ cmd: 'parse' }, (req, reply) => {
      t.fail('this should never happen')
      reply(null, { replying: 'i2' })
    })
  })
})
