module.exports = {
  type: 'tradle.Model',
  id: 'tradle.Object',
  isInterface: true,
  properties: {
    _author: {
      type: 'string',
      virtual: true
    },
    _link: {
      type: 'string',
      virtual: true
    },
    _permalink: {
      type: 'string',
      virtual: true
    },
    _time: {
      type: 'string',
      virtual: true
    },
    _min: {
      type: 'boolean',
      virtual: true
    }
  },
  required: [
    '_link'
  ]
}
