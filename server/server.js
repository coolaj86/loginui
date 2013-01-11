/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true
eqeqeq:true immed:true latedef:true unused:true undef:true*/
/*
 * SERVER
 */
(function () {
  "use strict";

  // TODO on create pass in database with get, set, query, etc
  var PREAUTH = {}
    , MIN_PASSPHRASE_LEN = 5
    , request = require('ahr')
    , steve = require('./steve')
    , path = require('path')
    , connect = require('connect')
    , crypto = require('crypto')
    , app = connect.createServer()
    , store = require('json-storage').create(require('dom-storage').create(
        path.join(__dirname, '..', 'var', 'users.db.json')
      ))
    , db = {
          "coolaj86": {
              "passphrase": "secret"
            , "username": "coolaj86"
            , "email": "coolaj86@gmail.com"
            , "nickname": "AJ"
            //, "otp": "0123456789abcdef"
            , "salt": null
          }
        , "foo": {
              "passphrase": "secret"
            , "username": "foo"
            //, "otp": "0123456789abcdef"
            , "salt": null
          }
      }
    ;

  store.set('coolaj86', db.coolaj86);
  store.set('foo', db.foo);

  function randomString(len) {
    var i
      , chars = ""
      , str = ""
      , rnd
      ;

    // 32-126
    for (i = 32; i <= 126; i += 1) {
      chars += String.fromCharCode(i);
    } 

    if (isNaN(len)) {
      len = 8;
    }

    for (i = 0; i < len; i += 1) {
      rnd = Math.floor(Math.random() * chars.length);
      str += chars[rnd];
    }
    return str;
    //return "thesecret";
  }

  function hashSecret(secret, salt) {
    if (!secret || !salt) {
      throw new Error('Missing some secret salt!');
    }
    return crypto.createHash('sha1').update(salt + secret).digest('hex');
  }

/*
  function fbGetServerToken(code) {
    url = "https://graph.facebook.com/oauth/access_token?"
      + "client_id=" + YOUR_APP_ID
      + "&redirect_uri=" + YOUR_REDIRECT_URI
      + "&client_secret=" + YOUR_APP_SECRET
      + "&code=" + CODE_GENERATED_BY_FACEBOOK
      ;
  }
*/

  function fbCreateUser(fn, fbData) {
    //
    function mergeOrCreate(err, account) {
      var fbid
        , newAccount = {
              email: fbData.email
            , nickname: fbData.first_name + ' ' + fbData.last_name
            , gender: fbData.gender
            , birthday: (fbData.birthday||'').split('/').reverse().join('-')
            , auths: [{
                  type: 'fb'
                , id: fbData.id
                , username: fbData.username
                , email: fbData.email
              }]
          }
        ;

      if (err) {
        account = null;
      }

      // create a user as long as one doesn't exist by the same name
      [fbData.username, fbData.email.replace(/@.*/, '')].some(function (uid) {
        if(uid && !checkUser(uid)) {
          fbid = uid;
          return true;
        }
      });

      if (!account) {
        // TODO allow multiple e-mails
        account = createUser(fbid, null, newAccount);
      } else {
        mergeAccounts(account, newAccount);
      }

      console.log('saving account', 'fb:' + fbData.id, account);
      store.set('fb:' + fbData.id, { alias: account.username });
      fn(null, account);
    }

    // This is kinda sketch.
    // We're trusting that if a user verified their e-mail
    // via facebook that it's good enough for us as well
    retrieveUser(mergeOrCreate, fbData.email, PREAUTH);
  }

  function fbAuth(fn, YOUR_USER_ACCESS_TOKEN) {
    // text/javascript
    request.get("https://graph.facebook.com/me?access_token=" + YOUR_USER_ACCESS_TOKEN).when(function (err, ahr2, fbData) {
      /*{ id: , first_name: , last_name:, email: , username: , gender: , birthday: }*/
      if ('string' === typeof fbData) {
        fbData = JSON.parse(fbData);
      }
      if (!err) {
        if (!fbData || !fbData.email) {
          console.error(fbData);
          err = new Error('Unsuccessful fb authentication attempt');
        }
      } 

      if (err) {
        fn(err);
        return;
      }

      retrieveUser(function (err, account) {
        if (!err) {
          fn(err, account);
          return;
        }
        
        fbCreateUser(fn, fbData);
      }, 'fb:' + fbData.id, PREAUTH);
    });
  }

  function altAuth(fn, req) {
    if ('fb' === req.body.auth.type) {
      fbAuth(fn, req.body.auth.accessToken);
    } else {
      fn(new Error('unrecognized authorization type ' + req.body.auth.type));
    }
  }

  function retrieveUser(fn, username, pass) {
    var account
      , err
      ;

    account = store.get(username);
    if (!account) {
      err = new Error('No user ' + username);
      console.warn('163', err.toString());
      fn(err);
      return;
    }
    if (account.alias) {
      retrieveUser(fn, account.alias, pass);
      return;
    }

    // auto-update unsalted passwords
    if (!account.salt) {
      account.salt = randomString(255);
      account.passphrase = hashSecret(account.passphrase, account.salt);
    }

    console.log(pass.length, pass.toString().substr(0, 3));
    console.log('client     :', pass);
    console.log('client+salt:', hashSecret(pass, account.salt));
    console.log('original   :', account.otp);
    console.log('original   :', account.passphrase);
    if ((258 === pass.length) && ('otp' === pass.substr(0, 3))) {
      console.log('looks like otp');
      if (pass.substr(3) === account.otp) {
        account.otp = randomString(255);
      } else {
        err = new Error('otp doesn\'t match');
        console.log(err.toString());
        fn(err);
        return;
      }
    } else if ((PREAUTH !== pass) && (hashSecret(pass, account.salt) !== account.passphrase)) {
      err = new Error('login+pass doesn\'t match');
      console.log(err.toString());
      fn(err);
      return;
    }

    console.log('looks like success');
    account.otp = account.otp || randomString(255);
    store.set(username, account);
    fn(null, account);
  }

  function httpAuth(_fn, req) {
    var token
      , username
      , pass
      , basicAuthB64
      , fn = function () {
          var args = [].slice(arguments)
            ;

          process.nextTick(function () {
            _fn.apply(null, args);
          });
        }
      ;

    basicAuthB64 = (req.headers.authorization||"").replace(/\s*Basic\s+/i, '');
    token = (new Buffer(basicAuthB64, "base64"))
      .toString('utf8')
      .split(/:/) // not g
      ;

    username = token.shift(); // TODO disallow ':' in username
    pass = token.join(':'); // a password might have a ':'

    retrieveUser(fn, username, pass);
  }

  function createUser(username, passphrase, extra) {
    var user = true
      , account
      , salt = randomString(255)
      ;

    if (username && store.get(username)) {
      username = undefined;
    }
    while (user) {
      username = username || ('guest' + Math.floor(Math.random() * 1000000000000));
      user = store.get(username);
    }

    if (passphrase && passphrase.length < MIN_PASSPHRASE_LEN) {
      passphrase = null;
    }

    account = {
        "passphrase": hashSecret(passphrase || randomString(255), salt)
      , "username": username
      , "salt": salt
      , "createdAt": Date.now()
      , "updatedAt": Date.now()
      , "authenticatedAt": Date.now()
      , "guest": true
    };

    if (extra) {
      Object.keys(account).forEach(function (key) {
        extra[key] = account[key];
      });
      account = extra;
    }

    account.otp = account.otp || randomString(255);

    store.set(account.username, account);
    store.set(account.email, { alias: account.username });
    return account;
  }

  function addAccountInfoToSession(session, account) {
    session.username = account.username;
    // The only valid use of secret as a property
    session.secret = 'otp' + account.otp;
    session.createdAt = account.createdAt;
    session.updatedAt = account.updatedAt;
    session.authenticatedAt = account.authenticatedAt;
  }

  // steve's cookieless-session does the magic
  // we just have to auth if credentials are given
  function restfullyAuthenticateSession(req, res) {
    console.log('posted to /session');
    var account
      ;

    function finishHim(err, account) {
      if (err) {
        res.error('authentication did not complete (creating a guest)');
      }
      if (!account) {
        // TODO url mangle as to fall through to a create user route?
        account = createUser();
      }

      addAccountInfoToSession(req.session, account);
      res.json(req.session);
    }

    if (req.headers.authorization) {
      account = httpAuth(finishHim, req);
    } else if (req.body.auth) {
      account = altAuth(finishHim, req);
    } else {
      // Guest
      finishHim();
    }
  }

  function mergeAccounts(primary, old) {
  }

  function restfullyCreateUser(req, res) {
    var account = req.body
      ;

    if (!account) {
      res.error('no post body');
      res.json();
      return;
    }

    if (!account.username) {
      res.error('no username');
    } else if (store.get(account.username)) {
      // TODO add a code for easy 'iforgot' prompt
      // TODO the user gets the account, but it must be renamed
      // TODO if the password matches, respond as a a login attempt
      account.username = undefined;
      res.error('account exists');
    }

    if (/^guest/i.exec(account.username)) {
      res.error('a username may not begin with the word "guest"');
    }
    if (!account.passphrase) {
      res.error('no passphrase');
    } 

    account = createUser(account.username, account.passphrase, account);
    addAccountInfoToSession(req.session, account);

    res.json(req.session);
  }

  function checkUser(username) {
    return store.get(username);
  }

  function checkOrGetUser(req, res) {
    // The user is NOT the authenticated user
    if (req.session.username !== req.params.id) {
      res.json(!!checkUser(req.params.id));
      return;
    }

    // The user IS the authenticated user
    res.json(checkUser(req.params.id));
  }

  function router(rest) {
    // This will create a guest user if no user is available
    rest.post('/session', restfullyAuthenticateSession);
    rest.post('/sessions', restfullyAuthenticateSession);

    // This will create a user (and merge the guest user) and authn the session;
    rest.post('/user', restfullyCreateUser);
    rest.post('/users', restfullyCreateUser);

    rest.get('/users/:id', checkOrGetUser);
  }

  app
    .use(steve)
    .use(connect.router(router))
    ;

  module.exports = app;
}());
