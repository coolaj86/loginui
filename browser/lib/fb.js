/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";
  
  var $ = require('jQuery')
    , FB
    , domReady = $
    ;

  function initiateFbLogin() {
  }

  function testApi() {
    console.log('Welcome! Fetching your information.... ');
    FB.api('/me', function(response) {
      console.log('/me Result:');
      console.log(response);
      console.log('Good to see you, ' + response.name + '.');
    });
  }

  function login() {
    FB.login(function(response) {
      console.log('Login Result:');
      console.log(response);
      if (response.authResponse) {
        // connected
        getLoginStatus();
      } else {
        // cancelled
        // XXX BUG cyclic loop
        getLoginStatus();
      }
    }, { scope: "email" });
  }

  function getLoginStatus() {
    // Additional init code here
    FB.getLoginStatus(function(response) {
      console.log('Login Status:', response.status);
      if (response.status === 'connected') {
        // connected
        testApi();
      } else if (response.status === 'not_authorized') {
        // not_authorized
      } else {
        // not_logged_in
      }
    });
  }

  domReady(function () {
    $('body').on('click', '.js-fb-connect', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      console.log('click', '.js-fb-connect');
      initiateFbLogin();
    });
  });

  module.exports.init = function () {
    // loaded async
    FB = require('FB');

    FB.init({
        appId: '191236997623684' // App ID
      //, channelUrl: '//WWW.YOUR_DOMAIN.COM/channel.html' // Channel File
      , status: true // check login status
      , cookie: true // enable cookies to allow the server to access the session
      //, xfbml: true  // parse XFBML
    });

    login();
  };
}());
