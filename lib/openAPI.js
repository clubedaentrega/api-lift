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
		prepareSpec = api._options.openApi.prepareSpec,
		hasApiKeyAuth = api._options.hasApiKeyAuth,
		isRest = api._options.isRest

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

	if (hasApiKeyAuth) {
		spec.securityDefinitions = {
			apiKey: {
				type: 'apiKey',
				name: 'apiKey',
				in: 'header',
				description: 'Token with 32 characters hex'
			}
		}
		spec.security = [{
			apiKey: []
		}]
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
			outSchema = endpoint.action.module[api._options.validateOutput.exportName + '-schema']

		if (!isRest) {
			// Using api only with post method
			let pathItem = {
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
		} else {

			let parts = endpoint.name.split('/'),
				resource = parts[0],
				action = parts[1],
				versionStr = endpoint.versionStr,
				method,
				url,
				schema = inSchema ? inSchema.toJSONSchema() : undefined

			if (schema) {
				// Remove resource from schema
				delete schema.properties[resource]
				let requiredIndex = schema.required.indexOf(resource)
				if (requiredIndex > -1) {
					schema.required.splice(requiredIndex, 1)
				}
				// Remove apiKey from schema
				if (hasApiKeyAuth) {
					delete schema.properties.apiKey
					let requiredIndex = schema.required.indexOf('apiKey')
					if (requiredIndex > -1) {
						schema.required.splice(requiredIndex, 1)
					}
				}
				if (!Object.keys(schema.properties).length) {
					schema = undefined
				}
			}
			switch (action) {
				case 'rest_create':
					url = '/' + versionStr + '/' + resource
					method = 'post'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].post = {
						parameters: []
					}
					break
				case 'rest_delete':
					url = '/' + versionStr + '/' + resource + '/{id}'
					method = 'delete'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].delete = {
						parameters: [{
							name: 'id',
							type: 'string',
							in: 'path',
							required: true
						}]
					}
					break
				case 'rest_list':
					url = '/' + versionStr + '/' + resource
					method = 'get'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].get = {
						parameters: getQueryParameters(resource, endpoint.action.module.fields, '', [])
					}
					break
				case 'rest_read':
					url = '/' + versionStr + '/' + resource + '/{id}'
					method = 'get'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].get = {
						parameters: getQueryParameters(resource, endpoint.action.module.fields, '', [])
					}
					spec.paths[url].get.parameters.push({
						name: 'id',
						type: 'string',
						in: 'path',
						required: true
					})
					break
				case 'rest_update':
					url = '/' + versionStr + '/' + resource + '/{id}'
					method = 'put'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].put = {
						parameters: [{
							name: 'id',
							type: 'string',
							in: 'path',
							required: true
						}]
					}
					break
				default:
					url = '/' + versionStr + '/' + resource + '/{id}/' + action
					method = 'post'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].post = {
						parameters: [{
							name: 'id',
							type: 'string',
							in: 'path',
							required: true
						}]
					}

			}

			if (schema && method !== 'get') {
				spec.paths[url][method].parameters.push({
					name: 'json',
					in: 'body',
					required: true,
					schema
				})
			} else {
				spec.paths[url][method].consumes = []
			}
			spec.paths[url][method].summary = endpoint.action.module.description
			spec.paths[url][method].tags = [resource]
			spec.paths[url][method].responses = {
				200: {
					description: 'Success'
				}
			}
			if (outSchema) {
				spec.paths[url][method].responses['200'].schema = outSchema.toJSONSchema()
				spec.paths[url][method].responses['200'].schema.properties.failure = {
					type: 'string',
					default: 'null',
					example: 'null',
					description: 'This is JSON null value, not string "null"'
				}
			}
		}

		// Iterate in obj to get all parameters (excluding resource and auth)
		function getQueryParameters(resource, obj, stack, params) {
			for (let property in obj) {
				if (obj.hasOwnProperty(property)) {
					if (hasApiKeyAuth && property === 'apiKey') {
						continue
					}
					property = property.split('?')[0].split('=')[0]
					if (property === resource) {
						continue
					}
					let newStack = stack ? stack + '.' + property : property
					if (typeof obj[property] === 'object') {
						params.push({
							name: newStack,
							in: 'query',
							type: 'string'
						})
						params = getQueryParameters(resource, obj[property], newStack, params)
					} else {
						params.push({
							name: newStack,
							in: 'query',
							type: 'string'
						})
					}
				}
			}
			return params
		}
	})

	return prepareSpec(spec)
}