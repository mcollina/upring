'use strict'

const upring = require('../../')
const server = upring({
  hashring: {
    port: 7799
  }
})
const fs = require('fs')

server.on('up', () => {
  console.log('server up at', server.whoami())
})

server.add({ cmd: 'read' }, (req, reply) => {
  console.log('received req', req)
  reply(null, {
    streams: {
      out: fs.createReadStream(__filename)
    }
  })
})
