#!/usr/bin/node
const RippleAPI = require('ripple-lib').RippleAPI;
const BigNumber = require('bignumber.js');
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
var account = secrets.account;

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
  return api.getOrderbook(account, secrets.pair).then(orderbook => {
    orderbook.bids.forEach(o => {
      console.log(o.specification);
    });
    console.log("-------------------------------------");
    orderbook.asks.forEach(o => {
      console.log(o.specification);
    });
  });
}).catch(console.error);
