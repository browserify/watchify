var through = require('through');
var copy = require('shallow-copy');
var browserify = require('browserify');
var fs = require('fs');

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
    
    if (opts.cache) {
        cache = opts.cache;
        delete opts.cache;
        first = false;
    }
    
    if (opts.pkgcache) {
        pkgcache = opts.pkgcache;
        delete opts.pkgcache;
    }
    
    b.on('package', function (file, pkg) {
        pkgcache[file] = pkg;
    });
    
    b.on('dep', function (dep) {
        queuedDeps[dep.id] = copy(dep);
    });
    
    function addDep (dep) {
        if (watching[dep.id]) return;
        watching[dep.id] = true;
        cache[dep.id] = dep;
        
        var watcher = fs.watch(dep.id);
        watcher.on('error', function (err) {
            b.emit('error', err);
        });
        watcher.on('change', function(path) {
            delete cache[dep.id];
            queuedCloses[dep.id] = watcher;
            changingDeps[dep.id] = true
            
            // wait for the disk/editor to quiet down first:
            if (!pending) setTimeout(function () {
                pending = false;
                b.emit('update', Object.keys(changingDeps));
                changingDeps = {};
            
            }, opts.delay || 600);
            pending = true;
        });
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
            var depId;
            for (depId in queuedCloses) {
                queuedCloses[depId].close();
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
