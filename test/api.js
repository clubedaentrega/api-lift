/* globals describe, it*/
'use strict'

let apiLift = require('../'),
	app = apiLift.express(),
	http = require('http'),
	request = require('request'),
	should = require('should'),
	body = {
		name: 'Gui',
		password: '123'
	},
	api, server, baseUrl, options

describe('api', () => {
	it('should lift', () => {
		options = {
			folder: 'test/api',
			openApi: {
				serve: true
			}
		}
		api = apiLift(options)
	})

	it('should start a server', done => {
		app.use(api.router)
		server = http.createServer(app).listen(0, () => {
			baseUrl = 'http://localhost:' + server.address().port + '/'
			done()
		})
	})

	it('should create the route for /v1/user/create -> create-v1.js', done => {
		call('v1/user/create', body, res => {
			res.should.be.eql({
				failure: null
			})
			done()
		})
	})

	it('should create the route for /v2/user/create -> create.js', done => {
		call('v2/user/create', body, res => {
			res.failure.code.should.be.equal(101)
			done()
		})
	})

	it('should call onsuccess', done => {
		api._onsuccess = function (response, runInfo, body, endpoint) {
			response.should.be.eql({
				failure: null
			})

			runInfo.should.be.an.Object()
			runInfo.req.should.be.an.Object()
			runInfo.requestId.should.be.a.String().with.length(24)
			runInfo.beginTime.should.be.a.Number()

			body.should.be.eql({
				name: 'Gui',
				password: '[HIDDEN]'
			})

			endpoint.name.should.be.equal('user/create')
			endpoint.action.name.should.be.equal('user/create-v1')

			api._onsuccess = null
			done()
		}
		call('v1/user/create', body)
	})

	it('should call onfailure', done => {
		api._onfailure = function (response, runInfo, body, endpoint, error) {
			response.failure.code.should.be.equal(101)

			runInfo.should.be.an.Object()
			runInfo.req.should.be.an.Object()
			runInfo.requestId.should.be.a.String().with.length(24)
			runInfo.beginTime.should.be.a.Number()

			body.should.be.eql({
				name: 'Gui',
				password: '[HIDDEN]'
			})

			endpoint.name.should.be.equal('user/create')
			endpoint.action.name.should.be.equal('user/create')

			error.code.should.be.equal(101)
			api._onfailure = null
			done()
		}
		call('v2/user/create', body)
	})

	it('should call ontimeout', done => {
		api._timeout = 100
		api._ontimeout = function (runInfo, body, endpoint) {
			runInfo.should.be.an.Object()
			runInfo.req.should.be.an.Object()
			runInfo.requestId.should.be.a.String().with.length(24)
			runInfo.beginTime.should.be.a.Number()
			runInfo.profileData.should.be.an.Array()

			body.should.be.eql({
				name: 'Gui',
				password: '[HIDDEN]'
			})

			endpoint.name.should.be.equal('user/create')
			endpoint.action.name.should.be.equal('user/create')

			api._ontimeout = null
			done()
		}
		call('v2/user/create', {
			name: 'Gui',
			password: 'timeout'
		})
	})

	it('should warn about unsupported version', done => {
		call('v0/user/create', body, res => {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal('Version v0 is not supported. Supported versions are: v1, v2')
			done()
		})
	})

	it('should warn about unknown version', done => {
		call('v10/user/create', body, res => {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal(
				'Version v10 is not supported. Supported versions are: v1, v2'
			)
			done()
		})
	})

	it('should warn about non existent endpoint', done => {
		call('v1/i/do/not/exist', body, res => {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal('The action i/do/not/exist does not exists in version v1')
			done()
		})
	})

	it('should warn about invalid URL structure', done => {
		call('not/valid', body, res => {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal('Invalid path format, expected something like /v2/user/create')
			done()
		})
	})

	it('should warn about request body to large', done => {
		call('v2/user/update', body, res => {
			res.failure.code.should.be.equal(100)
			res.failure.message.should.be.equal('request entity too large')
			done()
		})
	})

	it('should expose the run() method to call endpoints', done => {
		api.run('/v2/user/create', body, out => {
			out.should.be.eql({
				failure: {
					code: 101,
					message: 'I was expecting at least 6 chars in password'
				}
			})
			done()
		})
	})

	it('should create the open api spec', () => {
		let v1PathItem = {
				post: {
					parameters: [{
						name: 'json',
						in: 'body',
						required: true,
						schema: {
							type: 'object',
							properties: {
								name: {
									type: 'string'
								},
								password: {
									type: 'string'
								}
							},
							required: ['name', 'password']
						}
					}],
					responses: {
						200: {
							description: 'Success or error',
							schema: {
								type: 'object',
								properties: {}
							}
						}
					}
				}
			},
			v2PathItem = {
				post: {
					parameters: [{
						name: 'json',
						in: 'body',
						required: true,
						schema: {
							type: 'object',
							properties: {
								name: {
									type: 'string'
								},
								password: {
									type: 'string',
									minLength: 6
								}
							},
							required: ['name', 'password']
						}
					}],
					responses: {
						200: {
							description: 'Success or error'
						}
					}
				}
			},
			updatePathItem = v2PathItem

		api.getOpenAPISpec().should.be.eql({
			swagger: '2.0',
			info: {
				version: 'v2.1'
			},
			consumes: ['application/json'],
			produces: ['application/json'],
			paths: {
				'/v1/user/create': v1PathItem,
				'/v2/user/create': v2PathItem,
				'/v1/user/update': updatePathItem,
				'/v2/user/update': updatePathItem
			},
			definitions: {}
		})

		api.getOpenAPISpec(2).should.be.eql({
			swagger: '2.0',
			info: {
				version: 'v2'
			},
			consumes: ['application/json'],
			produces: ['application/json'],
			paths: {
				'/v2/user/create': v2PathItem,
				'/v2/user/update': updatePathItem
			},
			definitions: {}
		})
	})

	it('should serve the open api spec', done => {
		request({
			url: baseUrl + 'v-last/swagger.json'
		}, (err, _, res) => {
			should(err).be.null()
			let spec = JSON.parse(res)
			spec.info.version.should.be.equal('v2')
			done()
		})
	})
})

/**
 * @param {string} name
 * @param {Object} body
 * @param {function(Object)} [callback]
 */
function call(name, body, callback) {
	request({
		url: baseUrl + name,
		method: 'POST',
		json: body
	}, (err, _, res) => {
		should(err).be.null()
		if (callback) {
			return callback(res)
		}
	})
}