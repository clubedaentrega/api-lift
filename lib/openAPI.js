'use strict'

let validateFields = require('validate-fields')

/**
 * @param {API} api
 * @param {number} [version]
 * @returns {Object}
 * @private
 */
module.exports = function (api, version) {
	let prepareEndpoint = api._options.openApi.prepareEndpoint,
		prepareSpec = api._options.openApi.prepareSpec

	// Prepare OpenAPI spec
	let spec = {
		swagger: '2.0',
		info: {
			title: 'API',
			version: 'v'
		},
		consumes: ['application/json'],
		produces: ['application/json'],
		paths: {},
		definitions: {}
	}

	// Fill version info
	if (version) {
		spec.info.version += String(version)
	} else {
		spec.info.version += api.maxVersion + '.' + api.minVersion
	}

	// Collect definitions
	if (api._options.validate.defineTypes) {
		let validate = validateFields()
		api._options.validate.defineTypes(validate)
		let typedefs = validate.getRegisteredTypes().typedefs

		Object.keys(typedefs).forEach(name => {
			spec.definitions[name] = typedefs[name].toJSONSchema(true)
		})
	}

	// Collect endpoints
	api.endpoints.forEach(endpoint => {
		if (version && endpoint.version !== version) {
			// Ignore endpoints from other versions
			return
		}

		let inSchema = endpoint.action.module[(api._options.validate.exportName || 'fields') + '-schema'],
			outSchema = endpoint.action.module[api._options.validateOutput.exportName + '-schema'],
			pathItem = {
				post: {
					parameters: [{
						name: 'json',
						in: 'body',
						required: true
					}],
					responses: {
						200: {
							description: 'Success or error'
						}
					}
				}
			}

		if (inSchema) {
			pathItem.post.parameters[0].schema = inSchema.toJSONSchema()
		}
		if (outSchema) {
			pathItem.post.responses['200'].schema = outSchema.toJSONSchema()
		}

		pathItem = prepareEndpoint(endpoint, pathItem)

		if (pathItem) {
			spec.paths[endpoint.url] = pathItem
		}
	})

	return prepareSpec(spec)
}