var $ = require('jQuery')
  ;

$.fn.forEach = function (fn, context) {
  Array.prototype.forEach.call(this, fn, context || this);
  /*
  var arr = Array.prototype.slice.call(this)
    ;

  arr.forEach(fn, context || this);
  */
};
