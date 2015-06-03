'use strict'

/**
 * @class
 * @param {string} name
 * @param {number} version
 * @param {Action} action
 */
function Endpoint(name, version, action) {
	/** @member {string} - like '/v1/user/create' */
	this.url = '/v' + version + '/' + name

	/** @member {string} - like 'user/create' */
	this.name = name

	/** @member {string} - like 'v6' */
	this.versionStr = 'v' + version

	/** @member {number} */
	this.version = version

	/** @member {Action} */
	this.action = action
}

module.exports = Endpoint