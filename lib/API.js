'use strict'

let express = require('express'),
	versions = require('./versions'),
	scrub = require('./scrub'),
	genId = require('./genId'),
	APIError = require('./APIError'),
	openAPI = require('./openAPI'),
	bodyParser = require('body-parser')

/**
 * Represent a lifted API
 *
 * Instances of this class are created internally for you.
 * *You don't need to use this constructor directly.*
 *
 * @class
 * @param {external:lift-it.Lifted} lifted
 * @param {Object} options
 * @param {Array<RegExp>} options.dataScrub
 * @param {number} options.timeout
 * @param {Function} options.callToJSON
 * @param {?Function} options.onsuccess
 * @param {?Function} options.onfailure
 * @param {?Function} options.ontimeout
 * @param {Array<String>} options.headers
 * @param {?Function} options.checkId
 */
function API(lifted, options) {
	/** @member {external:express.Router} */
	this.router = new express.Router

	/** @member {number} */
	this.minVersion = 0

	/** @member {number} */
	this.maxVersion = 0

	/**
	 * The list of supported versions, ordered from oldest to newest.
	 * Example: `['v3', 'v4']`
	 * @member {Array<string>}
	 */
	this.versions = 0

	/** @member {Array<Endpoint>} */
	this.endpoints = []

	/**
	 * The map from url to an Endpoint instance
	 * @member {Object<Endpoint>}
	 */
	this.endpointByUrl = Object.create(null)

	/**
	 * @member {lift-it:Lifted}
	 * @private
	 */
	this._lifted = lifted

	/**
	 * @member {Object}
	 * @private
	 */
	this._options = options

	/**
	 * @member {Array<RegExp>}
	 * @private
	 */
	this._dataScrub = options.dataScrub

	/**
	 * @member {number}
	 * @private
	 */
	this._timeout = options.timeout

	/**
	 * @member {Function}
	 * @private
	 */
	this._callToJSON = options.callToJSON

	/**
	 * @member {?Function}
	 * @private
	 */
	this._onsuccess = options.onsuccess

	/**
	 * @member {?Function}
	 * @private
	 */
	this._onfailure = options.onfailure

	/**
	 * @member {?Function}
	 * @private
	 */
	this._ontimeout = options.ontimeout

	/**
	 * @member {Function}
	 * @private
	 */
	this._bodyParser = bodyParser.json(options.bodyParser)

	/**
	 * @member {Array<String>}
	 * @private
	 */
	this._headers = options.headers

	/**
	 * @member {?Function}
	 * @private
	 */
	this._checkId = options.checkId
}

module.exports = API

/**
 * Execute an endpoint in this api
 * @param {string} url - like '/v1/user/create' or '/v-last/user/create'
 * @param {Object} body
 * @param {Object} [runInfo={}] - data available as `process.domain.runInfo`. See more info in {@link https://www.npmjs.com/package/run-it|run-it} module
 * @param {number} [runInfo.beginTime=Date.now()]
 * @param {string} [runInfo.requestId=genId()]
 * @param {Function} callback - async cb(out)
 */
API.prototype.run = function (url, body, runInfo, callback) {
	// runInfo is optional
	if (typeof runInfo === 'function') {
		callback = runInfo
		runInfo = {}
	}

	runInfo = this._prepareRunInfo(runInfo)
	let that = this,
		endpoint = this._getEndpoint(url, 'POST')

	if (!endpoint) {
		// Always async
		return process.nextTick(() => {
			that._handleNotFound(url, body, runInfo, callback)
		})
	}
	this._runEndpoint(endpoint, body, runInfo, callback)
}

/**
 * Return the OpenAPI (Swagger) description object of this api.
 * Both prepareEndpoint and prepareSpec will be applied.
 * @param {number} [version] - version to consider (if empty, returns all versions)
 * @returns {Object}
 */
API.prototype.getOpenAPISpec = function (version) {
	return openAPI(this, version)
}

