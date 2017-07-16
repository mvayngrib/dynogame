#!/usr/bin/env node

const { printSchema } = require('graphql')

const { createSchema } = require('../schemas')
const models = require('../example/helpers/models')
const backend = require('../example/helpers/backend')({ models })
const { tables, resolvers } = backend
const { schema, schemas } = createSchema({
  resolvers,
  models,
  tables
})

process.stdout.write(printSchema(schema))
