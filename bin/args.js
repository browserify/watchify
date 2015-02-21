var fromArgs = require('browserify/bin/args');
var watchify = require('../');

module.exports = function (args) {
    var browserify = fromArgs(
        args,
        watchify.args
    );
    return watchify(browserify, browserify.argv);
};
