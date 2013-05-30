#!/bin/bash

var watchify = require('../');
var through = require('through');
var fs = require('fs');
var argv = require('optimist').argv;
var outfile = argv.o || argv.outfile;

var w = watchify(argv._);
w.on('update', function () {
console.log('UPDATE');
    var s = w.bundle();
    s.pipe(fs.createWriteStream('.' + outfile));
    s.on('data', function () {});
    s.on('end', function () {
        fs.rename('.' + outfile, outfile, function (err) {
            if (err) console.error(err)
            else console.log(outfile + ' written')
        });
    });
});
w.bundle().pipe(fs.createWriteStream(outfile));
