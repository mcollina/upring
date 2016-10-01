'use strict'

const test = require('tap').test
const tracker = require('../lib/tracker')
const farmhash = require('farmhash')

test('track a value on the ring', (t) => {
  t.plan(1)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const peer = { id: 'localhost:12345' }

  const track = instance.track('hello')
  track.on('moved', (newPeer) => {
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello'),
    to: peer
  })
})

test('do nothing if the element interval is before', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('moved', () => {
    t.fail('this should not be called')
  })

  instance.check({
    start: farmhash.hash32('hello') - 10,
    end: farmhash.hash32('hello') - 5,
    to: peer
  })

  t.end()
})

test('do nothing if the element interval is after', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('moved', () => {
    t.fail('this should not be called')
  })

  instance.check({
    start: farmhash.hash32('hello') + 10,
    end: farmhash.hash32('hello') + 20,
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

  try {
    instance.track('hello')
    t.fail('no error')
  } catch (err) {
    t.ok(err, 'error expected')
  }
})

test('call a callback only once', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('moved', (newPeer) => {
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello'),
    to: peer
  })

  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello'),
    to: peer
  })

  t.end()
})

test('track two entities', (t) => {
  t.plan(2)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('moved', (newPeer) => {
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.track('hello').on('moved', (newPeer) => {
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello'),
    to: peer
  })
})

test('clear()', (t) => {
  t.plan(2)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  instance.track('hello').on('moved', (newPeer) => {
    t.notOk(newPeer, 'newPeer is null')
  })

  instance.track('hello').on('moved', (newPeer) => {
    t.notOk(newPeer, 'newPeer is null')
  })

  instance.clear()
})

test('do nothing if the the tracker.end function is called', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true
  })

  const peer = { id: 'localhost:12345' }

  const track = instance.track('hello').on('moved', () => {
    t.fail('this should not be called')
  })

  track.end()

  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello') + 1,
    to: peer
  })

  t.end()
})
