#!/usr/bin/node
const BigNumber = require('bignumber.js');
const RippleAPI = require('ripple-lib').RippleAPI;
const sprintf=require('sprintf-js').sprintf;
const formatOrder = require('./orderUtil.js').formatOrder;
const fs = require('fs');

const api = new RippleAPI({
  server: 'wss://s1.ripple.com', // Public rippled server hosted by Ripple, Inc.
  maxFeeXRP: '0.00001'
});

const argv = require('yargs')
  .option('type', {
    alias: 't',
    describe: 'The type of order',
    choices: ['buy', 'sell'],
  })
  .option('secret_file', {
    describe: 'The path of secret file',
    type: 'string',
    default: '.secret.json'
  })
  .demandOption(['type'])
  .help()
  .strict()
  .argv

var secrets = JSON.parse(fs.readFileSync(argv.secret_file, 'utf8'));
var account = secrets.account;

api.connect().then(() => {
  return api.getOrders(account).then(orders => {
    orders = orders.filter((o) => o.specification.direction === argv.type);
    orders.sort((a, b) => {
      return a.properties.makerExchangeRate < b.properties.makerExchangeRate ? -1 : 1
    });
    var sumQuantity = new BigNumber(0);
    var sumTotalPrice = new BigNumber(0);
    orders.forEach(function(order) {
      console.log(formatOrder(order));
      sumQuantity = sumQuantity.plus(BigNumber(order.specification.quantity.value))
      sumTotalPrice = sumTotalPrice.plus(BigNumber(order.specification.totalPrice.value))
    })
    console.log(sprintf('Sum quantity:    %f', sumQuantity.toString()))
    console.log(sprintf('Sum total price: %.5f', sumTotalPrice.toString()))
  });
}).then(() => {
  api.disconnect().then(() => {
    process.exit();
  });
}).catch(console.error);
