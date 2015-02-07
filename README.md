# CdE API Lift

Create a ready-to-go express router for a REST API with filters, input validation, versioning, automatic routes and logging.

See on [npm](https://www.npmjs.com/package/api-lift)

## Install
`npm install api-lift --save`

## Important note
This module is built on top of [express](https://www.npmjs.com/package/express) and [lift-it](https://www.npmjs.com/package/lift-it) and *is* meant to be very opinionated.

## Status
**EXPERIMENTAL**

## Assumptions
This module is locked down by some strong assumptions:

* The routes are created and named after the files in the file system
* The endpoints are to be implemented as supported by [lift-it](https://www.npmjs.com/package/lift-it)
* In the endpoints files, `exports.description` is a string describing what it does
* The first argument for the endpoint handler is the request `body`. `body._req` points to the express request object (this property is non-enumerable).
* All routes are requested with POST. All input and output is JSON
* Standard output for success: `{failure:null}`, for error: `{failure:{code:Number,message:String}}`

## Features
Okay, after complying to all the rules outlined above, you get:

* Filters, input validation and profiling (by `lift-it`)
* Versioning: don't break old consumers and yet let the API evolve
* Logging: simple logging interface to connect to any logging solution (like [log-sink](https://www.npmjs.com/package/log-sink))

## Options
```js
var apiLift = require('api-lift')

var router = apiLift({
	// All options are optional
	// The values bellow are the default
	// Some are not configurable and can not be changed,
	// those are listed only for your information
	
	// Options for `lift-it`
	folder: './api',
	profile: false,
	errorClass: apiLift.Error, // <-- can't be changed
	enableErrorCode: true, // <-- can't be changed
	onerror: function (action) {
		// Called for each action (ie, file) that fails to be lifted
	},
	
	// Options for validate plugin of `lift-it`
	validate: {
		// Use the plugin defaults
	},
	
	// Options for filters plugin of `lift-it`
	filters: './filters',
	
	// Options for this module
	minVersion: 1, // the min version to support
	onsuccess: function (response, req, body, action) {
		// Called right before a request is answered with success
		// `response` is the JSON object to send
		// `req` is the express request object
		// `req.beginTime` is the value of Date.now() when the request was received
		// `req.profileData` is the profile data (if enabled)
		// `body` is the cleaned (see bellow) JSON input
		// `action` is the lift-it action
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

The parameter `body` given to `onsuccess` and `onfailure` is cleared from any property that has 'session', 'password', 'serial' or 'token' in its name (case-insensitive). This is meant to make it log-safe.

## Versioning
TODO

## Logging
TODO