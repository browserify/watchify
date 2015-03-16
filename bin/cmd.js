#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var fromArgs = require('./args.js');
var w = fromArgs(process.argv.slice(2));
w.setMaxListeners(Infinity);

var outfile = w.argv.o || w.argv.outfile;
var verbose = w.argv.v || w.argv.verbose;

if (!outfile) {
    console.error('You MUST specify an outfile with -o.');
    process.exit(1);
}
var dotfile = path.join(path.dirname(outfile), '.' + path.basename(outfile));

w.on('update', bundle);
bundle();

function bundle () {
    var wb = w.bundle();
    wb.on('error', function (err) {
        console.error(String(err));
        fs.writeFile(outfile, 'console.error('+JSON.stringify(String(err))+')', logIfErr)
    });
    wb.pipe(fs.createWriteStream(dotfile)).on('error', logIfErr);
    
    var bytes, time;
    w.on('bytes', function (b) { bytes = b });
    w.on('time', function (t) { time = t });
    function verboseLog() {
        console.error(bytes + ' bytes written to ' + outfile
            + ' (' + (time / 1000).toFixed(2) + ' seconds)'
        );
    }
    
    wb.on('end', function () {
        fs.rename(dotfile, outfile, function (err) {
            if (err && err.code === 'EPERM') fakeRename();
            else if (err) console.error(err);
            else if (verbose) verboseLog();
        });
    });
    function fakeRename() {
        fs.createReadStream(dotfile)
            .pipe(fs.createWriteStream(outfile))
            .on('finish', function () {
                fs.unlink(dotfile, function (err) {
                    if (err) console.error(err);
                    else if (verbose) verboseLog();
                })
            })
            .on('error', logIfErr)
        ;
    }
}

function logIfErr(err) {
    if (err) console.error(String(err))
}
