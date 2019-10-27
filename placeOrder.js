#!/usr/bin/node
const RippleAPI = require('ripple-lib').RippleAPI;
const BigNumber = require('bignumber.js');
const Tx = require('./tx.js');
const formatValue = require('./orderUtil.js').formatValue;
const fs = require('fs');

var removeComma = function(arg) {
  return arg.replace(/,/g, '');
}

const api = new RippleAPI({
  server: 'wss://s1.ripple.com', // Public rippled server hosted by Ripple, Inc.
  maxFeeXRP: '0.00001'
});

const argv = require('yargs')
  .option('debug', {
    alias: 'd',
    describe: 'If true, just print out target price, do not submit',
    type: 'boolean',
    default: false
  })
  .option('type', {
    alias: 't',
    describe: 'The order type to place or replace',
    choices: ['buy', 'sell']
  })
  .option('quantity', {
    alias: 'q',
    describe: 'The quantity of the first currency to sell or the quantity of the second currency to buy the first currency with',
    type: 'string',
  })
  .option('price', {
    alias: 'p',
    describe: 'The price of the new order to be placed',
    type: 'string',
  })
  .option('secret_file', {
    describe: 'The path of secrt file',
    type: 'string',
    default: '.secret.json'
  })
  .coerce('price', removeComma)
  .demandOption(['type', 'quantity', 'price'])
  .help()
  .strict()
  .argv

var secrets = JSON.parse(fs.readFileSync(argv.secret_file, 'utf8'));
var account = secrets.account;
var secret = secrets.secret;
var base = secrets.pair.base;
var counter = secrets.pair.counter;

api.connect().then(() => {
  console.log('connected');
  order = {
      direction: argv.type,
      quantity: {
        currency: base.currency,
        counterparty: base.counterparty
      },
      totalPrice: {
        currency: counter.currency,
        counterparty: counter.counterparty
      },
  }
  if (argv.type === 'sell') {
    order.quantity.value = formatValue(BigNumber(argv.quantity), order.quantity.currency)
    order.totalPrice.value = formatValue(BigNumber(argv.quantity).times(argv.price), order.totalPrice.currency)
  } else {
    order.quantity.value = formatValue(BigNumber(argv.quantity).div(argv.price), order.quantity.currency)
    order.totalPrice.value = formatValue(BigNumber(argv.quantity), order.totalPrice.currency)
  }
  console.log(order);
  if (argv.debug) {
    return
  }
  return api.prepareOrder(account, order, {
    maxLedgerVersionOffset: 5
  }).then(prepared => {
    return Tx.submit(api, prepared, secret, Tx.reportSequence, console.log, console.log);
  });
}).then(() => {
  api.disconnect().then(() => {
    console.log('api disconnected');
    process.exit();
  });
}).catch(console.error);
