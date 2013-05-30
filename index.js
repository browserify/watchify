var browserify = require('browserify');
var fs = require('fs');
var through = require('through');

module.exports = function (opts) {
    var bundle = browserify(opts);
    bundle.on('dep', function (dep) {
        console.log(dep.id);
    });
    return bundle;
};
