var through = require('through2');
var path = require('path');
var chokidar = require('chokidar');
var xtend = require('xtend');

module.exports = watchify;
module.exports.args = {
    cache: {}, packageCache: {}
};

function watchify (b, opts) {
    if (!opts) opts = {};
    var cache = b._options.cache;
    var pkgcache = b._options.packageCache;
    var delay = typeof opts.delay === 'number' ? opts.delay : 600;
    var changingDeps = {};
    var pending = false;
    
    var wopts = {persistent: true};
    if (opts.ignoreWatch) {
        wopts.ignored = opts.ignoreWatch !== true
            ? opts.ignoreWatch
            : '**/node_modules/**';
    }
    if (opts.poll || typeof opts.poll === 'number') {
        wopts.usePolling = true;
        wopts.interval = opts.poll !== true
            ? opts.poll
            : undefined;
    }

    b.on('reset', collect);
    collect();
    
    function collect () {
        b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
            if (cache) {
                cache[row.file] = {
                    id: row.file,
                    source: row.source,
                    deps: xtend({}, row.deps),
                    file: row.file
                };
            }
            watchFile(row.file);
            this.push(row);
            next();
        }));
    }
    
    b.on('file', function (file) {
        watchFile(file);
    });
    
    b.on('package', function (pkg) {
        watchFile(path.join(pkg.__dirname, 'package.json'));
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
    
    b.on('transform', function (tr, mfile) {
        tr.on('file', function (file) {
            watchDepFile(mfile, file);
        });
    });
    
    function watchFile (file) {
        if (b._mdeps.top.basedir === file) return;
        if (!fwatchers[file]) fwatchers[file] = [];
        if (!fwatcherFiles[file]) fwatcherFiles[file] = [];
        if (fwatcherFiles[file].indexOf(file) >= 0) return;
        
        var w = b._watcher(file, wopts);
        w.setMaxListeners(0);
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

        var w = b._watcher(file, wopts);
        w.setMaxListeners(0);
        w.on('error', b.emit.bind(b, 'error'));
        w.on('change', function () {
            invalidate(mfile);
        });
        fwatchers[mfile].push(w);
        fwatcherFiles[mfile].push(file);
    }
    
    function invalidate (id) {
        if (cache) delete cache[id];
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
        
        }, delay);
        pending = true;
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
