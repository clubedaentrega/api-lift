'use strict'

var express = require('express'),
	APIError = require('./lib/APIError'),
	lift = require('./lib/lift'),
	router = require('./lib/router')

/**
 * @property {Object} [options] - see defaults in README
 * @returns {express:Router}
 */
module.exports = function (options) {
	// Set defaults
	options = options || {}
	options.folder = options.folder || './api'
	options.profile = Boolean(options.profile)
	options.validate = options.validate || {}
	options.filters = options.filters || './filters'
	options.minVersion = options.minVersion === undefined ? 1 : options.minVersion

	// Lift and call error callbacks
	var lifted = lift(options)

	// Create router and return it
	return router(options, lifted)
}

module.exports.express = express

module.exports.Error = APIError