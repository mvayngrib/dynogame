const http = require('http')
const co = require('co').wrap
const pick = require('object.pick')
// const Client = require('apollo-client')
// const { createNetworkInterface } = Client
const express = require('express')
const expressGraphQL = require('express-graphql')
const dynogels = require('dynogels')
dynogels.AWS.config.update({
  // localstack
  endpoint: 'http://localhost:4569',
  region: 'us-east-1'
})

const modelsArray = require('@tradle/models').models.concat(require('@tradle/custom-models'))
const { normalizeModels } = require('./utils')
const models = normalizeModels(modelsArray.reduce((map, model) => {
  map[model.id] = model
  return map
}, {}))

const { createSchema } = require('./schema-mapper-graphql')
const { getTables, ensureTables } = require('./backend')
const METADATA_PREFIX = require('./constants').prefix.metadata
const objects = {
  putObject: function () {
    throw new Error('putObject not available in this environment')
  },
  getObjectByLink: function () {
    throw new Error('getObjectByLink not available in this environment')
  }
}

const port = 4000
const time = String(1499486259331)
const tables = getTables({ models, objects })
// const client = new Client({
//   networkInterface: createNetworkInterface({
//     uri: `http://localhost:${port}/graphql`,
//   })
// })

co(function* () {
  const table = tables['tradle.BasicContactInfo']
  yield ensureTables(pick(tables, 'tradle.BasicContactInfo'))
  yield table.create({
    _t: 'tradle.BasicContactInfo',
    _s: 'somesig',
    [`${METADATA_PREFIX}author`]: 'bill',
    [`${METADATA_PREFIX}time`]: time,
    [`${METADATA_PREFIX}link`]: 'a',
    [`${METADATA_PREFIX}permalink`]: 'b',
    // object: {
      firstName: 'bill',
      lastName: 'preston',
      email: 'bill@ted.io'
    // }
  })
  // }, { overwrite: false })
})().catch(console.error)

const schema = createSchema({ models, tables })

const app = express()
app.use('/graphql', expressGraphQL(req => ({
  schema,
  graphiql: true,
  pretty: true
})))

app.set('port', port)
let server = http.createServer(app)
server.listen(port)