/**
 * Translates a web request into an endpoint execution in this api
 * @param {Object} req
 * @param {Object} [req.runInfo]
 * @param {Object} res
 * @param {Function} callback - async cb(err, out)
 * @private
 */
API.prototype._runRequest = function (req, res, callback) {
	req.runInfo = this._prepareRunInfo(req.runInfo)

	let endpoint = this._getEndpoint(req.url, req.method),
		that = this,
		parseBody = endpoint ? endpoint.action.module.bodyParser : that._bodyParser

	return parseBody(req, res, err => {
		if (err || !req.body) {
			return callback(err)
		}

		let body = that._addParamsToBody(req, req.body)

		if (!endpoint) {
			return that._handleNotFound(req.url, body, req.runInfo, out => {
				callback(null, out)
			})
		}

		that._runEndpoint(endpoint, body, req.runInfo, out => {
			callback(null, out)
		})

	})
}

/**
 * Prepares a runInfo object with the default data
 * @param {Object} [req.runInfo={}]
 * @param {number} [req.runInfo.beginTime=Date.now()]
 * @param {string} [req.runInfo.requestId=genId()]
 * @returns {Object}
 * @private
 */
API.prototype._prepareRunInfo = function (runInfo) {
	runInfo = runInfo || {}
	runInfo.beginTime = runInfo.beginTime || Date.now()
	runInfo.requestId = runInfo.requestId || genId()
	return runInfo
}

/**
 * Finds an endpoint from the given url
 * Endpoints need to be REST, HTTP request methods will be accepted:
 * DELETE: '/v-last/resource/id' -> call resource/rest_delete.js
 * GET: '/v-last/resource' -> call resource/rest_read.js
 * PUT: '/v-last/resource/id' -> call resource/rest_update.js
 * POST: '/v-last/resource' -> call resource/rest_create.js
 * POST '/v-last/resource/id/action' -> call resource/action.js
 * @param {string} url - like '/v1/user/create' or '/v-last/user/create'
 * @param {string} method - HTTP request methods
 * @returns {Endpoint}
 * @private
 */
API.prototype._getEndpoint = function (url, method) {

	// Remove GET params
	url = url.split('?')[0]

	// Translate 'v-last'
	if (url.indexOf('/v-last/') === 0) {
		url = '/v' + this.maxVersion + '/' + url.substr(8)
	}
	let parts = url.split('/'),
		baseUrl

	// Remove id from url to use in endpointsByUrl
	if (this._checkId(parts[3])) {
		parts.splice(3, 1)
		url = parts.join('/')
	}
	baseUrl = '/' + parts[1] + '/' + parts[2]

	switch (method) {
		case 'POST':
			// Used map to maintain compatibility with older versions if we have endpoints like '/v1/nonresource'
			if (this.endpointByUrl[url]) {
				break
			} else if (parts.length === 3) {
				url = baseUrl + '/rest_create'
			}
			break
		case 'GET':
			if (parts.length === 3) {
				url = baseUrl + '/rest_read'
				break
			}
			return
		case 'PUT':
			if (parts.length === 3) {
				url = baseUrl + '/rest_update'
				break
			}
			return
		case 'DELETE':
			if (parts.length === 3) {
				url = baseUrl + '/rest_delete'
				break
			}
			return
		default:
			return
	}
	return this.endpointByUrl[url]
}

/**
 * Finds a resource from the given url
 * @param {string} url - like '/v1/user/id' or '/v-last/user/id/cancel'
 * @returns {Object}
 * @private
 */
API.prototype._getResource = function (url) {

	// Remove GET params
	url = url.split('?')[0]

	let parts = url.split('/'),
		id
	// Get id
	if (this._checkId(parts[3])) {
		id = parts[3]
	}
	return {
		name: parts[2],
		id
	}
}

