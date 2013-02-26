/**
 * Copyright 2011, Prescreen, Inc. https://www.prescreen.com
 * @author John Smart <https://twitter.com/thesmart>
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
var Cell = require('./Cell.js');
var FactIndex = require('./FactIndex.js');
var _ = require('underscore');

/**
 * A simple implementation of an OLAP hypercube.
 * @see http://www.olapcouncil.org/research/glossaryly.htm
 *
 * @param {Array.<string>=} opt_measureNames		Optional. The measure names to expect.
 */
var Cube = module.exports = function(opt_measureNames) {

	/**
	 * A collection of all cells
	 * @property {Array.<Cell>}
	 */
	this.cells		= [];

	/**
	 * A collection of indexes, keyed by index-name
	 * @property {Object.<string, FactIndex>}
	 * @protected
	 */
	this._indecies	= {};

	/**
	 * The names of the facts contained in this cube
	 * @property {Array.<string>}
	 * @protected
	 */
	this._factNames	= [];

	/**
	 * The names of measures we should expect
	 * @property {Array.<string>}
	 * @protected
	 */
	this._measureNames = ps.isArray(opt_measureNames) ? opt_measureNames : null;
};

/**
 * @return {!number}		The size of the cube
 */
Cube.prototype.count = function() {
	return this.cells.length;
};

/**
 * Get the names of the facts the make this Cube
 * @return {Array.<string>}
*/
Cube.prototype.getFactNames = function() {
	if (!this._factNames.length) {
		// compile the fact names
		this._factNames	= ps.array.keys(this._indecies);
		this._factNames.sort();
	}

	return this._factNames;
};

/**
 * Get the unique fact values for a specific fact name
 * i.e. 'title' would retrieve ['Terminator 2: Judgement Day', 'Alien']
 * @param {string} factName
 * @return {Array.<string>}		Get a list of fact values from the cube
 */
Cube.prototype.getFactValues = function(factName) {
	var values 		= [];

	for (var i = 0, il = this.cells.length; i < il; ++i) {
		var value	= this.cells[i].facts[factName];
		if (value) {
			values.push(value);
		}
	}

	return ps.array.unique(values);
};

/**
 * Insert a cell
 * @param {!Cell} cell
 */
Cube.prototype.insert = function(cell) {
	this._factNames	= [];

	var position	= this.cells.length,
		index;

	_.each(cell.facts, function(factValue, factName) {
		index	= this._indecies[factName];
		if (!ps.isDef(index)) {
			// build a new fact index where non-existed
			index		= new FactIndex();
			this._indecies[factName]	= index;
		}
		index.insert(factValue, position);
	}.bind(this));

	this.cells.push(cell);
};

/**
 * Get the position of every cell that matches the fact set
 * @param {!Object<string, string>} facts
 * @return {Array.<number>}		The positions in this._cells that match the fact set
 * @protected
 */
Cube.prototype._getPos = function(facts) {
	var hits,
		factPositions,
		index;

	_.each(facts, function(factValue, factName) {
		index		= this._indecies[factName];
		if (!ps.isDef(index)) {
			// this fact is not in this cube
			hits	= [];
			return false;
		}

		factPositions	= index.get(factValue);
		if (!ps.isDef(factPositions)) {
			// this fact is not in this cube
			hits	= [];
			return false;
		}

		if (hits) {
			// get hits that match across all fact sets
			hits	= ps.array.intersect(hits, factPositions);
		} else {
			// initialize hits
			hits	= factPositions;
		}

		if (!hits.length) {
			// this fact is not in the cube
			hits	= [];
			return false;
		}

	}.bind(this));

	return hits;
};

/**
 * Slice off and return the cells that align with specific fact values
 * @param {!Object<string, string>} facts
*/
Cube.prototype.slice = function(facts) {
	var slice			= new Cube(this._measureNames),
	 	hits			= this._getPos(facts);

	for (var i = 0, il = hits.length; i < il; ++i) {
		slice.insert(this.cells[hits[i]]);
	}

	return slice;
};

/**
 * Slice the cube between two millisecond timestamps
 * 
 * @param {number} fromTime
 * @param {number} toTime
 */
Cube.prototype.sliceTime = function(fromTime, toTime) {
	var cube	= new Cube(this._measureNames),
		cells	= this.cells,
		facts;

	for (var i = 0, il = cells.length; i < il; ++i) {
		if (cells[i].time >= fromTime && cells[i].time < toTime) {
			// match!
			cube.insert(cells[i]);
		}
	}

	return cube;
};

/**
 * Slice by a callback function.
 * @param {Function(cell, i)} iterator		Return true to slice, falsy to dice
 * @return {Cube}
 */
Cube.prototype.sliceBy = function(iterator) {
	var cube	= new Cube(this._measureNames),
		cells	= this.cells;

	for (var i = 0, il = cells.length; i < il; ++i) {
		if (iterator.call(this, cells[i], i)) {
			// match!
			cube.insert(cells[i]);
		}
	}

	return cube;
};

/**
 * Iterate over each cell
 * @param {Function(cell, i)} iterator
 * @return {Cube}
 */
Cube.prototype.forEach = function(iterator) {
	var cells	= this.cells;

	for (var i = 0, il = cells.length; i < il; ++i) {
		iterator.call(this, cells[i], i)
	}

	return this;
};

