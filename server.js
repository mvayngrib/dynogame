const express = require('express')
const expressGraphQL = require('express-graphql')
const modelsArray = require('@tradle/models').models.concat(require('@tradle/custom-models'))
const models = {}
modelsArray.forEach(m => models[m.id] = m)

const { createSchema } = require('./schema-mapper-graphql')
const schema = createSchema({ tables, models })

const app = express()
app.use('/graphql', expressGraphQL(req => ({
    schema,
    graphiql: true,
    pretty: true
})))

app.set('port', 4000)
let http = require('http')
let server = http.createServer(app)
server.listen(port)
