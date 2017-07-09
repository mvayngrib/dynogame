const pick = require('object.pick')

const {
  getProperties,
  isRequired,
  getRef
} = require('./utils')

module.exports = {
  slim: getSlimVersion
}

const SLIM_PREFERENCES = [
  minusPhotos,
  minusBigValues,
  minusOptional,
  minusAll
]

function getSlimVersion ({ item, model }) {
  const all = getProperties(model)
  let chosenProps = all
  let slim = item
  for (const filter of SLIM_PREFERENCES) {
    const size = JSON.stringify(slim).length
    if (size < 1000) return slim

    const prev = chosenProps
    chosenProps = chosenProps.filter(propertyName => {
      return filter({
        model,
        propertyName,
        property: model.properties[propertyName],
        value: item[propertyName]
      })
    })

    if (prev.length < chosenProps.length) {
      slim = pick(slim, chosenProps)
    }
  }

  return item
}

function minusPhotos ({ property }) {
  return getRef(property) !== 'tradle.Photo'
}

function minusBigValues ({ value }) {
  const str = typeof value === 'string' ? str : JSON.stringify(value)
  return str.length < 50
}

function minusOptional ({ model, propertyName }) {
  return isRequired({ model, propertyName })
}

function minusAll () {
  return false
}