/**
 * Create a collection of Cube instances containing Cells that have
 * a truthy factName
 *
 * e.g.
 * cube.groupBy('aptitude');
 * { 'smart': Cube, 'average': Cube, 'clueless': Cube }
 *
 * @param {string} factName
 * @return {Object<string,Cube>}
 */
Cube.prototype.groupBy = function(factName) {
	var factValues = this.getFactValues(factName),
		cubes = {};

	for (var i = 0, il = factValues.length; i < il; ++i) {
		var query = {},
			factValue = factValues[i];

		query[factName] = factValue;
		cubes[factValue] = this.slice(query);
	}

	return cubes;
};

/**
 * Create a new Cube
 * @param {string} factName			Group by this fact
 * @param {string} measureName		Sort by this measure
 * @param {number} limit			Limit how many are returned
 * @return {Object<name, Cube>}	A collection cubes, indexed by factName
 */
Cube.prototype.sortBy = function(factName, measureName, limit) {
	var groups = this.groupBy(factName);

	var cubes = _.sortBy(groups, function(cube, factValue) {
		return cube.sum()[measureName] * -1;
	});

	if (limit) {
		cubes = cubes.slice(0, limit);
	}

	var cubesByValue = {};
	for (var i = 0, il = cubes.length; i < il; ++i) {
		var cube = cubes[i],
			cell = cube.cells[0];

		cubesByValue[cell.facts[factName]] = cube;
	}

	return cubesByValue;
};

/**
 * Dice out a cube, removing the data that matches a set of facts
 * @param {!Object<string, string>} facts
 */
Cube.prototype.dice = function(facts) {
	var dice			= new Cube(this._measureNames),
	 	hits			= this._getPos(facts);

	// invert the hits
	hits	= ps.array.diff(ps.array.keys(this.cells), hits);
	for (var i = 0, il = hits.length; i < il; ++i) {
		dice.insert(this.cells[hits[i]]);
	}

	return dice;
};

/**
 * Merge a cube with this cube
 * @param {!Cube} cube
 */
Cube.prototype.merge = function(cube) {
	for (var i = 0, il = cube.cells.length; i < il; ++i) {
		this.insert(cube.cells[i]);
	}
};

/**
* Sum the measures in the cube
*
* @static
* @param {number=} opt_precision					Optional. The number of significant figures to allow
* @return {Object}		The summed measure set
*/
Cube.prototype.sum = function(opt_precision) {
	if (!this.cells.length) {
		if (this._measureNames) {
			return ps.object.fill(this._measureNames, 0);
		}
		return {};
	}

	return Cell.aggregate(this.cells, function(agg, inc) {
		if (ps.isNumber(opt_precision)) {
			// sig figs
			inc		= parseFloat(inc.toPrecision(opt_precision), 10);
		}

		if (ps.isDef(agg)) {
			agg += inc;
		} else {
			// first iteration, aggregate is undefined
			agg = inc;
		}

		return agg;
	});
};

/**
 * Average the measures in the cube
 *
 * @static
 * @param {number} count							Based on the grain, this count is the maximum number of cells in the set.
 * @param {number=} opt_precision					Optional. The number of significant figures to allow
 * @return {Object}		The summed measure set
*/
Cube.prototype.avg = function(count, opt_precision) {
	var sums	= this.sum(opt_precision),
		avgs	= {},
		hasMeasures = false;

	_.each(sums, function(value, key) {
		hasMeasures	= true;
		value		= value ? value / count : value;
		if (ps.isNumber(opt_precision)) {
			// sig figs
			value	= parseFloat(value.toPrecision(opt_precision), 10);
		}
		avgs[key]	= value;
	});

	if (!hasMeasures && this._measureNames) {
		return ps.object.fill(this._measureNames, 0);
	}

	return avgs;
};

/**
 * Get a cube of the top measures based on the callback function comparable result (0, 1, or -1)
 * @param {number} limit			A limit to the number of results to return
 * @param {Function} iterator		A function the returns 0 (equal), 1 (greater than), -1 (less than)
 * @return {Cube}
 */
Cube.prototype.sliceTop = function(limit, iterator) {
	var topCells = _.sortBy(this.cells, function(cell) {
		return iterator(cell.measures);
	});

	var topCube = new Cube(this._measureNames);
	for (var i = 0, l = topCells.length; i < l; ++i) {
		if (i === limit) {
			break;
		}
		topCube.insert(topCells[i]);
	}
	return topCube;
};

/**
* Turn the cube into a simple array of objects
* @return {Array}
*/
Cube.prototype.serialize = function() {
	var data	= [],
		obj,
		cell;

	for (var i = 0, il = this.cells.length; i < il; ++i) {
		cell			= this.cells[i];
		obj				= {};
		if (ps.isNumber(cell.time)) {
			obj['time']		= cell.time;
		}
		obj['facts']	= cell.facts;
		obj['measures']	= cell.measures;
		data.push(obj);
	}

	return data;
};

/**
 * Create a new cube using data from a simple array of objects
 * @param {Array} data
 * @param {Array.<string>=} opt_measureNames		Optional. The measure names to expect.
 * @return {!Cube}
*/
Cube.deserialize = function(data, opt_measureNames) {
	var cube = new Cube(opt_measureNames),
		cellData;

	for (var i = 0, il = data.length; i < il; ++i) {
		cellData = data[i];
		var time = ps.isNumber(cellData['time']) ? cellData['time'] * 1000 : undefined;
		cube.insert(new Cell(cellData['facts'], cellData['measures'], time));
	}

	return cube;
};
