var fs = require('fs');
var path = require('path');

var through = require('through2');
var Readable = require('readable-stream').Readable;

var concat = require('concat-stream');
var duplexer = require('duplexer2');
var falafel = require('falafel');
var unparse = require('escodegen').generate;
var inspect = require('object-inspect');
var evaluate = require('static-eval');
var copy = require('shallow-copy');

module.exports = function parse (modules, opts) {
    if (!opts) opts = {};
    var vars = opts.vars || {};
    var varNames = opts.varNames || {};
    var skip = opts.skip || {};
    var skipOffset = opts.skipOffset || 0;
    var pending = 0;
    var updates = [];
    
    function pushUpdate (node, s) {
        var rep = String(s);
        var prev = node.range[1] - node.range[0];
        updates.push({ offset: prev - rep.length });
        node.update(rep);
    }
    
    var output = through();
    var body;
    return duplexer(concat(function (buf) {
        try {
            body = buf.toString('utf8');
            var src = falafel(body, walk)
        }
        catch (err) { return error(err) }
        if (pending === 0) finish(src);
    }), output);
    
    function finish (src) {
        var offset = 0, pos = 0;
        src = String(src);
        
        (function next () {
            if (updates.length === 0) return done();
            
            var s = updates.shift();
            if (!s.stream) {
                offset += s.offset;
                return next();
            }
            
            output.push(src.slice(pos, s.range[0] - offset));
            pos = s.range[0] - offset;
            offset += s.range[1] - s.range[0];
            
            s.stream.on('end', next);
            s.stream.pipe(output, { end: false });
        })();
        
        function done () {
            output.push(src.slice(pos));
            output.push(null);
        }
    }
    
    function error (msg) {
        var err = typeof msg === 'string' ? new Error(msg) : msg;
        output.emit('error', err);
    }
    
    function walk (node) {
        var isreq = false, reqid;
        if (isRequire(node)) {
            reqid = node.arguments[0].value;
            isreq = has(modules, reqid);
        }
        
        if (isreq && node.parent.type === 'VariableDeclarator'
        && node.parent.id.type === 'Identifier') {
            varNames[node.parent.id.name] = reqid;
            var decs = node.parent.parent.declarations;
            var ix = decs.indexOf(node.parent);
            var dec;
            if (ix >= 0) {
                dec = decs[ix];
                decs.splice(ix, 1);
            }
            
            var rep;
            if (decs.length === 0) {
                rep = '';
            }
            else {
                var src = unparse(node.parent.parent);
                updates.push({
                    range: [ 0, src.length ],
                    stream: st('var ')
                });
                decs.forEach(function (d, i) {
                    var key = (d.range[0] + skipOffset)
                        + ',' + (d.range[1] + skipOffset)
                    ;
                    skip[key] = true;
                    
                    var s = parse(modules, {
                        skip: skip,
                        skipOffset: skipOffset + d.init.range[0],
                        vars: vars,
                        varNames: varNames
                    });
                    updates.push({
                        range: [
                            d.init.range[0],
                            d.init.range[1]
                        ],
                        stream: s
                    });
                    if (i < decs.length - 1) {
                        var comma;
                        if (i === ix - 1) {
                            comma = body.slice(d.range[1], dec.range[0]);
                        }
                        else comma = body.slice(d.range[1], decs[i+1].range[0]);
                        updates.push({
                            range: [
                                d.range[1], d.range[1] + comma.length
                            ],
                            stream: st(comma)
                        });
                    }
                    s.end(unparse(d));
                });
                rep = '';
            }
            pushUpdate(node.parent.parent, rep);
        }
        else if (isreq && node.parent.type === 'AssignmentExpression'
        && node.parent.left.type === 'Identifier') {
            varNames[node.parent.left.name] = reqid;
            var cur = node.parent.parent;
            if (cur.type === 'SequenceExpression') {
                var ex = cur.expressions;
                var ix = ex.indexOf(node.parent);
                if (ix >= 0) ex.splice(ix, 1);
                pushUpdate(
                    node.parent.parent,
                    unparse(node.parent.parent)
                );
            }
            else pushUpdate(cur, '');
        }
        else if (isreq && node.parent.type === 'MemberExpression'
        && node.parent.property.type === 'Identifier'
        && node.parent.parent.type === 'VariableDeclarator'
        && node.parent.parent.id.type === 'Identifier') {
            varNames[node.parent.parent.id.name] = [
                reqid, node.parent.property.name
            ];
            var decs = node.parent.parent.parent.declarations;
            var ix = decs.indexOf(node.parent.parent);
            if (ix >= 0) decs.splice(ix, 1);
            
            if (decs.length === 0) {
                pushUpdate(node.parent.parent.parent, '');
            }
            else {
                pushUpdate(
                    node.parent.parent.parent,
                    unparse(node.parent.parent.parent)
                );
            }
        }
        else if (isreq && node.parent.type === 'MemberExpression'
        && node.parent.property.type === 'Identifier') {
            var name = node.parent.property.name;
            var cur = copy(node.parent.parent);
            cur.callee = copy(node.parent.property);
            cur.callee.parent = cur;
            traverse(cur.callee, modules[reqid][name]);
        }
        else if (isreq && node.parent.type === 'CallExpression') {
            var cur = copy(node.parent);
            var iname = Math.pow(16,8) * Math.random();
            cur.callee = {
                type: 'Identifier',
                name: '_' + Math.floor(iname).toString(16),
                parent: cur
            };
            traverse(cur.callee, modules[reqid]);
        }
        
        if (node.type === 'Identifier' && has(varNames, node.name)) {
            var vn = varNames[node.name];
            if (Array.isArray(vn)) {
                traverse(node, modules[vn[0]][vn[1]]);
            }
            else traverse(node, modules[vn]);
        }
    }
    
    function traverse (node, val) {
        for (var p = node; p; p = p.parent) {
            if (!p.range) continue;
            var key = (p.range[0] + skipOffset)
                + ',' + (p.range[1] + skipOffset)
            ;
            if (skip[key]) {
                skip[key] = false;
                return;
            }
        }
        
        if (skip[key]) {
            skip[key] = false;
            return;
        }
        
        if (node.parent.type === 'CallExpression') {
            if (typeof val !== 'function') {
                return error(
                    'tried to statically call ' + inspect(val)
                    + ' as a function'
                );
            }
            var xvars = copy(vars);
            xvars[node.name] = val;
            var res = evaluate(node.parent, xvars);
            
            if (isStream(res)) {
                updates.push({
                    range: node.parent.range,
                    stream: wrapStream(res)
                });
                pushUpdate(node.parent, '');
            }
            else if (res !== undefined) pushUpdate(node.parent, res);
        }
        else if (node.parent.type === 'MemberExpression') {
            if (node.parent.property.type !== 'Identifier') {
                return error(
                    'dynamic property in member expression: '
                    + node.parent.source()
                );
            }
            
            var cur = node.parent.parent;
            
            if (cur.type === 'MemberExpression') {
                cur = cur.parent;
                if (cur.type !== 'CallExpression'
                && cur.parent.type === 'CallExpression') {
                    cur = cur.parent;
                }
            }
            if (node.parent.type === 'MemberExpression'
            && (cur.type !== 'CallExpression'
            && cur.type !== 'MemberExpression')) {
                cur = node.parent;
            }
            
            var xvars = copy(vars);
            xvars[node.name] = val;
            
            var res = evaluate(cur, xvars);
            if (isStream(res)) {
                updates.push({
                    range: cur.range,
                    stream: wrapStream(res)
                });
                cur.update('');
            }
            else if (res !== undefined) {
                pushUpdate(cur, res);
            }
        }
        else {
            output.emit('error', new Error(
                'unsupported type for static module: ' + node.parent.type
                + '\nat expression:\n\n  ' + unparse(node.parent) + '\n'
            ));
        }
    }
}

function isRequire (node) {
    var c = node.callee;
    return c
        && node.type === 'CallExpression'
        && c.type === 'Identifier'
        && c.name === 'require'
    ;
}

function has (obj, key) {
    return {}.hasOwnProperty.call(obj, key);
}

function isStream (s) {
    return s && typeof s === 'object' && typeof s.pipe === 'function';
}

function wrapStream (s) {
    if (typeof s.read === 'function') return s
    else return (new Readable).wrap(s)
}

function st (msg) {
    var r = new Readable;
    r._read = function () {};
    r.push(msg);
    r.push(null);
    return r;
}
