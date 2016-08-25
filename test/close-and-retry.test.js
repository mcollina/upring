'use strict'

const test = require('tap').test
const eos = require('end-of-stream')
const writable = require('flush-write-stream')
const helper = require('./helper')

const getKey = helper.getKey
const bootTwo = helper.bootTwo

test('closing a persistent stream', { timeout: 5000 }, (t) => {
  t.plan(10)

  bootTwo(t, (i1, i2) => {
    let i1Key = getKey(i1)

    pubsub(i1)
    pubsub(i2)

    const stream = writable.obj(function (chunk, enc, cb) {
      t.deepEqual(chunk, {
        some: 'data'
      })
    })

    eos(stream, function () {
      t.pass('stream closed')

      const stream = writable.obj(function (chunk, enc, cb) {
        t.deepEqual(chunk, {
          some: 'data'
        })
      })

      i1.request({
        cmd: 'subscribe',
        key: i1Key,
        streams: {
          messages: stream
        }
      }, function () {
        t.pass('subcribed again')

        i1.request({
          cmd: 'publish',
          key: i1Key,
          payload: {
            some: 'data'
          }
        }, function (err) {
          t.error(err, 'published successfully')
        })
      })
    })

    i2.request({
      cmd: 'subscribe',
      key: i1Key,
      streams: {
        messages: stream
      }
    }, function (err) {
      t.error(err)

      i1.request({
        cmd: 'publish',
        key: i1Key,
        payload: {
          some: 'data'
        }
      }, function (err) {
        t.error(err, 'published successfully')

        i1.close(function () {
          t.pass('closed')
        })
      })
    })
  })

  function pubsub (i) {
    const streams = new Set()
    i.add('cmd:subscribe', subscribe)
    i.add('cmd:publish', publish)

    function subscribe (req, reply) {
      const stream = req.streams.messages
      streams.add(stream)
      eos(stream, function () {
        streams.delete(stream)
      })
      reply()
    }

    function publish (req, reply) {
      streams.forEach((s) => s.write(req.payload))
      reply()
    }
  }
})
