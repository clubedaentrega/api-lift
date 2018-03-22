# 7.0.0
## Breaking changes
* Dropped support for Node.JS < 6
* Update dependencies

# 6.0.0
* Changed: major update run-it@v3
* Changed: add support for object with extra properties in `error()` functions

## Breaking changes
* Removed support for formats in `error()` functions

# 5.6.1
* Fixed: bug when handling invalid URL, `next()` and `res.json()` were called for the same request

# 5.6.0
* Added: `timeout` and `ontimeout` options to allow to monitor endpoints that take too long to finish.
* Changed: `body` passed to `onsuccess`, `onfailure` and `ontimeout` are now a snapshot on the initial body. In previous versions, is the endpoint handler (on any filter) modified the body, the changes would overwrite the information provided to those callbacks.

# 5.5.0
* Added: support for setting body limit by endpoint using `module.exports.bodyLimit`

# 5.4.0
* Added: support for [OpenAPI](https://openapis.org/) (Swagger) spec, with `API#getOpenAPISpec()`
* Added: optional (disabled by default) route to serve swagger.json file for each version and for all versions

# 5.3.0
* Changed: updated lift-it@4.0.0

# 5.2.0
* Added: option `bodyParser` passed to bodyParser.json()

# 5.1.0
* Changed: updated lift-it@3.1.0
* Added: option `callToJSON` to let one change how the body scrubbing logic call toJSON on objects. The default implementation is simply `x => x.toJSON()`.

# 5.0.1
* Changed: updated dependencies

# 5.0.0
* Added: support for custom plugins (option `plugins`)

## Breaking changes
* Changed: lift-it@3.0.0
* Removed: `onerror` option

# 4.1.0
* Added: support for custom plugins

# 4.0.0

## Breaking changes
* `onsuccess` and `onfailure` now receive `runInfo` instead of `req` as second parameter. To access the express request, use `runInfo.req`.
* `onsuccess` and `onfailure` now receive `endpoint` instead of `action` as forth parameter. To access the action, use `endpoint.action`.
* Removed `body._req`. To access the request, use `process.domain.runInfo.req`.

# 3.0.0

## Breaking changes
* Dev mode removed (`lastVersionIsDev` flag), since it was too awkward to work with it. If a version is considered in development, it should be noted in the provider docs.
* `apiLift()` now returns an `API` instance, instead of an express router. To access the router, use `api.router`
* `v-last` is not explicity listed in the `endpoints` array anymore
* renamed `apiLift.Error` to `apiLift.APIError`

## Non-breaking changes
* Added: generated docs
* `API#run()` method to call endpoints directly

# 2.1.0
* Added: `req.requestId`, a string unique for each request
* Added: made the express request object available as global, in `process.domain.runInfo`
* Added: `dataScrub` option, to give control over which fields should be scrubbed in the body
* Changed: instead of removing sensitive fields, change them to `'[HIDDEN]'`

# 2.0.0
* Changed: lift-it@2.0.0

# 1.3.2
* Changed: using lift-it@1.3.2

# 1.3.1
* Fixed: default value for options.validateOutput.exportName

# 1.3.0
* Added: output checking
