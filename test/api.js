/*globals describe, it*/
'use strict'

var apiLift = require('../'),
	app = apiLift.express(),
	http = require('http'),
	request = require('request'),
	should = require('should'),
	body = {
		name: 'Gui',
		password: '123'
	},
	api, server, baseUrl, options

describe('api', function () {
	it('should lift', function () {
		options = {
			folder: 'test/api'
		}
		api = apiLift(options)
	})

	it('should start a server', function (done) {
		app.use(api.router)
		server = http.createServer(app).listen(0, function () {
			baseUrl = 'http://localhost:' + server.address().port + '/'
			done()
		})
	})

	it('should create the route for /v1/user/create -> create-v1.js', function (done) {
		call('v1/user/create', body, function (res) {
			res.should.be.eql({
				failure: null
			})
			done()
		})
	})

	it('should create the route for /v2/user/create -> create.js', function (done) {
		call('v2/user/create', body, function (res) {
			res.failure.code.should.be.equal(101)
			done()
		})
	})

	it('should call onsuccess', function (done) {
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

	it('should call onfailure', function (done) {
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

	it('should warn about unsupported version', function (done) {
		call('v0/user/create', body, function (res) {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal('Version v0 is not supported. Supported versions are: v1, v2')
			done()
		})
	})

	it('should warn about unknown version', function (done) {
		call('v10/user/create', body, function (res) {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal(
				'Version v10 is not supported. Supported versions are: v1, v2')
			done()
		})
	})

	it('should warn about non existent endpoint', function (done) {
		call('v1/i/do/not/exist', body, function (res) {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal('The action i/do/not/exist does not exists in version v1')
			done()
		})
	})

	it('should warn about invalid URL structure', function (done) {
		call('not/valid', body, function (res) {
			res.failure.code.should.be.equal(199)
			res.failure.message.should.be.equal('Invalid path format, expected something like /v2/user/create')
			done()
		})
	})

	it('should expose the run() method to call endpoints', function (done) {
		api.run('/v2/user/create', body, function (out) {
			out.should.be.eql({
				failure: {
					code: 101,
					message: 'I was expecting at least 6 chars in password'
				}
			})
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
	}, function (err, _, res) {
		should(err).be.null()
		if (callback) {
			callback(res)
		}
	})
}