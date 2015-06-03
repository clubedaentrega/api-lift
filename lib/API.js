'use strict'

var express = require('express'),
	versions = require('./versions'),
	scrub = require('./scrub'),
	APIError = require('./APIError')

/**
 * @class
 * @param {lift-it:Lifted} lifted
 * @param {Array<RegExp>} dataScrub
 * @param {?Function} onsuccess
 * @param {?Function} onfailure
 */
function API(lifted, dataScrub, onsuccess, onfailure) {
	/** @member {express:Router} */
	this.router = new express.Router

	/** @member {number} */
	this.minVersion = 0

	/** @member {number} */
	this.maxVersion = 0

	/** @member {Array<Endpoint>} */
	this.endpoints = []

	/** @member {Object<Endpoint>} */
	this.endpointByUrl = Object.create(null)

	/** @member {lift-it:Lifted} */
	this.lifted = lifted

	/** @param {Array<RegExp>} */
	this.dataScrub = dataScrub

	/** @param {?Function} */
	this.onsuccess = onsuccess

	/** @param {?Function} */
	this.onfailure = onfailure
}

module.exports = API

/**
 * List the endpoint from action names
 * @param {number} minVersion
 */
API.prototype.prepareEndpoints = function (minVersion) {
	var data = versions(minVersion, this.lifted.actions)

	this.minVersion = data.minVersion
	this.maxVersion = data.maxVersion
	this.versions = data.versions
	this.endpoints = data.endpoints
	this.endpointByUrl = data.endpointByUrl
}

/**
 * Execute an endpoint in this api
 * @param {string} url - like '/v1/user/create'
 * @param {Object} body
 * @param {Object} runInfo
 * @param {Function} callback - cb(out)
 */
API.prototype.run = function (url, body, runInfo, callback) {
	// Translate 'v-last'
	if (url.indexOf('/v-last/') === 0) {
		url = '/v' + this.maxVersion + '/' + url.substr(8)
	}

	var endpoint = this.endpointByUrl[url],
		that = this

	if (!endpoint) {
		return this._handleNotFound(url, body, runInfo, callback)
	}

	var action = endpoint.action,
		profile = action.profile
	action.getRunner().runInfo(runInfo).exec(body, function (err, out) {
		if (profile) {
			runInfo.profileData = arguments[arguments.length - 1]
		}

		if (err) {
			err.action = action
			return that._handleError(err, body, runInfo, callback)
		}

		out = profile && arguments.length === 2 ? {} : (out || {})
		if (typeof out !== 'object') {
			throw new Error('The response must be an object')
		}
		out.failure = null
		if (that.onsuccess) {
			that.onsuccess(out, runInfo, scrub(body, that.dataScrub), action)
		}
		callback(out)
	})
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

	this._handleError(err, body, runInfo, callback)
}

/**
 * Treat error cases, formating them to a failure object
 * @param {Object} err
 * @param {Object} body
 * @param {Object} runInfo
 * @param {Function} callback - cb(out)
 * @private
 */
API.prototype._handleError = function (err, body, runInfo, callback) {
	var code, message

	if (err instanceof APIError) {
		code = err.code
		message = err.message
	} else {
		code = 100
		message = err.message || 'Unknown error'
	}

	var out = {
		failure: {
			code: code,
			message: message
		}
	}
	if (this.onfailure) {
		this.onfailure(out, runInfo, scrub(body, this.dataScrub), err.action, err)
	}
	callback(out)
}