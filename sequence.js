#!/usr/bin/node
const BigNumber = require('bignumber.js');
const RippleAPI = require('ripple-lib').RippleAPI;
const sprintf=require("sprintf-js").sprintf;
const orderPrice = require('./orderUtil.js').exchangeRateToPrice;
const formatAmount = require('./orderUtil.js').formatAmount;
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

var seq = {
  buy: [],
  sell: []
}

api.connect().then(() => {
  return api.getOrders(account).then(orders => {
    var o = {}
    o.buy = orders.filter((o) => o.specification.direction === 'buy');
    o.sell = orders.filter((o) => o.specification.direction === 'sell');
    for (const [type, typeOrders] of Object.entries(o)) {
      typeOrders.sort((a, b) => {
        return a.properties.makerExchangeRate < b.properties.makerExchangeRate ? -1 : 1
      });
      typeOrders.forEach(function(order) {
        seq[type].push({
          sequence: order.properties.sequence,
          price: orderPrice(order),
          quantity: formatAmount(order.specification.quantity),
          small: 1,
          range: [0,0]
        })
      })
    }
    console.log(JSON.stringify(seq, null, 2))
  });
}).then(() => {
  api.disconnect().then(() => {
    process.exit();
  });
}).catch(console.error);
