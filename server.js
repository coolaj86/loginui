/*
 * SERVER
 */
(function () {
  "use strict";

  // TODO on create pass in database with get, set, query, etc
  var PREAUTH = {}
    , MIN_PASSPHRASE_LEN = 5
    , request = require('ahr')
    , steve = require('./lib/steve')
    , path = require('path')
    , connect = require('connect')
    , crypto = require('crypto')
    , UUID = require('node-uuid')
    , app = connect.createServer()
    , store = require('json-storage').create(require('dom-storage').create(
        path.join(__dirname, 'var', 'users.db.json')
      ))
    , demoDb = {
          "coolaj86": {
              "passphrase": "secret"
            , "username": "coolaj86"
            , "email": "coolaj86@gmail.com"
            , "nickname": "AJ"
            //, "otp": "0123456789abcdef"
            , "salt": null
            , "uuid": "633e1bf2-2b34-4ccf-a856-2574a8d622a6"
          }
        , "foo": {
              "passphrase": "secret"
            , "username": "foo"
            //, "otp": "0123456789abcdef"
            , "salt": null
            , "uuid": "0c452f97-9ea6-4c2c-9a11-ec23d43754de"
          }
      }
    ;

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

  function setUserAccount(account) {
    if (!account.aliases) {
      account.aliases = {};
    }
    if (account.email) {
      setUserAlias(account.email, account);
    }
    if (account.username) {
      setUserAlias(account.username, account);
    }
    store.set(account.uuid, account);
  }

  function setUserAlias(newId, userObject) {
    if (!userObject.uuid) {
      userObject.uuid = UUID.v4();
      store.set(userObject.uuid, userObject);
      if (userObject.username) {
        store.set(userObject.username, { alias: userObject.uuid });
      }
      if (userObject.email) {
        store.set(userObject.email, { alias: userObject.uuid });
      }
    }

    // no sense in setting an user account to null
    if (newId && newId !== userObject.uuid) {
      userObject.aliases[newId] = 1;
      store.set(newId, { alias: userObject.uuid });
    }
  }

  function getUserAlias(id) {
    if (!id) {
      return null;
    }
    return store.get(id);
  }

  function mergeAccounts(primary, old) {
    old.aliases = old.aliases || {};
    Object.keys(old.aliases).forEach(function (aliasname) {
      setUserAlias(old.aliases[aliasname], primary);
    });

    old.auths = old.auths || [];
    primary.auths = primary.auths || [];
    primary.auths = primary.auths.concat(old.auths);

    Object.keys(old).forEach(function (key) {
      primary[key] = primary[key] || old[key];
    });
    // TODO save the data
    setUserAlias(old.uuid, primary);
  }

  function formatFbDate(fbBirthday) {
    var parts = (fbBirthday||'').split('/').reverse()
      , newParts = []
      ;

    newParts[0] = parts[0]; // year
    newParts[1] = parts[2]; // month
    newParts[2] = parts[1]; // day

    return newParts.join('-');
  }

  function fbCreateUser(fn, fbData) {
    //
    function mergeOrCreate(err, account) {
      var fbid
        , newAccount = {
              email: fbData.email
            , nickname: fbData.first_name + ' ' + fbData.last_name
            , gender: fbData.gender
            , birthday: formatFbDate(fbData.birthday)
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

      if (!account) {
        console.log('[FB][USER] create!');
        // TODO allow multiple e-mails
        // create a user as long as one doesn't exist by the same name
        [fbData.email/*, fbData.username*/].some(function (uid) {
          if(uid && !checkUser(uid)) {
            fbid = uid;
            return true;
          }
        });
        account = createUser(fbid, null, newAccount);
      } else {
        console.log('[FB][USER] merge!');
        mergeAccounts(account, newAccount);
      }

      console.log('saving account', 'fb:' + fbData.id, account);
      setUserAlias('fb:' + fbData.id, account);
      fn(null, account);
    }

    // This is kinda sketch.
    // We're trusting that if a user verified their e-mail
    // via facebook that it's good enough for us as well
    directRetrieveUser(mergeOrCreate, fbData.email);
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

      function returnOrCreateUser(err, account) {
        if (!err) {
          console.log('[FB][USER] found');
          fn(err, account);
          return;
        }
        
        console.log('[FB][USER] create? or merge?');
        fbCreateUser(fn, fbData);
      }

      directRetrieveUser(returnOrCreateUser, 'fb:' + fbData.id);
    });
  }

  function altAuth(fn, req) {
    if ('fb' === req.body.auth.type) {
      console.log('[AUTH][FB]');
      fbAuth(fn, req.body.auth.accessToken);
    } else {
      console.log('[AUTH][UNKNOWN]');
      fn(new Error('unrecognized authorization type ' + req.body.auth.type));
    }
  }

  function directRetrieveUser(fn, userAlias) {
    retrieveUser(fn, userAlias, PREAUTH);
  }

  // Recursively searches aliases to find account
  // TODO update to new alias if multi-recursion happens
  function retrieveUser(fn, userAlias, pass) {
    var account
      , err
      ;

    account = getUserAlias(userAlias);
    if (!account) {
      console.log(typeof userAlias, userAlias);
      err = new Error('No user ' + userAlias);
      console.warn('163', err.message);
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

    console.log('pass.length, pass.substr', pass.length, pass);//.toString().substr(0, 3));
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
    setUserAccount(account);
    fn(null, account);
  }

  function httpAuth(_fn, req) {
    var token
      , userAlias
      , pass
      , basicAuthB64
      , fn = function () {
          var args = [].slice.call(arguments)
            ;

          console.log('args', args);
          process.nextTick(function () {
            _fn.apply(null, args);
          });
        }
      ;

    basicAuthB64 = (req.headers.authorization||"").replace(/\s*Basic\s+/i, '');
    token = (new Buffer(basicAuthB64, "base64"))
      .toString('utf8')
                  // a username may not contain ':', but a password may
      .split(/:/) // not g
      ;

    console.log('token', token);
    userAlias = token.shift(); // TODO disallow ':' in username
    pass = token.join(':'); // a password might have a ':'

    retrieveUser(fn, userAlias, pass);
  }

  // 'username' is just servers as human-readable unique id
  // it's fine for it to be an e-mail
  function createUser(username, passphrase, extra) {
    var user = true
      , account
      , salt = randomString(255)
      ;

    // unset username if user by that name exists
    if (username && getUserAlias(username)) {
      username = undefined;
    }
    while (user) {
      username = username || ('guest' + Math.floor(Math.random() * 1000000000000));
      user = getUserAlias(username);
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

    setUserAccount(account);
    setUserAlias(account.email, account);
    return account;
  }

  function addAccountInfoToSession(session, account) {
    session.uuid = account.uuid;
    session.nickname = account.nickname || account.username || (account.email||'').replace(/@.*/, '');
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
      console.log('[AUTH][END]', err, account);
      if (err) {
        res.error('[AUTH][GUEST] authentication did not complete (creating a guest)');
      }
      if (!account) {
        // TODO url mangle as to fall through to a create user route?
        console.log('[AUTH][GUEST] create');
        account = createUser();
      }

      addAccountInfoToSession(req.session, account);
      res.json(req.session);
    }

    if (req.headers.authorization) {
      console.log('[AUTH][HTTP]', req.headers.authorization);
      account = httpAuth(finishHim, req);
    } else if (req.body.auth) {
      console.log('[AUTH][ALT]');
      account = altAuth(finishHim, req);
    } else {
      // Guest
      console.log('[AUTH][GUEST]');
      finishHim();
    }
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
    } else if (getUserAlias(account.email)) {
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

  function checkUser(alias) {
    return !!getUserAlias(alias);
  }

  function isLoggedIn(fn, loggedInId, otherId) {
    // TODO could there be an id 0?
    if (!loggedInId || !otherId) {
      console.log("missing ids");
      process.nextTick(function () {
        fn(false);
      });
      return;
    }

    directRetrieveUser(function (err, accountA) {
      directRetrieveUser(function (err, accountB) {
        if (!accountA || !accountB) {
          console.log('no accounts');
          fn(false);
          return;
        }
        if (accountA.uuid === accountB.uuid) {
          console.log('working as hoped');
          fn(true);
        } else {
          console.log("accounts are different");
          console.log("account A");
          console.log(accountA);
          console.log("account B");
          console.log(accountB);
          fn(false);
        }
      }, otherId);
    }, loggedInId);
  }

  function router(rest) {
    function checkOrGetUser(req, res) {
      isLoggedIn(function (loggedIn) {
        // The user is NOT the authenticated user
        if (!loggedIn) {
          res.json(checkUser(req.params.id));
          return;
        }

        // The user IS the authenticated user
        function respondWithAccount(err, account) {
          console.log(account);
          res.json(account);
        }
        directRetrieveUser(respondWithAccount, req.params.id);
      }, req.session.uuid, req.params.id);
    }

    // This will create a guest user if no user is available
    rest.post('/session', restfullyAuthenticateSession);
    rest.post('/sessions', restfullyAuthenticateSession);

    // This will create a user (and merge the guest user) and authn the session;
    rest.post('/user', restfullyCreateUser);
    rest.post('/users', restfullyCreateUser);

    rest.get('/users/:id', checkOrGetUser);
  }

  setUserAccount(demoDb.coolaj86);
  setUserAccount(demoDb.foo);

  app
    .use(steve)
    .use(connect.router(router))
    ;

  module.exports = app;
}());
