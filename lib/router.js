'use strict'

var express = require('express'),
	APIError = require('./APIError'),
	bodyParser = require('body-parser'),
	versions = require('./versions')

/**
 * Create and set the router
 * @param {Object} options
 * @param {Object} lifted - returned by lift.js
 * @returns {express:Router}
 */
module.exports = function (options, lifted) {
	var router = new express.Router

	// Prepare express middlewares
	router.use(function (req, res, next) {
		// Save the time at the beggining
		req.beginTime = Date.now()

		if (!req.is('json')) {
			var err = new APIError('Invalid Content-Type header, application/json was expected')
			err.code = 101
			return next(err)
		}

		next()
	})
	router.use(bodyParser.json())

	// Create the endpoints using versioning
	var endPoints = versions(lifted.actions)

	// Prepare express routes
	endPoints.forEach(function (endPoint) {
		var action = endPoint.action,
			profile = action.profile

		// Cache handler to use the same function if more than one url points to the same action
		if (!action.cachedHandler) {
			action.cachedHandler = function (req, res, next) {
				// Make the req accessible through body
				Object.defineProperty(req.body, '_req', {
					value: req
				})

				action.run(req.body, function (err, response) {
					if (profile) {
						req.profileData = arguments[arguments.length - 1]
					}

					if (err) {
						err.action = action
						return next(err)
					}

					response = profile && arguments.length === 2 ? {} : (response || {})
					if (typeof response !== 'object') {
						throw new Error('The response must be an object')
					}
					response.failure = null
					if (options.onsuccess) {
						options.onsuccess(response, req, extractBody(req), action)
					}
					res.json(response)
				})
			}
		}

		router.post(endPoint.url, action.cachedHandler)
	})

	// Error handler
	router.use(function (err, req, res, next) {
		next // next isn't used on purpose, because express demands a 4-arity function
		var code, message

		if (err instanceof Error && err.status === 400 && typeof err.body === 'string') {
			// JSON parsing error
			code = 101
			message = 'Invalid JSON: ' + err
		} else if (err instanceof APIError) {
			code = err.code
			message = err.message
		} else {
			code = 100
			message = err.message || 'Unknown error'
		}

		var response = {
			failure: {
				code: code,
				message: message
			}
		}
		if (options.onfailure) {
			options.onfailure(response, req, extractBody(req), err.action, err)
		}
		res.json(response)
	})
}

/**
 * Return a cleaned version of the request body
 * @param {Request} req
 * @returns {Object}
 */
function extractBody(req) {
	var copy = function (x) {
		var r, key, lowKey
		if (!x || typeof x !== 'object') {
			return x
		}

		if (Array.isArray(x)) {
			return x.map(copy)
		}

		r = {}
		for (key in x) {
			lowKey = key.toLowerCase()
			if (lowKey.indexOf('session') === -1 &&
				lowKey.indexOf('password') === -1 &&
				lowKey.indexOf('serial') === -1 &&
				lowKey.indexOf('token') === -1) {
				r[key] = copy(x[key])
			}
		}
		return r
	}

	return copy(req.body)
}