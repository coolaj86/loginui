/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true*/
/*
 * BROWSER
 */
(function () {
  "use strict";

  var $ = require('ender')
    , noObj = {}
    , noOp = function () {}
    , domReady = require('domready')
    , uuid = require('node-uuid')
    , url = require('url')
    , store = require('json-storage').create(require('localStorage'))
    , location = require('location')
    , serializeForm = require('serialize-form').serializeFormObject
    , serializeToNativeTypes = true
    , pure = require('pure').$p
    , request = require('ahr2')
    , oldHttp
    , userSession
    ;

  // Monkey Patch for session support
  request._oldHttp = request.http;
  request.http = function (options, callback) {
    var p
      ;

    options.query = options.query || {};
    options.query.userSession = options.query.userSession || userSession;
    options.query.foo = 'bar';
    p = request._oldHttp(options, callback);
    p.when(function (err, ahr, data) {
      if (data && data.userSession) {
        userSession = data.userSession;
      }
    });
    return p;
  };

  function attemptLogin(ev) {
    var obj
      , urlObj
      , href
      ;

    ev.preventDefault();
    ev.stopPropagation();

    obj = serializeForm('form#js-auth', serializeToNativeTypes);

    urlObj = {
        protocol: location.protocol
      , hostname: location.hostname
      , port: location.port
      , pathname: '/session'
      , auth: obj.username + ':' + obj.passphrase
    };

    href = url.format(urlObj);
    console.log('href[2]');
    console.log(href);

    request.post(href).when(authenticatedUi);
  }

  function authenticatedUi(err, ahr, data) {
    var username
      ;

    if (err) {
      console.error('had error');
      console.error(err);
      return;
    }
    if (!data) {
      console.error('no data');
      console.error(err);
      return;
    }

    store.set('login', data.result);
    console.log('session', data.result);

    if (!data.success) {
      console.log('it\'s BAD BAD BAD');
      $('.js-unauthenticated').show();
      $('.js-authenticated').hide();
      return;
    }

    username = data.result.username;
    if (/^guest/.test(username)) {
      // TODO change to displayname
      $('.js-username-before').text("Welcome ");
      $('.js-username').text("Guest");
      $('.js-username-after').text("!");
      $('.js-unauthenticated').show();
      $('.js-authenticated').show();
      username = 'guest';
      return;
    }

    $('.js-unauthenticated').hide();
    $('.js-authenticated').show();
    console.log('nick:', username);
    $('.js-username-before').text("Not ");
    $('.js-username').text(username);
      $('.js-username-after').text("?");
  }

  function logout(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    $('.js-unauthenticated').show();
  }

  function init() {
    var login = store.get('login')
      , urlObj = {
            protocol: location.protocol
          , hostname: location.hostname
          , port: location.port
          , pathname: '/session'
        }
      , href
      ;

    $('body').delegate('form#js-auth', 'submit', attemptLogin);
    
    if (login && login.username && login.secret) {
      // TODO this should be handled as part of ahr2
      urlObj.auth = login.username + ':' + login.secret;
    }

    // try to login as guest or user
    // if the guest token is bad, the server will respond with a different guest token
    console.log('urlObj[0]');
    console.log(urlObj);
    console.log(urlObj);
    href = url.format(urlObj);
    console.log('href[1]');
    console.log(href);
    request.post(url.format(urlObj)).when(authenticatedUi);
    $('body').on('#js-logout', 'click', logout);
  }

  domReady(init);
}());
