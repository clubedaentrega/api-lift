'use strict'

/**
 * @typedef {Object} Action
 * @property {string} name - untagged: 'user/create' or tagged: 'user/create-v2'
 */

/**
 * @typedef {Object} Endpoint
 * @property {string} url - like '/v1/user/create'
 * @property {Action} action
 */

/**
 * @typedef {Object} Versions
 * @property {Array<Endpoint>} endpoints
 * @property {number} minVersion
 * @property {number} maxVersion
 */

/**
 * Find all supported versions and map each endpoint to a file (an action)
 * @param {Object} options
 * @param {number} options.minVersion
 * @param {boolean} options.lastVersionIsDev
 * @param {Array<Action>} actions
 * @returns {Versions}
 */
module.exports = function (options, actions) {
	// The maximum version is the greatest tag + 1
	var minVersion = options.minVersion,
		maxVersion = options.minVersion,
		dev = options.lastVersionIsDev

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
	var endpoints = []
	Object.keys(actionsByName).forEach(function (name) {
		var actions = actionsByName[name],
			version = actions.untagged ? maxVersion : actions.maxVersion,
			action = actions.untagged || actions.tagged[version],
			versionStr

		for (; version >= minVersion; version--) {
			action = actions.tagged[version] || action
			versionStr = version + (version === maxVersion && dev ? '-dev' : '')
			endpoints.push({
				url: '/v' + versionStr + '/' + name,
				action: action
			})
		}
	})

	return {
		endpoints: endpoints,
		minVersion: minVersion,
		maxVersion: maxVersion,
		lastVersionIsDev: dev
	}
}