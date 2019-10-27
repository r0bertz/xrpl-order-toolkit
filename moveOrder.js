#!/usr/bin/node
const RippleAPI = require('ripple-lib').RippleAPI;
const BigNumber = require('bignumber.js');
const Tx = require('./tx.js');
const formatNewOrder = require('./orderUtil.js').formatNewOrder;
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
  .option('old', {
    alias: 'o',
    describe: 'The price of the old order to be replaced',
    type: 'string',
  })
  .option('new', {
    alias: 'n',
    describe: 'The price of the new order to be placed',
    type: 'string',
  })
  .option('secret_file', {
    describe: 'The path of secrt file',
    type: 'string',
    default: '.secret.json'
  })
  .coerce('old', removeComma)
  .coerce('new', removeComma)
  .demandOption(['type', 'old', 'new'])
  .help()
  .strict()
  .argv

var secrets = JSON.parse(fs.readFileSync(argv.secret_file, 'utf8'));
var account = secrets.account;
var secret = secrets.secret;
var pair = secrets.pair

api.on('error', (errorCode, errorMessage, data) => {
  console.error('api error: ', errorCode + ': ' + errorMessage + ': ' + data);
});

api.connect().then(() => {
  return api.getOrders(account, {
  }).then(response => {
    var order;
    if (argv.old !== undefined) {
      response.forEach(function(i) {
        var spec = i.specification
        var direction = spec.direction;
        var quantity = spec.quantity;
        var totalPrice = spec.totalPrice;
        if ((argv.type === direction && quantity.currency === pair.base.currency && totalPrice.currency === pair.counter.currency) ||
            (argv.type !== direction && quantity.currency === pair.counter.currency && totalPrice.currency === pair.base.curency)) {
          var targetPrice = BigNumber(argv.old)
          var price = BigNumber(spec.totalPrice.value).div(BigNumber(
            spec.quantity.value))
          if (targetPrice.minus(price).abs().lt(0.001)) {
            order = i
          }
        }
      });
      if (order === undefined) {
        throw 'order not found, price: ' + argv.old
      }
    }
    return {
      orderToReplace: order,
      newPrice: argv.type === 'sell' ? BigNumber(argv.new) : BigNumber(1).div(
        BigNumber(argv.new))
    };
  }).then(rv => {
    var order = rv.orderToReplace;
    var spec = order.specification;
    var newOrder = {
      direction: spec.direction,
      quantity: spec.quantity,
      totalPrice: spec.totalPrice,
      orderToReplace: order.properties.sequence
    };
    if (argv.type === 'sell') {
      newOrder.totalPrice.value = formatValue(
        BigNumber(newOrder.quantity.value).times(rv.newPrice),
        newOrder.totalPrice.currency);
    } else {
      newOrder.quantity.value = formatValue(
        BigNumber(newOrder.totalPrice.value).times(rv.newPrice),
        newOrder.quantity.currency);
    }
    console.log(newOrder);
    if (argv.debug) {
      return
    }
    return api.prepareOrder(account, newOrder, {
        maxLedgerVersionOffset: 5
    }).then(prepared => {
      return Tx.submit(api, prepared, secret, Tx.reportSequence, console.log, console.log);
    });
  })
}).then(() => {
  api.disconnect().then(() => {
    process.exit();
  });
}).catch(console.error);
