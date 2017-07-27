'use strict'

const test = require('tap').test
const helper = require('./helper')

const getKey = helper.getKey
const bootTwo = helper.bootTwo

test('should validate the request (valid)', { timeout: 5000 }, (t) => {
  t.plan(6)

  bootTwo(t, (i1, i2) => {
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

    i2.add({ cmd: 'parse' }, {
      type: 'object',
      properties: {
        key: { type: 'string' },
        cmd: { type: 'string' },
        value: { type: 'number' }
      }
    }, (req, reply) => {
      t.equal(req.key, i2Key, 'key matches')
      t.equal(req.value, 42, 'other key matches')
      reply(null, { replying: 'i2' })
    })
  })
})

test('should validate the request (not valid)', { timeout: 5000 }, (t) => {
  t.plan(4)

  bootTwo(t, (i1, i2) => {
    let i2Key = getKey(i2)

    i1.request({
      key: i2Key,
      cmd: 'parse',
      value: 42
    }, (err, response) => {
      t.equal(err.message, '400')
      t.is(typeof response, 'object')
    })

    i2.add({ cmd: 'parse' }, {
      type: 'object',
      properties: {
        key: { type: 'string' },
        cmd: { type: 'number' },
        value: { type: 'number' }
      }
    }, (req, reply) => {
      t.fail('this should not be called')
    })
  })
})
