# API Lift
[![Build Status](https://travis-ci.org/clubedaentrega/api-lift.svg?branch=master)](https://travis-ci.org/clubedaentrega/api-lift)
[![Inline docs](https://inch-ci.org/github/clubedaentrega/api-lift.svg?branch=master)](https://inch-ci.org/github/clubedaentrega/api-lift)
[![Dependency Status](https://david-dm.org/clubedaentrega/api-lift.svg)](https://david-dm.org/clubedaentrega/api-lift)

Create a ready-to-go express router for a REST API with filters, input validation, output checking, versioning, automatic routes and logging.

See on [npm](https://www.npmjs.com/package/api-lift)

## Install
`npm install api-lift`

## Important note
This module is built on top of [express](https://www.npmjs.com/package/express) and [lift-it](https://www.npmjs.com/package/lift-it) and *is* meant to be very opinionated.

## Status
Stable, missing some docs

## Assumptions
This module is locked down by some strong assumptions:

* The routes are created and named after the files in the file system
* The endpoints are to be implemented as supported by [lift-it](https://www.npmjs.com/package/lift-it). See details in section "Endpoint handler"
* Works with REST pattern, generating the following routes for each http method:
	* DELETE /resource/id -> call resource/rest_delete.js
	* GET /resource -> call resource/rest_read.js
	* PUT /resource/id -> call resource/rest_update.js
	* POST /resource -> call resource/rest_create.js
	* POST /resource/id/action -> call resource/action.js
* Params GET (in GET method), resource id (from url) and headers vars (described in headers options) will be added to json body in the endpoints calls
* Standard output for success: `{failure:null}`, for error: `{failure:{code:Number,message:String}}`

## Features
Okay, after complying to all the rules outlined above, you get:

* Filters, input validation, output checking and profiling (by `lift-it`)
* Versioning: don't break old consumers and yet let the API evolve
* Logging: simple logging interface to connect to any logging solution (like [log-sink](https://www.npmjs.com/package/log-sink))

## Options
```js
let apiLift = require('api-lift')

let api = apiLift({
	// All options are optional :P
	// The default values are described bellow
	// Some are not configurable and can not be changed,
	// those are listed only for your information
	
	// Options for `lift-it`
	folder: './api',
	profile: false,
	errorClass: apiLift.APIError, // <-- can't be changed
	enableErrorCode: true, // <-- can't be changed
	// Custom lift-it plugins to use
	plugins: [],
	
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
	
	// Options for bodyParser.json() of `body-parser`
	bodyParser: {},
	
	// Options for this module
	minVersion: 1, // the min version to support
	dataScrub: [/session|password|serial|token/i], // describe fields to hide in the body
	headers: [], // HTTP header variables that will be passed in json to the endpoints
	checkId: function(x){
		// Checks whether the string x is an id of the resource
	},
	callToJSON: function (x) {
		// function to convert log value to JSON
		return x.toJSON()
	},
	onsuccess: function (response, runInfo, body, endpoint) {
		// Called right before a request is answered with success
		// `response` is the JSON object to send
		// `runInfo` carries data about the execution
		// `runInfo.req` is the express request object (if routed with express)
		// `runInfo.requestId` a unique identifier for this execution
		// `runInfo.beginTime` is the value of Date.now() when the request was received
		// `runInfo.profileData` is the profile data (if enabled)
		// `body` is the cleaned (see bellow) JSON input
		// `endpoint` is the instance of the executed Endpoint
	},
	onfailure: function (response, runInfo, body, endpoint, error) {
		// Called right before a request is answered with error
		// `response`, `runInfo`, `body` and `endpoint` behave the same as onsuccess
		// `endpoint` may be undefined if the error is not linked to any
		// `error` is the original error object
	},
	timeout: 30e3,
	ontimeout: function (runInfo, body, endpoint) {
		// Called when an endpoint does not resolve within time
		// `runInfo`, `body` and `endpoint` behave the same as onsuccess
		// The timeout will not interfere on the endpoint's normal operation, that is,
		// the request won't be modified in any way and the endpoint still have
		// oportunity to answer the request properly
	},
	
	// Options for generating openApi spec
	// See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md
	openApi: {
		// Whether to add routes to serve the spec, like:
		// /swagger.json -> all versions
		// /v3/swagger.json -> specific version
		// /v-last/swagger.json -> last version
		serve: false,
		// File name used to serve
		serveAs: 'swagger.json',
		middleware: function (req, res, next) {
			// An express middleware, set on the spec-serving rout
			// May be used to implement authentication, for example
			next()
		},
		prepareEndpoint: function (endpoint, pathItem) {
			// Called for each "Path Item Object" created
			// `endpoint` is the instance of Endpoint
			// `pathItem` is an object following the OpenAPI spec for "Path Item Object"
			// The pathItem to use should be returned
			// If nothing is returned, this endpoint will be omitted from the output
			return pathItem
		},
		prepareSpec: function (spec) {
			// Called for each "Path Item Object" created
			// `endpoint` is the instance of Endpoint
			// `pathItem` is an object following the OpenAPI spec for "Path Item Object"
			return spec
		}
	}
})

// `api.router` is an express router object
// You can, for example:
let app = apiLift.express() // see note bellow about apiLift.express
app.use('/api', api.router)
require('http').createServer(app).listen(80)
```

This module uses `express` internally to create the router object. To avoid compatibility problems, it's adviced to use the same lib this module is using. This is exported as `require('api-lift').express`

The parameter `body` given to `onsuccess` and `onfailure` has properties matching one of the regular expressions in `dataScrub` scrubbed (even in deep objects and arrays). This is meant to make it log-safe. Example: `{password: '123456'}` becomes `{password: '[HIDDEN]'}`

## Returned value
The return of `apiLift()` call is an instance of `API`. Its properties are:

* `{express:Router} router`: an express Router instance
* `{number} minVersion`: the minimum supported version
* `{number} maxVersion`: the maximum supported version
* `{Array<string>} versions`: The list of supported versions, ordered from oldest to newest. Example: `['v3', 'v4']`
* `{Array<Endpoint>} endpoints`: the list of available endpoints
* `{Object<Endpoint>} endpointByUrl`: a map from url to an Endpoint instance

If you are not interested in the router, but in the returned meta-data (like max version), use `apiLift.info(options)` instead:

```js
let apiLift = require('api-lift')

let info = apiLift.info({
	// The default values are described bellow
	folder: './api',
	minVersion: 1
})

info.maxVersion // a number
```

## Generated Doc
All public methods and properties are described in the [generated docs](http://clubedaentrega.github.io/api-lift/docs)

## Versioning
This module aims to make endpoint versioning very simple, pragmatic and source-control friendly. The system only cares about backwards-incompatible changes, that is, MAJOR changes (as defined by [semantic versioning](http://semver.org/)).

By default (`options.minVersion`), all endpoints start at version 1. That is, a file in the path `api/user/create.js` is served at the url `/v1/user/create`. If a breaking change is to be made in this endpoint, the API version must be bumped to 2. To do this, the current file is copied to `api/user/create-v1.js` and new changes can be freely applied to the current `api/user/create.js` file. The new url will be `/v2/user/create` and will be mapped to the current file. The old url will keep working and will point to the old v1 file. Any other endpoint that hasn't been changed will be served equally in v1 and v2. Magic!

Note that the v1 file is like a snapshot. From the point of view of a revision control system (like git), the file has evolved linearly: no move/rename or any other trick (like symlinks).

After some time, the support for version 1 may be dropped, by increasing the `minVersion` option and removing old v1 files.

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
/v3
	/user/create -> api/user/create.js
	/user/getinfo -> api/user/getinfo.js
```

The file `api/user/getinfo.js` is available in all versions. `api/user/create-v2.js` is the snapshot for v1 and v2, `api/user/create.js` is used in v3. `api/user/findbyname-v1.js` is the snapshot for v1 only and is not available in next versions.

## Run Info
While processing the request, `process.domain.runInfo` is an express request instance. `req.requestId` is a string, unique for each request. As a result, in any async process created by the request, `process.domain.runInfo.requestId` can be used. Useful for logs, for example.

## Logging
TODO

## Endpoint handler
TODO

### Body Limit
Each endpoint can set its own body size limit by setting the `module.exports.bodyLimit` property (syntax from [bytes](https://www.npmjs.com/package/bytes)). If it doesn't set this property, the limit will be the one defined in the `bodyParser` field from `options`.

## Success
The default HTTP status code to a correct execution of `success` is `200 Ok`.
If the success function has in its `output` the property `HTTPStatusCode`, this one is answered. 
Note: `HTTPStatusCode` is a private property and will be deleted after sent. Do not use it as a property in your `output`.

## Error codes
The generated erros respects the [APIError class](https://github.com/clubedaentrega/api-lift/blob/master/lib/APIError.js), this is, always have an internal code and a message. A HTTP status code is optional, and if not set the `500 Internal Server Error` is answered.

The APIError will always respect the information received from `error` function.
The invalid `path` errors are always `404 Not Found` and invalid content-type/json `400 Bad Request`