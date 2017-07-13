const pick = require('object.pick')
const {
  getProperties,
  isRequired,
  getRef,
  shallowClone
} = require('./utils')

module.exports = minify

const MINIFY_PREFERENCES = [
  minusPhotos,
  minusBigValues,
  minusOptional,
  minusAll
]

function minify ({ item, model }) {
  let min = shallowClone(item)
  let diff = {}
  let isMinified

  for (const filter of MINIFY_PREFERENCES) {
    const size = JSON.stringify(min).length
    if (size < 1000) return { min, diff }

    let slimmed
    for (let propertyName in min) {
      if (propertyName.startsWith('_')) {
        continue
      }

      let keep = filter({
        model,
        propertyName,
        property: model.properties[propertyName],
        value: item[propertyName]
      })

      if (!keep) {
        diff[propertyName] = item[propertyName]
        delete min[propertyName]
        isMinified = true
      }
    }
  }

  return { min, diff, isMinified }
}

function minusPhotos ({ property }) {
  return getRef(property) !== 'tradle.Photo'
}

function minusBigValues ({ value }) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return str.length < 50
}

function minusOptional ({ model, propertyName }) {
  return isRequired({ model, propertyName })
}

function minusAll () {
  return false
}
