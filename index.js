
const Backend = require('./backend')
const { createSchema } = require('./schemas')

module.exports = function createGoodies ({ models, objects }) {
  const { tables, resolvers } = new Backend({
    hashKey: '_link',
    prefix: {
      metadata: 'm',
      data: 'd'
    },
    models,
    objects
  })

  const { schema, schemas } = createSchema({
    resolvers,
    models,
    tables
  })

  return {
    tables,
    schema,
    schemas
  }
}
