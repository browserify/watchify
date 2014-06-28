var test = require('tape');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var spawn = require('child_process').spawn;
var split = require('split');

var cmd = path.resolve(__dirname, '../bin/cmd.js');
var os = require('os');
var tmpdir = path.join((os.tmpdir || os.tmpDir)(), 'watchify-' + Math.random());

var files = {
    main: path.join(tmpdir, 'main.js'),
    dep: path.join(tmpdir, 'dep.js'),
    bundle: path.join(tmpdir, 'bundle.js')
};

mkdirp.sync(tmpdir);
fs.writeFileSync(files.main, 'require("./dep");\nconsole.log(555);');
fs.writeFileSync(files.dep, 'console.log(222);');

test('ignore', function (t) {
    t.plan(8);
    var ps = spawn(cmd, [ files.main, '-o', files.bundle, '-v', '--ignore-watch=de*' ]);
    var lineNum = 0;
    ps.stderr.pipe(split()).on('data', function onBundle(line) {
        lineNum ++;
        if (lineNum === 1) {
            run(files.bundle, function (err, output) {
                t.ifError(err);
                t.equal(output, '222\n555\n');
                fs.writeFile(files.dep, 'console.log(333)');
                // since the bundle won't run
                setTimeout(function(){
                    t.equal(lineNum, 1);
                    onBundle();
                }, 1000); 
            });
        }
        else if (lineNum === 2) {
            run(files.bundle, function (err, output) {
                t.ifError(err);
                t.equal(output, '222\n555\n');
                fs.writeFile(files.main, 'require("./dep");\nconsole.log(444);');
            });
        }
        else if (lineNum === 3) {
            run(files.bundle, function (err, output) {
                t.ifError(err);
                t.equal(output, '333\n444\n');

                // Ensure no other events fire
                setTimeout(function() {
                    t.equal(lineNum, 3);
                    ps.kill();
                }, 500);
            });
        }
    });
});

function run (file, cb) {
    var ps = spawn(process.execPath, [ file ]);
    var data = [];
    ps.stdout.on('data', function (buf) { data.push(buf) });
    ps.stdout.on('end', function () {
        cb(null, Buffer.concat(data).toString('utf8'));
    });
    ps.on('error', cb);
    return ps;
}
