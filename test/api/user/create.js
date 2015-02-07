'use strict'

module.exports.description = 'Create a user. Check for weak passwords'

module.exports.fields = {
	name: String,
	password: 'string(6,)'
}

module.exports.handler = function (body, success, error) {
	if (body.password === '123456') {
		error(200, 'Password too weak')
	}
	success()
}