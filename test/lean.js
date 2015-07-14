/*globals describe, it*/
'use strict'

var apiLift = require('../')
require('should')

describe('info', function () {
	var info
	it('should only get info', function () {
		info = apiLift.info({
			folder: 'test/api'
		})

		info.minVersion.should.be.equal(1)
		info.maxVersion.should.be.equal(2)
		info.versions.should.be.eql(['v1', 'v2'])
		info.endpoints.should.have.length(2)

		info.endpoints[0].url.should.be.equal('/v2/user/create')
		info.endpoints[0].action.name.should.be.equal('user/create')
	})
})