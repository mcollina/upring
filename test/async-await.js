'use strict'

const sleep = require('then-sleep')
const helper = require('./helper')
const getKey = helper.getKey
const bootTwo = helper.bootTwo

function asyncAwaitTestAdd (test) {
  test('async await support', { timeout: 5000 }, (t) => {
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

      i1.add({ cmd: 'parse' }, async (req, reply) => {
        t.equal(req.key, i1Key, 'key matches')
        t.equal(req.value, 42, 'other key matches')
        await sleep(200)
        return { replying: 'i1' }
      })

      i2.add({ cmd: 'parse' }, async (req, reply) => {
        t.equal(req.key, i2Key, 'key matches')
        t.equal(req.value, 42, 'other key matches')
        await sleep(200)
        return { replying: 'i2' }
      })
    })
  })
}

function asyncAwaitTestRequest (test) {
  test('request should support async await', { timeout: 5000 }, (t) => {
    t.plan(8)

    bootTwo(t, (i1, i2) => {
      let i1Key = getKey(i1)
      let i2Key = getKey(i2)

      async function makeRequest () {
        try {
          const response = await i1.request({
            key: i2Key,
            hello: 42
          })
          t.deepEqual(response, {
            replying: 'i2'
          }, 'response matches')
        } catch (err) {
          t.error(err)
        }

        try {
          const response = await i2.request({
            key: i1Key,
            hello: 42
          })
          t.deepEqual(response, {
            replying: 'i1'
          }, 'response matches')
        } catch (err) {
          t.error(err)
        }
      }

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

      makeRequest()
    })
  })
}

module.exports = { asyncAwaitTestAdd, asyncAwaitTestRequest }
