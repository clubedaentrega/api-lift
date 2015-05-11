'use strict'

module.exports.description = 'Create a user. Do not check for weak passwords. Deprecated'

module.exports.fields = {
	name: String,
	password: String
}

module.exports.output = {}

module.exports.handler = function (body, success) {
	success()
}