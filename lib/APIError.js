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

/**
 * @property {number} code
 * @property {string} message
 * @returns {APIError}
 */
APIError.create = function (code, message) {
	var err = new APIError(message)
	err.code = code
	return err
}

module.exports = APIError