'use strict'

var express = require('express'),
	APIError = require('./lib/APIError'),
	lift = require('./lib/lift'),
	versions = require('./lib/versions'),
	bodyParser = require('body-parser'),
	genId = require('./lib/genId'),
	API = require('./lib/API')

/**
 * @module api-lift
 */

/**
 * The module responsible for reading the files in the target folder
 * @external lift-it
 * @see https://www.npmjs.com/package/lift-it
 */

/**
 * Express module
 * @external express
 * @see https://www.npmjs.com/package/express
 */

/**
 * Lift the API
 * @param {Object} [options] - see defaults in README
 * @returns {API}
 */
module.exports = function (options) {
	options = prepareOptions(options)

	// Lift and call error callbacks
	var lifted = lift(options)

	var api = new API(lifted, options.dataScrub, options.onsuccess, options.onfailure)

	// Prepare express middlewares
	api.router.use(function (req, res, next) {
		// Save the time at the beggining
		req.beginTime = Date.now()
		req.requestId = genId()

		if (req.method === 'POST' && !req.is('json')) {
			return next(APIError.create(101,
				'Invalid Content-Type header, application/json was expected'))
		}

		next()
	})
	api.router.use(bodyParser.json())

	// Create the endpoints using versioning
	api._prepareEndpoints(options.minVersion)

	// Prepare express endpoint handler
	api.router.use(function (req, res, next) {
		if (req.method !== 'POST' || !req.body) {
			// We're only looking into POST requests
			return next()
		}

		// Make the req accessible through body
		Object.defineProperty(req.body, '_req', {
			value: req
		})

		api.run(req.url, req.body, req, function (out) {
			res.json(out)
		})
	})

	// Error handler
	api.router.use(function (err, req, res, next) {
		next // next isn't used on purpose, because express demands a 4-arity function
		if (err instanceof Error && err.status === 400 && typeof err.body === 'string') {
			// JSON parsing error
			err = APIError.create(101, 'Invalid JSON: ' + err)
		}
		api._handleError(err, req.body, req, function (out) {
			res.json(out)
		})
	})

	return api
}

/**
 * @param {Object} [options]
 * @returns {Versions}
 */
module.exports.info = function (options) {
	options = prepareOptions(options)
	return versions(options.minVersion, lift.lean(options).actions)
}

/** Exposes used version of {@link external:express} */
module.exports.express = express

/** Exposes {@link APIError} class */
module.exports.APIError = APIError

/**
 * @param {?Object} options
 * @returns {Object}
 * @private
 */
function prepareOptions(options) {
	var vO

	// Set defaults
	options = options || {}
	options.folder = options.folder || './api'
	options.profile = Boolean(options.profile)
	options.dataScrub = options.dataScrub || [/session|password|serial|token/i]
	options.validate = options.validate || {}

	// Set validateOutput defaults
	vO = options.validateOutput = options.validateOutput || {}
	vO.direction = 'output'
	vO.exportName = vO.exportName || 'outFields'
	vO.optional = vO.optional === undefined ? true : vO.optional
	vO.getDefaultValue = vO.getDefaultValue || function () {
		return {}
	}
	vO.code = vO.code || 100
	vO.errorHandler = vO.errorHandler || function (action, value, err) {
		throw err
	}
	vO.options = vO.options || {}
	vO.options.strict = vO.options.strict === undefined ? true : vO.options.strict

	options.filters = options.filters || './filters'
	options.minVersion = options.minVersion === undefined ? 1 : options.minVersion
	options.onerror = options.onerror || function (action) {
		throw action.error
	}

	return options
}