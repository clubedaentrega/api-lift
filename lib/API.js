'use strict'

var express = require('express'),
	versions = require('./versions'),
	scrub = require('./scrub'),
	genId = require('./genId'),
	APIError = require('./APIError')

/**
 * Represent a lifted API
 *
 * Instances of this class are created internally for you.
 * *You don't need to use this constructor directly.*
 *
 * @class
 * @param {external:lift-it.Lifted} lifted
 * @param {Array<RegExp>} dataScrub
 * @param {Function} callToJSON
 * @param {?Function} onsuccess
 * @param {?Function} onfailure
 */
function API(lifted, dataScrub, callToJSON, onsuccess, onfailure) {
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
	 * @param {Array<RegExp>}
	 * @private
	 */
	this._dataScrub = dataScrub

	/**
	 * @param {Function}
	 * @private
	 */
	this._callToJSON = callToJSON

	/**
	 * @param {?Function}
	 * @private
	 */
	this._onsuccess = onsuccess

	/**
	 * @param {?Function}
	 * @private
	 */
	this._onfailure = onfailure
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
	// Translate 'v-last'
	if (url.indexOf('/v-last/') === 0) {
		url = '/v' + this.maxVersion + '/' + url.substr(8)
	}

	// runInfo is optional
	if (typeof runInfo === 'function') {
		callback = runInfo
		runInfo = {}
	}

	// Prepare runInfo data
	runInfo = runInfo || {}
	runInfo.beginTime = runInfo.beginTime || Date.now()
	runInfo.requestId = runInfo.requestId || genId()

	var endpoint = this.endpointByUrl[url],
		that = this

	if (!endpoint) {
		// Always async
		return process.nextTick(function () {
			that._handleNotFound(url, body, runInfo, callback)
		})
	}

	var action = endpoint.action,
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