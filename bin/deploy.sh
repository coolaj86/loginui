#!/usr/bin/env bash

#npm install -g jade less pakmanager

pushd server
  npm install
popd

#pushd local
#  npm install
#popd

pushd browser
  WEBPUB='../public'
  WEBSTATIC='../static'

  echo -n "Killing off old cruft..."
  rm -rf "${WEBPUB}"

  echo -n "Copying in static files..."
  mkdir -p "${WEBPUB}/"
  rsync -a static/ "${WEBPUB}/"
  rsync -a "${WEBSTATIC}/" "${WEBPUB}/"
  # make sure there's always a favicon, even if it's broken
  touch "${WEBPUB}/favicon.ico"

  echo -n "Compiling Jade to HTML..."
  jade *.jade
  mv *.html "${WEBPUB}/"

  echo -n "Compiling LESS to CSS and minifying..."
  lessc style.less > style.css
  mv style.css "${WEBPUB}/"

  echo -n "Compiling JavaScript to CommonJS..."
  pakmanager build
  rm -f pakmanaged.html
  uglifyjs pakmanaged.js > pakmanaged.min.js
  mv pakmanaged.* "${WEBPUB}"
popd

#pushd clients
#popd
