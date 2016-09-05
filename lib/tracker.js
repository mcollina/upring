'use strict'

const createTree = require('functional-red-black-tree')

function tracker (hashring) {
  var tree = createTree()

  return {
    track,
    check,
    clear
  }

  function track (obj, cb) {
    const entity = new Entity(obj, cb)
    const key = hashring.hash(obj.key)
    const list = tree.get(key)

    if (!hashring.allocatedToMe(key)) {
      process.nextTick(cb, new Error('not allocate to me'))
      return
    }

    if (list) {
      list.push(entity)
    } else {
      tree = tree.insert(key, [entity])
    }

    // chainable API
    return this
  }

  function check (event) {
    var it = tree.gt(event.start)

    while (it.valid && it.key <= event.end) {
      for (var i = 0; i < it.value.length; i++) {
        const cb = it.value[i].cb
        cb(null, it.value[i].obj, event.to)
      }
      tree = it.remove()
      it.next()
    }
  }

  function clear () {
    var it = tree.gt(0)

    while (it.valid) {
      for (var i = 0; i < it.value.length; i++) {
        const cb = it.value[i].cb
        cb(null, it.value[i].obj, null)
      }
      it.next()
    }

    tree = createTree
  }

  function Entity (obj, cb) {
    this.obj = obj
    this.cb = cb
  }
}

module.exports = tracker
