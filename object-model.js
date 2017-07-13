module.exports = {
  type: 'tradle.Model',
  id: 'tradle.Object',
  properties: {
    // type
    _t: {
      type: 'string',
      readOnly: true
    },
    // signature
    _s: {
      type: 'string',
      readOnly: true
    },
    // link to original version of this object
    _r: {
      type: 'string',
      readOnly: true
    },
    // link to previous version of this object
    _p: {
      type: 'string',
      readOnly: true
    },
    // link to previous message to this recipient
    _q: {
      type: 'string',
      readOnly: true
    },
    // sequence number
    _n: {
      type: 'number',
      readOnly: true
    },

    // permalink of Identity that signed this object
    _author: {
      type: 'string',
      virtual: true,
      readOnly: true
    },

    // derived properties that are not covered by the merkle root
    _link: {
      type: 'string',
      virtual: true,
      readOnly: true
    },

    _permalink: {
      type: 'string',
      virtual: true,
      readOnly: true
    },

    // timestamp or date
    _time: {
      type: 'string',
      virtual: true,
      readOnly: true
    },

    // if true, this object is incomplete, and the rest of the body
    // must be retrieved from elsewhere
    _min: {
      type: 'boolean',
      virtual: true,
      readOnly: true
    },

    // like toString
    _displayName: {
      type: 'string',
      virtual: true,
      readOnly: true
    }
  },
  required: [
    '_t',
    '_s'
  ]
}
