'use strict'

module.exports = function dispatchPlugin (upring, opts, next) {
  upring._dispatch = dispatch
  next()

  function dispatch (req, reply) {
    if (!upring.ready) {
      upring.once('up', upring._dispatch.bind(upring, req, reply))
      return
    }

    var func
    upring.emit('prerequest', req)
    if (upring._router) {
      func = upring._router.lookup(req)
      if (func) {
        var result = func(req, reply)
        if (result && typeof result.then === 'function') {
          result
            .then(res => process.nextTick(reply, null, res))
            .catch(err => process.nextTick(reply, err, null))
        }
      } else {
        reply(new Error('message does not match any pattern'))
      }
    } else {
      upring.emit('request', req, reply)
    }
  }
}
