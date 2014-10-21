# brfs

fs.readFileSync() and fs.readFile() static asset browserify transform

[![build status](https://secure.travis-ci.org/substack/brfs.png)](http://travis-ci.org/substack/brfs)

This module is a plugin for [browserify](http://browserify.org) to parse the AST
for `fs.readFileSync()` calls so that you can inline file contents into your
bundles.

Even though this module is intended for use with browserify, nothing about it is
particularly specific to browserify so it should be generally useful in other
projects.

# example

for a main.js:

``` js
var fs = require('fs');
var html = fs.readFileSync(__dirname + '/robot.html', 'utf8');
console.log(html);
```

and a robot.html:

``` html
<b>beep boop</b>
```

first `npm install brfs` into your project, then:

## on the command-line

```
$ browserify -t brfs example/main.js > bundle.js
```

now in the bundle output file,

``` js
var html = fs.readFileSync(__dirname + '/robot.html', 'utf8');
```

turns into:

``` js
var html = "<b>beep boop</b>\n";
```

## or with the api

``` js
var browserify = require('browserify');
var fs = require('fs');

var b = browserify('example/main.js');
b.transform('brfs');

b.bundle().pipe(fs.createWriteStream('bundle.js'));
```

## async

You can also use `fs.readFile()`:

``` js
var fs = require('fs');
fs.readFile(__dirname + '/robot.html', 'utf8', function (err, html) {
    console.log(html);
});
```

When you run this code through brfs, it turns into:

``` js
var fs = require('fs');
process.nextTick(function () {(function (err, html) {
    console.log(html);
})(null,"<b>beep boop</b>\n")});
```

# methods

brfs looks for:

* `fs.readFileSync(pathExpr, enc='utf8')`
* `fs.readFile(pathExpr, enc=null, cb)`
* `fs.readdirSync(pathExpr, cb)`
* `fs.readdir(pathExpr, cb)`

The `pathExpr` function is evaluated as an expression with `__dirname` and
`__filename` variables available.

Just like node, the default encoding is `null` and will give back a `Buffer`.
If you want differently-encoded file contents for your inline content you can
set `enc` to `'utf8'`, `'base64'`, or `'hex'`.

In async mode when a callback `cb` is given, the contents of `pathExpr` are
inlined into the source inside of a `process.nextTick()` call.

When you use a `'file'`-event aware watcher such as
[watchify](https://npmjs.org/package/watchify), the inlined assets will be
updated automatically.

If you want to use this plugin directly, not through browserify, the api
follows.

``` js
var brfs = require('brfs')
```

## var tr = brfs(file, opts)

Return a through stream `tr` inlining `fs.readFileSync()` file contents
in-place.

Optionally, you can set which `opts.vars` will be used in the
[static argument evaluation](https://npmjs.org/package/static-eval)
in addition to `__dirname` and `__filename`.

# events

## tr.on('file', function (file) {})

For every file included with `fs.readFileSync()` or `fs.readFile()`, the `tr`
instance emits a `'file'` event with the `file` path.

# usage

A tiny command-line program ships with this module to make debugging easier.

```
usage:

  brfs file
 
    Inline `fs.readFileSync()` calls from `file`, printing the transformed file
    contents to stdout.

  brfs
  brfs -
 
    Inline `fs.readFileSync()` calls from stdin, printing the transformed file
    contents to stdout.

```

# install

With [npm](https://npmjs.org) do:

```
npm install brfs
```

then use `-t brfs` with the browserify command or use `.transform('brfs')` from
the browserify api.

# license

MIT
