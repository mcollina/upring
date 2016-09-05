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

    const list = tree.get(key)

    if (!hashring.allocatedToMe(key)) {
      process.nextTick(cb, new Error('not allocate to me'))
      return
    }

    if (list) {
      list.push(cb)
    } else {
      tree = tree.insert(key, [cb])
    }

    // chainable API
    return this
  }

  function check (event) {
    var it = tree.gt(event.start)

    while (it.valid && it.key <= event.end) {
      for (var i = 0; i < it.value.length; i++) {
        const cb = it.value[i]
        cb(null, event.to)
      }
      tree = it.remove()
      it.next()
    }
  }

  function clear () {
    var it = tree.gt(0)

    while (it.valid) {
      for (var i = 0; i < it.value.length; i++) {
        const cb = it.value[i]
        cb(null, null)
      }
      it.next()
    }

    tree = createTree
  }
}

module.exports = tracker
