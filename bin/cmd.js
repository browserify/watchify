#!/usr/bin/env node

var watchify = require('../');
var fs = require('fs');
var path = require('path');
var concat = require('concat-stream');

var fromArgs = require('./args.js');
var w = fromArgs(process.argv.slice(2));
w.setMaxListeners(Infinity);

var outfile = w.argv.o || w.argv.outfile;
var verbose = w.argv.v || w.argv.verbose;

if (!outfile) {
    console.error('You MUST specify an outfile with -o.');
    process.exit(1);
}

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
    wb.pipe(concat(function (buf) {
		fs.writeFile(outfile, buf, function (err) {
			if (err) console.error(String(err));
		})
	}));
    
    var bytes, time;
    w.on('bytes', function (b) { bytes = b });
    w.on('time', function (t) { time = t });
    
    wb.on('end', function () {
		if (verbose) {
			console.error(bytes + ' bytes written to ' + outfile
				+ ' (' + (time / 1000).toFixed(2) + ' seconds)'
			);
		}
    });
}
