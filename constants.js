const prefix = {
  // metadata: '_meta_',
  metadata: '_',
  data: ''
}

const hashKey = prefix.metadata + 'link'
const metadataProperties = [
  'link',
  'permalink',
  'time',
  'author',
  'id',
  'title',
  'min'
].reduce((obj, prop) => {
  obj[prop] = prefix.metadata + prop
  return obj
}, {})

module.exports = {
  prefix,
  hashKey,
  rangeKey: null,
  defaultIndexes: [
    {
      hashKey: prefix.metadata + 'author',
      rangeKey: prefix.metadata + 'time',
      name: 'AuthorAndDateIndex',
      type: 'global'
    },
    {
      hashKey: prefix.metadata + 'permalink',
      rangeKey: prefix.metadata + 'time',
      name: 'PermalinkAndDateIndex',
      type: 'global'
    }
  ],
  primaryKeyProperties: [hashKey],
  metadataProperties,
  TYPE: '_t',
  SIG: '_s',
  SEQ: '_n',
  PERMALINK: '_r',
  PREVLINK: '_p',
  PREV_TO_SENDER: '_q'
}
