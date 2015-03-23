#!/usr/bin/env node

var watchify = require('../');
var fs = require('fs');
var path = require('path');

var fromArgs = require('./args.js');
var w = fromArgs(process.argv.slice(2));
var usingWindows = (process.platform === 'win32');
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
        fs.writeFile(outfile, 'console.error('+JSON.stringify(String(err))+')', function(err) {
            if (err) console.error(err);
        })
    });
    wb.pipe(fs.createWriteStream(usingWindows ? outfile : dotfile));
    
    var bytes, time;
    w.on('bytes', function (b) { bytes = b });
    w.on('time', function (t) { time = t });
    
    wb.on('end', function () {
        if (usingWindows) return logVerboseEnd();
        fs.rename(dotfile, outfile, function (err) {
            if (err) return console.error(err);
            logVerboseEnd();
        });
    });
    
    function logVerboseEnd () {
        if (verbose) {
            console.error(bytes + ' bytes written to ' + outfile
                + ' (' + (time / 1000).toFixed(2) + ' seconds)'
            );
        }
    }
}
