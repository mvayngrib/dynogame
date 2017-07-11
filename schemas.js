const debug = require('debug')('tradle:graphql-schema')
const {
  GraphQLSchema,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLList,
  GraphQLInterfaceType
} = require('graphql/type')

const GraphQLJSON = require('graphql-type-json')
// const validateResource = require('@tradle/validate-resource')
const ResourceStubType = require('./types/resource-stub')
// const GraphQLDate = require('graphql-date')
const {
  GraphQLDate,
  // GraphQLTime,
  // GraphQLDateTime
} = require('graphql-iso-date')

const {
  isResourceStub,
  isInlinedProperty,
  fromResourceStub,
  getInstantiableModels,
  isInstantiable,
  getRequiredProperties,
  getOnCreateProperties,
  getProperties,
  getRef,
  cachify,
  toNonNull,
  getValues,
  shallowClone,
  extend,
  pick,
  co
} = require('./utils')

const constants = require('./constants')
const { TYPE } = constants
const StringWrapper = { type: GraphQLString }
const TimestampType = require('./types/timestamp')
const Prefixer = require('./prefixer')
const metadataTypes = Prefixer.metadata({
  id: StringWrapper,
  title: StringWrapper,
  link: StringWrapper,
  permalink: StringWrapper,
  author: StringWrapper,
  time: { type: TimestampType }
})

const IDENTITY_FN = arg => arg
const getTypeName = name => (name.id || name).replace(/[^a-zA-Z-_0-9]/g, '_')
const getGetterFieldName = type => `r_${getTypeName(type)}`
const getListerFieldName = type => `rl_${getTypeName(type)}`
const getCreaterFieldName = type => `c_${getTypeName(type)}`
const getUpdaterFieldName = type => `u_${getTypeName(type)}`
const getDeleterFieldName = type => `d_${getTypeName(type)}`
const PRIMARY_KEY_PROPS = constants.primaryKeyProperties

module.exports = {
  createSchema
}

