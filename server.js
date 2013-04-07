/*
 * SERVER
 */
(function () {
  "use strict";

  // TODO on create pass in database with get, set, query, etc
  var account = require('./lib/account')
    , steve = require('./lib/steve')
    , connect = require('connect')
    , app = connect.createServer()
    ;

  function addAccountToSession(session, account) {
    session.uuid = account.uuid;
    session.gravatar = account.gravatar;
    session.username = account.username;
    session.nickname = account.nickname || account.username || (account.email||'').replace(/@.*/, '');
    // The only valid use of secret as a property
    session.secret = 'otp' + account.otp;
    session.createdAt = account.createdAt;
    session.updatedAt = account.updatedAt;
    session.authenticatedAt = account.authenticatedAt;
  }

  account.init(addAccountToSession);

  function router(rest) {
    // This will create a guest user if no user is available
    rest.post('/session', account.restfullyAuthenticateSession);
    rest.post('/sessions', account.restfullyAuthenticateSession);

    // This will create a user (and merge the guest user) and authn the session;
    rest.post('/user', account.restfullyCreateUser);
    rest.post('/users', account.restfullyCreateUser);

    rest.get('/users/:id', account.checkOrGetUser);
  }

  app
    .use(steve)
    .use(connect.router(router))
    ;

  module.exports = app;
}());
