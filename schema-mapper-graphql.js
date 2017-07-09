const co = require('co').wrap
const debug = require('debug')('tradle:graphql-schema')
const promisify = require('pify')
const deepEqual = require('deep-equal')
const {
  graphql,
  GraphQLSchema,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLFloat,
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
const AUTHOR_PROP = prefixMetadataProp('author')
const TIME_PROP = prefixMetadataProp('time')
const AUTHOR_TYPE = { type: GraphQLString }
const AUTHOR_TYPE_REQUIRED = { type: new GraphQLNonNull(AUTHOR_TYPE.type) }
const TIME_TYPE = { type: GraphQLDate }
const TIME_TYPE_REQUIRED = { type: new GraphQLNonNull(TIME_TYPE.type) }

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
        fields[getListerFieldName(id)] = {
          type: list,
          args: {
            [AUTHOR_PROP]: AUTHOR_TYPE,
            [TIME_PROP]: TIME_TYPE
            // TODO:
            // extend with props from model
          },
          resolve: createLister({ model })
        }

        fields[getGetterFieldName(id)] = {
          type,
          args: {
            [AUTHOR_PROP]: AUTHOR_TYPE_REQUIRED,
            [TIME_PROP]: TIME_TYPE_REQUIRED
          },
          resolve: createGetter({ model })
        }
      })

      return fields
    }
  })

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: function () {
      const fields = {}
      Object.keys(models).forEach(id => {
        const model = models[id]
        fields[getTypeName(id)] = createMutationType({ model })
        return fields
      })

      return fields
    }
  })

  function createMutationType ({ model }) {
    const required = getRequiredProperties(model)
    const { properties } = model
    const propertyNames = getProperties(model)
    const { id } = model
    const { type, list } = getOrCreate({ model })
    const args = {}
    propertyNames.forEach(propertyName => {
      const property = properties[propertyName]
      args[propertyName] = createMutationProperty({
        propertyName,
        property,
        model,
        required
      })

      return args
    })

    return {
      type: list,
      description: `Add a ${id}`,
      args,
      resolve: createMutater({ model })
    }
  }

  function createMutationProperty ({ propertyName, property, model, required }) {
    return {
      name: getTypeName(propertyName),
      type: getFieldType({ propertyName, property, model }),
      resolve: function () {
        throw new Error('implement me')
      }
    }
  }

  function createMutater ({ model }) {
    return function (root, props) {
      debugger
      return tables[model.id].update(props)
    }
  }

  function createGetter ({ model }) {
    return function getter (root, props) {
      return tables[model.id].get(getPrimaryKey(props))
    }
  }

  function listByPrimaryKeys (model, { author }) {
    return tables[id].query(author).exec()
  }

  function search (model, props) {
    debug('scanning based on arbitrary attributes is not yet implemented')
    // maybe check if query is possible, then filter the results
    // otherwise scan
    throw new Error('implement scanning')
  }

  function createLister ({ model }) {
    const { id } = model
    return co(function* (root, props) {
      const primaryKey = getPrimaryKey(props)
      let results
      if (deepEqual(primaryKey, props)) {
        results = yield listByPrimaryKeys(model, props)
      } else {
        results = yield search(model, props)
      }

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

  function getPrimaryKey (props) {
    return {
      time: props[TIME_PROP],
      author: props[AUTHOR_PROP]
    }
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
    return new GraphQLObjectType({
      name: getTypeName(model),
      fields: function () {
        const fields = {
          [AUTHOR_PROP]: AUTHOR_TYPE,
          [TIME_PROP]: TIME_TYPE,
        }

        propertyNames.forEach(propertyName => {
          let field
          const property = properties[propertyName]
          Object.defineProperty(fields, propertyName, {
            enumerable: true,
            // lazy, because of circular references
            get: () => {
              if (!field) {
                field = createField({
                  propertyName,
                  property,
                  model,
                  required
                })
              }

              return field
            }
          })
        })

        return fields
      }
    })
  }

  function createField ({
    propertyName,
    property,
    model,
    required
  }) {
    const { description } = property
    const type = getFieldType({
      propertyName,
      property,
      model,
      isRequired: required.indexOf(propertyName) !== -1
    })

    const field = { type }
    if (description) field.description = description

    return field
  }

  function isNullableProperty (property) {
    const { type } = property
    return type !== 'object' && type !== 'array' && type !== 'enum'
  }

  function getFieldType ({ propertyName, property, model, isRequired }) {
    const PropType = _getFieldType({ propertyName, property, model })
    return isRequired || !isNullableProperty(property)
      ? PropType
      : new GraphQLNonNull(PropType)
  }

  function _getFieldType ({ propertyName, property, model }) {
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
