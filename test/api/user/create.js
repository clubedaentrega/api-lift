'use strict'

module.exports.description = 'Create a user. Check for weak passwords'

module.exports.fields = {
	name: String,
	password: 'string(6,)'
}

module.exports.profile = true

module.exports.handler = function (body, success, error) {
	if (body.password === '123456') {
		error(200, 'Password too weak')
	} else if (body.password === 'timeout') {
		// Do not call success() nor error() so that
		// this endpoint will never return a proper response
		return
	}
	success()
}