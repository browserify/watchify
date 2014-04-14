var test = require('tape');

test('hackfix to end the process', function (t) {
    t.on('end', function () {
        setTimeout(process.exit, 1);
    });
    t.end();
});