/**
 * Execute an endpoint in this api
 * @param {Endpoint} endpoint
 * @param {Object} body
 * @param {Object} runInfo
 * @param {Function} callback - async cb(out)
 * @private
 */
API.prototype._runEndpoint = function (endpoint, body, runInfo, callback) {
	let that = this,
		action = endpoint.action,
		profile = action.profile,
		scrubbedBody = scrub(body, this._dataScrub, this._callToJSON),
		timer

	if (this._ontimeout) {
		timer = setTimeout(this._ontimeout.bind(null, runInfo, scrubbedBody, endpoint), this._timeout)
	}

	let runner = action.getRunner()
	runInfo.profileData = runner._profileData
	runner.runInfo(runInfo).exec(body, function (err, out) {
		if (timer) {
			clearTimeout(timer)
		}

		if (err) {
			return that._handleError(err, scrubbedBody, runInfo, endpoint, callback)
		}

		out = profile && arguments.length === 2 ? {} : (out || {})
		if (typeof out !== 'object') {
			throw new Error('The response must be an object')
		}
		out.failure = null
		if (that._onsuccess) {
			that._onsuccess(out, runInfo, scrubbedBody, endpoint)
		}
		callback(out)
	})
}

/**
 * List the endpoint from action names
 * @param {number} minVersion
 * @private
 */
API.prototype._prepareEndpoints = function (minVersion) {
	let data = versions(minVersion, this._lifted.actions)

	this.minVersion = data.minVersion
	this.maxVersion = data.maxVersion
	this.versions = data.versions
	this.endpoints = data.endpoints
	this.endpointByUrl = data.endpointByUrl
}

/**
 * Provide a friendly message if the endpoint is not found
 * @param {string} url
 * @param {Object} body
 * @param {Object} runInfo
 * @param {Function} callback - cb(out)
 * @private
 */
API.prototype._handleNotFound = function (url, body, runInfo, callback) {
	let match = url.match(/^\/(v\d+)\/(.*)$/),
		err, version, action

	if (!match) {
		err = APIError.create(199,
			'Invalid path format, expected something like /' +
			this.versions[this.versions.length - 1] + '/user/create')
	} else {
		version = match[1]
		action = match[2]
		if (this.versions.indexOf(version) === -1) {
			err = APIError.create(199,
				'Version ' + version + ' is not supported. Supported versions are: ' +
				this.versions.join(', '))
		} else {
			err = APIError.create(199,
				'The action ' + action + ' does not exists in version ' + version)
		}
	}

	this._handleError(err, scrub(body, this._dataScrub, this._callToJSON), runInfo, null, callback)
}

/**
 * Treat error cases, formating them to a failure object
 * @param {Object} err
 * @param {Object} scrubbedBody
 * @param {Object} runInfo
 * @param {?Endpoint} endpoint
 * @param {Function} callback - cb(out)
 * @private
 */
API.prototype._handleError = function (err, scrubbedBody, runInfo, endpoint, callback) {
	let code, message

	if (err instanceof APIError) {
		code = err.code
		message = err.message
	} else {
		code = 100
		message = err.message || String(err) || 'Unknown error'
	}

	let out = {
		failure: {
			code,
			message
		}
	}
	if (this._onfailure) {
		this._onfailure(out, runInfo, scrubbedBody, endpoint, err)
	}
	callback(out)
}

/**
 * Parse url and header to add params to body
 * @param {Object} req
 * @param {Object} body
 * @private
 */
API.prototype._addParamsToBody = function (req, body) {

	// Body from GET params
	if (req.method === 'GET') {
		body = req.query
	}

	// Resource from url
	let resource = this._getResource(req.url)
	if (resource.id) {
		if (!body[resource.name]) {
			body[resource.name] = {}
		}
		body[resource.name].id = resource.id
	}

	// Params from header
	this._headers.forEach(h => {
		if (req.get(h)) {
			body[h] = req.get(h)
		}
	})

	return body
}