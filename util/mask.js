/*jslint node:true, bitwise:true */
'use strict';

/**
 * Make a mask where you can get or set any number from 0 to max - 1
 * to 0 or 1.
 * Stores state efficiently in a binary buffer.
 */
exports.newMask = function (size) {
  var buffer = new Buffer(size / 8);
  buffer.fill(0);

  return {
    buf: buffer,
    get: function (n) {
      return (this.buf.readUInt8(Math.floor(n / 8)) & (1 << (n % 8))) > 0;
    },
    set: function (n) {
      var pos = Math.floor(n / 8);
      this.buf.writeUInt8(this.buf.readUInt8(pos) | (1 << (n % 8)), pos);
    },
    clear: function (n) {
      var pos = Math.floor(n / 8);
      this.buf.writeUInt8(this.buf.readUInt8(pos) & ~(1 << (n % 8)), pos);
    }
  };
};