var through = require('through');
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
    
    b.on('dep', function(dep) {
        queuedDeps[dep.id] = dep;
    });
    
    function addDep (dep) {
        if (watching[dep.id]) return;
        watching[dep.id] = true;
        cache[dep.id] = dep;
        
        var watcher = fs.watch(dep.id);
        watcher.on('error', function(err) {
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
            }, opts.delay || 300);
            
            pending = true;
        });
    }
    
    var bundle = b.bundle.bind(b);
    var firstFiles = [];
    b.on('file', function (file) { firstFiles.push(file) });
    
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
        outStream.on('error', function () {
            var watches = firstFiles.map(function (file) {
                var w = fs.watch(file);
                w.on('change', function () {
                    setTimeout(
                        function () { onchange(file) },
                        opts.delay || 300
                    );
                });
                return w;
            });
            var changed = false;
            function onchange (file) {
                if (changed) return;
                changed = true;
                watches.forEach(function (w) { w.close() });
                b.emit('update', file);
            }
        });
        outStream.on('close', function() {
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
        });
        return outStream;
    };
    
    return b;
}
