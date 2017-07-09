const co = require('co').wrap
const Joi = require('joi')
const clone = require('xtend')
const extend = require('xtend/mutable')
const pick = require('object.pick')
const omit = require('object.omit')
const promisify = require('pify')
const dynogels = require('dynogels')
const createTables = promisify(dynogels.createTables)
const { isEmailProperty, isInlinedProperty } = require('./utils')
const constants = require('./constants')
const { hashKey, rangeKey } = constants
const METADATA_PREFIX = constants.prefix.metadata
const DATA_PREFIX = constants.prefix.data
const RESOLVED = Promise.resolve()
// const METADATA_PREFIX = 'm'
// const DATA_PREFIX = 'd'
// don't prefix for now, disallow _ as first character in model props
const ensureTablesCache = {}
const ensureTables =  co(function* (tables) {
  for (let id in tables) {
    if (!(id in ensureTablesCache)) {
      ensureTablesCache[id] = tables[id].createTable()
    }

    try {
      yield ensureTablesCache[id]
    } catch (err) {
      if (err.code !== 'ResourceInUseException') {
        delete ensureTablesCache[id]
        throw err
      }
    }
  }
})

module.exports = {
  toDynogelsSchema,
  deflate,
  inflate,
  getTableName,
  // getKey,
  getTable,
  getTables,
  ensureTables
  // list
}

// function getKey (resource) {
//   return {
//     prefixProp('time', METADATA_PREFIX),
//     prefixProp('author', METADATA_PREFIX)
//   }
// }

function inflate (object) {
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

function deflate (object) {
  const metadataProps = getMetadataProps(object)
  return extend(
    prefixMetadataProps(metadataProps),
    omit(object, metadataProps)
  )

  // return extend(
  //   prefixMetadataProps(getMetadataProps(object)),
  //   prefixDataProps(object.object)
  // )
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
  schema[prefixProp('time', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('author', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('link', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('permalink', METADATA_PREFIX)] = Joi.string()
  return {
    // metadata prop
    // hashKey: prefixProp('time', METADATA_PREFIX),
    // rangeKey: prefixProp('author', METADATA_PREFIX),
    rangeKey,
    hashKey,
    tableName: getTableName(model),
    timestamps: true,
    createdAt: false, //prefixProp('dateCreated'),
    updatedAt: prefixProp('dateUpdated'),
    schema
  }
}

function getTable ({ model, models, objects }) {
  const schema = toDynogelsSchema({ model, models })
  const table = dynogels.define(model.id, schema)
  return wrapTable({ table, model, objects })
}

function wrapInstance (instance) {
  return promisify(instance, {
    include: ['save', 'update', 'destroy']
  })

  // return {
  //   metadata: prop => instance.get(prefixMetadataProp(prop)),
  //   get: prop => prop ? instance.get(prefixDataProp(prop)) : instance.get(),
  //   set: prop => props => instance.set(prefixDataProps(props)),
  //   save: promisify(instance.save.bind(instance)),
  //   update: promisify(instance.update.bind(instance)),
  //   destroy: promisify(instance.destroy.bind(instance)),
  //   toPlainObject: toJSON,
  //   toJSON
  // }

  // function toJSON () {
  //   return inflate(instance.toJSON())
  // }
}

function wrapTable ({ table, model, objects }) {
  table = promisify(table, {
    include: ['createTable', 'create', 'get', 'update', 'destroy']
  })

  const create = co(function* (item, options={}) {
    const result = yield table.create(deflate(item), options)
    return wrapInstance(result)
  })

  const get = co(function* (key) {
    const result = yield table.get(key[hashKey], key[rangeKey])
    return wrapInstance(result)
  })

  const update = co(function* (item, options) {
    const slim = getSlim(item)
    const putSlim = table.update(deflate(item), options)
    const putFat = slim === item ? RESOLVED : objects.putObject(item)
    // const result = yield table.update(deflate(item), options)
    const [result] = yield [putSlim, putFat]
    return wrapInstance(result)
  })

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(deflate(key), options)
    return wrapInstance(result)
  })

  return {
    createTable: () => table.createTable(),
    create,
    get,
    update,
    destroy,
    query: (...args) => wrapOperation({
      table,
      model,
      op: table.query(...args)
    }),
    scan: (...args) => wrapOperation({
      table,
      model,
      op: table.scan(...args)
    }),
  }
}

// TODO: wrap, instead of overwrite
function wrapOperation ({ table, model, op }) {
  const exec = promisify(op.exec.bind(op))
  op.exec = co(function* () {
    yield ensureTables({
      [model.id]: table
    })

    return yield exec()
  })

  return op
}

function getTables ({ models, objects }) {
  const tables = {}
  Object.keys(models).forEach(id => {
    const model = models[id]
    let table
    Object.defineProperty(tables, model.id, {
      enumerable: true,
      get: function () {
        if (!table) {
          table = getTable({ model, models, objects })
        }

        return table
      }
    })
  })

  return tables
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
  return id.replace(/[.]/g, '_')
}
