#!/usr/bin/env node

var watchify = require('../');
var through = require('through');
var fs = require('fs');
var path = require('path');
var fromArgs = require('browserify/bin/args');

var w, outfile, verbose, dotfile;
var prevErrs = [], first = true;

function showError (err) {
    if (prevErrs.indexOf(String(err)) < 0) {
        console.error(err + '');
        prevErrs.push(String(err));
    }
}

(function retry () {
    w = watchify(fromArgs(process.argv.slice(2)));
    outfile = w.argv.o || w.argv.outfile;
    verbose = w.argv.v || w.argv.verbose;
    
    if (!outfile) {
        console.error('You MUST specify an outfile with -o.');
        process.exit(1);
    }
    dotfile = path.join(path.dirname(outfile), '.' + path.basename(outfile));
    
    w.on('update', bundle);
    w.on('error', function (err) {
        showError(err);
        w.removeListener('update', bundle);
        setTimeout(retry, w.argv.delay || 600);
    });
    bundle();
})();

function bundle () {
    var start = (new Date()).getTime();
    var wb = w.bundle();
    var caught = false;
    wb.on('error', function (err) {
        showError(err);
        caught = true;
    });
    wb.pipe(fs.createWriteStream(dotfile));
    var bytes = 0;
    wb.pipe(through(write, end));
    
    function write (buf) { bytes += buf.length }
    function end () {
        prevErr = [];
        first = false;
        if (caught) return;
        
        fs.rename(dotfile, outfile, function (err) {
            if (err) return console.error(err);
            if (verbose) {
                var delta = (new Date()).getTime() - start;
                console.error(bytes + ' bytes written to ' + outfile
                    + ' (' + (delta / 1000).toFixed(2) + ' seconds)'
                );
            }
        });
    }
}
