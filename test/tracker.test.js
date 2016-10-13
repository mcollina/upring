'use strict'

const test = require('tap').test
const tracker = require('../lib/tracker')
const farmhash = require('farmhash')
const EE = require('events').EventEmitter

test('track a value on the ring', (t) => {
  t.plan(1)

  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  const peer = { id: 'localhost:12345' }

  const track = instance.track('hello')
  track.on('move', (newPeer) => {
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
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('move', () => {
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
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('move', () => {
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
    allocatedToMe: () => false,
    whoami: () => 'abcde',
    on: () => {}
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
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('move', (newPeer) => {
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
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  const peer = { id: 'localhost:12345' }

  instance.track('hello').on('move', (newPeer) => {
    t.equal(newPeer, peer, 'peer is set')
  })

  instance.track('hello').on('move', (newPeer) => {
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
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  instance.track('hello').on('move', (newPeer) => {
    t.notOk(newPeer, 'newPeer is null')
  })

  instance.track('hello').on('move', (newPeer) => {
    t.notOk(newPeer, 'newPeer is null')
  })

  instance.clear()
})

test('do nothing if the the tracker.end function is called', (t) => {
  const instance = tracker({
    hash: farmhash.hash32,
    allocatedToMe: () => true,
    whoami: () => 'abcde',
    on: () => {}
  })

  const peer = { id: 'localhost:12345' }

  const track = instance.track('hello').on('move', () => {
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

test('track the replica of a value across the ring', (t) => {
  t.plan(8)

  const hash = farmhash.hash32('hello')
  const hashring = new EE()

  hashring.hash = farmhash.hash32
  hashring.allocatedToMe = () => true
  hashring.whoami = () => 'abcde'

  const instance = tracker(hashring)

  const myself = {
    id: 'a',
    points: [ // mocked points
      hash - 10,
      hash + 50
    ]
  }
  const peer = {
    id: 'b',
    points: [ // mocked points
      hash + 60,
      hash + 100
    ]
  }
  const peer2 = {
    id: 'b',
    points: [ // mocked points
      hash + 55,
      hash + 200
    ]
  }

  hashring.next = function (key) {
    // first go, there is a next peer
    t.equal(key, hash)

    hashring.next = function (key) {
      // second go, there is a next peer
      t.equal(key, hash)

      hashring.next = function () {
        t.fail('next should not be called again')
      }

      return peer2
    }

    return peer
  }

  hashring.lookup = function (key) {
    t.equal(key, hash)
    return myself
  }

  const track = instance.track('hello', { replica: true })
  track.once('replica', (newPeer, oldPeer) => {
    t.equal(newPeer, peer, 'peer is set')
    t.notOk(oldPeer, 'no old peer')

    track.once('replica', (newPeer2, oldPeer2) => {
      t.equal(oldPeer2, newPeer, 'peer is set')
      t.equal(newPeer2, peer2)

      track.once('replica', () => {
        t.fail('no more replica')
      })
    })

    hashring.emit('peerUp', peer2)

    instance.check({
      start: myself.points[1],
      end: peer2.points[0],
      to: peer2
    })
  })

  hashring.emit('peerUp', peer)

  instance.check({
    start: myself.points[1],
    end: peer.points[0],
    to: peer
  })
})
