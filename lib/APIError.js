'use strict'

/**
 * @class
 * @extends Error
 * @param {string} message
 */
function APIError(message) {
	/** @member {string} */
	this.message = message

	/** @member {number} */
	this.code = 0

	/** @member {number} */
	this.HTTPStatusCode = 0

	/** @member {Object} */
	this.stack = new Error(message).stack
}

// new APIError instanceof Error === true
APIError.prototype = Object.create(Error.prototype)

/**
 * @property {number} HTTPStatusCode
 * @property {number} code
 * @property {string} message
 * @returns {APIError}
 */
APIError.create = function (HTTPStatusCode, code, message) {
	let err = new APIError(message)
	err.code = code
	if (HTTPStatusCode) {
		err.HTTPStatusCode = HTTPStatusCode
	}
	return err
}

module.exports = APIError