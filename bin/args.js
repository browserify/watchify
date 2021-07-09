var fromArgs = require('browserify/bin/args');
var watchify = require('../');
var defined = require('defined');

module.exports = function (args) {
    var b = fromArgs(args, watchify.args);

    var opts = {};
    var ignoreWatch = defined(b.argv['ignore-watch'], b.argv.iw);
    if (ignoreWatch) {
        opts.ignoreWatch = ignoreWatch;
    }

    return watchify(b, Object.assign(opts, b.argv));
};
