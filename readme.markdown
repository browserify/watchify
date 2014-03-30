## watchify

Watch mode for [browserify](https://github.com/substack/node-browserify) builds.

Update any source file and your browserify bundle will be recompiled on the
spot.

## install

```
$ npm install -g watchify
```

to get the global `watchify` command, and

```
$ npm install watchify
```

to get just the library.

## command-line usage

Use `watchify` with all the same arguments as `browserify` except that
`-o` is mandatory:

```
$ watchify main.js -o static/bundle.js
```

Now as you update files, `static/bundle.js` will be automatically re-compiled on
the fly.

You can use `-v` to get more verbose output to show when a file was written:

```
$ watchify browser.js -d -o static/bundle.js -v
610598 bytes written to static/bundle.js
610606 bytes written to static/bundle.js
610597 bytes written to static/bundle.js
610606 bytes written to static/bundle.js
610597 bytes written to static/bundle.js
610597 bytes written to static/bundle.js
```

All the [bundle options](https://github.com/substack/node-browserify#usage) are the same as the `browserify` command except for `-v`.

## commonjs module usage

```js
var watchify = require('watchify')

// create a browserify bundle `w` from `opts`
var w = watchify(opts)
```

`opts` are passed in [similarly to](https://github.com/substack/node-browserify#var-b--browserifyfiles-or-opts) `browserify`:

```js
var w = watchify('./public/js/main.js');

// or:
var w = watchify({
  entries: ['./public/js/main.js']
});
```

## 'update' event

`w` is exactly like a browserify bundle except that caches file contents and
emits an `'update'` event when a file changes. You should call `w.bundle()`
after the `'update'` event fires to generate a new bundle:

```js
w.on('update', rebundle);

function rebundle(ids) {
  // emit the list of altered file ids
  console.log(ids)

  return w.bundle({ debug: true })
}
```

Calling `w.bundle()` extra times past the first time will be much faster due to caching.

## transform, require, external, and other functions

Again, these are utilized similarly to a vanilla `browserify` implementation:

```js
w.transform('brfs');

w.external('angular');
w.external('angular-route');
```

## license

MIT
