/*
 * BROWSER
 */
// Docs
// https://developers.facebook.com/tools/explorer/
// https://developers.facebook.com/docs/reference/javascript/#graphapi
(function () {
  "use strict";

  var $ = require('jQuery')
    /*
    , noObj = {}
    , noOp = function () {}
    , uuid = require('node-uuid')
    , pure = require('pure').$p
    , oldHttp
    */
    , domReady = $
    , url = require('url')
    , store = require('json-storage').create(require('localStorage'))
    , location = require('location')
    , serializeForm = require('serialize-form').serializeFormObject
    , serializeToNativeTypes = true
    , request = require('ahr2')
    , userSession
    , cuToken
    , cuVal = ""
    , fb = require('./fb')
    ;

  require('window').fbOauth = function (msg) {
    console.log('fbOauth');
    console.log(msg);
  };

  // TODO switch to AHR3
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

  function updateAccount(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    window.alert('Not Implemented');
    hideAccountDetails();
  }

  // try to login as User or Guest
  // if the Token is bad, the server will respond with a different guest token
  function initialLogin() {
    var login = store.get('login') || {}
      , href
      , urlObj
      ;

    urlObj = {
        protocol: location.protocol
      , hostname: location.hostname
      , port: location.port
      , pathname: '/session'
    };

    // returns access token or undefined (i.e. not logged in or expired)
    fb.getAccessToken(function (accessToken) {
      console.log('fb.getAccessToken', accessToken);
      console.log('fb.getAuthResponse', fb._FB.getAuthResponse());
      if (accessToken) {
        login.auth = { type: "fb", accessToken: accessToken };
      } else {
        return;
      }

      urlObj.auth = null;
      href = url.format(urlObj);
      console.log('fb.getAccessToken', href, login);
      /*
      fb._FB.api('/me', function(response) {
        console.log('fb.api.me', response);
        login.email = response.email;
      });
      */
      request.post(href, null, login).when(authenticatedUi);
    });

    console.log('initialLogin');

    // TODO fix this race condition

    if (login.username && login.secret) {
      // TODO create an ahr3 client for this
      urlObj.auth = login.username + ':' + login.secret;
      href = url.format(urlObj);
      request.post(href, null, login).when(authenticatedUi);
    }
  }

  function attemptLogin(ev) {
    var obj
      , urlObj
      , href
      ;

    ev.preventDefault();
    ev.stopPropagation();

    obj = serializeForm('form.js-login-email', serializeToNativeTypes);

    if (!obj.username || !obj.passphrase) {
      console.error("The form didn't get a username and passphrase. Are the class names still correct?");
      return;
    }

    urlObj = {
        protocol: location.protocol
      , hostname: location.hostname
      , port: location.port
      , pathname: '/session'
      , auth: obj.username + ':' + obj.passphrase
    };

    href = url.format(urlObj);

    console.log('attemptLogin', href);
    request.post(href).when(authenticatedUi);
  }

  function authenticatedUi(err, ahr, data) {
    console.log('[authenticatedUi] start');

    if (err) {
      console.error('had error');
      console.error(err);
      // TODO move message to a better place
      window.alert(err.toString());
      return;
    }

    if (!data) {
      // TODO resume later
      console.error('no data');
      console.error(err);
      return;
    }

    var lastUser
      , currentUser
      , passphrases
      ;


    passphrases = $('.js-passphrase');
    passphrases.forEach(function (el) {
      $(el).val('');
    });

    lastUser = store.get('login');
    currentUser = data.result;

    store.set('login', currentUser);

    if (!data.success || /^guest/.test(currentUser.username)) {
      if (!lastUser || !/^guest/.exec(lastUser.username)) {
        console.log('keeping the new guest account');
      } else {
        console.log('reverting to the previous guest account');
        currentUser = lastUser;
        store.set('login', lastUser);
      }
      showGuestUi(lastUser, currentUser);
    } else {
      showUserUi(lastUser, currentUser);
    }
  }

  function showGuestUi(lastUser, currentUser) {
    console.log('guest session', currentUser);
    $('.js-account-user').slideUp(function () {
      $('.js-account-nickname').text("Guest " + currentUser.username.replace(/^guest/, '').substr(0, 5));
      $('.js-account-guest').slideDown();
    });
  }

  function showUserUi(lastUser, currentUser) {
    console.log('user session', currentUser);
    $('.js-account-guest').slideUp(function () {
      $('.js-account-nickname').text(currentUser.nickname);
      $('.js-account-user').slideDown();
    });
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
      , err
      ;

    obj = serializeForm('form.js-signup-email', serializeToNativeTypes);
    if (!obj.nickname) {
      console.log('no nickname, no biggie');
    }
    if (!obj.username) {
      err = new Error('no username');
      console.error(err);
    }
    if (!/.+@.+\..+/.test(obj.email)) {
      err = new Error('no email');
      console.error(err);
    }
    if (!obj.passphrase) {
      err = new Error('no passphrase');
      console.error(err);
    }
    if (err) {
      authenticatedUi(err);
      return;
    }

    console.log('form.js-signup-email');
    console.log(this);
    console.log(obj);
    request.post('/users', null, obj).when(function (err, ahr, data) {
      console.log('response to user creation');
      authenticatedUi(err, ahr, data);
    });
  }

  function checkUsername() {
    var v = $('.js-signup-email .js-username').val()
      ;

    if (!v) {
      $('.js-signup-submit').val('Create Account');
    }

    if (cuVal === v) {
      return;
    }
    cuVal = v;

    clearTimeout(cuToken);
    $('.js-signup-submit').attr('disabled', 'disabled');
    $('.js-signup-submit').val('Checking...');
    // TODO show spinner
    cuToken = setTimeout(function () {
      var val = $('.js-signup-email .js-username').val()
        ;

      // TODO hide spinner
      request.get('/users/' + val).when(function (err, ahr, data) {
        if (data.result) {
          console.log('RED: not available');
          $('.js-signup-submit').val('Name Unavailable');
        } else if (data.success) {
          console.log('GREEN: available');
          $('.js-signup-submit').removeAttr('disabled');
          $('.js-signup-submit').val('Create Account');
        } else {
          console.warn("Didn't get usernames");
        }
      });
    }, 750);
  }

  function showAccount() {
    $('.js-close-signup-login').removeClass('css-hidden');
    $('.js-account-container').removeClass('css-login-hidden');
    $('.js-login-container').addClass('css-login-hidden');
    $('.js-signup-container').addClass('css-login-hidden');
  }

  function showLogin() {
    console.log('DEBUG: showLogin');
    $('.js-close-signup-login').removeClass('css-hidden');
    $('.js-login-container').removeClass('css-login-hidden');
    $('.js-signup-container').addClass('css-login-hidden');
    $('.js-account-container').addClass('css-login-hidden');
  }

  function showSignup() {
    $('.js-close-signup-login').removeClass('css-hidden');
    $('.js-signup-container').removeClass('css-login-hidden');
    $('.js-login-container').addClass('css-login-hidden');
    $('.js-account-container').addClass('css-login-hidden');
  }

  function hideLoginSignup() {
    $('.js-close-signup-login').addClass('css-hidden');
    $('.js-account-container').addClass('css-login-hidden');
    $('.js-signup-container').addClass('css-login-hidden');
    $('.js-login-container').addClass('css-login-hidden');
  }

  function hideAccountDetails() {
    $('.js-close-signup-login').addClass('css-hidden');
    $('.js-account-container').addClass('css-login-hidden');
  }

 function copyPassphrase() {
    /*jshint validthis:true*/
    var secret = $(this).val()
      ;

    // TODO right forEach plugin for jq
    $('.js-passphrase').each(function (i, el) {
      $(el).val(secret);
    });
  }

  function togglePassphrase(ev) {
    /*jshint validthis:true*/
    var show = ev.target.checked
      ;

    console.log("everyday I'm togglin'", ev.target.checked, ev.target);
    if (!show) {
      $('.js-passphrase').show();//.removeClass('css-hidden');
      $('.js-passphrase2').hide();//.addClass('css-hidden');
    } else {
      $('.js-passphrase').hide();//.addClass('css-hidden');
      $('.js-passphrase2').show();//.removeClass('css-hidden');
    }
  }
  
  function fbLogin(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    console.log('click', '.js-fb-connect');
    // TODO this theoretically might not be ready
    fb.login(function (accessToken) {
      console.log('got fb response');
      var urlObj = {
              protocol: location.protocol
            , hostname: location.hostname
            , port: location.port
            , pathname: '/session'
          }
        , href = url.format(urlObj)
        , body = { auth: { type: "fb", accessToken: accessToken } }
        ;

      if (accessToken) {
        request.post(href, null, body);
      } else {
        authenticatedUi(null, null, { success: false, errors: [ new Error('bad facebook auth') ] });
      }
    });
  }

  function initEvents() {
    $('body').on('click', '.js-account-logout', logout);
    $('body').on('click', '.js-fb-connect', fbLogin);
    $('body').on('submit', 'form.js-login-email', attemptLogin);
    $('body').on('submit', 'form.js-signup-email', attemptCreate);
    $('body').on('keyup', '.js-passphrase', copyPassphrase);
    $('body').on('change', '.js-toggle-passphrase', togglePassphrase);
    //$('.js-passphrase2').hide();//addClass('css-hidden');

    // Tabby thingies
    //$('body').on('click', '.js-show-account', showAccount);
    //$('body').on('click', '.js-show-signup', showSignup);
    //$('body').on('click', '.js-show-login', showLogin);
    //$('body').on('click', '.js-close-signup-login', hideLoginSignup);

    // TODO
    //$('body').on('keyup', 'form.js-signup-email .js-username', checkUsername);
    // TODO
    //$('body').on('submit', 'form#js-account', updateAccount);

    //$('.js-account-container').addClass('css-login-hidden');
    //$('.js-signup-container').addClass('css-login-hidden');
    //$('.js-login-container').addClass('css-login-hidden');
    //$('.js-login-container').addClass('css-login-hidden');
    //$('.js-close-signup-login').addClass('css-hidden');
    //$('.js-signup-submit').attr('disabled', 'disabled');

    // Cases to handle:
    // * This browser has no OTP (or it is invalid)
    //   1. Try facebook
    //   2. Assume Guest
    //   3. Get the user to connect the guest via account creation (incl facebook)
    // * This browser has a (valid) Guest OTP
    //   1. Assume Guest
    //   ??. Try facebook, ask to merge
    // * This browser has a (valid) User OTP
    //   1. The app logs in. Done
    console.log("running el widget");
    initialLogin();
  }

  domReady(initEvents);
}());
