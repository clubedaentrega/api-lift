'use strict'

var Endpoint = require('./Endpoint')

/**
 * @typedef {Object} Action
 * @property {string} name - untagged: 'user/create' or tagged: 'user/create-v2'
 */

/**
 * @typedef {Object} Versions
 * @property {Array<Endpoint>} endpoints
 * @property {Object<Endpoint>} endpointByUrl
 * @property {number} minVersion
 * @property {number} maxVersion
 * @property {Array<string>} versions - like `['v1', 'v2']`, ordered in ascending order
 */

/**
 * Find all supported versions and map each endpoint to a file (an action)
 * @param {number} minVersion
 * @param {Array<Action>} actions
 * @returns {Versions}
 */
module.exports = function (minVersion, actions) {
	// The maximum version is the greatest tag + 1
	var maxVersion = minVersion

	// Group actions by root name
	// 'user/create-v2' -> root='user/create', tag=2
	// 'user/create' -> root='user/create', tag=-1
	var actionsByName = Object.create(null)
	actions.forEach(function (action) {
		var match = action.name.match(/^(.*?)(?:-v(\d+))?$/),
			rootName = match[1],
			tag, group

		if (!(rootName in actionsByName)) {
			actionsByName[rootName] = {
				untagged: null,
				tagged: [],
				maxVersion: -1
			}
		}
		group = actionsByName[rootName]

		if (match[2]) {
			tag = Number(match[2])
			if (tag < minVersion) {
				throw new Error('Uhm... You have told me the minimum version you want ' +
					'to support is ' + minVersion + ' but the file ' + action.name +
					' violates this. You must either decrease the min version value or ' +
					'remove the offending file')
			}
			group.tagged[tag] = action
			group.maxVersion = Math.max(group.maxVersion, tag)
			maxVersion = Math.max(maxVersion, tag + 1)
		} else {
			group.untagged = action
		}
	})

	// Create the endpoints for each version
	var endpoints = [],
		endpointByUrl = Object.create(null)
	Object.keys(actionsByName).forEach(function (name) {
		var actions = actionsByName[name],
			version = actions.untagged ? maxVersion : actions.maxVersion,
			action = actions.untagged || actions.tagged[version],
			versionStr, endpoint

		for (; version >= minVersion; version--) {
			action = actions.tagged[version] || action
			versionStr = 'v' + version
			endpoint = new Endpoint(name, version, action)
			endpoints.push(endpoint)
			endpointByUrl[endpoint.url] = endpoint
		}
	})

	// Create the version name list
	var versions = [],
		version
	for (version = minVersion; version <= maxVersion; version++) {
		versions.push('v' + version)
	}

	return {
		endpoints: endpoints,
		endpointByUrl: endpointByUrl,
		minVersion: minVersion,
		maxVersion: maxVersion,
		versions: versions
	}
}