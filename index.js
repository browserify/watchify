var through = require('through2');
var path = require('path');
var chokidar = require('chokidar');
var xtend = require('xtend');
var anymatch = require('anymatch');

module.exports = watchify;
module.exports.args = {
    cache: {}, packageCache: {}
};

function watchify (b, opts) {
    if (!opts) opts = {};
    var cache = b._options.cache;
    var pkgcache = b._options.packageCache;
    var delay = typeof opts.delay === 'number' ? opts.delay : 100;
    var changingDeps = {};
    var pending = false;
    var updating = false;
    
    var wopts = {persistent: true};
    if (opts.ignoreWatch) {
        var ignored = opts.ignoreWatch !== true
            ? opts.ignoreWatch
            : '**/node_modules/**';
    }
    if (opts.poll || typeof opts.poll === 'number') {
        wopts.usePolling = true;
        wopts.interval = opts.poll !== true
            ? opts.poll
            : undefined;
    }

    if (cache) {
        b.on('reset', collect);
        collect();
    }
    
    function collect () {
        b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
            var file = row.expose ? b._expose[row.id] : row.file;
            cache[file] = {
                source: row.source,
                deps: xtend(row.deps)
            };
            this.push(row);
            next();
        }));
    }
    
    b.on('file', function (file) {
        watchFile(file);
    });
    
    b.on('package', function (pkg) {
        var file = path.join(pkg.__dirname, 'package.json');
        watchFile(file);
        if (pkgcache) pkgcache[file] = pkg;
    });
    
    b.on('reset', reset);
    reset();
    
    function reset () {
        var time = null;
        var bytes = 0;
        b.pipeline.get('record').on('end', function () {
            time = Date.now();
        });
        
        b.pipeline.get('wrap').push(through(write, end));
        function write (buf, enc, next) {
            bytes += buf.length;
            this.push(buf);
            next();
        }
        function end () {
            var delta = Date.now() - time;
            b.emit('time', delta);
            b.emit('bytes', bytes);
            b.emit('log', bytes + ' bytes written ('
                + (delta / 1000).toFixed(2) + ' seconds)'
            );
            this.push(null);
        }
    }
    
    var fwatchers = {};
    var fwatcherFiles = {};
    var ignoredFiles = {};
    
    if (opts.entryGlob) {
        fwatchers._entryWatcher = [watchEntries(opts.entryGlob)];
    }

    b.on('transform', function (tr, mfile) {
        tr.on('file', function (dep) {
            watchFile(mfile, dep);
        });
    });
    b.on('bundle', function (bundle) {
        updating = true;
        bundle.on('error', onend);
        bundle.on('end', onend);
        function onend () { updating = false }
    });

    function watchFile (file, dep) {
        dep = dep || file;
        if (ignored) {
            if (!ignoredFiles.hasOwnProperty(file)) {
                ignoredFiles[file] = anymatch(ignored, file);
            }
            if (ignoredFiles[file]) return;
        }
        if (!fwatchers[file]) fwatchers[file] = [];
        if (!fwatcherFiles[file]) fwatcherFiles[file] = [];
        if (fwatcherFiles[file].indexOf(dep) >= 0) return;

        var w = b._watcher(dep, wopts);
        w.setMaxListeners(0);
        w.on('error', b.emit.bind(b, 'error'));
        w.on('change', function () {
            invalidate(file);
        });
        fwatchers[file].push(w);
        fwatcherFiles[file].push(dep);
    }
    
    function invalidate (id) {
        if (cache) delete cache[id];
        if (pkgcache) delete pkgcache[id];
        changingDeps[id] = true;
        
        if (!updating && fwatchers[id]) {
            fwatchers[id].forEach(function (w) {
                w.close();
            });
            delete fwatchers[id];
            delete fwatcherFiles[id];
        }
        
        // wait for the disk/editor to quiet down first:
        if (pending) clearTimeout(pending);
        pending = setTimeout(notify, delay);
    }
    
    function notify () {
        if (updating) {
            pending = setTimeout(notify, delay);
        } else {
            pending = false;
            b.emit('update', Object.keys(changingDeps));
            changingDeps = {};
        }
    }

    function watchEntries(glob) {
        var entriesAdded = {};
        var entriesRemoved = {};

        var basedir = b._options.basedir || process.cwd();
        var watchOpts = xtend({ cwd: basedir }, wopts);
        watchOpts.ignoreInitial = true;
        var watcher = chokidar.watch(glob, watchOpts);

        watcher.on('error', b.emit.bind(b, 'error'));
        watcher.on('add', function (file) {
            file = path.join(basedir, file);
            entriesAdded[file] = true;
            if (entriesRemoved[file]) {
                delete entriesRemoved[file];
            }
            invalidate(file);
        });
        watcher.on('unlink', function (file) {
            file = path.join(basedir, file);
            entriesRemoved[file] = true;
            if (entriesAdded[file]) {
                delete entriesAdded[file];
            }
            invalidate(file);
        });

        b.on('reset', function () {
            var added = entriesAdded;
            var removed = entriesRemoved;
            entriesAdded = {};
            entriesRemoved = {};
            var entryOrder = 0;

            b.pipeline.get('record').unshift(through.obj(function (row, enc, next) {
                if (row.file && removed[row.file]) {
                    return next();
                }
                if (row.entry) {
                    // for browser-pack
                    row.order = entryOrder++;
                }
                next(null, row);
            }));

            b.add(Object.keys(added), { basedir: b._options.basedir });
        })

        return watcher;
    }
    
    b.close = function () {
        Object.keys(fwatchers).forEach(function (id) {
            fwatchers[id].forEach(function (w) { w.close() });
        });
    };
    
    b._watcher = function (file, opts) {
        return chokidar.watch(file, opts);
    };

    return b;
}
