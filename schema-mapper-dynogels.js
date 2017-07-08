const co = require('co').wrap
const Joi = require('joi')
const clone = require('xtend')
const extend = require('xtend/mutable')
const pick = require('object.pick')
const promisify = require('pify')
const dynogels = require('dynogels')
const { isEmailProperty, isInlinedProperty } = require('./utils')
// const METADATA_PREFIX = 'm'
// const DATA_PREFIX = 'd'
const METADATA_PREFIX = '_'
// don't prefix for now, disallow _ as first character in model props
const DATA_PREFIX = ''

module.exports = {
  toDynogelsSchema,
  toDynogelsObject,
  fromDynogelsObject,
  getTableName,
  // getKey,
  defineTable
}

// function getKey (resource) {
//   return {
//     prefixProp('time', METADATA_PREFIX),
//     prefixProp('author', METADATA_PREFIX)
//   }
// }

function fromDynogelsObject (object) {
  // const metadataProps = Object.keys(object).filter(prop => prop.startsWith(METADATA_PREFIX))
  // const dataProps = Object.keys(object).filter(prop => prop.startsWith(DATA_PREFIX))
  const recovered = {
    object: {}
  }

  for (let prop in object) {
    if (prop.startsWith(METADATA_PREFIX)) {
      recovered[prop.slice(METADATA_PREFIX.length)] = object[prop]
    } else if (prop.startsWith(DATA_PREFIX)) {
      recovered.object[prop.slice(DATA_PREFIX.length)] = object[prop]
    } else {
      throw new Error(`unexpected property ${prop}`)
    }
  }

  return recovered
}

function toDynogelsObject (object) {
  return extend(
    prefixMetadataProps(getMetadataProps(object)),
    prefixDataProps(object.object)
  )
}

const getMetadataProps = object => pick(object, ['link', 'permalink', 'time', 'author'])
const prefixProp = (prop, prefix) => prefix + prop
const prefixMetadataProp = prop => prefixProp(prop, METADATA_PREFIX)
const prefixMetadataProps = props => prefixProps(props, METADATA_PREFIX)
const prefixDataProp = prop => prefixProp(prop, DATA_PREFIX)
const prefixDataProps = props => prefixProps(props, DATA_PREFIX)

function prefixProps (props, prefix) {
  const prefixed = {}
  for (let prop in props) {
    prefixed[prefixProp(prop, prefix)] = props[prop]
  }

  return prefixed
}

function toDynogelsSchema ({ model, models }) {
  const schema = toJoi({ model, models })
  schema[prefixProp('time', METADATA_PREFIX)] = Joi.date().timestamp()
  schema[prefixProp('author', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('link', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('permalink', METADATA_PREFIX)] = Joi.string()
  return {
    // metadata prop
    hashKey: prefixProp('time', METADATA_PREFIX),
    rangeKey: prefixProp('author', METADATA_PREFIX),
    tableName: getTableName(model),
    timestamps: true,
    createdAt: false, //prefixProp('dateCreated'),
    updatedAt: prefixProp('dateUpdated'),
    schema
  }
}

function defineTable ({ model, models }) {
  const schema = toDynogelsSchema({ model, models })
  const table = dynogels.define(model.id, schema)
  return wrapTable(table)
}

function wrapInstance (instance) {
  return {
    metadata: prop => instance.get(prefixMetadataProp(prop)),
    get: prop => prop ? instance.get(prefixDataProp(prop)) : instance.get(),
    set: prop => props => instance.set(prefixDataProps(props)),
    save: promisify(instance.save.bind(instance)),
    update: promisify(instance.save.bind(instance)),
    destroy: promisify(instance.destroy.bind(instance)),
    toPlainObject: toJSON,
    toJSON
  }

  function toJSON () {
    return fromDynogelsObject(instance.toJSON())
  }
}

function wrapTable (table) {
  table = promisify(table)
  const create = co(function* (item) {
    const result = yield table.create(toDynogelsObject(item))
    return wrapInstance(result)
  })

  const get = co(function* (key) {
    const result = yield table.get(key)
    return wrapInstance(result)
  })

  const update = co(function* (item, options) {
    const result = yield table.update(toDynogelsObject(item), options)
    return wrapInstance(result)
  })

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(toDynogelsObject(key), options)
    return wrapInstance(result)
  })

  return {
    create,
    get,
    update,
    destroy
  }
}

function toJoi ({ model, models }) {
  const { properties, required } = model
  const joiProps = {}
  for (let propertyName in properties) {
    let property = properties[propertyName]
    joiProps[propertyName] = toJoiProp({ propertyName, property, model, models })
  }

  for (let name of required) {
    joiProps[name] = joiProps[name].required()
  }

  return joiProps
}

function toJoiProp ({
  propertyName,
  property,
  model,
  models
}) {
  const { type } = property
  switch (type) {
  case 'string':
    return toJoiStringProperty({ propertyName, property })
  case 'number':
    return toJoiNumberProperty({ propertyName, property })
  case 'date':
    return Joi.date()
  case 'boolean':
    return Joi.boolean()
  case 'array':
    return Joi.array().items(toJoiProp({
      propertyName,
      property: clone(property, { type: 'object' }),
      model,
      models
    }))

  case 'object':
    const isInlined = isInlinedProperty({
      property,
      model,
      models
    })

    if (isInlined) {
      return Joi.object()
    }

    return Joi.object({
      id: Joi.string(),
      title: Joi.string()
    })
  default:
    throw new Error(`unknown type: ${type}`)
  }
}

function toJoiNumberProperty ({ propertyName, property }) {
  let joiProp = Joi.number()
  if (property.maxLength) {
    joiProp = joiProp.max(Math.pow(10, property.maxLength) - 1)
  }

  if (property.minLength) {
    joiProp = joiProp.min(Math.pow(10, property.minLength) - 1)
  }

  return joiProp
}

function toJoiStringProperty ({ propertyName, property }) {
  let joiProp = Joi.string()
  if (isEmailProperty({ propertyName, property })) {
    joiProp = joiProp.email()
  } else if (property.pattern) {
    joiProp = joiProp.regex(new RegExp(property.pattern))
  }

  if (property.maxLength) {
    joiProp = joiProp.max(Math.pow(10, property.maxLength) - 1)
  }

  if (property.minLength) {
    joiProp = joiProp.min(Math.pow(10, property.minLength) - 1)
  }

  return joiProp
}

function getTableName (model) {
  const id = model.id || model
  return id.replace(/[.]/g, '-')
}
