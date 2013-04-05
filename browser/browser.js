/*
 * BROWSER
 */
var $ = require('jQuery')
  ;

require('./lib/foreach.jq.js');

$(function () {
  "use strict";

  console.log('loading...');
  $('body').on('click', '.js-use-email', function (ev) {
    ev.preventDefault();
    console.log('lala ');
    $('.js-ask-email').hide();
    $('.js-login-email').slideDown();
    $('.js-signup-email').slideDown();
  });

  $('body').on('click', '.js-account-tabs a', function (ev) {
    ev.preventDefault();
    $(this).tab('show');
  });

  require('./lib/loginui-widget');
});
