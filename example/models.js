const modelsArray = require('@tradle/models').models.concat(require('@tradle/custom-models'))
const schemaUtils = require('@tradle/schema-graphql').utils
const models = schemaUtils.normalizeModels(modelsArray.reduce((map, model) => {
  map[model.id] = model
  return map
}, {}))

module.exports = models
