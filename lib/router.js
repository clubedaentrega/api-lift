'use strict'

var express = require('express'),
	APIError = require('./APIError'),
	bodyParser = require('body-parser'),
	versions = require('./versions'),
	genId = require('./genId')

/**
 * @typedef {Object} Router
 * @extends {express:Router}
 * @property {number} minVersion
 * @property {number} maxVersion
 * @property {Array<Endpoint>} endpoints
 * @property {lift-it:Lifted} lifted
 */

/**
 * Create and set the router
 * @param {Object} options
 * @param {lift-it:Lifted} lifted - returned by lift.js
 * @returns {Router}
 */
module.exports = function (options, lifted) {
	var router = new express.Router,
		dataScrub = options.dataScrub

	// Prepare express middlewares
	router.use(function (req, res, next) {
		// Save the time at the beggining
		req.beginTime = Date.now()
		req.requestId = genId()

		if (req.method === 'POST' && !req.is('json')) {
			return next(APIError.create(101,
				'Invalid Content-Type header, application/json was expected'))
		}

		next()
	})
	router.use(bodyParser.json())

	// Create the endpoints using versioning
	var versionsObj = versions(options, lifted.actions)

	// Add more info to router
	router.minVersion = versionsObj.minVersion
	router.maxVersion = versionsObj.maxVersion
	router.versions = versionsObj.versions
	router.endpoints = versionsObj.endpoints
	router.lifted = lifted

	// Prepare express routes
	versionsObj.endpoints.forEach(function (endpoint) {
		var action = endpoint.action,
			profile = action.profile

		// Cache handler to use the same function if more than one url points to the same action
		if (!action.cachedHandler) {
			action.cachedHandler = function (req, res, next) {
				// Make the req accessible through body
				Object.defineProperty(req.body, '_req', {
					value: req
				})

				action.getRunner().runInfo(req).exec(req.body, function (err, response) {
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
						options.onsuccess(response, req, extractBody(req, dataScrub), action)
					}
					res.json(response)
				})
			}
		}

		router.post(endpoint.url, action.cachedHandler)
	})

	// Handle not-found
	router.use(function (req, res, next) {
		if (req.method !== 'POST') {
			// Only answer POST requests
			return next()
		}

		var match = req.url.match(/^\/(v(?:\d+|-last))\/(.*)$/)
		if (!match) {
			return next(APIError.create(199,
				'Invalid path format, expected something like /' +
				router.versions[router.versions.length - 1] + '/user/create'))
		}
		var version = match[1],
			action = match[2]
		if (router.versions.indexOf(version) === -1) {
			next(APIError.create(199,
				'Version ' + version + ' is not supported. Supported versions are: ' +
				router.versions.join(', ')))
		} else {
			next(APIError.create(199,
				'The action ' + action + ' does not exists in version ' + version))
		}
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
			options.onfailure(response, req, extractBody(req, dataScrub), err.action, err)
		}
		res.json(response)
	})

	return router
}

/**
 * Return a cleaned version of the request body
 * @param {Request} req
 * @param {Array<RegExp>} dataScrub
 * @returns {Object}
 */
function extractBody(req, dataScrub) {
	var copy = function (x) {
		var r, key, shouldScrub, i

		if (x && x.toJSON && typeof x.toJSON === 'function') {
			x = x.toJSON()
		}

		if (!x || typeof x !== 'object') {
			return x
		}

		if (Array.isArray(x)) {
			return x.map(copy)
		}

		r = {}
		for (key in x) {
			shouldScrub = false
			for (i = 0; i < dataScrub.length; i++) {
				if (dataScrub[i].test(key)) {
					shouldScrub = true
					break
				}
			}
			r[key] = shouldScrub ? hide(x[key]) : copy(x[key])
		}
		return r
	}

	var hide = function (x) {
		var r, key

		if (x && x.toJSON && typeof x.toJSON === 'function') {
			x = x.toJSON()
		}

		if (!x || typeof x !== 'object') {
			return '[HIDDEN]'
		}

		if (Array.isArray(x)) {
			return x.map(hide)
		}

		r = {}
		for (key in x) {
			r[key] = hide(x[key])
		}
		return r
	}

	return copy(req.body)
}