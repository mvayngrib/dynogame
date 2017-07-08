const debug = require('debug')('tradle:graphql-schema')
const promisify = require('pify')
const {
  graphql,
  GraphQLSchema,
  GraphQLBoolean,
  // GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLList
} = require('graphql')

const GraphQLDate = require('graphql-date')
const {
  isEmailProperty,
  isInlinedProperty,
  getRequiredProperties
} = require('./utils')

const IDENTITY_FN = arg => arg

module.exports = {
  toGraphQLSchema,
  schema,
  Schemer
}

function createSchema ({ tables, objects, models }) {
  const TYPES = {}
  const LIST_TYPES = {}
  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: function () {
      const fields = {}
      Object.keys(models).forEach(id => {
        const model = models[id]
        const { type, list } = getOrCreate({ model })
        fields[id] = {
          type: list,
          resolve: createResolver({ model })
        }
      })

      return fields
    }
  })

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: Object.keys(models).reduce((fields, id) => {
      const model = models[id]
      const required = getRequiredProperties(model)
      const { properties } = model
      const { type, list } = getOrCreate({ model })
      fields[id] = {
        type: list,
        description: `Add a ${id}`,
        args: Object.keys(properties).reduce((properties, propertyName) => {
          const prop = toMutationProperty({
            propertyName,
            property: properties[propertyName],
            model,
            required
          })

          return properties
        }, {})
        resolve: (root, props) => {
          return tables[id].update(props)
        }
      }

      return fields
    }, {})
  })

  function toMutationProperty ({ propertyName, property, model, required }) {
    return {
      name: propertyName,
      type: new GraphQLNonNull(GraphQLString)
    }
  }

  function createResolver ({ model }) {
    return co(function* () {
      const { id } = model
      const scan = tables[id].scan()
      const results = yield promisify(scan.exec.bind(scan))()
      if (!results.length) return results

      const required = getRequiredProperties(model)
      const first = results[0]
      const allGood = required.every(prop => prop in first)
      if (allGood) return results

      // for now
      return results
    })
  }

  function getOrCreate ({ model }) {
    const { id } = model
    if (!TYPES[id]) {
      TYPES[id] = toGraphQLSchema({ model, models, tables })
      LIST_TYPES = new GraphQLList(TYPES[id])
    }

    return {
      type: TYPES[id],
      list: LIST_TYPES[id]
    }
  }

  function toGraphQLSchema ({ model, object }) {
    const { properties } = model
    const fields = {}
    for (let propertyName in properties) {
      fields[propertyName] = toGraphQLProp({
        propertyName,
        property: properties[propertyName],
        model
      })
    }

    return new GraphQLObjectType({
      name: model.id,
      fields
    })
  }

  function toGraphQLProp ({
    propertyName,
    property,
    model,
    required
  }) {
    const { type, ref, description } = property
    const isRequired = required.indexOf(propertyName) !== -1
    let type = wrapType(getPropertyType({
      propertyName,
      property,
      model
    }))

    if (isRequired) {
      type = new GraphQLNonNull(type)
    }

    return {
      type,
      description
    }
  }

  function getPropertyType ({ propertyName, property, model }) {
    switch (type) {
      case 'string':
        return GraphQLString
      case 'boolean':
        return GraphQLBoolean
      case 'number':
        return GraphQLFloat
      case 'date':
        return GraphQLDate
      case 'object':
        if (isInlinedProperty({ property, model, models })) {
          debug(`TODO: schema for inlined property ${model.id}.${propertyName}`)
          return GraphQLObjectType
        }

        return getOrCreate({ model: models[ref] }).type

        // if (models[ref].subClassOf === 'tradle.Enum') {
        //   return {
        //     type: getOrCreate({ model: models[ref] })
        //     // type: GraphQLEnumType
        //   }
        // }

        // return {
        //   type: GraphQLObjectType,
        //   resolve: (root, { link }) => {
        //     return objects.getObjectByLink(link)
        //   }
        // }
      case 'array':
        if (isInlinedProperty({ property, model, models })) {
          throw new Error('implement me!')
        }

        return getOrCreate({ model: models[ref] })

        // return {
        //   type: GraphQLObjectType,
        //   resolve: (root, { })
        // }
    }
  }

  return new GraphQLSchema({
    query: QueryType,
    mutation: MutationType
  })
}

/**
 * This is the type that will be the root of our query,
 * and the entry point into our schema.
 */
// const QueryType = new GraphQLObjectType({
//   name: 'Query',
//   fields: () => ({
//     // Add your own root fields here
//     viewer: {
//       type: UserType,
//       resolve: (_, _args, context) => db.getViewer({}, context),
//     },
//   }),
// });
