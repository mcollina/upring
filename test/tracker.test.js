'use strict'

const test = require('tap').test
const tracker = require('../lib/tracker')
const farmhash = require('farmhash')

test('track a value on the ring', (t) => {
  t.plan(3)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const data = { key: 'hello' }
  const peer = { id: 'localhost:12345' }

  instance.track(data, (err, expired, newPeer) => {
    t.error(err, 'no error')
    t.equal(expired, data, 'data is the same')
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.check({
    start: farmhash.hash32(data.key) - 1,
    end: farmhash.hash32(data.key),
    to: peer
  })
})

test('do nothing if the element interval is before', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const data = { key: 'hello' }
  const peer = { id: 'localhost:12345' }

  instance.track(data, () => {
    t.fail('this should not be called')
  })

  instance.check({
    start: farmhash.hash32(data.key) - 10,
    end: farmhash.hash32(data.key) - 5,
    to: peer
  })

  t.end()
})

test('do nothing if the element interval is after', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const data = { key: 'hello' }
  const peer = { id: 'localhost:12345' }

  instance.track(data, () => {
    t.fail('this should not be called')
  })

  instance.check({
    start: farmhash.hash32(data.key) + 10,
    end: farmhash.hash32(data.key) + 20,
    to: peer
  })

  t.end()
})

test('errors if the key does not belong to the ring', (t) => {
  t.plan(1)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => false
  })

  const data = { key: 'hello' }

  instance.track(data, (err, expired, newPeer) => {
    t.ok(err, 'error expected')
  })
})

test('call a callback only once', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const data = { key: 'hello' }
  const peer = { id: 'localhost:12345' }

  instance.track(data, (err, expired, newPeer) => {
    t.error(err, 'no error')
    t.equal(expired, data, 'data is the same')
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.check({
    start: farmhash.hash32(data.key) - 1,
    end: farmhash.hash32(data.key),
    to: peer
  })

  instance.check({
    start: farmhash.hash32(data.key) - 1,
    end: farmhash.hash32(data.key),
    to: peer
  })

  t.end()
})

test('track two entities', (t) => {
  t.plan(6)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const data1 = { key: 'hello' }
  const data2 = { key: 'hello' }
  const peer = { id: 'localhost:12345' }

  instance.track(data1, (err, expired, newPeer) => {
    t.error(err, 'no error')
    t.equal(expired, data1, 'data is the same')
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.track(data2, (err, expired, newPeer) => {
    t.error(err, 'no error')
    t.equal(expired, data2, 'data is the same')
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.check({
    start: farmhash.hash32(data1.key) - 1,
    end: farmhash.hash32(data1.key),
    to: peer
  })
})

test('clear()', (t) => {
  t.plan(6)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const data1 = { key: 'hello' }
  const data2 = { key: 'hello' }

  instance.track(data1, (err, expired, newPeer) => {
    t.error(err, 'no error')
    t.equal(expired, data1, 'data is the same')
    t.notOk(newPeer, 'newPeer is null')
  })

  instance.track(data2, (err, expired, newPeer) => {
    t.error(err, 'no error')
    t.equal(expired, data2, 'data is the same')
    t.notOk(newPeer, 'newPeer is null')
  })

  instance.clear()
})
