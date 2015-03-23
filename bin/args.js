var fromArgs = require('browserify/bin/args');
var watchify = require('../');

module.exports = function (args) {
    var browserify = fromArgs(
        args || process.argv.slice(2),
        watchify.args
    );
    return watchify(browserify, browserify.argv);
};
