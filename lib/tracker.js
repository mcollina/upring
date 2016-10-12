'use strict'

const createTree = require('functional-red-black-tree')
const EE = require('events').EventEmitter
const maxInt = Math.pow(2, 32) - 1

function build (hashring) {
  var tree = createTree()

  class Tracker extends EE {
    constructor (key, opts) {
      super()

      key = hashring.hash(key)

      if (!hashring.allocatedToMe(key)) {
        throw new Error('not allocate to me')
      }

      this.key = key
      this.list = addToList(this)
      this.replica = null

      if (opts && opts.replica) {
        this.replica = new Replica(this)

        if (this.replica.peer) {
          // event replica newPeer oldPeer
          process.nextTick(this.emit.bind(this), 'replica', this.replica.peer, null)
        }
      }
    }

    end () {
      removefromList(this)
      const replica = this.replica

      if (this.replica) {
        this.replica = null
        replica.end()
      }
    }
  }

  class Replica {
    constructor (tracker) {
      const main = hashring.lookup(tracker.key)

      this.key = getNextPoint(tracker.key, main.points)
      this.tracker = tracker
      this.list = addToList(this)
      this.peer = hashring.next(tracker.key)
    }

    end () {
      removefromList(this)
    }
  }

  return {
    track,
    check,
    clear
  }

  function getNextPoint (point, points) {
    var result = -1

    for (var i = 0; i < points.length; i++) {
      if (point < points[i]) {
        result = points[i] + 1
      }
    }

    // cycle, if it's greater than the end
    // it is the first element
    if (result === -1) {
      result = points[0] + 1
    }

    if (result >= maxInt) {
      result = 0
    }

    return result
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

  function removefromList (obj) {
    const list = obj.list
    const i = list.indexOf(obj)

    if (i >= 0) {
      list.splice(i, 1)
    }

    if (list.length === 0) {
      tree = tree.remove(obj.key)
    }
  }

  function track (key, opts) {
    return new Tracker(key, opts)
  }

  function check (event) {
    var iterator = tree.gt(event.start)
    var replicas = []
    var i
    var tracker

    while (iterator.valid && iterator.key <= event.end) {
      for (i = 0; i < iterator.value.length; i++) {
        tracker = iterator.value[i]

        if (tracker instanceof Replica) {
          replicas.push(tracker)
        } else {
          if (tracker.replica) {
            tracker.replica.end()
            tracker.replica = null
          }
          tracker.emit('moved', event.to)
        }
      }
      tree = iterator.remove()
      iterator.next()
    }

    for (i = 0; i < replicas.length; i++) {
      var prev = replicas[i]
      tracker = prev.tracker
      var newReplica = new Replica(tracker)
      tracker.replica = newReplica
      tracker.emit('replica', newReplica.peer, prev.peer)
    }
  }

  function clear () {
    var iterator = tree.gt(0)
    var tracker

    while (iterator.valid) {
      for (var i = 0; i < iterator.value.length; i++) {
        tracker = iterator.value[i]
        if (!(tracker instanceof Replica)) {
          tracker.emit('moved', null)
        }
      }
      iterator.next()
    }

    tree = createTree()
  }
}

module.exports = build
