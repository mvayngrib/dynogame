const graphql = require('graphql')
const tradleDynamo = require('@tradle/dynamodb')
const { createSchema } = require('@tradle/schema-graphql')

exports = module.exports = function setup ({ models, objects }) {
  const db = tradleDynamo.db({ models, objects })
  const resolvers = tradleDynamo.createResolvers({
    objects,
    models,
    db
  })

  const { schema, schemas } = createSchema({ models, objects, resolvers })
  const executeQuery = (query, variables) => {
    return graphql(schema, query, null, {}, variables)
  }

  return {
    tables: db.tables,
    resolvers,
    schema,
    schemas,
    executeQuery
  }
}
