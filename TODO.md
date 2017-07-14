
improve filter-dynamodb
  try to use query whenever possible
  is orderBy possible?
  AND/OR
    https://stackoverflow.com/questions/43570660/dynogels-query-using-or-comparison

improve use of indexes
  check what attributes are projected, restore the missing set from Objects

notes:
  orderBy costs a full scan if the property is not indexed or the partitionKey

instead of 
    model -> joi
    model -> graphql
  do 
    model -> graphql
    graphql -> joi

  this way special cases in tradle models don't result in repeat logic

pagination
  http://graphql.org/learn/pagination/
  opaque cursor 
    map `filter` to dynamodb query, and dynamodb query to `result.LastEvaluatedKey`

separate schema generation from resolvers
