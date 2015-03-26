#!/usr/bin/env node

var watchify = require('../');
var fs = require('fs');
var path = require('path');

var fromArgs = require('./args.js');
var w = fromArgs(process.argv.slice(2));

var outfile = w.argv.o || w.argv.outfile;
var verbose = w.argv.v || w.argv.verbose;

if (!outfile) {
    console.error('You MUST specify an outfile with -o.');
    process.exit(1);
}
var dotfile = path.join(path.dirname(outfile), '.' + path.basename(outfile));

var bytes, time;
w.on('bytes', function (b) { bytes = b });
w.on('time', function (t) { time = t });

w.on('update', bundle);
bundle();

function bundle () {
    var didError = false;
    var dotStream = fs.createWriteStream(dotfile);

    var wb = w.bundle();
    wb.on('error', function (err) {
        console.error(String(err));
        didError = true;
        dotStream.end('console.error('+JSON.stringify(String(err))+');');
    });
    wb.pipe(dotStream);

    dotStream.on('error', function (err) {
        console.error(err);
    });
    dotStream.on('close', function () {
        fs.rename(dotfile, outfile, function (err) {
            if (err) return console.error(err);
            if (verbose && !didError) {
                console.error(bytes + ' bytes written to ' + outfile
                    + ' (' + (time / 1000).toFixed(2) + ' seconds)'
                );
            }
        });
    });
}
