var fs = require('fs');
var through = require('through');
var browserify = require('browserify');

module.exports = function (opts) {
    if (!opts) opts = {};
    var b = typeof opts.bundle === 'function' ? opts : browserify(opts);
    var cache = {};
    var pkgcache = {};
    var watching = {};
    var pending = false;
    
    b.on('package', function (file, pkg) {
        pkgcache[file] = pkg;
    });
    
    b.on('dep', function (dep) {
        if (watching[dep.id]) return;
        watching[dep.id] = true;
        cache[dep.id] = dep;
        
        fs.watch(dep.id, function (type) {
            delete cache[dep.id];
            watching[dep.id] = false;
            
            // wait for the disk/editor to quiet down first:
            if (!pending) setTimeout(function () {
                pending = false;
                b.emit('update');
            }, opts.delay || 300);
            
            pending = true;
        });
    });
    
    var bundle = b.bundle.bind(b);
    var first = true;
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
        first = false;
        
        return bundle(opts_, cb);
    };
    
    return b;
};
