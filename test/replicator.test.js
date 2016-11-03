'use strict'

const test = require('tap').test
const replicator = require('../lib/replicator')
const farmhash = require('farmhash')

test('replica', (t) => {
  t.plan(1)

  const instance = replicator({
    hash: farmhash.hash32,
    allocatedToMe: () => false,
    whoami: () => 'abcde'
  })

  const peer = { id: 'abcde' }

  instance.replica('hello', function () {
    t.pass('replica called')
  })

  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello'),
    to: peer
  })

  // double check, replica is fired only once
  instance.check({
    start: farmhash.hash32('hello') - 1,
    end: farmhash.hash32('hello'),
    to: peer
  })
})

test('replica not fired', (t) => {
  const instance = replicator({
    hash: farmhash.hash32,
    allocatedToMe: () => false,
    whoami: () => 'abcde'
  })

  const peer = { id: 'abcde' }

  instance.replica('hello', function () {
    t.fail('replica called')
  })

  instance.check({
    start: farmhash.hash32('hello') - 10,
    end: farmhash.hash32('hello') - 5,
    to: peer
  })

  t.end()
})

test('replica throws if allocated to the current peer', (t) => {
  t.plan(1)

  const instance = replicator({
    hash: farmhash.hash32,
    allocatedToMe: () => true,
    whoami: () => 'abcde'
  })

  try {
    instance.replica('hello', function () {})
  } catch (err) {
    t.ok(err)
    return
  }

  t.fail('not thrown')
})
