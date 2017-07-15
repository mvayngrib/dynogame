const debug = require('debug')('tradle:graphql-resolvers')
const {
  co,
  getRequiredProperties,
  getIndexes,
  sortResults
} = require('./utils')

const { filterResults } = require('./filter-memory')
const createSearchQuery = require('./filter-dynamodb')

module.exports = function createResolvers ({ tables, objects, models, primaryKey }) {

  function postProcessSearchResult ({ model, result, filter, orderBy, limit=Infinity }) {
    const { Count, Items } = result
    if (!Count) return []

    const survivors = filterResults({
      model,
      results: resultsToJson(Items),
      filter
    })

    const sorted = sortResults({
      results: survivors,
      orderBy
    })

    return sorted.slice(0, limit)
  }

  const update = co(function* ({ model, props }) {
    const result = yield tables[model.id].update(props)
    return resultsToJson(result)
  })

  const get = co(function* ({ model, key }) {
    const result = yield tables[model.id].get(key)
    return result ? resultsToJson(result) : null
  })

  const list = co(function* ({ model, source, args, context, info }) {
    const { filter, orderBy, limit } = args
    const op = createSearchQuery({
      table: tables[model.id],
      model,
      filter,
      orderBy,
      limit
    })

    const result = yield op.exec()
    return postProcessSearchResult({ model, result, filter, orderBy, limit })
  })

  function getQueryBy ({ model, props }) {
    if (primaryKey in props) {
      return {
        value: props[primaryKey],
        // rangeKey: props[rangeKey]
      }
    }

    // TODO: lazify, cachify
    const index = getIndexes({ model, models })
      .find(indexDef => indexDef.hashKey in props)

    if (index) {
      return {
        index: index.name,
        value: props[index.hashKey],
        // rangeKey: props[index.rangeKey]
      }
    }
  }

  return {
    list,
    get,
    update
  }
}

function resultsToJson (items) {
  // return items
  if (Array.isArray(items)) {
    return items.map(item => {
      return item.toJSON ? item.toJSON() : item
    })
  }

  return items.toJSON ? items.toJSON() : items
}
