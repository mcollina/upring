'use strict'

const upring = require('../../')
const server = upring({
  logLevel: 'debug',
  hashring: {
    port: 7799
  }
})
const fs = require('fs')

server.add({ cmd: 'read' }, (req, reply) => {
  console.log('received req', req)
  reply(null, {
    streams: {
      out: fs.createReadStream(__filename)
    }
  })
})
