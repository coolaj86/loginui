/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";
  
  var $ = require('jQuery')
    , myFb = module.exports
    , FB
    , domReady = $
    ;

  function testApi() {
    console.log('Welcome! Fetching your information.... ');
    FB.api('/me', function(response) {
      console.log('/me Result:');
      console.log(response);
      console.log('Good to see you, ' + response.name + '.');
    });
  }

  function login(cb) {
    function answerHappily() {
      cb(FB.getAccessToken());
    }

    FB.getLoginStatus(function(response) {
      console.log('Login Status:', response.status);
      if (response.status === 'connected') {
        // connected
        // logged into facebook and connected to the app
        answerHappily();
        return;
      }

      function relayFbLogin() {
        FB.login(function(response) {
          console.log('Login Result:');
          console.log(response);
          if (response.authResponse) {
            // connected
            answerHappily();
          } else {
            // cancelled
          }
        }, { scope: "email" });
      }

      FB.login(relayFbLogin);
      if (response.status === 'not_authorized') {
        // not_authorized
        // logged in to facebook, but not the app
      } else if (response.status === 'unknown') {
        // not logged in to facebook at all
      } else {
        // not_logged_in ?
        console.warn('unknown state:', response.status);
      }
      // TODO what about when the app is connected,
      // but the access token has expired?
    });
  }

  function getLoginStatus() {
    // Additional init code here
    FB.getLoginStatus(function(response) {
      console.log('Login Status:', response.status);
      if (response.status === 'connected') {
        // connected
        // logged into facebook and connected to the app
        testApi();
      } else if (response.status === 'not_authorized') {
        // not_authorized
        // logged in to facebook, but not the app
      } else if (response.status === 'unknown') {
        // not logged in to facebook at all
      } else {
        // not_logged_in ?
        console.warn('unknown state:', response.status);
      }
      // TODO what about when the app is connected,
      // but the access token has expired?
    });
  }

  myFb.getAccessToken = function (cb) {
    FB.getLoginStatus(function(response) {
      if (response.status === 'connected') {
        // connected
        // logged into facebook and connected to the app
        cb(FB.getAccessToken());
      } else {
        cb();
      }
    });
  };

  myFb.init = function () {
    // loaded async
    FB = require('FB');

    FB.init({
        appId: '191236997623684' // App ID
      //, channelUrl: '//WWW.YOUR_DOMAIN.COM/channel.html' // Channel File
      , status: true // check login status
      , cookie: true // enable cookies to allow the server to access the session
      //, xfbml: true  // parse XFBML
    });
  };
  myFb.login = login;
}());
