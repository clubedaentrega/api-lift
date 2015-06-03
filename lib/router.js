'use strict'

var APIError = require('./APIError'),
	bodyParser = require('body-parser'),
	genId = require('./genId'),
	API = require('./API')

/**
 * Create and set the router
 * @param {Object} options
 * @param {lift-it:Lifted} lifted - returned by lift.js
 * @returns {API}
 */
module.exports = function (options, lifted) {
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
	api.prepareEndpoints(options.minVersion)

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