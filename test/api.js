var test = require('tape');
var watchify = require('../');
var browserify = require('browserify');
var vm = require('vm');

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var split = require('split');

var os = require('os');
var tmpdir = path.join((os.tmpdir || os.tmpDir)(), 'watchify-' + Math.random());

var files = {
    main: path.join(tmpdir, 'main.js'),
    bundle: path.join(tmpdir, 'bundle.js')
};

mkdirp.sync(tmpdir);
fs.writeFileSync(files.main, 'console.log(555)');

test('api', function (t) {
    t.plan(5);
    var w = watchify(browserify(files.main));
    w.on('update', function () {
        w.bundle(function (err, src) {
            t.ifError(err);
            t.equal(run(src), '333\n');
            w.close();
        });
    });
    w.bundle(function (err, src) {
        t.ifError(err);
        t.equal(run(src), '555\n');
        fs.writeFile(files.main, 'console.log(333)', function (err) {
            t.ifError(err);
        });
    });
});

function run (src) {
    var output = '';
    function log (msg) { output += msg + '\n' }
    vm.runInNewContext(src, { console: { log: log } });
    return output;
}
