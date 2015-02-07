# CdE API Lift

Create a ready-to-go express router for a REST API with filters, input validation, versioning, automatic routes and logging.

See on [npm](https://www.npmjs.com/package/cde-api-lift)

## Install
`npm install cde-api-lift --save`

## Important note
This module is built on top of [express](https://www.npmjs.com/package/express) and [lift-it](https://www.npmjs.com/package/lift-it) and *is* meant to be very opinionated.

## Status
**EXPERIMENTAL**

## Assumptions
This module is locked down by some strong assumptions:

* The routes are created and named after the files in the file system
* The endpoints are to be implemented as supported by [lift-it](https://www.npmjs.com/package/lift-it)
* All routes are requested with POST. All input and output is JSON
* Standard output for success: `{failure:null}`, for error: `{failure:{code:Number,message:String}}`

## Features
Okay, after complying to all the rules outlined above, you get:

* Filters, input validation and profiling (by `lift-it`)
* Versioning: don't break old consumers and yet let the API evolve
* Logging: simple logging interface to connect to any logging solution (like [log-sink](https://www.npmjs.com/package/log-sink))

### Versioning
TODO

### Logging
TODO

## Options
TODO