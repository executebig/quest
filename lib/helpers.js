"use strict";

let blocks = Object.create(null);

exports.section = (name, options) => {
  if (!this._sections) this._sections = {};
  this._sections[name] = options.fn(this);
  return null;
};

exports.eq = (arg1, arg2, options) => {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
}

exports.extend = (name,context) => {
  let block = blocks[name];
  if (!block) {
      block = blocks[name] = [];
  }

  block.push(context.fn(this));
}

exports.block = (name) => {
  let val = (blocks[name] || []).join('\n');

  // clear the block
  blocks[name] = [];
  return val;
}