#!/usr/bin/env

require('isomorphic-fetch')
require('./helpers/local-config')

const express = require('express')
const expressGraphQL = require('express-graphql')
const { createSchema } = require('../schemas')
const objects = require('./helpers/objects')
const models = require('./helpers/models')
const { schema } = require('../')({ models, objects })

const port = 4000
const app = express()
app.use('/', expressGraphQL(req => ({
  schema,
  graphiql: true,
  pretty: true
})))

app.listen(port)
