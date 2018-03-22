/* globals describe, it*/
'use strict'

let versions = require('../lib/versions'),
	Endpoint = require('../lib/Endpoint')
require('should')

describe('versions', () => {
	it('should return an empty set if no action is given', () => {
		check(0, [], {
			minVersion: 0,
			maxVersion: 0,
			versions: ['v0'],
			endpoints: []
		})
	})

	it('should set all endpoints at the min version if no file has a tag', () => {
		let a = {
			name: 'user/create'
		}

		check(1, [a], {
			minVersion: 1,
			maxVersion: 1,
			versions: ['v1'],
			endpoints: [new Endpoint('user/create', 1, a)]
		})
	})

	it('should not set after the last tagged version if there is no untagged file', () => {
		let a = {
				name: 'user/create-v2'
			},
			b = {
				name: 'user/update'
			}

		check(1, [a], {
			minVersion: 1,
			maxVersion: 3,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [
				new Endpoint('user/create', 2, a),
				new Endpoint('user/create', 1, a)
			]
		})

		check(1, [a, b], {
			minVersion: 1,
			maxVersion: 3,
			versions: ['v1', 'v2', 'v3'],
			endpoints: [
				new Endpoint('user/create', 2, a),
				new Endpoint('user/create', 1, a),
				new Endpoint('user/update', 3, b),
				new Endpoint('user/update', 2, b),
				new Endpoint('user/update', 1, b)
			]
		})
	})

	it('should work for a snapshotted file', () => {
		let a = {
				name: 'user/create-v1'
			},
			b = {
				name: 'user/create'
			}

		check(1, [a, b], {
			minVersion: 1,
			maxVersion: 2,
			versions: ['v1', 'v2'],
			endpoints: [
				new Endpoint('user/create', 2, b),
				new Endpoint('user/create', 1, a)
			]
		})
	})

	it('should raise an error if a tagged file is older than min version', () => {
		let a = {
			name: 'user/create-v2'
		}

		function boom() {
			versions(3, [a])
		}

		boom.should.throw('Uhm... You have told me the minimum version you want to support is 3 but the file user/create-v2 violates this. You must either decrease the min version value or remove the offending file')
	})

	it('should work for all together', () => {
		let a = {
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
			endpoints: [
				new Endpoint('user/create', 3, a),
				new Endpoint('user/create', 2, b),
				new Endpoint('user/create', 1, b),
				new Endpoint('user/old', 1, c),
				new Endpoint('user/current', 3, d),
				new Endpoint('user/current', 2, d),
				new Endpoint('user/current', 1, d)
			]
		})
	})
})

function check(minVersion, actions, answer) {
	answer.endpointByUrl = Object.create(null)
	answer.endpoints.forEach(endpoint => {
		answer.endpointByUrl[endpoint.url] = endpoint
	})
	versions(minVersion, actions).should.be.eql(answer)
}