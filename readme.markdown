# watchify

This is a clone for [watchify]
to support detecting new entries.

It is based on this [pr](https://github.com/substack/watchify/pull/297),
and whenever [watchify] handles watching adding/removing entry files,
this package will be deprecated.

# Usage

```js
var b = browserify({ cache: {}, packageCache: {} });
// watchify defaults:
b.plugin('watchify2', {
  entryGlob: 'page/**/index.js',
  delay: 100,
  ignoreWatch: ['**/node_modules/**'],
  poll: false
});

```

[watchify]: https://github.com/substack/watchify
