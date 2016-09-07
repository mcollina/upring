'use strict'

const t = require('tap')
const boot = require('./helper').boot

t.plan(7)

// boot two unrelated instance
boot(t, (one) => {
  boot(t, (two) => {
    t.deepEqual(one.peers(), [], 'no peers')
    t.deepEqual(one.peers(true), [one.mymeta()], 'includes myself')

    one.on('peerUp', function (peer) {
      t.equal(peer.id, two.whoami(), 'peer id matches')
      t.deepEqual(one.peers(), [peer], 'one peer')
      t.deepEqual(one.peers(true), [peer, one.mymeta()], 'two peers including myself')
      two.close()
    })

    one.on('peerDown', function (peer) {
      t.equal(peer.id, two.whoami(), 'peer id matches')
    })

    // let's join them in a cluster
    one.join([two.whoami()], function (err) {
      t.error(err, 'no error')
    })
  })
})
