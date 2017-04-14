![logo][logo-url]

# upring

[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Coverage Status][coveralls-badge]][coveralls-url]

**UpRing** provides application-level sharding, based on node.js streams. UpRing allocates some resources to a node, based on the hash of a `key`, and allows you to query the node using a request response pattern (based on JS objects) which can embed streams.

**UpRing** simplifies the implementation and deployment of a cluster of nodes using a gossip membership protocol and a [consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) scheme (see [swim-hashring](https://github.com/upringjs/swim-hashring)). It uses [tentacoli](https://github.com/mcollina/tentacoli) as a transport layer.

* [Installation](#install)
* [Examples](#examples)
* [API](#api)
* [Monitoring](#monitoring)
* [Acknowledgements](#acknowledgements)
* [License](#license)

## Install

```
npm i upring
```

## Examples

Check out:

* [upring-kv](https://github.com/upringjs/upring-kv), a scalable key/value
  store accessible over HTTP.
* [upring-pubsub](https://github.com/upringjs/upring-pubsub), a scalable
  publish subscribe system without a central broker.
* [upring-control](https://github.com/upringjs/upring-control), a
  monitoring dashboard for your upring cluster. See the demo at
  https://youtu.be/fLDOCwiKbbo.

We recommend using [baseswim](http://github.com/upringjs/baseswim) to
run a base node. It also available as a tiny docker image.

<a name="api"></a>
## API

  * <a href="#constructor"><code><b>upring()</b></code></a>
  * <a href="#request"><code>instance.<b>request()</b></code></a>
  * <a href="#peerConn"><code>instance.<b>peerConn()</b></code></a>
  * <a href="#peers"><code>instance.<b>peers()</b></code></a>
  * <a href="#add"><code>instance.<b>add()</b></code></a>
  * <a href="#whoami"><code>instance.<b>whoami()</b></code></a>
  * <a href="#join"><code>instance.<b>join()</b></code></a>
  * <a href="#allocatedToMe"><code>instance.<b>allocatedToMe()</b></code></a>
  * <a href="#track"><code>instance.<b>track()</b></code></a>
  * <a href="#info"><code>instance.<b>info</b></code></a>
  * <a href="#logger"><code>instance.<b>logger</b></code></a>
  * <a href="#close"><code>instance.<b>close()</b></code></a>

<a name="constructor"></a>
### upring(opts)

Create a new upring.

Options:

* `hashring`: Options for
  [swim-hashring](http://github.com/upringjs/swim-hashring).
* `client`: if the current node can answer request from other peers or
  not. Defaults to `false`. Alias for `hashring.client`
* `base`: alias for `hashring.base`.
* `name`: alias for `hashring.name`.
* `port`: the tcp port to listen to for the RPC communications,
  it is allocated dynamically and discovered via gossip by default.
* `logLevel`: the level for the embedded logger; default `'info'`.
* `logger`: a [pino][pino] instance to log stuff to.

Events:

* `up`: when this instance is up & running and properly configured.
* `move`: see
  [swim-hashring](http://github.com/upringjs/swim-hashring) `'move'`
event.
* `steal`: see
  [swim-hashring](http://github.com/upringjs/swim-hashring) `'steal'`
event.
* `request`: when a request comes in to be handled by the current
  node, if the router is not configured. It has the request object as first argument, a function to call
when finished as second argument:
* `'peerUp'`: when a peer that is part of the hashring gets online
* `'peerDown'`: when a peer that is part of the hashring gets offline

```js
instance.on('request', (req, reply) => {
  reply(null, {
    a: 'response',
    streams: {
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

Example:

```js
instance.request({
  key: 'some data',
  streams: {
    in: fs.createWriteStream('out')
  }
}, (err) => {
  if (err) throw err
})
```

See [tentacoli](http://github.com/mcollina/tentacoli) for the full
details on the request/response format.

#### Retry logic

If the target instance fails while _waiting for a response_, the message
will be sent to the next peer in the ring. This does not applies to
streams, which will be closed or errored.

<a name="peers"></a>
### instance.peers([myself])

All the other peers, as computed by [swim-hashring](http://github.com/upringjs/swim-hashring). If `myself` is set to `true`, then we get data of the current peer as well.

Example:

```js
console.log(instance.peers().map((peer) => peer.id))
```

<a name="mymeta"></a>
### instance.mymeta()

Returns the information regarding this peer.

<a name="peerConn"></a>
### instance.peerConn(peer)

Return the connection for the peer.
See [tentacoli](http://github.com/mcollina/tentacoli) for the full
details on the API.

Example:

```js
instance.peerConn(instance.peers()[0]).request({
  hello: 'world'
}, console.log))
```

<a name="add"></a>
### instance.add(pattern, func)

Execute the given function when the received received requests
matches the given pattern. The request is matched using
[bloomrun](https://github.com/mcollina/bloomrun), e.g. in insertion
order.

After a call to `add`, any non-matching messages will return an error to
the caller.

Setting up any pattern-matching routes disables the `'request'`
event.

Example:

```js
instance.add({ cmd: 'parse' }, (req, reply) => {
  reply(null, {
    a: 'response',
    streams: {
      any: stream
    }
  })
})
```

For convenience a command can also be defined by a `string`.

Example:

```js
instance.add('parse', (req, reply) => {
  reply(null, {
    a: 'response',
    streams: {
      any: stream
    }
  })
})
```

<a name="whoami"></a>
### instance.whoami()

The id of the current peer. It will throw if the node has not emitted
`'up'` yet.

<a name="join"></a>
### instance.join(peers, cb)

Make the instance join the set of peers id (the result of
[`whomai()`](#whoami)). The `cb` callback is called after join the join
is completed.

<a name="allocatedToMe"></a>
### instance.allocatedToMe(key)

Returns `true` or `false` depending if the given key has been allocated to this node or not.

<a name="track"></a>
### instance.track(key[, opts])

Create a new tracker for the given `key`.

Options:

* `replica`, turns on tracking of a replica of the given data. Default:
  `false`.

Events:

* `'move'`, when the `key` exits from this peer responsibility.
  The `'move'` event will be called with a `newPeer` if the peers knows the
  target, with `null` otherwise, e.g. when `close` is called.
* `'replica'`, adds or replace the replica of the given key. The first
  argument is the destination peer, while the second is the old replica
  peer (if any).

Methods:

* `end()`, quit tracking.

<a name="replica"></a>
### instance.replica(key, cb)

Flag this upring instance as replicating the given key.
`cb` is fired once, after the instance becames responsible for the key.

<a name="close"></a>
### instance.close(cb)

Close the current instance

<a name="logger"></a>
### instance.logger

A [pino][pino] instance to log stuff to.

<a name="info"></a>
### instance.info

An Object that can be used for publishing custom information through the
stock monitoring commands.

<a name="monitoring"></a>
## Monitoring

If [`upring.add()`][#add] is used, some standard pattern are also added
to __UpRing__ to ease monitoring the instance.

Given an `upring` instance, those commands are easily accessible by
sending a direct message through the [tentacoli][tentacoli]
connection.

```js
const conn = upring.peerConn({ id: '127.0.0.1:7979' })

conn.request({
  ns: 'monitoring',
  cmd: 'memoryUsage'
}, console.log)
```

### ns:monitoring,cmd:memoryUsage

Returns the amount of memory currently used by the peer.

```js
const conn = upring.peerConn({ id: '127.0.0.1:7979' })

conn.request({
  ns: 'monitoring',
  cmd: 'memoryUsage'
}, console.log)

// the response will be in the format
// { rss: 42639360, heapTotal: 23105536, heapUsed: 16028496 }
```

### ns:monitoring,cmd:info

Return some informations about the peer.

```js
const conn = upring.peerConn({ id: '127.0.0.1:7979' })

conn.request({
  ns: 'monitoring',
  cmd: 'info'
}, console.log)

// the response will be in the format
// { id: '192.168.1.185:55673',
//   upring: { address: '192.168.1.185', port: 50758 } }
```

Custom information can be added in [`upring.info`](#info), and it will
be added to this respsonse.

### ns:monitoring,cmd:trace

Returns a stream of sampled key/hash pairs.

```js
const conn = upring.peerConn({ id: '127.0.0.1:7979' })

conn.request({
  ns: 'monitoring',
  cmd: 'trace'
}, function (err, res) {
  if (err) {
    // do something!
  }

  res.stream.trace.on('data', console.log)
  // this will be in the format
  // { id: '192.168.1.185:55673',
  //   keys:
  //    [ { key: 'world', hash: 831779723 },
  //      { key: 'hello', hash: 2535641019 } ] }
})
```


## Acknowledgements

This project is kindly sponsored by [nearForm](http://nearform.com).

## License

MIT

[logo-url]: https://raw.githubusercontent.com/upringjs/upring/master/upring.png
[npm-badge]: https://badge.fury.io/js/upring.svg
[npm-url]: https://badge.fury.io/js/upring
[travis-badge]: https://api.travis-ci.org/upringjs/upring.svg
[travis-url]: https://travis-ci.org/upringjs/upring
[pino]: https://github.com/upringjs/pino
[coveralls-badge]: https://coveralls.io/repos/github/upringjs/upring/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/upringjs/upring?branch=master
