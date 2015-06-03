/*globals describe, it*/
'use strict'

var versions = require('../lib/versions')
require('should')

describe('versions', function () {
	it('should return an empty set if no action is given', function () {
		check(0, [], {
			minVersion: 0,
			maxVersion: 0,
			versions: ['v0'],
			endpoints: []
		})
	})

	it('should set all endpoints at the min version if no file has a tag', function () {
		var a = {
			name: 'user/create'
		}

		check(1, [a], {
			minVersion: 1,
			maxVersion: 1,
			versions: ['v1'],
			endpoints: [{
				url: '/v1/user/create',
				name: 'user/create',
				versionStr: 'v1',
				version: 1,
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

		check(1, [a], {
			minVersion: 1,
			maxVersion: 3,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [{
				url: '/v2/user/create',
				name: 'user/create',
				versionStr: 'v2',
				version: 2,
				action: a
			}, {
				url: '/v1/user/create',
				name: 'user/create',
				versionStr: 'v1',
				version: 1,
				action: a
			}]
		})

		check(1, [a, b], {
			minVersion: 1,
			maxVersion: 3,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [{
				url: '/v2/user/create',
				name: 'user/create',
				versionStr: 'v2',
				version: 2,
				action: a
			}, {
				url: '/v1/user/create',
				name: 'user/create',
				versionStr: 'v1',
				version: 1,
				action: a
			}, {
				url: '/v3/user/update',
				name: 'user/update',
				versionStr: 'v3',
				version: 3,
				action: b
			}, {
				url: '/v2/user/update',
				name: 'user/update',
				versionStr: 'v2',
				version: 2,
				action: b
			}, {
				url: '/v1/user/update',
				name: 'user/update',
				versionStr: 'v1',
				version: 1,
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

		check(1, [a, b], {
			minVersion: 1,
			maxVersion: 2,
			versions: ['v1', 'v2'],
			endpoints: [{
				url: '/v2/user/create',
				name: 'user/create',
				versionStr: 'v2',
				version: 2,
				action: b
			}, {
				url: '/v1/user/create',
				name: 'user/create',
				versionStr: 'v1',
				version: 1,
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

		boom.should.throw('Uhm... You have told me the minimum version you want to support is 3 but the file user/create-v2 violates this. You must either decrease the min version value or remove the offending file')
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

		check(1, [a, b, c, d], {
			minVersion: 1,
			maxVersion: 3,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [{
				url: '/v3/user/create',
				name: 'user/create',
				versionStr: 'v3',
				version: 3,
				action: a
			}, {
				url: '/v2/user/create',
				name: 'user/create',
				versionStr: 'v2',
				version: 2,
				action: b
			}, {
				url: '/v1/user/create',
				name: 'user/create',
				versionStr: 'v1',
				version: 1,
				action: b
			}, {
				url: '/v1/user/old',
				name: 'user/old',
				versionStr: 'v1',
				version: 1,
				action: c
			}, {
				url: '/v3/user/current',
				name: 'user/current',
				versionStr: 'v3',
				version: 3,
				action: d
			}, {
				url: '/v2/user/current',
				name: 'user/current',
				versionStr: 'v2',
				version: 2,
				action: d
			}, {
				url: '/v1/user/current',
				name: 'user/current',
				versionStr: 'v1',
				version: 1,
				action: d
			}]
		})
	})
})

function check(minVersion, actions, answer) {
	answer.endpointByUrl = Object.create(null)
	answer.endpoints.forEach(function (endpoint) {
		answer.endpointByUrl[endpoint.url] = endpoint
	})
	versions(minVersion, actions).should.be.eql(answer)
}