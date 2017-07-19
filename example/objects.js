const co = require('co').wrap
const low = require('lowdb')
const db = low('objects.json')
db.defaults({})
  .write()

module.exports = {
  put: co(function* (wrapper) {
    db.set(wrapper._link, wrapper)
      .write()

    return wrapper
  }),
  get: co(function* (link) {
    const val = db.get(link).value()
    if (!val) {
      throw new Error('not found')
    }

    return val
  })
}
