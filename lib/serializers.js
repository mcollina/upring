'use strict'

function peer (peer) {
  return {
    id: peer.id,
    meta: peer.meta
  }
}

module.exports = {
  peer,
  to: peer,
  from: peer
}
