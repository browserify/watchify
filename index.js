var through = require('through');
var copy = require('shallow-copy');
var browserify = require('browserify');
var fs = require('fs');
var chokidar = require('chokidar');
var listenerCount = require('events').EventEmitter.listenerCount;

module.exports = watchify;
watchify.browserify = browserify;

function watchify (opts) {
    if (!opts) opts = {};
    var b = typeof opts.bundle === 'function' ? opts : browserify(opts);
    var cache = {};
    var pkgcache = {};
    var watching = {};
    var pending = false;
    var queuedCloses = {};
    var queuedDeps = {};
    var changingDeps = {};
    var first = true;
    var watchers = {};
    var listeners = { change: {}, err: {} };
    
    if (opts.cache) {
        cache = opts.cache;
        delete opts.cache;
        first = false;
    }
    
    if (opts.pkgcache) {
        pkgcache = opts.pkgcache;
        delete opts.pkgcache;
    }

    if (opts.watchers) {
        watchers = opts.watchers;
        delete opts.watchers;
    }
    
    b.on('package', function (file, pkg) {
        pkgcache[file] = pkg;
    });
    
    b.on('dep', function (dep) {
        queuedDeps[dep.id] = copy(dep);
    });
    
    var fwatchers = {};
    var fwatcherFiles = {};
    b.on('bundle', function (bundle) {
        bundle.on('transform', function (tr, mfile) {
            if (!fwatchers[mfile]) fwatchers[mfile] = [];
            if (!fwatcherFiles[mfile]) fwatcherFiles[mfile] = [];

            tr.on('file', function (file) {
                if (!fwatchers[mfile]) return;
                if (fwatchers[mfile].indexOf(file) >= 0) return;
                
                var w = chokidar.watch(file, {persistent: true});
                w.on('error', b.emit.bind(b, 'error'));
                w.on('change', function () {
                    invalidate(mfile);
                });
                fwatchers[mfile].push(w);
                fwatcherFiles[mfile].push(file);
            });
        });
    });
    
    function addDep (dep) {
        if (watching[dep.id]) return;
        watching[dep.id] = true;
        cache[dep.id] = dep;
        
        var watcher = watchers[dep.id];
        if (!watcher) {
            watcher = watchers[dep.id] = chokidar.watch(dep.id, {persistent: true});
            b.emit('watch', watcher, dep);
        }

        listeners.err[dep.id] = b.emit.bind(b, 'error');
        listeners.change[dep.id] = function () {
            invalidate(dep.id);
        };
        
        watcher.on('error', listeners.err[dep.id]);
        watcher.on('change', listeners.change[dep.id]);
    }
    
    function invalidate (id) {
        delete cache[id];
        if (fwatchers[id]) {
            fwatchers[id].forEach(function (w) {
                queuedCloses[id + '-' + id] = w;
            });
            delete fwatchers[id];
            delete fwatcherFiles[id];
        }
        queuedCloses[id] = watchers[id];
        changingDeps[id] = true
        
        // wait for the disk/editor to quiet down first:
        if (!pending) setTimeout(function () {
            pending = false;
            b.emit('update', Object.keys(changingDeps));
            changingDeps = {};
        
        }, opts.delay || 600);
        pending = true;
    }
    
    var bundle = b.bundle.bind(b);
    b.bundle = function (opts_, cb) {
        if (b._pending) return bundle(opts_, cb);
        
        if (typeof opts_ === 'function') {
            cb = opts_;
            opts_ = {};
        }
        if (!opts_) opts_ = {};
        if (!first) opts_.cache = cache;
        opts_.includePackage = true;
        opts_.packageCache = pkgcache;
        
        // we only want to mess with the listeners if the bundle was created
        // successfully, e.g. on the 'close' event.
        var outStream = bundle(opts_, cb);
        outStream.on('error', function (err) {
            var updated = false;
            b.once('update', function () { updated = true });
            
            if (err.type === 'not found') {
                (function f () {
                    if (updated) return;
                    fs.exists(err.filename, function (ex) {
                        if (ex) b.emit('update', [ err.filename ])
                        else setTimeout(f, opts.delay || 600)
                    });
                })();
            }
        });
        outStream.on('close', close);
        function close () {
            first = false;
            var depId, watcher;
            for (depId in queuedCloses) {
                watcher = watchers[depId];
                watcher.removeListener('change', listeners.change[depId]);
                watcher.removeListener('error', listeners.err[depId]);
                if (!listenerCount(watcher, 'change') && !listenerCount(watcher, 'error')) {
                    watcher.close();
                    watchers[depId] = null;
                }
                watching[depId] = false;
            }
            queuedCloses = {};
            for (depId in queuedDeps) {
                addDep(queuedDeps[depId]);
            }
            queuedDeps = {};
        }
        return outStream;
    };
    
    return b;
}
