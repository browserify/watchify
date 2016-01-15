var test = require('tape');
var watchify = require('../');
var browserify = require('browserify');
var vm = require('vm');

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var os = require('os');
var tmpdir = path.join((os.tmpdir || os.tmpDir)(), 'watchify-' + Math.random());

var file = path.join(tmpdir, 'main.js');

mkdirp.sync(tmpdir);
fs.writeFileSync(file, 'console.log(333)');

var opts = {
    cache: {},
    packageCache: {},
    basedir: tmpdir,
};

test('entry glob', function (t) {
    t.plan(8);
    var w = watchify(browserify(file, opts), { entryGlob: '*.js' });
    var toBeAdded = path.join(tmpdir, 'added.js');
    var removed = false;
    w.on('update', function () {
        w.bundle(function (err, src) {
            t.ifError(err);

            if (removed) {
                t.equal(run(src), '333\n', 'Should exclude removed entries');
                w.close();
            } else {
                t.equal(run(src), '555\n333\n', 'Should include added entries');
                removed = true;
                setTimeout(function () {
                    fs.unlink(toBeAdded, function (err) {
                        t.ifError(err, 'Remove ' + toBeAdded);
                    });
                }, 1000);
            }
        });
    });
    w.bundle(function (err, src) {
        t.ifError(err);
        t.equal(run(src), '333\n', 'initial');

        setTimeout(function () {
            fs.writeFile(toBeAdded, 'console.log(555)', function (err) {
                t.ifError(err, 'Add ' + toBeAdded);
            });
        }, 1000);
    });
});

function run (src) {
    var output = '';
    function log (msg) { output += msg + '\n' }
    vm.runInNewContext(src, { console: { log: log } });
    return output;
}

