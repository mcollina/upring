# UpRing

**UpRing** provides application-level sharding, based on node.js streams. UpRing allocates some resources to a node, based on the hash of a `key`, and allows you to query the node using a request response pattern (based on JS objects) which can embed streams.

**UpRing** simplifies the implementation and deployment of a cluster of nodes using a gossip membership protocol and a consistent hasrhing (see [swim-hashring](https://github.com/mcollina/swim-hashring)). It uses [tentacoli](https://github.com/mcollina/tentacoli) as a transport layer.

## Install

```
npm i upring
```

## Example

Here is an example client:

```js
'use strict'

const upring = require('upring')
const client = upring({
  client: true, // this does not provides services to the ring

  // fill in with your base node, it maches the one for local usage
  base: [process.argv[2]]
})

client.on('up', () => {
  client.request({
    // the same key will always go to the same host
    // if it is online or until new servers come online
    key: 'a key',
    hello: 42
  }, (err, response) => {
    if (err) {
      console.log(err.message)
      return
    }
    response.streams$.out.pipe(process.stdout)
    response.streams$.out.on('end', () => {
      process.exit(0)
    })
  })
})
```

And here is an example server, acting as a base node:

```js
'use strict'

const upring = require('upring')
const server = upring({
  hashring: {
    port: 7799
  }
})
const fs = require('fs')

server.on('up', () => {
  console.log('server up at', server.whoami())
})

server.on('request', (req, reply) => {
  reply(null, {
    streams$: {
      out: fs.createReadStream(__filename)
    }
  })
})
```

We recommend using [baseswim](http://github.com/mcollina/baseswim) to
run a base node. It also avalailable as a tiny docker image.

<a name="api"></a>
## API

  * <a href="#constructor"><code><b>upring()</b></code></a>
  * <a href="#request"><code>instance.<b>request()</b></code></a>
  * <a href="#whoami"><code>instance.<b>whoami()</b></code></a>
  * <a href="#allocatedToMe"><code>instance.<b>allocatedToMe()</b></code></a>
  * <a href="#close"><code>instance.<b>close()</b></code></a>

<a name="constructor"></a>
### upring(opts)

Create a new upring.

Options:

* `hashring`: Options for
  [swim-hashring](http://github.com/mcollina/swim-hashring).
* `client`: if the current node can answer request from other peers or
  not. Defaults to `false`. Alias for `hashring.client`
* `base`: alias for `hashring.base`.
* `name`: alias for `hashring.name`.
* `port`: the tcp port to listen to for the RPC communications,
  it is allocated dynamically and discovered via gossip by default.

Events:

* `up`: when this instance is up & running and properly configured.
* `move`: see
  [swim-hashring](http://github.com/mcollina/swim-hashring) `'move'`
event.
* `request`: when a request comes in to be handled by the current
  node. It has the request object as first argument, a function to call
when finished as second argument:

```js
instance.on('request', (req, reply) => {
  reply(null, {
    a: 'response',
    streams$: {
      any: stream
    }
  })
})
```

See [tentacoli](http://github.com/mcollina/tentacoli) for the full
details on the request/response format.

<a name="request"></a>
### instance.request(obj, cb)

Forward the given request to the ring. The node that will reply to the
current enquiry will be picked by the `key` property in `obj`.
Callback will be called when a response is received, or an error
occurred.

```js
instance.request({
  key: 'some data',
  streams$: {
    in: fs.createWriteStream('out')
  }
}, (err) => {
  if (err) throw err
})
```

See [tentacoli](http://github.com/mcollina/tentacoli) for the full
details on the request/response format.

<a name="whoami"></a>
### instance.whoami()

The id of the current peer. It will throw if the node has not emitted
`'up'` yet.

<a name="allocatedToMe"></a>
### instance.allocatedToMe(key)

Returns `true` or `false` depending if the given key has been allocated to this node or not.

<a name="close"></a>
### instance.close(cb)

Close the current instance

## License

MIT
