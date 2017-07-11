// const prefix = {
//   metadata: 'm',
//   data: 'd'
// }

// const hashKey = 'link'
// const metadataProperties = [
//   'link',
//   'permalink',
//   'time',
//   'author',
//   'id',
//   'title',
//   'min'
// ]
// .reduce((obj, prop) => {
//   obj[prop] = prop
//   return obj
// }, {})

module.exports = {
  // prefix,
  // hashKey,
  rangeKey: null,
  defaultIndexes: [
    {
      hashKey: 'author',
      rangeKey: 'time',
      name: 'AuthorAndDateIndex',
      type: 'global'
    },
    {
      hashKey: 'permalink',
      rangeKey: 'time',
      name: 'PermalinkAndDateIndex',
      type: 'global'
    }
  ],
  // primaryKeyProperties: [hashKey],
  // metadataProperties,
  TYPE: '_t',
  SIG: '_s',
  SEQ: '_n',
  PERMALINK: '_r',
  PREVLINK: '_p',
  PREV_TO_SENDER: '_q'
}
