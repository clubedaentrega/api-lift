'use strict'

let express = require('express'),
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
	let lifted = lift(options)

	let api = new API(lifted, options)

	// Prepare express middlewares
	api.router.use((req, res, next) => {
		// Save the time at the beggining
		req.runInfo = {
			beginTime: Date.now(),
			requestId: genId(),
			req
		}

		if ((req.method === 'POST' || req.method === 'PUT') && !req.is('json')) {
			return next(APIError.create(406, 101,
				'Invalid Content-Type header, application/json was expected'))
		}

		next()
	})

	// Create the endpoints using versioning
	api._prepareEndpoints(options.minVersion)

	// Prepare open API routes
	if (options.openApi.serve) {
		api.router.get('/' + options.openApi.serveAs, getOpenApiMiddlewares())
		api.router.get('/v-last/' + options.openApi.serveAs, getOpenApiMiddlewares(api.maxVersion))

		let version
		for (version = api.minVersion; version <= api.maxVersion; version++) {
			api.router.get('/v' + version + '/' + options.openApi.serveAs, getOpenApiMiddlewares(version))
		}
	}

	// Prepare express endpoint handler
	api.router.use((req, res, next) => {
		api._runRequest(req, res, (err, out) => {
			if (err || !out) {
				return next(err)
			}
			res.json(out)
		})
	})

	// Error handler
	// eslint-disable-next-line no-unused-vars
	api.router.use((err, req, res, next) => {
		if (err instanceof Error && err.status === 400 && typeof err.body === 'string') {
			// JSON parsing error
			err = APIError.create(400, 101, 'Invalid JSON: ' + err)
		}
		api._handleError(err, req.body, req.runInfo, null, res, out => {
			res.json(out)
		})
	})

	function getOpenApiMiddlewares(version) {
		return [options.openApi.middleware, function (req, res) {
			let spec = api.getOpenAPISpec(version)
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
	let vO

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

	options.isRest = Boolean(options.isRest)
	options.hasApiKeyAuth = Boolean(options.hasApiKeyAuth)
	options.errors = options.errors || {}
	options.checkId = options.checkId || (() => false)

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