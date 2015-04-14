/*globals describe, it*/
'use strict'

var versions = require('../lib/versions')
require('should')

describe('versions', function () {
	it('should return an empty set if no action is given', function () {
		versions({
			minVersion: 0,
			lastVersionIsDev: false
		}, []).should.be.eql({
			minVersion: 0,
			maxVersion: 0,
			lastVersionIsDev: false,
			versions: ['v0'],
			endpoints: []
		})
	})

	it('should set all endpoints at the min version if no file has a tag', function () {
		var a = {
			name: 'user/create'
		}

		versions({
			minVersion: 1,
			lastVersionIsDev: false
		}, [a]).should.be.eql({
			minVersion: 1,
			maxVersion: 1,
			lastVersionIsDev: false,
			versions: ['v1'],
			endpoints: [{
				url: '/v-last/user/create',
				versionStr: 'v-last',
				isLast: true,
				action: a
			}, {
				url: '/v1/user/create',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
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

		versions({
			minVersion: 1,
			lastVersionIsDev: false
		}, [a]).should.be.eql({
			minVersion: 1,
			maxVersion: 3,
			lastVersionIsDev: false,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [{
				url: '/v2/user/create',
				versionStr: 'v2',
				version: 2,
				isLast: false,
				isDev: false,
				action: a
			}, {
				url: '/v1/user/create',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: a
			}]
		})

		versions({
			minVersion: 1,
			lastVersionIsDev: false
		}, [a, b]).should.be.eql({
			minVersion: 1,
			maxVersion: 3,
			lastVersionIsDev: false,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [{
				url: '/v2/user/create',
				versionStr: 'v2',
				version: 2,
				isLast: false,
				isDev: false,
				action: a
			}, {
				url: '/v1/user/create',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: a
			}, {
				url: '/v-last/user/update',
				versionStr: 'v-last',
				isLast: true,
				action: b
			}, {
				url: '/v3/user/update',
				versionStr: 'v3',
				version: 3,
				isLast: false,
				isDev: false,
				action: b
			}, {
				url: '/v2/user/update',
				versionStr: 'v2',
				version: 2,
				isLast: false,
				isDev: false,
				action: b
			}, {
				url: '/v1/user/update',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
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

		versions({
			minVersion: 1,
			lastVersionIsDev: false
		}, [a, b]).should.be.eql({
			minVersion: 1,
			maxVersion: 2,
			lastVersionIsDev: false,
			versions: ['v1', 'v2'],
			endpoints: [{
				url: '/v-last/user/create',
				versionStr: 'v-last',
				isLast: true,
				action: b
			}, {
				url: '/v2/user/create',
				versionStr: 'v2',
				version: 2,
				isLast: false,
				isDev: false,
				action: b
			}, {
				url: '/v1/user/create',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: a
			}]
		})
	})

	it('should raise an error if a tagged file is older than min version', function () {
		var a = {
				name: 'user/create-v2'
			},
			boom = function () {
				versions({
					minVersion: 3,
					lastVersionIsDev: false
				}, [a])
			}

		boom.should.throw('Uhm... You have told me the minimum version you want to support is 3 but the file user/create-v2 violates this. You must either decrease the min version value or remove the offending file')
	})

	it('should create dev routes', function () {
		var a = {
				name: 'user/create-v1'
			},
			b = {
				name: 'user/create'
			}

		versions({
			minVersion: 1,
			lastVersionIsDev: true
		}, [a, b]).should.be.eql({
			minVersion: 1,
			maxVersion: 2,
			lastVersionIsDev: true,
			versions: ['v1', 'v2-dev'],
			endpoints: [{
				url: '/v-last/user/create',
				versionStr: 'v-last',
				isLast: true,
				action: b
			}, {
				url: '/v2-dev/user/create',
				versionStr: 'v2-dev',
				version: 2,
				isLast: false,
				isDev: true,
				action: b
			}, {
				url: '/v1/user/create',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: a
			}]
		})
	})

	it('should work when there is no stable version', function () {
		var a = {
			name: 'user/create'
		}

		versions({
			minVersion: 1,
			lastVersionIsDev: true
		}, [a]).should.be.eql({
			minVersion: 1,
			maxVersion: 1,
			lastVersionIsDev: true,
			versions: ['v1-dev'],
			endpoints: [{
				url: '/v-last/user/create',
				versionStr: 'v-last',
				isLast: true,
				action: a
			}, {
				url: '/v1-dev/user/create',
				versionStr: 'v1-dev',
				version: 1,
				isLast: false,
				isDev: true,
				action: a
			}]
		})
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

		versions({
			minVersion: 1,
			lastVersionIsDev: true
		}, [a, b, c, d]).should.be.eql({
			minVersion: 1,
			maxVersion: 3,
			lastVersionIsDev: true,
			versions: ['v1', 'v2', 'v3-dev'],
			endpoints: [{
				url: '/v-last/user/create',
				versionStr: 'v-last',
				isLast: true,
				action: a
			}, {
				url: '/v3-dev/user/create',
				versionStr: 'v3-dev',
				version: 3,
				isLast: false,
				isDev: true,
				action: a
			}, {
				url: '/v2/user/create',
				versionStr: 'v2',
				version: 2,
				isLast: false,
				isDev: false,
				action: b
			}, {
				url: '/v1/user/create',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: b
			}, {
				url: '/v1/user/old',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: c
			}, {
				url: '/v-last/user/current',
				versionStr: 'v-last',
				isLast: true,
				action: d
			}, {
				url: '/v3-dev/user/current',
				versionStr: 'v3-dev',
				version: 3,
				isLast: false,
				isDev: true,
				action: d
			}, {
				url: '/v2/user/current',
				versionStr: 'v2',
				version: 2,
				isLast: false,
				isDev: false,
				action: d
			}, {
				url: '/v1/user/current',
				versionStr: 'v1',
				version: 1,
				isLast: false,
				isDev: false,
				action: d
			}]
		})
	})
})