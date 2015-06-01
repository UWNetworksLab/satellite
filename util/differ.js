/*jslint node:true,nomen: true*/
'use strict';

/**
 * Usage:
 * r1 = fs.createReadStream('...');
 * r2 = fs.createReadStream('...');
 * handles = require('differ')(fs.createWriteStream('union.file'));
 * r1.pipe(handles[0]).pipe(fs.createWriteStream('r1only.file'));
 * r2.pipe(handles[1]).pipe(fs.createWriteStream('r2only.file'));
 */

var stream = require('stream');
var getDiff = function (union, comparison) {
  var inone = new stream.Transform({objectMode: true}),
    intwo = new stream.Transform({objectMode: true}),
    adone = false,
    bdone = false,
    aqueue = [],
    bqueue = [];


  if (!comparison) {
    comparison = function (a, b) {
      if (a === b) {
        return 0;
      } else if (a < b) {
        return -1;
      } else {
        return 1;
      }
    };
  }

  function emptyQueue() {
    var item, comp;
    while (true) {
      // end case.
      if (aqueue.length === 0 && bqueue.length === 0 && adone && bdone) {
        adone();
        bdone();
        union.end();
        break;
      }

      // deteriorated cases.
      if (aqueue.length === 0 && adone && bqueue.length > 0) {
        item = bqueue.shift();
        intwo.push(item[0]);
        item[1]();
      } else if (bqueue.length === 0 && bdone && aqueue.length > 0) {
        item = aqueue.shift();
        inone.push(item[0]);
        item[1]();
        // Comparison case.
      } else if (aqueue.length > 0 && bqueue.length > 0) {
        comp = comparison(aqueue[0][0], bqueue[0][0]);
        if (comp === 0) {
          item = [aqueue.shift(), bqueue.shift()];
          union.write(item[0][0]);
          item[0][1]();
          item[1][1]();
        } else if (comp < 0) {
          inone.push(aqueue[0][0]);
          aqueue.shift()[1]();
        } else {
          intwo.push(bqueue[0][0]);
          bqueue.shift()[1]();
        }
      } else { // waiting case
        break;
      }
    }
  }

  inone._transform = function (chunk, encoding, done) {
    aqueue.push([chunk, done]);
    emptyQueue();
  };

  inone._flush = function (done) {
    adone = done;
    emptyQueue();
  };

  intwo._transform = function (chunk, encoding, done) {
    bqueue.push([chunk, done]);
    emptyQueue();
  };

  intwo._flush = function (done) {
    bdone = done;
    emptyQueue();
  };

  return [inone, intwo];
};
/** end line chunker */

module.exports = getDiff;
