const prefix = {
  metadata: '',
  data: ''
}

module.exports = {
  prefix,
  hashKey: prefix.metadata + 'author',
  rangeKey: prefix.metadata + 'time'
}
