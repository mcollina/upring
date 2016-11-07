'use strict'

const createTree = require('functional-red-black-tree')
const inherits = require('util').inherits
const EE = require('events').EventEmitter
const maxInt = Math.pow(2, 32) - 1

function build (hashring) {
  var tree = createTree()
  var peers = 0
  var requestReplicas = []

  hashring.on('peerUp', function () {
    peers++

    for (var i = 0; i < requestReplicas.length; i++) {
      process.nextTick(addReplica, requestReplicas[i])
    }
    requestReplicas = []
  })

  hashring.on('peerDown', function () {
    peers--

    if (peers === 0) {
      readdReplicaRequests()
    }
  })

  function readdReplicaRequests () {
    tree.forEach(function (k, v) {
      v.forEach(function (tracker) {
        if (tracker.requestReplica) {
          requestReplicas.push(tracker)
        }
      })
    })
  }

  function Tracker (key, opts) {
    EE.call(this)

    key = hashring.hash(key)

    if (!hashring.allocatedToMe(key)) {
      throw new Error('not allocated to me')
    }

    this.key = key
    this.list = addToList(this)
    this.replica = null
    this.requestReplica = opts && opts.replica
    this.ended = false

    if (opts && opts.replica) {
      if (peers > 0) {
        addReplica(this)
      } else {
        requestReplicas.push(this)
      }
    }
  }

  function addReplica (tracker) {
    if (tracker.ended) {
      return
    }

    tracker.replica = new Replica(tracker)

    if (tracker.replica.peer) {
      // event replica newPeer oldPeer
      process.nextTick(tracker.emit.bind(tracker), 'replica', tracker.replica.peer, null)
    }
  }

  inherits(Tracker, EE)

  Tracker.prototype.end = function () {
    removefromList(this)
    this.ended = true

    const replica = this.replica

    if (this.replica) {
      this.replica = null
      replica.end()
    }
  }

  function Replica (tracker) {
    const main = hashring.lookup(tracker.key)

    this.key = getNextPoint(tracker.key, main.points)
    this.tracker = tracker
    this.list = addToList(this)
    this.peer = hashring.next(tracker.key)
  }

  Replica.prototype.end = function () {
    removefromList(this)
  }

  return {
    track,
    check,
    clear
  }

  function getNextPoint (point, points) {
    var result = -1

    for (var i = 0; i < points.length; i++) {
      if (point <= points[i]) {
        result = points[i] + 1
      } else if (result > 0) {
        break
      }
    }

    // cycle, if it's greater than the end
    // it is the first element
    if (result === -1) {
      result = maxInt
    }

    if (result > maxInt) {
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
          tracker.ended = true
          tracker.emit('move', event.to)
        }
      }
      tree = iterator.remove()
      iterator.next()
    }

    if (replicas.length > 0) {
      process.nextTick(updateReplicas, replicas)
    }
  }

  function updateReplicas (replicas) {
    for (var i = 0; i < replicas.length; i++) {
      var prev = replicas[i]
      var tracker = prev.tracker
      tracker.replica = null
      if (!tracker.ended) {
        var newReplica = new Replica(tracker)
        tracker.replica = newReplica
        tracker.emit('replica', newReplica.peer, prev.peer)
      }
    }
  }

  function clear () {
    var iterator = tree.gt(0)
    var tracker

    while (iterator.valid) {
      for (var i = 0; i < iterator.value.length; i++) {
        tracker = iterator.value[i]
        if (!(tracker instanceof Replica)) {
          tracker.emit('move', null)
        }
      }
      iterator.next()
    }

    tree = createTree()
  }
}

module.exports = build
