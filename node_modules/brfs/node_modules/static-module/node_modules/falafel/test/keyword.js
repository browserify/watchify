var falafel = require('../');
var test = require('tape');

test('custom keyword', function (t) {
    t.plan(2);
    
    var src = 't.equal(beep "boop", "BOOP");';
    var opts = {
        isKeyword: function (id) {
            if (id === 'beep') return true;
        }
    };
    
    var output = falafel(src, opts, function (node) {
        if (node.type === 'UnaryExpression'
        && node.operator === 'beep') {
            node.update(
                'String(' + node.argument.source() + ').toUpperCase()'
            );
            t.equal(node.operator, node.keyword);
        }
    });
    Function('t', output)(t);
});

test('block keyword', function (t) {
    t.plan(4);
    
    var src = 'server { where.push("server") } client { where.push("client") }';
    var output = falafel(src, { isKeyword: isKeyword }, function (node) {
        if (node.keyword === 'server') {
            node.update('if (SERVER) {' + source(node.body) + '}');
        }
        else if (node.keyword === 'client') {
            node.update('if (CLIENT) {' + source(node.body) + '}');
        }
    });
    
    var where;
    
    where = [];
    Function('CLIENT', 'SERVER', 'where', output)(true, false, where);
    t.deepEqual(where, ['client']);
    
    where = [];
    Function('CLIENT', 'SERVER', 'where', output)(false, true, where);
    t.deepEqual(where, ['server']);
    
    where = [];
    Function('CLIENT', 'SERVER', 'where', output)(true, true, where);
    t.deepEqual(where, ['server', 'client']);
    
    where = [];
    Function('CLIENT', 'SERVER', 'where', output)(false, false, where);
    t.deepEqual(where, []);
    
    function isKeyword (id) {
        if (id === 'server' || id === 'client') return 'block';
    }
    
    function source (xs) {
        return xs.map(function (x) { return x.source() }).join('');
    }
});
