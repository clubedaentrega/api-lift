# API Lift

Create a ready-to-go express router for a REST API with filters, input validation, output checking, versioning, automatic routes and logging.

See on [npm](https://www.npmjs.com/package/api-lift)

## Install
`npm install api-lift --save`

## Important note
This module is built on top of [express](https://www.npmjs.com/package/express) and [lift-it](https://www.npmjs.com/package/lift-it) and *is* meant to be very opinionated.

## Status
Stable, missing some docs

## Assumptions
This module is locked down by some strong assumptions:

* The routes are created and named after the files in the file system
* The endpoints are to be implemented as supported by [lift-it](https://www.npmjs.com/package/lift-it). See details in section "Endpoint handler"
* All routes only answer POST requests. All input and output is JSON
* Standard output for success: `{failure:null}`, for error: `{failure:{code:Number,message:String}}`

## Features
Okay, after complying to all the rules outlined above, you get:

* Filters, input validation, output checking and profiling (by `lift-it`)
* Versioning: don't break old consumers and yet let the API evolve
* Logging: simple logging interface to connect to any logging solution (like [log-sink](https://www.npmjs.com/package/log-sink))

## Options
```js
var apiLift = require('api-lift')

var router = apiLift({
	// All options are optional :P
	// The default values are described bellow
	// Some are not configurable and can not be changed,
	// those are listed only for your information
	
	// Options for `lift-it`
	folder: './api',
	profile: false,
	errorClass: apiLift.Error, // <-- can't be changed
	enableErrorCode: true, // <-- can't be changed
	onerror: function (action) {
		// Called for each action (ie, file) that fails to be lifted
		throw action.error
	},
	
	// Options for validate plugin of `lift-it`
	validate: {
		// Use the plugin defaults
	},
	
	// Options for validate plugin of `lift-it`
	validateOutput: {
		direction: 'output', // <-- can't be changed
		exportName: 'outFields',
		optional: true,
		getDefaultValue: function () {
			return {}
		},
		code: 100,
		errorHandler: function (action, value, err) {
			throw err
		},
		options: {
			strict: true
		}
	},

	// Options for filters plugin of `lift-it`
	filters: './filters',
	
	// Options for this module
	minVersion: 1, // the min version to support
	lastVersionIsDev: false, // whether the last version is in development stage
	onsuccess: function (response, req, body, action) {
		// Called right before a request is answered with success
		// `response` is the JSON object to send
		// `req` is the express request object
		// `req.beginTime` is the value of Date.now() when the request was received
		// `req.profileData` is the profile data (if enabled)
		// `body` is the cleaned (see bellow) JSON input
		// `action` is the lift-it action object
	},
	onfailure: function (response, req, body, action, error) {
		// Called right before a request is answered with error
		// `response`, `req`, `body` and `action` behave the same as onsuccess
		// `action` may be undefined if the error is not linked to any action
		// `error` is the original error object
	}
})

// `router` is an express router object
// You can, for example:
var app = apiLift.express() // see note bellow about apiLift.express
app.use('/api', router)
require('http').createServer(app).listen(80)
```

This module uses `express` internally to create the router object. To avoid compatibility problems, it's adviced to use the same lib this module is using. This is exported as `require('api-lift').express`

The parameter `body` given to `onsuccess` and `onfailure` have had any property that contains 'session', 'password', 'serial' or 'token' in its name (case-insensitive) removed (even in deep objects and arrays). This is meant to make it log-safe.

## Returned router
The output of the lifting process is an express Router instance with some added properties:

* `router.minVersion`: number
* `router.maxVersion`: number
* `router.lastVersionIsDev`: boolean
* `router.versions`: an array of version names (as string), ordered from oldest to newest. Example: `['v3', 'v4', 'v5-dev']`
* `router.endpoints`: an array of objects like: `{url: string, name: string, versionStr: string, version: string, isDev: boolean, isLast: boolean, action: Action}` (see lift-it module for details about `Action` instances)
* `router.lifted`: a `Lifted` instance (see lift-it module)

If you are not interested in the router, but in the returned meta-data (like max version), use `apiLift.info(options)` instead:

```js
var apiLift = require('api-lift')

var info = apiLift.info({
	// The default values are described bellow
	folder: './api',
	minVersion: 1,
	lastVersionIsDev: false
})

info.maxVersion // a number
```

## Versioning
This module aims to make endpoint versioning very simple, pragmatic and source-control friendly. The system only cares about backwards-incompatible changes, that is, MAJOR changes (as defined by [semantic versioning](http://semver.org/)).

By default (`options.minVersion`), all endpoints start at version 1. That is, a file in the path `api/user/create.js` is served at the url `/v1/user/create`. If a breaking change is to be made in this endpoint, the API version must be bumped to 2. To do this, the current file is copied to `api/user/create-v1.js` and new changes can be freely applied to the current `api/user/create.js` file. The new url will be `/v2/user/create` and will be mapped to the current file. The old url will keep working and will point to the old v1 file. Any other endpoint that hasn't been changed will be served equally in v1 and v2. Magic!

Note that the v1 file is like a snapshot. From the point of view of a revision control system (like git), the file has evolved linearly: no move/rename or any other trick (like symlinks).

After some time, the support for version 1 may be dropped, by increasing the `minVersion` option and removing old v1 files.

If needed, the most recent version, including development versions, is available under `v-last`, like `/v-last/user/create`.

### Complete example
For the following files in the api folder:
```
api
	user
		create.js
		create-v2.js
		findbyname-v1.js
		getinfo.js
```

Assuming `minVersion` is 1, those endpoints will be created:
```
/v1
	/user/create -> api/user/create-v2.js
	/user/findbyname -> api/user/findbyname-v1.js
	/user/getinfo -> api/user/getinfo.js
/v2
	/user/create -> api/user/create-v2.js
	/user/getinfo -> api/user/getinfo.js
/v3 and /v-last
	/user/create -> api/user/create.js
	/user/getinfo -> api/user/getinfo.js
```

The file `api/user/getinfo.js` is available in all versions. `api/user/create-v2.js` is the snapshot for v1 and v2, `api/user/create.js` is used in v3. `api/user/findbyname-v1.js` is the snapshot for v1 only and is not available in next versions.

### Development version
The last version may be in development stage and not yet ready to provide backwards compatible coverage. In this situation `options.lastVersionIsDev` should be set to `true`. This will let the team work on a bigger feature and warn possible consumers that the version is under active development and backwards compatibility may not be honored.

An example to ilustrate and help understand its use:  
Imagine two endpoints `/v4/A` (file `api/A.js`) and `/v4/B` (file `api/B.js`), both at the current version (v4). The next version (v5) will bring breaking changes to both. The implementation will happen in three steps.  
The first step will snapshot `api/A.js` to `api/A-v4.js`, set `lastVersionIsDev` and then change
`api/A.js`. This step alone will bump the current version to v5-dev, keep old v4 routes working as before and route `/v5-dev/A` to the new implementation. At this point `/v5-dev/B` will map to old (v4) behaviour, since the action `/api/B.js` remained the same in this first step.  
The second step will snapshot `api/B-v4.js` and change `api/B.js`. This will change the behaviour of `/v5-dev/B` accordingly. Note that this does not honor backwards compatibility, since the same endpoint (under the same URL) went through a breaking change. But who else was using this endpoint has already been advised it could happen.  
The third step will unset `lastVersionIsDev`. This will remove support for v5-dev and enable support for v5. For this point on, v5 backwards compatibility should be ensured.

## Logging
TODO

## Endpoint handler
TODO

## Error codes
TODO
