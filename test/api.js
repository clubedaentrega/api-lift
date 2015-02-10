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
	router, server, baseUrl, options

describe('api', function () {
	it('should lift and call onerror', function () {
		var ok = false
		options = {
			folder: 'test/api',
			onerror: function (action) {
				action.name.should.be.equal('user/fail')
				ok = true
			}
		}
		router = apiLift(options)
		ok.should.be.true
	})

	it('should start a server', function (done) {
		app.use(router)
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
		options.onsuccess = function (response, req, body, action) {
			response.should.be.eql({
				failure: null
			})
			req.should.be.an.Object
			body.should.be.eql({
				name: 'Gui'
			})
			action.name.should.be.eql('user/create-v1')
			done()
			options.onsuccess = null
		}
		call('v1/user/create', body)
	})

	it('should call onfailure', function (done) {
		options.onfailure = function (response, req, body, action, error) {
			response.failure.code.should.be.equal(101)
			req.should.be.an.Object
			body.should.be.eql({
				name: 'Gui'
			})
			action.name.should.be.eql('user/create')
			error.code.should.be.equal(101)
			done()
			options.onfailure = null
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
		should(err).be.null
		callback && callback(res)
	})
}