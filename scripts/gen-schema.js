#!/usr/bin/env node

const { printSchema } = require('graphql')

const { createSchema } = require('../schemas')
const objects = require('./helpers/objects')
const models = require('./helpers/models')
const backend = require('./helpers/backend')({ models, objects })
const { tables, resolvers } = backend
const { schema, schemas } = createSchema({
  resolvers,
  models,
  tables
})

process.stdout.write(printSchema(schema))
