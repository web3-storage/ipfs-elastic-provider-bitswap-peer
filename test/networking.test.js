
import t from 'tap'

import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import config from '../src/config.js'
import { Connection } from '../src/networking.js'
import { BITSWAP_V_100 as protocol } from '../src/protocol.js'
import { startService } from '../src/service.js'
import * as helper from './utils/helper.js'
import { mockAWS } from './utils/mock.js'

t.test('send - after closing behavior', async t => {
  const { awsClient } = await mockAWS(config)
  const { client, service, connection } = await helper.setup({ protocol, awsClient })

  connection.close()

  // Nothing is returned
  t.strictSame(await connection[Symbol.asyncIterator]().next(), { done: true, value: undefined })

  // Sending is rejected
  t.throws(() => connection.send('ANYTHING'), { message: 'The stream is closed.' })

  // Nothing is returned
  t.strictSame(await connection[Symbol.asyncIterator]().next(), { done: true, value: undefined })

  await helper.teardown(client, service, connection)
})

t.test('error handling', async t => {
  const peerId = await createEd25519PeerId()
  const connectionConfig = {
    maxConnections: config.p2pConnectionMaxConnections,
    minConnections: config.p2pConnectionMinConnections,
    pollInterval: config.p2pConnectionPollInterval,
    inboundConnectionThreshold: config.p2pConnectionInboundConnectionThreshold,
    maxIncomingPendingConnections: config.p2pConnectionMaxIncomingPendingConnections,
    inboundUpgradeTimeout: config.p2pConnectionInboundUpgradeTimeout,
    autoDial: config.p2pConnectionAutoDial,
    autoDialInterval: config.p2pConnectionAutoDialInterval
  }
  const { port, service } = await startService({ peerId, port: await helper.getFreePort(), connectionConfig })
  const { stream, client } = await helper.createClient(peerId, port, protocol)

  stream.source[Symbol.asyncIterator] = function () {
    return {
      next: () => {
        return Promise.reject(new Error('SOURCE ERROR'))
      }
    }
  }

  stream.sink = function () {
    return Promise.reject(new Error('SINK ERROR'))
  }

  const connection = new Connection(stream)
  connection.on('error', () => { })

  const receiveError = new Promise(resolve => {
    connection.once('error:receive', resolve)
  })

  const sendError = new Promise(resolve => {
    connection.once('error:send', resolve)
  })

  connection.send('ANYTHING')

  t.equal((await receiveError).message, 'SOURCE ERROR')
  t.equal((await sendError).message, 'SINK ERROR')

  await helper.teardown(client, service, connection)
})

// TODO connectPeer
