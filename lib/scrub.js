'use strict'

/**
 * Return a cleaned version of the request body
 * @param {Object} obj
 * @param {Array<RegExp>} dataScrub
 * @param {function(Object):*} callToJSON
 * @returns {Object}
 */
module.exports = function (obj, dataScrub, callToJSON) {
	var copy = function (x) {
		var r, key, shouldScrub, i

		if (x && x.toJSON && typeof x.toJSON === 'function') {
			x = callToJSON(x)
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
			x = callToJSON(x)
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

	return copy(obj)
}