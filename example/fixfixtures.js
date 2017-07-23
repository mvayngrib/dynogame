const fs = require('fs')
const path = require('path')
const pick = require('object.pick')
const models = require('./models')
const { utils } = require('@tradle/validate-resource')
const fixtures = require('./fixtures')
  .filter(fix => {
    const type = fix._t
    return models[type] && type !== 'tradle.ProductList'
  })
  .map(res => fixResource(res))

function fixResource (res, model) {
  if (!model) model = models[res._t]

  if (res._r) {
    res._permalink = res._r
    delete res._r
  }

  if (res._c) {
    res._link = res._c
    delete res._c
  }

  if (res.from) {
    res._author = res.from.id.split('_')[1]
    delete res.from
  }

  delete res.to
  delete res._appSubmitted

  const { properties } = model
  if (res.time) res._time = '' + res.time

  const virtual = res._virtual
    ? utils.pickVirtual(res)
    : pick(res, Object.keys(res).filter(prop => {
        return prop[0] === '_' && prop.length > 2
      }))

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

  if (Object.keys(virtual).length) {
    utils.setVirtual(res, virtual)
  }

  return res
}

fs.writeFileSync(
  path.resolve(__dirname, './fixtures-fixed.json'),
  JSON.stringify(fixtures, null, 2)
)
