'use strict'

const createTree = require('functional-red-black-tree')

function build (hashring) {
  var tree = createTree()

  return { replica, check }

  function replica (key, cb) {
    key = hashring.hash(key)

    if (hashring.allocatedToMe(key)) {
      throw new Error('allocated to me')
    }

    if (!cb) {
      throw new Error('missing callback')
    }

    addToList({
      key,
      cb
    })
  }

  function addToList (obj) {
    const key = obj.key
    const list = tree.get(key) || []

    if (list.length === 0) {
      tree = tree.insert(key, list)
    }

    list.push(obj)

    return list
  }

  function check (event) {
    var iterator = tree.gt(event.start)
    var i
    var tracker

    while (iterator.valid && iterator.key <= event.end) {
      for (i = 0; i < iterator.value.length; i++) {
        tracker = iterator.value[i]
        tracker.cb()
      }
      tree = iterator.remove()
      iterator.next()
    }
  }
}

module.exports = build
