const Backend = require('../../backend')

module.exports = ({ models, objects }) => new Backend({
  hashKey: '_link',
  prefix: {
    metadata: 'm',
    data: 'd'
  },
  models,
  objects
})
