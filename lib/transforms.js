/**
 * Copyright 2012, Prescreen, Inc. https://www.prescreen.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var ps = require('./ps');
var _ = require('underscore');
var moment = require('moment');

/**
 * Filter data to have date dimensions in local time, down to the hourly grain.
 * This requires a standard data format:
 * 		data = {
 * 			time: {number}
 * 			dimensions: {Object}
 * 			measures: {Object}
 * 		}
 *
 * It will add the standard date fields, in local time.
 *
 * @param {Object} data		See format in function comments.
 */
module.exports.addDateFacts	= function(data) {
	var dayOfWeek	= ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

	_.each(data, function(record, i) {
		if (!record.time || !record.facts) {
			;; console.error('record is missing necessary properties. halting.', record);
			return false;
		}

		// build Date, which will represent local time on the client machine
		var date = new Date(record.time);
		var m = moment(date);
		record.facts.year			= date.getFullYear();
		record.facts.month			= date.getMonth() + 1;
		record.facts.day			= date.getDate();
		record.facts.hour			= date.getHours();
		record.facts.iso_week		= m.format('YYYY-\\Www');
		record.facts.day_of_week	= dayOfWeek[date.getDay()];
	});

	_.sortBy(data, function(record) {
		return record.time * -1;
	});
};