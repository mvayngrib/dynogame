
module.exports = {
  hashKey: '_link',
  defaultIndexes: [
    {
      hashKey: '_author',
      rangeKey: '_time',
      name: 'AuthorAndDateIndex',
      type: 'global'
    },
    {
      hashKey: '_permalink',
      rangeKey: '_time',
      name: 'PermalinkAndDateIndex',
      type: 'global'
    }
  ],
  TYPE: '_t',
  SIG: '_s',
  SEQ: '_n',
  PERMALINK: '_r',
  PREVLINK: '_p',
  PREV_TO_SENDER: '_q'
}
