global.expect = require('chai').expect;
var has = require('../src');


run({
  'Suite': {
    'test': function() {
      expect(has({}, 'hasOwnProperty')).to.be.false;
      expect(has(Object.prototype, 'hasOwnProperty')).to.be.true;
    }
  }
});
