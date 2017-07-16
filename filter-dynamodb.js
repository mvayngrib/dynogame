const debug = require('debug')('tradle:graphql-filter-dynamodb')
const { clone, toObject, getIndexes } = require('./utils')
const OPERATORS = require('./operators')
const { hashKey } = require('./constants')

module.exports = function filterViaDynamoDB ({ table, model, filter, orderBy, limit }) {
  filter = clone(filter || {})
  const indexes = getIndexes({ model })
  const usedProps = getUsedProperties({ model, filter })
  const indexedProps = indexes.map(index => index.hashKey)
    .concat(hashKey)

  const indexedPropsMap = toObject(indexedProps)
  const { EQ } = filter
  const usedIndexedProps = usedProps.filter(prop => {
    return EQ && prop in EQ && prop in indexedPropsMap
  })

  const opType = usedIndexedProps.length
    ? 'query'
    : 'scan'

  let createBuilder = table[opType]
  let builder
  let queryProp
  let fullScanRequired = true
  if (opType === 'query') {
    // supported key condition operators:
    //   http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html#Query.KeyConditionExpressions

    if (usedIndexedProps.includes(hashKey)) {
      queryProp = hashKey
    } else {
      queryProp = usedIndexedProps[0]
    }

    builder = createBuilder(EQ[queryProp])
    delete EQ[queryProp]
    if (queryProp !== hashKey) {
      const index = indexes.find(i => i.hashKey === queryProp)
      builder.usingIndex(index.name)
    }

    if (orderBy && orderBy.property === queryProp) {
      fullScanRequired = false
      if (orderBy.desc) {
        builder.descending()
      } else {
        builder.ascending()
      }
    }

  } else {
    builder = createBuilder()
  }

  const conditionMethod = opType === 'query' ? 'filter' : 'where'
  for (let op in filter) {
    let val = filter[op]
    for (let prop in val) {
      if (prop in OPERATORS) {
        debug('nested operators not support (yet)')
        continue
      }

      if (op === 'EQ') {
        builder[conditionMethod](prop).equals(val[prop])
      } else if (op === 'STARTS_WITH') {
        builder[conditionMethod](prop).beginsWith(val[prop])
      } else if (op === 'IN') {
        builder[conditionMethod](prop).in(val[prop])
      } else if (op === 'BETWEEN') {
        let pVal = val[prop]
        builder[conditionMethod](prop).between(...pVal)
      } else {
        debug(`unsupported operator ${op}`)
      }
    }
  }

  if (fullScanRequired) {
    if (limit) {
      debug('unable to set limit for db search operation, full scan is required')
    }

    builder.loadAll()
  } else if (limit) {
    builder.limit(limit)
  }

  return builder
}

function getUsedProperties ({ model, filter }) {
  const flat = flatten(filter)
  return flat.reduce((all, obj) => {
    return all.concat(Object.keys(obj))
  }, [])
}

// function usesNonPrimaryKeys ({ model, filter }) {
//   return props.some(prop => !indexed[prop])
// }

/**
 * flattens nested filter
 *
 * has no semantic meaning, this is just to be able to check
 * which props are being filtered against
 */
function flatten (filter) {
  const flat = []
  const batch = [filter]
  let len = batch.length
  while (true) {
    let copy = batch.slice()
    batch.length = 0
    copy.forEach(subFilter => {
      for (let op in subFilter) {
        if (op in OPERATORS) {
          batch.push(subFilter[op])
        } else {
          flat.push(subFilter)
        }
      }
    })

    if (!batch.length) {
      break
    }
  }

  return flat
}
