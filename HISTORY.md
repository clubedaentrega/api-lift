# next

## Breaking changes
* Dev mode removed (`lastVersionIsDev` flag), since it was too awkward to work with it. If a version is considered in development, it should be noted in the provider docs.

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
