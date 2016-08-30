'use strict'

var express = require('express'),
	APIError = require('./lib/APIError'),
	lift = require('./lib/lift'),
	versions = require('./lib/versions'),
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

	var api = new API(lifted, options)

	// Prepare express middlewares
	api.router.use(function (req, res, next) {
		// Save the time at the beggining
		req.runInfo = {
			beginTime: Date.now(),
			requestId: genId(),
			req: req
		}

		if (req.method === 'POST' && !req.is('json')) {
			return next(APIError.create(101,
				'Invalid Content-Type header, application/json was expected'))
		}

		next()
	})

	// Create the endpoints using versioning
	api._prepareEndpoints(options.minVersion)

	// Prepare express endpoint handler
	api.router.use(function (req, res, next) {
		if (req.method !== 'POST') {
			// We're only looking into POST requests
			return next()
		}

		api._runRequest(req, res, function (err, out) {
			if (err || !out) {
				return next(err)
			}
			res.json(out)
		})
	})

	// Prepare open API routes
	if (options.openApi.serve) {
		api.router.get('/' + options.openApi.serveAs, getOpenApiMiddlewares())
		api.router.get('/v-last/' + options.openApi.serveAs, getOpenApiMiddlewares(api.maxVersion))

		var version
		for (version = api.minVersion; version <= api.maxVersion; version++) {
			api.router.get('/v' + version + '/' + options.openApi.serveAs, getOpenApiMiddlewares(version))
		}
	}

	// Error handler
	api.router.use(function (err, req, res, next) {
		next = next // next isn't used on purpose, because express demands a 4-arity function
		if (err instanceof Error && err.status === 400 && typeof err.body === 'string') {
			// JSON parsing error
			err = APIError.create(101, 'Invalid JSON: ' + err)
		}
		api._handleError(err, req.body, req.runInfo, null, function (out) {
			res.json(out)
		})
	})

	function getOpenApiMiddlewares(version) {
		return [options.openApi.middleware, function (req, res) {
			var spec = api.getOpenAPISpec(version)
			if (!spec.basePath) {
				spec.basePath = req.baseUrl || '/'
			}
			res.json(spec)
		}]
	}

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
	options.plugins = options.plugins || []
	options.dataScrub = options.dataScrub || [/session|password|serial|token/i]
	options.callToJSON = options.callToJSON || function (x) {
		return x.toJSON()
	}
	options.timeout = options.timeout || 30e3
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
	options.bodyParser = options.bodyParser || {}
	options.minVersion = options.minVersion === undefined ? 1 : options.minVersion

	options.openApi = options.openApi || {}
	options.openApi.serve = Boolean(options.openApi.serve)
	options.openApi.serveAs = options.openApi.serveAs || 'swagger.json'
	options.openApi.middleware = options.openApi.middleware || function (req, res, next) {
		next()
	}
	options.openApi.prepareEndpoint = options.openApi.prepareEndpoint || function (endpoint, pathItem) {
		return pathItem
	}
	options.openApi.prepareSpec = options.openApi.prepareSpec || function (spec) {
		return spec
	}

	return options
}