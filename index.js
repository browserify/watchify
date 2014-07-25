var through = require('through2');
var fs = require('fs');
var chokidar = require('chokidar');

module.exports = function (b, opts) {
    if (!opts) opts = {};
    var cache = opts.cache || {};
    var pkgcache = opts.pkgcache || {};
    var changingDeps = {};
    var pending = false;
    
    b.on('dep', function (dep) {
        cache[dep.id] = dep;
        if (dep.file) watchFile(dep.file);
    });
    b.on('file', function (file) {
        watchFile(file);
    });
    
    var fwatchers = {};
    var fwatcherFiles = {};
    b.on('bundle', function (bundle) {
        bundle.on('transform', function (tr, mfile) {
            tr.on('file', function (file) {
                watchDepFile(mfile, file);
            });
        });
    });
    
    function watchFile (file) {
        if (!fwatchers[file]) fwatchers[file] = [];
        if (!fwatcherFiles[file]) fwatcherFiles[file] = [];
        if (fwatcherFiles[file].indexOf(file) >= 0) return;
        
        var w = chokidar.watch(file, {persistent: true});
        w.on('error', b.emit.bind(b, 'error'));
        w.on('change', function () {
            invalidate(file);
        });
        fwatchers[file].push(w);
        fwatcherFiles[file].push(file);
    }
    
    function watchDepFile(mfile, file) {
        if (!fwatchers[mfile]) fwatchers[mfile] = [];
        if (!fwatcherFiles[mfile]) fwatcherFiles[mfile] = [];
        if (fwatcherFiles[mfile].indexOf(file) >= 0) return;

        var w = chokidar.watch(file, {persistent: true});
        w.on('error', b.emit.bind(b, 'error'));
        w.on('change', function () {
            invalidate(mfile);
        });
        fwatchers[mfile].push(w);
        fwatcherFiles[mfile].push(file);
    }
    
    function invalidate (id) {
        delete cache[id];
        if (fwatchers[id]) {
            fwatchers[id].forEach(function (w) {
                w.close();
            });
            delete fwatchers[id];
            delete fwatcherFiles[id];
        }
        changingDeps[id] = true
        
        // wait for the disk/editor to quiet down first:
        if (!pending) setTimeout(function () {
            pending = false;
            b.emit('update', Object.keys(changingDeps));
            changingDeps = {};
        
        }, opts.delay || 600);
        pending = true;
    }
    
    b.close = function () {
        Object.keys(fwatchers).forEach(function (id) {
            fwatchers[id].forEach(function (w) { w.close() });
        });
    };
    
    return b;
}
