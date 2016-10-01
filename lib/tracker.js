'use strict'

const createTree = require('functional-red-black-tree')
const EE = require('events').EventEmitter

function build (hashring) {
  var tree = createTree()

  class Tracker extends EE {
    constructor (key) {
      super()

      key = hashring.hash(key)
      const list = tree.get(key) || []

      this.list = list
      this.key = key

      if (!hashring.allocatedToMe(key)) {
        throw new Error('not allocate to me')
      }

      if (list.length === 0) {
        tree = tree.insert(key, list)
      }

      list.push(this)
    }

    end () {
      const list = this.list
      const i = list.indexOf(this)

      if (i >= 0) {
        list.splice(i, 1)
      }

      if (list.length === 0) {
        tree = tree.remove(this.key)
      }
    }
  }

  return {
    track,
    check,
    clear
  }

  function track (key) {
    return new Tracker(key)
  }

  function check (event) {
    var iterator = tree.gt(event.start)

    while (iterator.valid && iterator.key <= event.end) {
      for (var i = 0; i < iterator.value.length; i++) {
        const tracker = iterator.value[i]
        tracker.emit('moved', event.to)
      }
      tree = iterator.remove()
      iterator.next()
    }
  }

  function clear () {
    var iterator = tree.gt(0)

    while (iterator.valid) {
      for (var i = 0; i < iterator.value.length; i++) {
        const tracker = iterator.value[i]
        tracker.emit('moved', null)
      }
      iterator.next()
    }

    tree = createTree()
  }
}

module.exports = build
