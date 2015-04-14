'use strict'

var express = require('express'),
	APIError = require('./lib/APIError'),
	lift = require('./lib/lift'),
	router = require('./lib/router'),
	versions = require('./lib/versions')

/**
 * @param {Object} [options] - see defaults in README
 * @returns {express:Router}
 */
module.exports = function (options) {
	options = prepareOptions(options)

	// Lift and call error callbacks
	var lifted = lift(options)

	// Create router and return it
	return router(options, lifted)
}

/**
 * @param {Object} [options]
 * @returns {Versions}
 */
module.exports.info = function (options) {
	options = prepareOptions(options)
	return versions(options, lift.lean(options).actions)
}

module.exports.express = express

module.exports.Error = APIError

/**
 * @param {?Object} options
 * @returns {Object}
 */
function prepareOptions(options) {
	// Set defaults
	options = options || {}
	options.folder = options.folder || './api'
	options.profile = Boolean(options.profile)
	options.lastVersionIsDev = Boolean(options.lastVersionIsDev)
	options.validate = options.validate || {}
	options.filters = options.filters || './filters'
	options.minVersion = options.minVersion === undefined ? 1 : options.minVersion
	options.onerror = options.onerror || function (action) {
		throw action.error
	}
	return options
}