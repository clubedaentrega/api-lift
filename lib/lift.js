'use strict'

var liftIt = require('lift-it'),
	APIError = require('./APIError'),
	bodyParser = require('body-parser')

/**
 * Apply the lift process
 * @property {Object} options
 * @returns {Object} - lifted
 */
module.exports = function (options) {
	// Set up lifter
	var lifter = liftIt(options.folder)
	lifter.profile = options.profile
	lifter.errorClass = APIError
	lifter.enableErrorCode = true

	var defaultBodyParser = bodyParser.json(options.bodyParser)

	// Plugins
	lifter.use(liftIt.profile())
	lifter.use(liftIt.validate(options.validate))
	lifter.use(liftIt.validate(options.validateOutput))
	lifter.use(liftIt.filters(options.filters))
	lifter.use(function (action) {
		// Static checks
		var description = action.module.description,
			logRelevance = 'logRelevance' in action.module ? action.module.logRelevance : 1
		if (!description) {
			throw new Error('Missing description parameter')
		} else if (typeof logRelevance !== 'number') {
			throw new Error('Invalid logRelevance parameter')
		}
		action.module.logRelevance = logRelevance

		// Instantiate body parser
		var bodyParserOptions, key
		if (action.module.bodyLimit) {
			// Copy base options and overwrite limit
			bodyParserOptions = {}
			for (key in options.bodyParser) {
				bodyParserOptions[key] = options.bodyParser[key]
			}
			bodyParserOptions.limit = action.module.bodyLimit
			action.module.bodyParser = bodyParser.json(bodyParserOptions)
		} else {
			action.module.bodyParser = defaultBodyParser
		}
	})

	// Custom plugins
	options.plugins.forEach(function (plugin) {
		lifter.use(plugin)
	})

	var lifted = lifter.lift()

	return lifted
}

/**
 * Apply the lean lift process
 * @property {Object} options
 * @returns {Object} - lifted
 * @private
 */
module.exports.lean = function (options) {
	return liftIt.lean(options.folder)
}