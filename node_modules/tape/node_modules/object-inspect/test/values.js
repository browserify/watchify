var inspect = require('../');
var test = require('tape');

test('values', function (t) {
    t.plan(1);
    var obj = [ {}, [], { 'a-b': 5 } ];
    t.equal(inspect(obj), '[ {}, [], { \'a-b\': 5 } ]');
});

test('has', function (t) {
    t.plan(1);
    var has = Object.prototype.hasOwnProperty;
    delete Object.prototype.hasOwnProperty;
    t.equal(inspect({ a: 1, b: 2 }), '{ a: 1, b: 2 }');
    Object.prototype.hasOwnProperty = has;
});

test('indexOf seen', function (t) {
    t.plan(1);
    var xs = [ 1, 2, 3, {} ];
    xs.push(xs);
    
    var seen = [];
    seen.indexOf = undefined;
    
    t.equal(
        inspect(xs, {}, 0, seen),
        '[ 1, 2, 3, {}, [Circular] ]'
    );
});

test('seen seen', function (t) {
    t.plan(1);
    var xs = [ 1, 2, 3 ];
    
    var seen = [ xs ];
    seen.indexOf = undefined;
    
    t.equal(
        inspect(xs, {}, 0, seen),
        '[Circular]'
    );
});

test('seen seen seen', function (t) {
    t.plan(1);
    var xs = [ 1, 2, 3 ];
    
    var seen = [ 5, xs ];
    seen.indexOf = undefined;
    
    t.equal(
        inspect(xs, {}, 0, seen),
        '[Circular]'
    );
});
