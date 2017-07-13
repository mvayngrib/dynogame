module.exports = {
  type: 'tradle.Model',
  id: 'tradle.Object',
  properties: {
    // type
    _t: {
      type: 'string'
    },
    // signature
    _s: {
      type: 'string'
    },
    // link to original version of this object
    _r: {
      type: 'string'
    },
    // link to previous version of this object
    _p: {
      type: 'string'
    },
    // link to previous message to this recipient
    _q: {
      type: 'string'
    },
    // sequence number
    _n: {
      type: 'number'
    },

    // permalink of Identity that signed this object
    _author: {
      type: 'string',
      virtual: true
    },

    // derived properties that are not covered by the merkle root
    _link: {
      type: 'string',
      virtual: true
    },

    _permalink: {
      type: 'string',
      virtual: true
    },

    // timestamp or date
    _time: {
      type: 'string',
      virtual: true
    },

    // if true, this object is incomplete, and the rest of the body
    // must be retrieved from elsewhere
    _min: {
      type: 'boolean',
      virtual: true
    }
  },
  required: [
    '_t',
    '_s'
  ]
}
