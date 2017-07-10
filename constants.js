const {
  GraphQLString,
} = require('graphql')

const StringWrapper = { type: GraphQLString }
const TimestampType = require('./types/timestamp')
const prefix = {
  metadata: '',
  data: ''
}

const metadataProperties = {
  id: prefix.metadata + 'id',
  title: prefix.metadata + 'title',
  link: prefix.metadata + 'link',
  permalink: prefix.metadata + 'permalink',
  author: prefix.metadata + 'author',
  time: prefix.metadata + 'time',
}

const metadataTypes = {
  [metadataProperties.id]: StringWrapper,
  [metadataProperties.title]: StringWrapper,
  [metadataProperties.link]: StringWrapper,
  [metadataProperties.permalink]: StringWrapper,
  [metadataProperties.author]: StringWrapper,
  [metadataProperties.time]: { type: TimestampType }
}

const hashKey = metadataProperties.link

module.exports = {
  prefix,
  hashKey,
  indexes: [
    {
      hashKey: metadataProperties.author,
      rangeKey: metadataProperties.time,
      name: 'AuthorAndDateIndex',
      type: 'global'
    },
    {
      hashKey: metadataProperties.permalink,
      rangeKey: metadataProperties.time,
      name: 'PermalinkAndDateIndex',
      type: 'global'
    }
  ],
  // rangeKey: prefix.metadata + 'time',
  primaryKeyProperties: [hashKey],
  metadata: {
    types: metadataTypes,
    names: metadataProperties
  }
}
