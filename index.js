const graphql = require('graphql')
const {
  constants,
  createTables,
  createResolvers
} = require('@tradle/dynamodb')

const { createSchema } = require('@tradle/schema-graphql')

exports = module.exports = function setup ({ models, objects }) {
  const tables = createTables({ models, objects })
  const resolvers = createResolvers({
    objects,
    models,
    tables
  })

  const { schema, schemas } = createSchema({ models, objects, resolvers })
  const executeQuery = (query, variables) => {
    return graphql(schema, query, null, {}, variables)
  }

  return {
    tables,
    resolvers,
    schema,
    schemas,
    executeQuery
  }
}
