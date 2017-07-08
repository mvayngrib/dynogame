const co = require('co').wrap
const debug = require('debug')('tradle:graphql-schema')
const promisify = require('pify')
const {
  graphql,
  GraphQLSchema,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLFloat,
  // GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLList
} = require('graphql')

const GraphQLJSON = require('graphql-type-json')
const GraphQLDate = require('graphql-date')
const {
  isEmailProperty,
  isInlinedProperty,
  getInstantiableModels,
  isInstantiable,
  getRequiredProperties,
  getProperties,
  getRef
} = require('./utils')

const IDENTITY_FN = arg => arg
const getTypeName = name => (name.id || name).replace(/[^a-zA-Z-_0-9]/g, '_')
const METADATA_PREFIX = '_'
const prefixMetadataProp = prop => METADATA_PREFIX + prop
const getGetterFieldName = type => `get_${getTypeName(type)}`
const getListerFieldName = type => `list_${getTypeName(type)}`
const AUTHOR_TYPE = {
  type: new GraphQLNonNull(GraphQLString)
}

const AUTHOR_PROP = prefixMetadataProp('author')
const TIME_PROP = prefixMetadataProp('time')

module.exports = {
  createSchema
}

function createSchema ({ tables, objects, models }) {
  // if (!tables) {
  //   tables = inMemoryTables(models)
  // }

  const TYPES = {}
  const LIST_TYPES = {}

  /**
   * This is the type that will be the root of our query,
   * and the entry point into our schema.
   */
  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: function () {
      const fields = {}
      getInstantiableModels(models).forEach(id => {
        const model = models[id]
        const { type, list } = getOrCreate({ model })
        fields[getGetterFieldName(id)] = {
          type,
          args: {
            [AUTHOR_PROP]: AUTHOR_TYPE,
            [TIME_PROP]: {
              type: GraphQLDate
            }
          }
        }

        fields[getListerFieldName(id)] = {
          type: list,
          args: {
            [AUTHOR_PROP]: AUTHOR_TYPE
          },
          resolve: createLister({ model })
        }
      })

      return fields
    }
  })

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: Object.keys(models).reduce((fields, id) => {
      const model = models[id]
      fields[id] = createMutationType({ model })
      return fields
    }, {})
  })

  function createMutationType ({ model }) {
    const required = getRequiredProperties(model)
    const { properties } = model
    const propertyNames = getProperties(model)
    const { id } = model
    const { type, list } = getOrCreate({ model })
    return {
      type: list,
      description: `Add a ${id}`,
      args: propertyNames.reduce((propMutations, propertyName) => {
        const property = properties[propertyName]
        propMutations[propertyName] = createMutationProperty({
          propertyName,
          property,
          model,
          required
        })

        return propMutations
      }, {}),
      resolve: createMutater({ model })
    }
  }

  function createMutationProperty ({ propertyName, property, model, required }) {
    return {
      name: getTypeName(propertyName),
      type: getPropertyType({ propertyName, property, model }),
      resolve: function () {
        throw new Error('implement me')
      }
    }
  }

  function createMutater ({ model }) {
    return (root, props) => {
      debugger
      return tables[model.id].update(props)
    }
  }

  function createGetter ({ model }) {
    return co(function* ({ author, time }) {

    })
  }

  function createLister ({ model }) {
    const { id } = model
    return co(function* ({ author }) {
      const query = tables[id].query(author)
      const results = yield promisify(query.exec.bind(query))()
      if (!results.length) return results

      const required = getRequiredProperties(model)
      const first = results[0]
      const missing = required.filter(prop => !(prop in first))
      if (!missing.length) return results

      debug(`missing properties: ${missing.join(', ')}`)

      // for now
      return results
    })
  }

  function getOrCreate ({ model }) {
    const { id } = model
    if (!TYPES[id]) {
      TYPES[id] = createType({ model })
      LIST_TYPES[id] = new GraphQLList(TYPES[id])
    }

    return {
      type: TYPES[id],
      list: LIST_TYPES[id]
    }
  }

  function sanitizeEnumValueName (id) {
    return id.replace(/[^_a-zA-Z0-9]/g, '_')
  }

  function createEnumType ({ model }) {
    const values = {}
    for (const value of model.enum) {
      const { id, title } = value
      values[sanitizeEnumValueName(id)] = {
        value: id,
        description: title
      }
    }

    return new GraphQLEnumType({
      name: getTypeName(model),
      description: model.description,
      values
    })
  }

  function createType ({ model }) {
    if (model.subClassOf === 'tradle.Enum') {
      if (model.enum) {
        return createEnumType({ model })
      }

      debug(`bad enum: ${model.id}`)
    }

    const required = getRequiredProperties(model)
    const { properties } = model
    const propertyNames = getProperties(model)
    const fields = {}
    propertyNames.forEach(propertyName => {
      fields.__defineGetter__(propertyName, () => createProperty({
        propertyName,
        property: properties[propertyName],
        model,
        required
      }))
    })

    return new GraphQLObjectType({
      name: getTypeName(model),
      fields
    })
  }

  function createProperty ({
    propertyName,
    property,
    model,
    required
  }) {
    const { description } = property
    const type = getPropertyType({
      propertyName,
      property,
      model,
      isRequired: required.indexOf(propertyName) !== -1
    })

    return {
      type,
      description
    }
  }

  function isNullableProperty (property) {
    const { type } = property
    return type !== 'object' && type !== 'array' && type !== 'enum'
  }

  function getPropertyType ({ propertyName, property, model, isRequired }) {
    const PropType = _getPropertyType({ propertyName, property, model })
    return isRequired || !isNullableProperty(property)
      ? PropType
      : new GraphQLNonNull(PropType)
  }

  function _getPropertyType ({ propertyName, property, model }) {
    const { type } = property
    const ref = getRef(property)
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
      case 'array':
        if (isInlinedProperty({ property, model, models })) {
          debug(`TODO: schema for inlined property ${model.id}.${propertyName}`)
          return GraphQLJSON
        }

        const isArray = type === 'array'
        const range = models[ref]
        if (!range || !isInstantiable(range)) {
          debug(`not sure how to handle property with range ${ref}`)
          return GraphQLJSON
          // return isArray ? new GraphQLList(GraphQLObjectType) : GraphQLObjectType
        }

        const RangeType = getOrCreate({ model: range })
        return isArray ? RangeType.list : RangeType.type

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
      // case 'array':
      //   if (isInlinedProperty({ property, model, models })) {
      //     debug(`TODO: schema for inlined property ${model.id}.${propertyName}`)
      //     // debug(`${propertyName}, ${JSON.stringify(property, null, 2)}`)
      //     // throw new Error('implement me!')
      //     return GraphQLJSON
      //   }

      //   return getOrCreate({ model: models[ref] }).list

        // return {
        //   type: GraphQLObjectType,
        //   resolve: (root, { })
        // }
      default:
        debug(`unexpected property type: ${type}`)
        return GraphQLJSON
        // throw new Error(`unexpected property type: ${type}`)
    }
  }

  return new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
    types: getValues(TYPES)
  })
}

function getValues (obj) {
  return Object.keys(obj).map(key => obj[key])
}
