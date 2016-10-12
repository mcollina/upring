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

test('track the replica of a value across the ring', (t) => {
  t.plan(10)

  const hash = farmhash.hash32('hello')
  const hashring = {
    hash: farmhash.hash32,
    allocatedToMe: () => true
  }

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
    // first go, there is no other peer
    t.equal(key, hash)

    hashring.next = function () {
      // second go, there is a next peer
      t.equal(key, hash)

      hashring.next = function () {
        // third go, there is a next peer
        t.equal(key, hash)

        hashring.next = function () {
          t.fail('next should not be called again')
        }

        return peer2
      }

      return peer
    }

    return null
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

    instance.check({
      start: myself.points[1],
      end: peer2.points[0],
      to: peer2
    })
  })

  instance.check({
    start: myself.points[1],
    end: peer.points[0],
    to: peer
  })
})
