'use strict'

let assert = require('assert')

module.exports.description = 'Create a user. Do not check for weak passwords. Deprecated'

module.exports.fields = {
	name: String,
	password: String
}

module.exports.outFields = {}

module.exports.handler = function (body, success) {
	assert(process.domain.runInfo.requestId.length === 24)

	success()
}