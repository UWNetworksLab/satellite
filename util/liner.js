/*jslint node:true,nomen: true*/
'use strict';

/** Line chunker from http://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api/ */
var stream = require('stream');
var makeLiner = function() {
  var liner = new stream.Transform({objectMode: true});

  liner._transform = function (chunk, encoding, done) {
    var data = chunk.toString(), lines;
    if (this._lastLineData) {
      data = this._lastLineData + data;
    }

    lines = data.split('\n');
    this._lastLineData = lines.splice(lines.length - 1, 1)[0];

    lines.forEach(this.push.bind(this));
    done();
  };

  liner._flush = function (done) {
    if (this._lastLineData) {
      this.push(this._lastLineData);
    }
    this._lastLineData = null;
    done();
  };
  return liner;
}
/** end line chunker */
var makeReturner = function () {
  var obj = new stream.Transform({objectMode: true});

  obj._transform = function (chunk, encoding, done) {
    this.push(chunk + '\n');
    done();
  };
  return obj;
};


module.exports = {
  liner: makeLiner(),
  get: makeLiner,
  newline: makeReturner
};
