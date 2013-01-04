/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";
  
  var $ = require('jQuery')
    , domReady = $
    ;

  function initiateFbLogin() {
  }
  
  domReady(function () {
    $('body').on('click', '.js-fb-connect', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      initiateFbLogin();
    });
  });
}());
