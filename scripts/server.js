#!/usr/bin/env

require('isomorphic-fetch')
require('./helpers/local-config')

const http = require('http')
const co = require('co').wrap
const pick = require('object.pick')
const express = require('express')
const expressGraphQL = require('express-graphql')
const { createSchema } = require('../schemas')
const Backend = require('../backend')
// const createResolvers = require('../resolvers')
const objects = require('./helpers/objects')
const port = 4000
const time = String(1499486259331)
const models = require('./helpers/models')
const backend = require('./helpers/backend')({ models, objects })
const { tables, resolvers } = backend
const { schema, schemas } = createSchema({
  resolvers,
  models,
  tables
})

const app = express()
const GRAPHQL_PATH = '/'
app.use(GRAPHQL_PATH, expressGraphQL(req => ({
  schema,
  graphiql: true,
  pretty: true
})))

app.set('port', port)
let server = http.createServer(app)
server.listen(port)

// const createClient = require('../client')
const gql = require('graphql-tag')
const { ApolloClient, createNetworkInterface } = require('apollo-client')
const client = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: `http://localhost:${port}${GRAPHQL_PATH}`
  })
})

// function runQuery (query)  {
//   client.query({
//     query: gql(`query)
//   })
// }

// setTimeout(function () {
//   client.query({
//       query: gql(`
//         query {
//           rl_tradle_PhotoID {
//             _link,
//             scan {
//               url
//             }
//           }
//         }
//       `),
//     })
//     .then(data => console.log(prettify(data)))
//     .catch(error => console.error(error));
// }, 1000)

// function prettify (obj) {
//   return JSON.stringify(obj, null, 2)
// }
