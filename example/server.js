#!/usr/bin/env

require('isomorphic-fetch')
require('./local-config')

const express = require('express')
const expressGraphQL = require('express-graphql')
const compression = require('compression')
const cors = require('cors')
const dynogels = require('dynogels')
const { createSchema } = require('@tradle/schema-graphql')
const objects = require('./objects')
const models = require('./models')
const { schema } = require('../')({ models, objects })

const debug = require('debug')('dynogels')
dynogels.log = {
  info: debug,
  warn: debug,
  level: 'info'
}

const port = 4000
const app = express()
app.use(cors())
// app.use(express.static(__dirname))
app.use(compression())
app.use('/', expressGraphQL(req => ({
  schema,
  graphiql: true,
  pretty: true
})))

app.listen(port)
