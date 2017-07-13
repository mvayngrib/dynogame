// const debug = require('debug')('tradle:dynogels-mapper')
const Joi = require('joi')
const dynogels = require('dynogels')
const bindAll = require('bindall')
const typeforce = require('typeforce')
const createResolvers = require('./resolvers')
const {
  co,
  extend,
  promisify,
  getIndexes,
  omit,
  shallowClone
} = require('./utils')

const minify = require('./minify')
const { toJoi } = require('./joi')
const constants = require('./constants')
const BaseObjectModel = require('./object-model')
const metadataTypes = toJoi({
  model: BaseObjectModel
})

const RESOLVED = Promise.resolve()

module.exports = Backend

function Backend ({
  hashKey='_link',
  rangeKey=null,
  models,
  objects
}) {
  bindAll(this)

  this.hashKey = hashKey
  this.rangeKey = rangeKey
  this.models = models
  this.objects = objects
  // don't prefix for now, disallow _ as first character in model props
  this._tablePromises = {}
  this.tables = this._getTables()
  this.resolvers = createResolvers({
    tables: this.tables,
    models,
    objects,
    hashKey
  })
}

Backend.prototype._ensureTablesExist = co(function* (ids) {
  ids = [].concat(ids) // coerce to array
  for (let id of ids) {
    if (!(id in this._tablePromises)) {
      this._tablePromises[id] = this.tables[id].createTable()
    }

    try {
      yield this._tablePromises[id]
    } catch (err) {
      if (err.code === 'ResourceInUseException') {
        this._tablePromises[id] = RESOLVED
      } else {
        delete this._tablePromises[id]
        throw err
      }
    }
  }
})

Backend.prototype._toDynogelsSchema = function _toDynogelsSchema ({ model }) {
  const { models, hashKey, rangeKey } = this
  const schema = extend(
    toJoi({ model, models }),
    metadataTypes
  )

  const tableDef = {
    hashKey,
    tableName: getTableName(model),
    timestamps: true,
    createdAt: false,
    updatedAt: '_dateUpdated',
    schema,
    indexes: getIndexes({ model, models })
  }

  if (rangeKey) tableDef.rangeKey = rangeKey

  return tableDef
}

Backend.prototype._getTable = function _getTable ({ model }) {
  const { models, objects } = this
  const schema = this._toDynogelsSchema({ model })
  const table = dynogels.define(model.id, schema)
  return this._wrapTable({ table, model })
}

Backend.prototype._wrapTable = function _wrapTable ({ table, model }) {
  const self = this
  table = promisify(table, {
    include: ['createTable', 'create', 'get', 'update', 'destroy']
  })

  const { prefix, hashKey, rangeKey, objects } = this
  const getMin = rangeKey
    ? key => table.get(key[hashKey], key[rangeKey])
    : key => table.get(key[hashKey])

  const get = co(function* (key) {
    const instance = yield getMin(key)
    yield self._maybeInflate({ objects, instance })
    return instance.toJSON()
  })

  const createWriteMethod = function createWriteMethod (method) {
    return co(function* (item, options) {
      if (method === 'create') {
        typeforce({
          _author: 'String',
          _link: 'String',
          _time: typeforce.oneOf('String', 'Number')
        }, item)
      }

      const { min, diff, isMinified } = minify({ model, prefix, item })
      if (isMinified) {
        item.min = true
        item.object = min
      }

      const result = yield table[method](item, options)
      return extend(result.toJSON(), diff)
    })
  }

  const { createTable } = table
  const create = createWriteMethod('create')
  const update = createWriteMethod('update')

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(self.deflate(key), options)
    return result.toJSON()
  })

  const opts = { table, model }
  const crud = this._wrapDBOperations({
    create,
    get,
    update,
    destroy
  }, opts)

  function scan (...args) {
    const op = table.scan(...args)
    op.exec = self._wrapDBOperation(promisify(op.exec.bind(op)), opts)
    return op
  }

  function query (...args) {
    const op = table.query(...args)
    op.exec = self._wrapDBOperation(promisify(op.exec.bind(op)), opts)
    return op
  }

  return extend(crud, {
    createTable,
    query,
    scan
  })
}

Backend.prototype._wrapDBOperations = function _wrapDBOperations (target, opts) {
  const ensured = {}
  Object.keys(target).forEach(key => {
    const val = target[key]
    if (typeof val === 'function') {
      ensured[key] = this._wrapDBOperation(val, opts)
    } else {
      ensured[key] = val
    }
  })

  return ensured
}

Backend.prototype._wrapDBOperation = function _wrapDBOperation (fn, { model, table }) {
  const self = this
  const { objects } = this
  return co(function* (...args) {
    yield self._ensureTablesExist(model.id)

    const result = yield fn.apply(this, args)
    if (!result) return result

    let { Item, Items } = result
    if (Item) {
      yield self._maybeInflate({ objects, instance: Item })
      result.Item = Item.toJSON()
    } else if (Items) {
      yield Promise.all(Items.map(instance => {
        return self._maybeInflate({ objects, instance })
      }))

      result.Items = Items.map(item => item.toJSON())
    }

    return result
  })
}

Backend.prototype._maybeInflate = co(function* ({ instance }) {
  if (instance.get('_min')) {
    const link = instance.get('_link')
    const full = yield this.objects.getObjectByLink(link)
    instance.set(full.object)
  }

  return instance
})

Backend.prototype._getTables = function _getTables () {
  const self = this
  const tables = {}
  const { models, objects } = this
  Object.keys(models).forEach(id => {
    const model = models[id]
    let table
    Object.defineProperty(tables, model.id, {
      enumerable: true,
      get: function () {
        if (!table) {
          table = self._getTable({ model })
        }

        return table
      }
    })
  })

  return tables
}

function getTableName (model) {
  const id = model.id || model
  return id.replace(/[.]/g, '_')
}
