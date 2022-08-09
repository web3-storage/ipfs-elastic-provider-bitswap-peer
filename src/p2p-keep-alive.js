'use strict'

/*
This is a workaround for ERR_MPLEX_STREAM_RESET errors
This is related to:
https://github.com/libp2p/js-libp2p-mplex/issues/111
https://github.com/libp2p/js-libp2p-interfaces/pull/90
https://github.com/libp2p/js-libp2p-mplex/pull/121
This was written based on:
https://github.com/status-im/js-waku/issues/185
*/

const { logger, serializeError } = require('./logging')
const { pingPeriodSecs } = require('./config')

const pingKeepAliveTimers = {}

function startKeepAlive(peerId, currentNode) {
  const peerIdStr = peerId.toB58String()

  if (pingPeriodSecs !== 0 && !pingKeepAliveTimers[peerIdStr]) {
    pingKeepAliveTimers[peerIdStr] = setInterval(() => {
      currentNode.ping(peerId).catch(err => {
        if (err.code !== 'ERR_MPLEX_STREAM_RESET' && err.code !== 'ERR_UNSUPPORTED_PROTOCOL') {
          logger.debug({ err, peerId: peerIdStr }, `Ping failed, Error: ${serializeError(err)}`)
        }
        stopKeepAlive(peerId)
      })
    }, pingPeriodSecs * 1000)
  }
}

function stopKeepAlive(peerId) {
  const peerIdStr = peerId.toB58String()

  if (pingKeepAliveTimers[peerIdStr]) {
    clearInterval(pingKeepAliveTimers[peerIdStr])
    delete pingKeepAliveTimers[peerIdStr]
  }
}

function _timers () {
  return pingKeepAliveTimers
}

module.exports = { startKeepAlive, stopKeepAlive, _timers }
