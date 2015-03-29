#!/usr/bin/env node

var watchify = require('../');
var fs = require('fs');
var path = require('path');
var os = require('os');

var fromArgs = require('./args.js');
var w = fromArgs(process.argv.slice(2));

var outfile = w.argv.o || w.argv.outfile;
var verbose = w.argv.v || w.argv.verbose;

if (!outfile) {
    console.error('You MUST specify an outfile with -o.');
    process.exit(1);
}

var tmpname = 'watchify-' + Math.random() + '-' + path.basename(outfile);
var tmpfile = path.join((os.tmpdir || os.tmpDir)(), tmpname);

var bytes, time;
w.on('bytes', function (b) { bytes = b });
w.on('time', function (t) { time = t });

w.on('update', bundle);
bundle();

function bundle () {
    var didError = false;
    var tmpStream = fs.createWriteStream(tmpfile);

    var wb = w.bundle();
    wb.on('error', function (err) {
        console.error(String(err));
        didError = true;
        tmpStream.end('console.error('+JSON.stringify(String(err))+');');
    });
    wb.pipe(tmpStream);

    tmpStream.on('error', function (err) {
        console.error(err);
    });
    tmpStream.on('close', function () {
        fs.rename(tmpfile, outfile, function (err) {
            if (err) return console.error(err);
            if (verbose && !didError) {
                console.error(bytes + ' bytes written to ' + outfile
                    + ' (' + (time / 1000).toFixed(2) + ' seconds)'
                );
            }
        });
    });
}
