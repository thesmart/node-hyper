var _ = require('underscore');

module.exports = {};

var ps = require('./ps.js');
_.each(ps, function(val, key) {
	module.exports[key] = val;
});

module.exports.array = require('./ps.array.js');
module.exports.object = require('./ps.array.js');
