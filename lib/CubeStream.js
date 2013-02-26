// creates a stream object for user data

var SmartStream = require('smart-stream').SmartStream;
var util = require('util');
var moment = require('moment');

/**
 * A source stream for cursing through dates
 *
 * @constructor
 * @extends {SmartStream}
 */
var CubeStream = module.exports = function() {
	SmartStream.call(this, 'CubeStream');
};
util.inherits(CubeStream, SmartStream);

CubeStream.setMiddleware(function middleware(data, next) {

});