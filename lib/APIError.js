'use strict'

/**
 * @class
 * @param {string} message
 */
function APIError(message) {
	/** @member {string} */
	this.message = message

	/** @member {number} */
	this.code = 0
}

// new APIError instanceof Error === true
APIError.prototype = Object.create(Error.prototype)

module.exports = APIError