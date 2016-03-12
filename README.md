# UpRing

Your streams, at scale.

**UpRing** provides application-level sharding, based on node.js streams. UpRing allocates some resources to a node, based on the hash of a `key`, and allows you to query the node using a request response pattern (based on JS objects) which can embed streams.

**UpRing** simplifies the implementation and deployment of a cluster of nodes using a gossip membership protocol and a consistent hasrhing (see [swim-hashring](https://github.com/mcollina/swim-hashring). It uses [tentacoli](https://github.com/mcollina/tentacoli) as a transport layer.

## License

MIT
