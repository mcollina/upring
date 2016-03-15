'use strict'

const upring = require('../../')
const client = upring({
  client: true, // this does not provides services to the ring
  hashring: {
    joinTimeout: 200,

    // fill in with your base node, it maches the one for local usage
    base: [process.argv[2]]
  }
})

client.on('up', () => {
  client.request({
    key: 'a key',
    hello: 42
  }, (err, response) => {
    if (err) {
      console.log(err.message)
      return
    }
    response.streams.out.pipe(process.stdout)
    response.streams.out.on('end', () => {
      process.exit(0)
    })
  })
})
