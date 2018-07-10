'use strict'

let validateFields = require('validate-fields'),
	path = require('path')

/**
 * @param {API} api
 * @param {number} [version]
 * @returns {Object}
 * @private
 */
module.exports = function (api, version) {
	let prepareEndpoint = api._options.openApi.prepareEndpoint,
		prepareSpec = api._options.openApi.prepareSpec,
		baseSwagger = api._options.openApi.baseSwagger,
		hasApiKeyAuth = api._options.hasApiKeyAuth,
		hasOAuth = api._options.hasOAuth,
		isRest = api._options.isRest,
		errors = api._options.errors

	// Prepare OpenAPI spec
	let spec = {}
	if (baseSwagger) {
		spec = baseSwagger
	}
	spec.swagger = '2.0'
	if (!spec.info) {
		spec.info = {}
	}
	spec.consumes = ['application/json']
	spec.produces = ['application/json']
	spec.paths = {}
	spec.definitions = {}

	// Fill version info
	if (version) {
		spec.info.version = 'v' + String(version)
	} else {
		spec.info.version = 'v' + api.maxVersion + '.' + api.minVersion
	}

	// Fill errors
	if (Object.keys(errors).length !== 0) {
		spec.definitions.failure = {
			type: 'object',
			properties: {
				code: {
					type: 'integer',
					enum: Object.keys(errors).map(code => {
						if (code !== 'globals') {
							return code
						}
					}).filter(Boolean)
				},
				message: {
					type: 'string',
					enum: Object.keys(errors).map(code => {
						if (code !== 'globals') {
							return errors[code]
						}
					}).filter(Boolean)
				}
			}
		}
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
				successCode,
				schema = inSchema ? inSchema.toJSONSchema() : undefined,
				pathComponent = path.resolve(api._options.folder),
				contract = require(pathComponent + '/' + resource + '/contract.json')

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
				// Remove Authorization from schema
				if (hasOAuth) {
					delete schema.properties.Authorization
					let requiredIndex = schema.required.indexOf('Authorization')
					if (requiredIndex > -1) {
						schema.required.splice(requiredIndex, 1)
					}
				}
				// Add schema description to schema according to contract
				if (schema.properties && schema.properties[resource.slice(0, -1)]) {
					insertDescription(contract, schema.properties[resource.slice(0, -1)])
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
					successCode = 201
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
							description: 'Unique resource identification string',
							required: true
						}]
					}
					successCode = 200
					break
				case 'rest_list':
					url = '/' + versionStr + '/' + resource
					method = 'get'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].get = {
						parameters: getQueryParameters(resource, endpoint.action.module.fields, endpoint.action.module.fieldsDescription, '', [])
					}
					successCode = 200
					break
				case 'rest_read':
					url = '/' + versionStr + '/' + resource + '/{id}'
					method = 'get'
					spec.paths[url] = spec.paths[url] || {}
					spec.paths[url].get = {
						parameters: getQueryParameters(resource, endpoint.action.module.fields, endpoint.action.module.fieldsDescription, '', [])
					}
					spec.paths[url].get.parameters.push({
						name: 'id',
						type: 'string',
						in: 'path',
						description: 'Unique resource identification string',
						required: true
					})
					successCode = 200
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
							description: 'Unique resource identification string',
							required: true
						}]
					}
					successCode = 200
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
							description: 'Unique resource identification string',
							required: true
						}]
					}
					successCode = 200

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
			spec.paths[url][method].responses = {}

			// Success responses
			if (outSchema) {
				let outSchemaJSON = outSchema.toJSONSchema()

				// Add schema description to schema according to contract
				if (outSchemaJSON.properties && outSchemaJSON.properties[resource.slice(0, -1)]) {
					insertDescription(contract, outSchemaJSON.properties[resource.slice(0, -1)])
				}
				if (outSchemaJSON.properties && outSchemaJSON.properties[resource]) {
					insertDescription(contract, outSchemaJSON.properties[resource])
				}

				spec.paths[url][method].responses[successCode] = {}
				spec.paths[url][method].responses[successCode].description = 'Success'
				spec.paths[url][method].responses[successCode].schema = outSchemaJSON
				spec.paths[url][method].responses[successCode].schema.properties.failure = {
					type: 'string',
					default: 'null',
					example: 'null',
					description: 'This is JSON null value, not string "null"'
				}
			}

			// Error responses
			// Global errors
			if (Object.keys(errors.globals).length) {
				makeErrorsTable(url, method, errors.globals)
			}

			// Local errors
			if (endpoint.action.module.outErrors) {
				makeErrorsTable(url, method, endpoint.action.module.outErrors)
			}

		}

		// Iterate in obj to get all parameters (excluding resource and auth)
		function getQueryParameters(resource, obj, fields, stack, params) {
			for (let property in obj) {
				if (obj.hasOwnProperty(property)) {
					if (hasApiKeyAuth && property === 'apiKey') {
						continue
					}
					if (hasOAuth && property === 'Authorization') {
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
						params = getQueryParameters(resource, obj[property], fields, newStack, params)
					} else {
						params.push({
							name: newStack,
							in: 'query',
							type: fields[newStack].type,
							description: fields[newStack].description,
							pattern: fields[newStack].pattern
						})
					}
				}
			}
			return params
		}

		// Insert errors in table
		function makeErrorsTable(url, method, obj) {
			Object.keys(obj).forEach(statusCode => {
				let errorDescription = '|Code|Message|\n'
				errorDescription += '|------------ | -------------|\n'
				spec.paths[url][method].responses[statusCode] = {}
				if (obj[statusCode].length) {
					obj[statusCode].forEach(code => {
						errorDescription += '|' + code + '|' + errors[code] + '|\n'
					})
					spec.paths[url][method].responses[statusCode].description = errorDescription
				}
				spec.paths[url][method].responses[statusCode].schema = {
					$ref: '#/definitions/failure'
				}
			})
		}

		// Insert description according to contract
		function insertDescription(objContract, objSchema) {
			if (!objSchema) {
				return
			}
			Object.keys(objContract).forEach(c => {
				if (c === 'description') {
					return
				}
				if (objSchema.type === 'array') {
					if (objSchema.items.hasOwnProperty('$ref')) {
						let ref = objSchema.items.$ref
						ref = ref.split('/')[2]
						delete objSchema.items.$ref
						Object.assign(objSchema.items, spec.definitions[ref])
					}
					return insertDescription(objContract, objSchema.items)
				}

				if (objSchema.hasOwnProperty('$ref')) {
					let ref = objSchema.$ref
					ref = ref.split('/')[2]
					delete objSchema.$ref
					Object.assign(objSchema, spec.definitions[ref])
					return insertDescription(objContract, objSchema)
				}

				if (objSchema.properties[c]) {
					if (objSchema.properties[c].hasOwnProperty('$ref')) {
						let ref = objSchema.properties[c].$ref
						ref = ref.split('/')[2]
						delete objSchema.properties[c].$ref
						// Definition property is make an exclusive now
						Object.assign(objSchema.properties[c], spec.definitions[ref])
					}
					// Exclusive property
					objSchema.properties[c].description = objContract[c].description

				}
				if (Object.keys(objContract[c]).length > 1) {
					insertDescription(objContract[c], objSchema.properties[c])
				}
			})
		}
	})

	return prepareSpec(spec)
}