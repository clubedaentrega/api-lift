/*globals describe, it*/
'use strict'

var versions = require('../lib/versions')
require('should')

describe('versions', function () {
	it('should return an empty set if no action is given', function () {
		versions(0, []).should.be.eql({
			minVersion: 0,
			maxVersion: 0,
			endPoints: []
		})
	})

	it('should set all endpoints at the min version if no file has a tag', function () {
		var a = {
			name: 'user/create'
		}

		versions(1, [a]).should.be.eql({
			minVersion: 1,
			maxVersion: 1,
			endPoints: [{
				url: '/v1/user/create',
				action: a
			}]
		})
	})

	it('should not set after the last tagged version if there is no untagged file', function () {
		var a = {
				name: 'user/create-v2'
			},
			b = {
				name: 'user/update'
			}

		versions(1, [a]).should.be.eql({
			minVersion: 1,
			maxVersion: 3,
			endPoints: [{
				url: '/v2/user/create',
				action: a
			}, {
				url: '/v1/user/create',
				action: a
			}]
		})

		versions(1, [a, b]).should.be.eql({
			minVersion: 1,
			maxVersion: 3,
			endPoints: [{
				url: '/v2/user/create',
				action: a
			}, {
				url: '/v1/user/create',
				action: a
			}, {
				url: '/v3/user/update',
				action: b
			}, {
				url: '/v2/user/update',
				action: b
			}, {
				url: '/v1/user/update',
				action: b
			}]
		})
	})

	it('should work for a snapshotted file', function () {
		var a = {
				name: 'user/create-v1'
			},
			b = {
				name: 'user/create'
			}

		versions(1, [a, b]).should.be.eql({
			minVersion: 1,
			maxVersion: 2,
			endPoints: [{
				url: '/v2/user/create',
				action: b
			}, {
				url: '/v1/user/create',
				action: a
			}]
		})
	})

	it('should raise an error if a tagged file is older than min version', function () {
		var a = {
				name: 'user/create-v2'
			},
			boom = function () {
				versions(3, [a])
			}

		boom.should.throw()
	})

	it('should work for all together', function () {
		var a = {
				name: 'user/create'
			},
			b = {
				name: 'user/create-v2'
			},
			c = {
				name: 'user/old-v1'
			},
			d = {
				name: 'user/current'
			}

		versions(1, [a, b, c, d]).should.be.eql({
			minVersion: 1,
			maxVersion: 3,
			endPoints: [{
				url: '/v3/user/create',
				action: a
			}, {
				url: '/v2/user/create',
				action: b
			}, {
				url: '/v1/user/create',
				action: b
			}, {
				url: '/v1/user/old',
				action: c
			}, {
				url: '/v3/user/current',
				action: d
			}, {
				url: '/v2/user/current',
				action: d
			}, {
				url: '/v1/user/current',
				action: d
			}]
		})
	})
})