const debug = require('debug')('tradle:graphql-schema')
const {
  graphql,
  GraphQLSchema,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLFloat,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLList,
  GraphQLInputObjectType
} = require('graphql')

const GraphQLJSON = require('graphql-type-json')
const TimestampType = require('./timestamp')
// const GraphQLDate = require('graphql-date')
const {
  GraphQLDate,
  // GraphQLTime,
  // GraphQLDateTime
} = require('graphql-iso-date')

const {
  withProtocolProps,
  isEmailProperty,
  isInlinedProperty,
  getInstantiableModels,
  isInstantiable,
  getRequiredProperties,
  getMutationProperties,
  getProperties,
  getRef,
  cachify,
  mapObject,
  toNonNull,
  getValues,
  clone,
  shallowClone,
  extend,
  deepEqual,
  pick,
  co
} = require('./utils')

const constants = require('./constants')
const { hashKey, rangeKey, indexes, metadata } = constants
const METADATA_PREFIX = constants.prefix.metadata
const IDENTITY_FN = arg => arg
const getTypeName = name => (name.id || name).replace(/[^a-zA-Z-_0-9]/g, '_')
const prefixMetadataProp = prop => METADATA_PREFIX + prop
// const prefixMetadataProps = obj => Object.keys(obj).reduce((prefixed, prop) => {
//   prefixed[prefixMetadataProp(prop)] = obj[prop]
//   return prefixed
// }, {})

const getGetterFieldName = type => `r_${getTypeName(type)}`
const getListerFieldName = type => `rl_${getTypeName(type)}`
const getCreaterFieldName = type => `c_${getTypeName(type)}`
const getUpdaterFieldName = type => `u_${getTypeName(type)}`
const getDeleterFieldName = type => `d_${getTypeName(type)}`
const PRIMARY_KEY_PROPS = constants.primaryKeyProperties

module.exports = {
  createSchema
}

function createSchema ({ tables, objects, models }) {
  const TYPES = {}
  const LIST_TYPES = {}
  const metadataArgs = toNonNull(metadata.types)
  const primaryKeyArgs = toNonNull(pick(metadata.types, PRIMARY_KEY_PROPS))

  function createMutationType ({ model }) {
    const required = getRequiredProperties(model)
    const { properties } = model
    const propertyNames = getMutationProperties({ model, models })
    const { id } = model
    const { type, list } = getOrCreateType({ model })
    const args = shallowClone(metadataArgs)
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
      type,
      // type: list,
      description: `Add a ${id}`,
      args,
      resolve: createMutater({ model })
    }
  }

  function createMutationProperty ({ propertyName, property, model, required }) {
    return {
      name: getTypeName(propertyName),
      type: getFieldType({
        propertyName,
        property,
        model,
        isInput: true,
        isRequired: required.indexOf(propertyName) !== -1
      }),
      resolve: function () {
        throw new Error('implement me')
      }
    }
  }

  function validateMutation ({ model, props }) {}

  function createMutater ({ model }) {
    return co(function* (root, props) {
      validateMutation({ model, props })
      const result = yield tables[model.id].update(props)
      return resultsToJson(result)
    })
  }

  const getOrCreateGetter = cachify(function ({ model }) {
    return co(function* getter (root, props) {
      const key = getPrimaryKeyProps(props)
      // TODO: add ProjectionExpression with attributes to fetch
      const result = yield tables[model.id].get(key)
      return result.toJSON()
    })
  }, ({ model }) => model.id)

  function getQueryBy (props) {
    if (hashKey in props) {
      return {
        value: props[hashKey],
        // rangeKey: props[rangeKey]
      }
    }

    const index = indexes.find(({ hashKey }) => hashKey in props)
    if (index) {
      return {
        index: index.name,
        value: props[index.hashKey],
        // rangeKey: props[index.rangeKey]
      }
    }
  }

  const runQuery = co(function* ({ model, key, props }) {
    let query = tables[model.id].query(key.value)
    if (key.index) {
      query = query.usingIndex(key.index)
    }

    const { Count, Items } = yield query.exec()
    return filterResults(Items, props)
  })

  function filterResults (results, props) {
    results = resultsToJson(results)
    const matchBy = Object.keys(props)
    if (!matchBy.length) return results

    return results.filter(result => {
      return deepEqual(pick(result, matchBy), props)
    })
  }

  const runSearch = co(function* ({ model, props }) {
    debug('scanning based on arbitrary attributes is not yet implemented')
    // maybe check if query is possible, then filter the results
    // otherwise scan
    // throw new Error('implement scanning')
    debug('TODO: implement more efficient scanning')
    const { Count, Items } = yield tables[model.id].scan().exec()
    return filterResults(Items, props)
  })

  const getOrCreateLister = cachify(function ({ model }) {
    return co(function* (root, props) {
      const primaryKey = getQueryBy(props)
      let results
      if (primaryKey) {
        results = yield runQuery({ model, key: primaryKey, props })
      } else {
        results = yield runSearch({ model, props })
      }

      if (!results.length) return []

      const required = getRequiredProperties(model)
      const first = results[0]
      const missing = required.filter(prop => !(prop in first))
      if (missing.length) {
        debug(`missing properties: ${missing.join(', ')}`)
      }

      // for now
      return results
    })
  }, ({ model }) => model.id)

  function resultsToJson (items) {
    if (Array.isArray(items)) {
      return items.map(item => {
        return item.toJSON ? item.toJSON() : item
      })
    }

    return items.toJSON ? items.toJSON() : items
  }

  function getPrimaryKeyProps (props) {
    return pick(props, PRIMARY_KEY_PROPS)
  }

  const getOrCreateType = cachify(function ({ model }) {
    const { id } = model
    const type = createType({ model })
    const list = new GraphQLList(type)
    return { type, list }
  }, ({ model }) => model.id)

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
        const fields = shallowClone(metadata.types)
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

  function getObjectType ({ input }) {
    return GraphQLJSON
    // return input ? GraphQLInputObjectType : GraphQLJSON
  }

  function getFieldType ({ propertyName, property, model, isRequired, isInput }) {
    const PropType = _getFieldType({ propertyName, property, model, isInput })
    return isRequired || !isNullableProperty(property)
      ? new GraphQLNonNull(PropType)
      : PropType
  }

  function _getFieldType ({ propertyName, property, model, isInput }) {
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
          return getObjectType({ input: isInput })
        }

        const isArray = type === 'array'
        const range = models[ref]
        if (!range || !isInstantiable(range)) {
          debug(`not sure how to handle property with range ${ref}`)
          return getObjectType({ input: isInput })
          // return isArray ? new GraphQLList(GraphQLObjectType) : GraphQLObjectType
        }

        const RangeType = getOrCreateType({ model: range })
        return isArray ? RangeType.list : RangeType.type
      case 'enum':
        debug(`unexpected property type: ${type}`)
        return getObjectType({ input: isInput })
      default:
        // debug(`unexpected property type: ${type}`)
        // return getObjectType({ input: isInput })
        throw new Error(`unexpected property type: ${type}`)
    }
  }

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
        const { type, list } = getOrCreateType({ model })
        fields[getListerFieldName(id)] = {
          type: list,
          args: extend({
            // TODO:
            // extend with props from model
          }, metadata.types), // nullable metadata
          resolve: getOrCreateLister({ model })
        }

        fields[getGetterFieldName(id)] = {
          type,
          args: primaryKeyArgs,
          resolve: getOrCreateGetter({ model })
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
        fields[getCreaterFieldName(id)] = createMutationType({ model })
        return fields
      })

      return fields
    }
  })

  return new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
    types: getValues(TYPES)
  })
}
