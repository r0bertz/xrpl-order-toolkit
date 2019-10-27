#!/usr/bin/node
const _ = require('lodash');
const RippleAPI = require('ripple-lib').RippleAPI;
const BigNumber = require('bignumber.js');
const OrderBook = require('ripple-lib-orderbook').OrderBook;
const XRPValue = require('ripple-lib-value').XRPValue;
const IOUValue = require('ripple-lib-value').IOUValue;
const fs = require('fs');

const api = new RippleAPI({
  server: 'wss://s1.ripple.com', // Public rippled server hosted by Ripple, Inc.
  maxFeeXRP: '0.00001'
});

const argv = require('yargs')
  .option('secret_file', {
    describe: 'The path of secret file',
    type: 'string',
    default: '.secret.json'
  })
  .help()
  .strict()
  .argv

var secrets = JSON.parse(fs.readFileSync(argv.secret_file, 'utf8'));
var base = secrets.pair.base;
var counter = secrets.pair.counter;

api.on('error', (errorCode, errorMessage, data) => {
  console.log('api error: ', errorCode + ': ' + errorMessage + ': ' + data);
});
api.on('connected', () => {
  console.log('connected');
});
api.on('disconnected', (code) => {
  // code - [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) sent by the server
  // will be 1000 if this was normal closure
  console.log('disconnected, code:', code);
});

api.connect().then(() => {
  var book = new OrderBook.createOrderBook(api, {
    currency_pays: base.currency,
    issuer_pays: base.counterparty,
    currency_gets: counter.currency,
    issuer_gets: counter.counterparty,
  });
  book.on('model', function(offers) {
    // book = RippleAPI.formatBidsAndAsks(secrets.pair, offers);
    // console.log(book.bids[0].speicification);
    for (var i = 0; i < offers.length; i++) {
      console.log(JSON.stringify(offers[i], null, 2));
    };
  });
  // book.on('trade', function(pays, gets) {
  //   console.log('Pays: ' + pays + ' Gets: ' + gets + ' Price: ' + pays*1000000/gets);
  // });
}).catch(console.error);
