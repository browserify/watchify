var fromArgs = require('browserify/bin/args');
var watchify = require('../');

module.exports = function (args) {
    return watchify(fromArgs(
        args || process.argv.slice(2),
        watchify.args
    ));
};
