var fs = require('fs');
var through = require('through');
var browserify = require('browserify');

module.exports = function (opts) {
    if (!opts) opts = {};
    var b = typeof opts.bundle === 'function' ? opts : browserify(opts);
    var cache = {};
    var watching = {};
    var lastUpdate = 0;
    
    b.on('dep', function (dep) {
        if (watching[dep.id]) return;
        watching[dep.id] = true;
        cache[dep.id] = dep;
        
        fs.watch(dep.id, function (type) {
            delete cache[dep.id];
            watching[dep.id] = false;

            var now = Date.now();
            if (now - lastUpdate > 2000) {
                b.emit('update');
                lastUpdate = now;
            }
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
        first = false;
        
        return bundle(opts_, cb);
    };
    
    return b;
};
