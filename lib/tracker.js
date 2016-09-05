'use strict'

const createTree = require('functional-red-black-tree')

function tracker (hashring) {
  var tree = createTree()

  return {
    track,
    check,
    clear
  }

  function track (key, cb) {
    key = hashring.hash(key)

    const list = tree.get(key) || []

    if (!hashring.allocatedToMe(key)) {
      process.nextTick(cb, new Error('not allocate to me'))
      return
    }

    if (list.length === 0) {
      tree = tree.insert(key, list)
    }

    list.push(cb)

    // untrack closure
    return function untrack () {
      const i = list.indexOf(cb)

      if (i >= 0) {
        list.splice(i, 1)
      }

      if (list.length === 0) {
        tree = tree.remove(key)
      }
    }
  }

  function check (event) {
    var iterator = tree.gt(event.start)

    while (iterator.valid && iterator.key <= event.end) {
      for (var i = 0; i < iterator.value.length; i++) {
        const cb = iterator.value[i]
        cb(null, event.to)
      }
      tree = iterator.remove()
      iterator.next()
    }
  }

  function clear () {
    var iterator = tree.gt(0)

    while (iterator.valid) {
      for (var i = 0; i < iterator.value.length; i++) {
        const cb = iterator.value[i]
        cb(null, null)
      }
      iterator.next()
    }

    tree = createTree()
  }
}

module.exports = tracker
