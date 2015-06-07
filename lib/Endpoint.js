'use strict'

/**
 * Represents a single endpoint
 *
 * Instances of this class are created internally for you.
 * *You don't need to use this constructor directly.*
 *
 * @class
 * @param {string} name
 * @param {number} version
 * @param {external:lift-it.Action} action
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

	/** @member {external:lift-it.Action} */
	this.action = action
}

module.exports = Endpoint