function createSchema ({ resolvers, objects, models }) {
  const TYPES = {}
  const metadataArgs = toNonNull(metadataTypes)
  const primaryKeyArgs = toNonNull(pick(metadataTypes, PRIMARY_KEY_PROPS))

  function createMutationType ({ model }) {
    const required = getRequiredProperties(model)
    const { properties } = model
    const propertyNames = getOnCreateProperties({ model, models })
    const { id } = model
    const type = getType({ model })
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
      description: `Add a ${id}`,
      args,
      resolve: getMutater({ model })
    }
  }

  function createMutationProperty ({ propertyName, property, model, required }) {
    const { type } = getFieldType({
      propertyName,
      property,
      model,
      isInput: true,
      isRequired: required.indexOf(propertyName) !== -1
    })

    return {
      name: getTypeName(propertyName),
      description: property.description,
      type,
      // resolve: getMutater({ model })
      // resolve: function () {
      //   throw new Error('implement me')
      // }
    }
  }

  function validateMutation ({ model, props }) {
    // TODO: strip metadata props, then validate
    // return validateResource({
    //   models,
    //   resource: props
    // })
  }

  const getMutater = cachifyByModel(function ({ model }) {
    return co(function* (root, props) {
      validateMutation({ model, props })
      return resolvers.update({ model, props })
    })
  })

  const getGetter = cachifyByModel(function ({ model }) {
    return co(function* (root, props) {
      if (isResourceStub(props)) {
        return getByStub({ model, stub: props })
      }

      return getByPrimaryKey({ model, props })
    })
  }, TYPES)

  function getByStub ({ model, stub }) {
    return getByPrimaryKey({
      model,
      props: Prefixer.metadata(fromResourceStub(stub))
    })
  }

  const getByPrimaryKey = co(function* ({ model, key, props }) {
    if (!key) key = getPrimaryKeyProps(props)

    // TODO: add ProjectionExpression with attributes to fetch
    return resolvers.get({ model, key })
  })

  const getBacklinkResolver = cachifyByModel(function ({ model }) {
    return function (source, args, context, info) {
      const type = source[TYPE]
      const { fieldName } = info
      const { backlink } = models[type].properties[fieldName].items
      return resolvers.list({
        model,
        source,
        args: {
          [backlink]: source[Prefixer.metadata('link')]
        }
      })
    }
  })

  const getLinkResolver = cachifyByModel(function ({ model }) {
    return function (source, args, context, info) {
      const { fieldName } = info
      const stub = source[fieldName]
      return getByStub({ model, stub })
    }
  })

  const getLister = cachifyByModel(function ({ model }) {
    return function (source, args, context, info) {
      return resolvers.list({ model, source, args, context, info })
    }
  })

  function getPrimaryKeyProps (props) {
    return pick(props, PRIMARY_KEY_PROPS)
  }

  // function sanitizeEnumValueName (id) {
  //   return id.replace(/[^_a-zA-Z0-9]/g, '_')
  // }

  function createEnumType ({ model }) {
    return new GraphQLObjectType({
      name: getTypeName(model),
      description: model.description,
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLString)
        },
        title: StringWrapper
      }
    })

    // TODO: uncomment after enums are refactored
    // to be more like enums and less like resources

    // const values = {}
    // for (const value of model.enum) {
    //   const { id, title } = value
    //   values[sanitizeEnumValueName(id)] = {
    //     value: id,
    //     description: title
    //   }
    // }

    // return new GraphQLEnumType({
    //   name: getTypeName(model),
    //   description: model.description,
    //   values
    // })
  }

  function isBadEnumModel (model) {
    return model.subClassOf === 'tradle.Enum' && !Array.isArray(model.enum)
  }

  function isGoodEnumModel (model) {
    return model.subClassOf === 'tradle.Enum' && Array.isArray(model.enum)
  }

  // const getMetadataWrappedType = cachifyByModel(function ({ model }) {
  //   if (isGoodEnumModel(model)) {
  //     return getType({ model })
  //   }

  //   return new GraphQLObjectType({
  //     name: getTypeName(model),
  //     description: model.description,
  //     fields: () => extend({
  //       object: {
  //         type: getType({ model }),
  //         // description: model.description,
  //         // resolve: function (source) {
  //         //   return source.object
  //         // }
  //       }
  //     }, metadataTypes)
  //   })
  // })

  const getType = cachifyByModel(function ({ model }) {
    if (isGoodEnumModel(model)) {
      return createEnumType({ model })
    }

    if (isBadEnumModel(model)) {
      debug(`bad enum: ${model.id}`)
      return GraphQLJSON
    }

    const required = getRequiredProperties(model)
    const { properties } = model
    const propertyNames = getProperties(model)
    return new GraphQLObjectType({
      name: '_' + getTypeName(model),
      description: model.description,
      fields: () => {
        const fields = shallowClone(metadataTypes)
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
  })

  const getMetadataWrappedType = getType

  function createField ({
    propertyName,
    property,
    model,
    required
  }) {
    const { description } = property
    const { type, resolve } = getFieldType({
      propertyName,
      property,
      model,
      isRequired: required.indexOf(propertyName) !== -1
    })

    const field = { type }
    if (resolve) field.resolve = resolve
    if (description) field.description = description

    return field
  }

  function isNullableProperty (property) {
    const { type } = property
    return type !== 'object' && type !== 'array' && type !== 'enum'
  }

  function getFieldType (propertyInfo) {
    const { property, isRequired } = propertyInfo
    let { type, resolve } = _getFieldType(propertyInfo)
    if (isRequired || !isNullableProperty(property)) {
      type = new GraphQLNonNull(type)
    }

    return { type, resolve }
  }

  function _getFieldType ({ propertyName, property, model, isRequired, isInput }) {
    const { type } = property
    switch (type) {
      case 'string':
        return StringWrapper
      case 'boolean':
        return { type: GraphQLBoolean }
      case 'number':
        return { type: GraphQLFloat }
      case 'date':
        return { type: GraphQLDate }
      case 'object':
      case 'array':
        return getRefType({
          model,
          propertyName,
          property,
          isInput
        })
      case 'enum':
        debug(`unexpected property type: ${type}`)
        return { type: GraphQLJSON }
      default:
        // debug(`unexpected property type: ${type}`)
        // return GraphQLJSON
        throw new Error(`unexpected property type: ${type}`)
    }
  }

  /**
   * This is the type that will be the root of our query,
   * and the entry point into our schema.
   */
  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: () => {
      const fields = {}
      getInstantiableModels(models).forEach(id => {
        const model = models[id]
        const type = getMetadataWrappedType({ model })
        fields[getListerFieldName(id)] = {
          type: new GraphQLList(type),
          args: extend({
            // TODO:
            // extend with props from model
          }, metadataTypes), // nullable metadata
          resolve: getLister({ model })
        }

        fields[getGetterFieldName(id)] = {
          type,
          args: primaryKeyArgs,
          resolve: getGetter({ model })
        }
      })

      return fields
    }
  })

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: () => {
      const fields = {}
      Object.keys(models).forEach(id => {
        const model = models[id]
        fields[getCreaterFieldName(id)] = createMutationType({ model })
        return fields
      })

      return fields
    }
  })

  const schemas = {}
  Object.keys(models).forEach(id => {
    // lazy
    schemas.__defineGetter__(id, () => {
      return getType({ model: models[id] })
    })
  })

  function getRefType ({ propertyName, property, model, isInput }) {
    let { type, resolve } = _getRefType(arguments[0])
    if (property.type === 'array') {
      type = new GraphQLList(type)
    }

    return { type, resolve }
  }

  function _getRefType ({ propertyName, property, model, isInput }) {
    const ref = getRef(property)
    const range = models[ref]
    // if (isInlinedProperty({ property, model, models })) {
    //   debug(`TODO: schema for inlined property ${model.id}.${propertyName}`)
    //   if (ref) {
    //     if (isInput) {
    //       return { type: ResourceStubType.input }
    //     }

    //     return {
    //       type: getMetadataWrappedType({ model: range })
    //     }
    //   }

    //   return { type: GraphQLJSON }
    // }

    if (!range || isBadEnumModel(range)) {
      return { type: GraphQLJSON }
    }

    if (isInput) {
      return { type: ResourceStubType.input }
    }

    if (isGoodEnumModel(range)) {
      return { type: ResourceStubType.output }
    }

    // e.g. interface or abstract class
    if (!isInstantiable(range)) {
      debug(`not sure how to handle property with range ${ref}`)
      // return {
      //   type: getMetadataWrappedType({ model: range }),
      //   // resolve: IDENTITY_FN
      // }
      return { type: GraphQLJSON }
    }

    const ret = {
      type: getMetadataWrappedType({ model: range }),
    }

    if (isInlinedProperty({ models, property })) {
      return ret
    }

    if (property.type === 'array') {
      ret.resolve = getBacklinkResolver({ model: range })
    } else {
      ret.resolve = getLinkResolver({ model: range })
    }

    return ret
  }

  const InterfaceType = new GraphQLInterfaceType({
    name: 'Interface',
    fields: () => extend({
      object: IDENTITY_FN
    }, metadataTypes),
    resolveType: function () {
      debugger
    }
  });

  return {
    schema: new GraphQLSchema({
      query: QueryType,
      mutation: MutationType,
      types: getValues(TYPES)
    }),
    schemas
  }
}

function cachifyByModel (fn, cache={}) {
  return cachify(fn, ({ model }) => model.id, cache)
}
