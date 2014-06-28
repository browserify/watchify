# watchify

Watch mode for browserify builds

[![build status](https://secure.travis-ci.org/substack/watchify.png)](http://travis-ci.org/substack/watchify)

Update any source file and your browserify bundle will be incrementally recompiled on the
spot.

# example

Use `watchify` with all the same arguments as `browserify` except that
`-o` is mandatory:

```
$ watchify main.js -o static/bundle.js
```

Now as you update files, `static/bundle.js` will be automatically re-compiled on
the fly.

You can use `-v` to get more verbose output to show when a file was written and how long the bundling took (in seconds):

```
$ watchify browser.js -d -o static/bundle.js -v
610598 bytes written to static/bundle.js  0.23s
610606 bytes written to static/bundle.js  0.10s
610597 bytes written to static/bundle.js  0.14s
610606 bytes written to static/bundle.js  0.08s
610597 bytes written to static/bundle.js  0.08s
610597 bytes written to static/bundle.js  0.19s
```

# usage

Watchify supports all the same options as the browserify command with the following additions:

```
  --ignore-watch=GLOB  

  Don't attach file watchers to the following glob. 
  Useful for e.g. ignoring `node_modules` (`--ignore-watch=node_modules/**`)
  
  --delay=ms           [default: 600]

  The number of ms to wait before emitting an 'update' event on a file change.
  Set lower to get more immediate updates at the risk of causing multiple bundle changes per save.
  It's usually not worth =changing this.

  --verbose, -v

  Verbose mode. Will print to stderr on a rebuild.
```

The above options (excepting `verbose`) exist as options to the `watchify()` constructor in camelCase.

# methods

``` js
var watchify = require('watchify')
```

## var w = watchify(opts)

Create a browserify bundle `w` from `opts`.

`w` is exactly like a browserify bundle except that caches file contents and
emits an `'update'` event when a file changes. You should call `w.bundle()`
after the `'update'` event fires to generate a new bundle. Calling `w.bundle()`
extra times past the first time will be much faster due to caching.

## w.close()

Close all the open watch handles.

# events

## w.on('update', function (ids) {})

When the bundle changes, emit the array of bundle `ids` that changed.

## w.on('bytes', function (bytes) {})

When a bundle is generated, this event fires with the number of bytes.

## w.on('time', function (time) {})

When a bundle is generated, this event fires with the time it took to create the
bundle in milliseconds.

## w.on('log', function (msg) {})

This event fires to with messages of the form:

```
X bytes written (Y seconds)
```

with the number of bytes in the bundle X and the time in seconds Y.

# install

With [npm](https://npmjs.org) do:

```
$ npm install -g watchify
```

to get the watchify command and:

```
$ npm install watchify
```

to get just the library.

# license

MIT
