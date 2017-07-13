const fs = require('fs')
const models = require('./helpers/models')
const fixtures = require('../fixtures')
  .filter(fix => {
    const type = fix._t
    return type in models && type !== 'tradle.ProductList'
  })
  .map(fix => {
    const model = models[fix._t]
    if (fix.time) fix._time = '' + fix.time

    Object.keys(fix).forEach(key => {
      if (!(key in model.properties)) {
        delete fix[key]
      }
    })

    return fix
  })

fs.writeFileSync('./fixtures-fixed.json', JSON.stringify(fixtures, null, 2))