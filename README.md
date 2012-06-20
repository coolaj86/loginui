LoginUI
===

An HTML5 Login Widget with all the bells and whistles. There is always an authenticated session as all failures return a new guest user which can be upgraded to a regular user.

API
===

  * `POST /users BODY {username: foo, passphrase: secret, nickname: Foo, email: foo@example.com}` 
    * creates a new user `foo` with a salted passphrase (or a guest on failure)

  * `GET /users/:id`
    * returns `true` if the user exists or `false` otherwise. 

  * `POST /sessions HEADER Authorization: Basic ...`
    * returns authenticated session (or a guest on failure)
