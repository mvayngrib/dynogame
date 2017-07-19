#!/usr/bin/env

require('isomorphic-fetch')
require('./local-config')

const express = require('express')
const expressGraphQL = require('express-graphql')
const compression = require('compression')
const { createSchema } = require('@tradle/schema-graphql')
const objects = require('./objects')
const models = require('./models')
const { schema } = require('../')({ models, objects })

const port = 4000
const app = express()
// app.use(express.static(__dirname))
app.use(compression({
  // threshold: 0,
  // filter: () => true
}))

app.use('/', expressGraphQL(req => ({
  schema,
  graphiql: true,
  pretty: true
})))

app.listen(port)
