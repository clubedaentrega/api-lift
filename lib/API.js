'use strict'

var express = require('express'),
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
 * @param {Function} options.callToJSON
 * @param {?Function} options.onsuccess
 * @param {?Function} options.onfailure
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
	 * @member {Function}
	 * @private
	 */
	this._bodyParse = bodyParser.json(options.bodyParser)
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

	this._prepareRunInfo(runInfo)
	var that = this,
		endpoint = this._translateURL(url)

	if (!endpoint) {
		// Always async
		return process.nextTick(function () {
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
 * @param {Object} [req.runInfo={}] - data available as `process.domain.runInfo`. See more info in {@link https://www.npmjs.com/package/run-it|run-it} module
 * @param {number} [req.runInfo.beginTime=Date.now()]
 * @param {string} [req.runInfo.requestId=genId()]
 * @param {Object}	res
 * @param {Function} callback - async cb(err, out)
 * @private
 */
API.prototype._runRequest = function (req, res, callback) {
	this._prepareRunInfo(req.runInfo)
	var endpoint = this._translateURL(req.url),
		that = this

	if (!endpoint) {
		//If endpoint is not found, we parse the body with the component default parser for logging pourposes
		that._bodyParse(req, res, callback)
		return process.nextTick(function () {
			that._handleNotFound(req.url, req.body, req.runInfo, function (out) {
				callback(null, out)
			})
		})
	}
	endpoint.action.module.bodyParse(req, res, function (err) {
		if (err || !req.body) {
			//Callback with error so next will be called
			callback(err || {})
		}

		that._runEndpoint(endpoint, req.body, req.runInfo, function (out) {
			callback(null, out)
		})
	})

}

/**
 * Prepares a runInfo object with the default data
 * @param {Object} [req.runInfo={}] - data available as `process.domain.runInfo`. See more info in {@link https://www.npmjs.com/package/run-it|run-it} module
 * @param {number} [req.runInfo.beginTime=Date.now()]
 * @param {string} [req.runInfo.requestId=genId()]
 * @private
 */
API.prototype._prepareRunInfo = function (runInfo) {
	// Prepare runInfo data
	runInfo = runInfo || {}
	runInfo.beginTime = runInfo.beginTime || Date.now()
	runInfo.requestId = runInfo.requestId || genId()
}

/**
 * Finds an endpoint from the given url
 * @param {string} url - like '/v1/user/create' or '/v-last/user/create'
 * @returns {Endpoint}
 * @private
 */
API.prototype._translateURL = function (url) {
	// Translate 'v-last'
	if (url.indexOf('/v-last/') === 0) {
		url = '/v' + this.maxVersion + '/' + url.substr(8)
	}

	return this.endpointByUrl[url]
}

/**
 * Execute an endpoint in this api
 * @param {Endpoint} endpoint
 * @param {Object} body
 * @param {Object} runInfo - data available as `process.domain.runInfo`. See more info in {@link https://www.npmjs.com/package/run-it|run-it} module
 * @param {number} [runInfo.beginTime=Date.now()]
 * @param {string} [runInfo.requestId=genId()]
 * @param {Function} callback - async cb(out)
 * @private
 */
API.prototype._runEndpoint = function (endpoint, body, runInfo, callback) {
	var that = this,
		action = endpoint.action,
		profile = action.profile
	action.getRunner().runInfo(runInfo).exec(body, function (err, out) {
		if (profile) {
			runInfo.profileData = arguments[arguments.length - 1]
		}

		if (err) {
			return that._handleError(err, body, runInfo, endpoint, callback)
		}

		out = profile && arguments.length === 2 ? {} : (out || {})
		if (typeof out !== 'object') {
			throw new Error('The response must be an object')
		}
		out.failure = null
		if (that._onsuccess) {
			that._onsuccess(out, runInfo, scrub(body, that._dataScrub, that._callToJSON), endpoint)
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
	var data = versions(minVersion, this._lifted.actions)

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
	var match = url.match(/^\/(v\d+)\/(.*)$/),
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

	this._handleError(err, body, runInfo, null, callback)
}

/**
 * Treat error cases, formating them to a failure object
 * @param {Object} err
 * @param {Object} body
 * @param {Object} runInfo
 * @param {?Endpoint} endpoint
 * @param {Function} callback - cb(out)
 * @private
 */
API.prototype._handleError = function (err, body, runInfo, endpoint, callback) {
	var code, message

	if (err instanceof APIError) {
		code = err.code
		message = err.message
	} else {
		code = 100
		message = err.message || String(err) || 'Unknown error'
	}

	var out = {
		failure: {
			code: code,
			message: message
		}
	}
	if (this._onfailure) {
		this._onfailure(out, runInfo, scrub(body, this._dataScrub, this._callToJSON), endpoint, err)
	}
	callback(out)
}