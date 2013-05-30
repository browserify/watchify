var fs = require('fs');
var browserify = require('browserify');
var mdeps = require('module-deps');
var through = require('through');

module.exports = function (opts, cb) {
    if (!opts) opts = {};
    var b = typeof opts.bundle === 'function' ? opts : browserify(opts);
    var cache = {};
    var pending = false;
    
    b.on('dep', function (dep) {
        cache[dep.id] = dep;
        
        fs.watch(dep.id, function (type) {
            delete cache[dep.id];
            
            // wait for the disk/editor to quiet down first:
            if (!pending) setTimeout(function () {
                pending = false;
                b.emit('update');
            }, opts.delay || 300);
            
            pending = true;
            
            console.log(Date.now());
        });
    });
    
    var bundle = b.bundle.bind(b);
    b.bundle = function (opts_, cb) {
        if (typeof opts_ === 'function') {
            cb = opts_;
            opts_ = {};
        }
        if (!opts_) opts_ = {};
        opts_.cache = cache;
        return bundle(opts_, cb);
    };
    
    return b;
};
