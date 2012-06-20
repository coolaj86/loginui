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

    request.post(href).when(authenticatedUi);
  }

  function authenticatedUi(err, ahr, data) {
    var lastUser
      , currentUser
      ;

    if (err) {
      console.error('had error');
      console.error(err);
      return;
    }

    if (!data) {
      // TODO resume later
      console.error('no data');
      console.error(err);
      return;
    }

    $('.js-passphrase').forEach(function (el) {
      $(el).val('');
    });

    lastUser = store.get('login');
    currentUser = data.result;

    store.set('login', currentUser);

    if (!data.success) {
      console.log('authentication failed');
      $('.js-guest').removeClass('css-hidden');
      $('.js-authenticated-user').addClass('css-hidden');

      if (!lastUser || !/^guest/.exec(lastUser.username)) {
        console.log('assuming the new guest account');
      } else {
        console.log('resuming previous guest account');
        currentUser = lastUser;
        store.set('login', lastUser);
      }
    } else {
      $('.js-close-signup-login').addClass('css-hidden');
      $('.js-login-container').addClass('css-hidden');
      $('.js-signup-container').addClass('css-hidden');
    }

    if (/^guest/.test(currentUser.username)) {
      console.log('guest session', currentUser);
      // TODO change to displayname
      $('.js-nickname').text("Guest" + currentUser.username.replace(/^guest/, '').substr(0, 5));
      $('.js-guest').removeClass('css-hidden');
      $('.js-authenticated-user').addClass('css-hidden');
      return;
    }

    console.log('user session', currentUser);

    $('.js-guest').addClass('css-hidden');
    $('.js-authenticated-user').removeClass('css-hidden');

    $('.js-nickname').text(currentUser.nickname || currentUser.username);
  }

  function logout(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    // effectively overwrites the current session
    request.post('/session').when(authenticatedUi);
  }

  function attemptCreate(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    /*jshint validthis:true*/
    var obj
      , serializeToNativeTypes = true
      ;

    obj = serializeForm('form#js-signup', serializeToNativeTypes);

    console.log('form#js-signup');
    console.log(this);
    console.log(obj);
    request.post('/users', null, obj).when(function (err, ahr, data) {
      console.log('response to user creation');
      authenticatedUi(err, ahr, data);
    });
  }

  var cuToken;
  function checkUsername() {
    clearTimeout(cuToken);
    $('.js-signup-submit').attr('disabled', 'disabled');
    // TODO show spinner
    cuToken = setTimeout(function () {
      var val = $('#js-signup .js-username').val()
        ;

      // TODO hide spinner
      request.get('/users/' + val).when(function (err, ahr, data) {
        if (data.result) {
          console.log('RED: not available');
        } else if (data.success) {
          console.log('GREEN: available');
          $('.js-signup-submit').removeAttr('disabled');
        } else {
          console.warn("Didn't get usernames");
        }
      });
    }, 750);
  }

  function showLogin() {
    $('.js-close-signup-login').removeClass('css-hidden');
    $('.js-login-container').removeClass('css-hidden');
    $('.js-signup-container').addClass('css-hidden');
  }

  function showSignup() {
    $('.js-close-signup-login').removeClass('css-hidden');
    $('.js-signup-container').removeClass('css-hidden');
    $('.js-login-container').addClass('css-hidden');
  }

  function hideLoginSignup() {
    $('.js-close-signup-login').addClass('css-hidden');
    $('.js-signup-container').addClass('css-hidden');
    $('.js-login-container').addClass('css-hidden');
  }

  function copyPassphrase() {
    /*jshint validthis:true*/
    var secret = $(this).val()
      ;

    $('.js-passphrase').forEach(function (el) {
      $(el).val(secret);
    });
  }

  function hidePassphrase(ev) {
    /*jshint validthis:true*/
    var hide = $(this).attr('checked')
      ;

    console.log('passphrase hidden', hide, ev, this);

    $('.js-hide-passphrase').forEach(function (el) {
      $(el).attr('checked', hide);
    });

    if (hide) {
      $('.js-nopassword').addClass('css-hidden');
      $('.js-password').removeClass('css-hidden');
    } else {
      $('.js-password').addClass('css-hidden');
      $('.js-nopassword').removeClass('css-hidden');
    }
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

    if (login && login.username && login.secret) {
      // TODO this should be handled as part of ahr2
      urlObj.auth = login.username + ':' + login.secret;
    }

    // try to login as guest or user
    // if the guest token is bad, the server will respond with a different guest token
    href = url.format(urlObj);
    request.post(href).when(authenticatedUi);

    $('body').on('.js-logout', 'click', logout);
    $('body').on('form#js-auth', 'submit', attemptLogin);
    $('body').on('form#js-signup', 'submit', attemptCreate);
    $('body').on('form#js-signup .js-username', 'keyup', checkUsername);
    $('body').on('.js-show-signup', 'click', showSignup);
    $('body').on('.js-show-login', 'click', showLogin);
    $('body').on('.js-close-signup-login', 'click', hideLoginSignup);
    $('body').on('.js-passphrase', 'keyup', copyPassphrase);
    $('body').on('.js-hide-passphrase', 'change', hidePassphrase);

    $('.js-signup-container').addClass('css-hidden');
    $('.js-login-container').addClass('css-hidden');
    $('.js-login-container').addClass('css-hidden');
    $('.js-close-signup-login').addClass('css-hidden');
    $('.js-password').addClass('css-hidden');
    $('.js-signup-submit').attr('disabled', 'disabled');
  }

  domReady(init);
}());
