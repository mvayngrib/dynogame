const fs = require('fs')
const models = require('./helpers/models')
const utils = require('../utils')
const fixtures = require('../fixtures')
  .filter(fix => {
    const type = fix._t
    return models[type] //&& type !== 'tradle.ProductList'
  })
  .map(res => fixResource(res))

function fixResource (res, model) {
  if (!model) model = models[res._t]

  const { properties } = model
  if (res.time) res._time = '' + res.time

  Object.keys(res).forEach(propertyName => {
    if (!(propertyName in properties)) {
      delete res[propertyName]
      return
    }

    const val = res[propertyName]
    if (val === '') {
      delete res[propertyName]
      return
    }

    const property = properties[propertyName]
    const ref = utils.getRef(property)
    const refModel = models[ref]
    if (refModel && utils.isInlinedProperty({
      property,
      models
    })) {
      if (property.type === 'object') {
        res[propertyName] = fixResource(val, refModel)
      } else {
        res[propertyName] = val.map(r => fixResource(r, refModel))
      }

      return
    }

    if (!val.title) {
      delete val.title
    }
  })

  return res
}

fs.writeFileSync('./fixtures-fixed.json', JSON.stringify(fixtures, null, 2))
