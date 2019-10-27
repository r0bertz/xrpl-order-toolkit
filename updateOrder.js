#!/usr/bin/node
const _ = require('lodash');
const RippleAPI = require('ripple-lib').RippleAPI;
const BigNumber = require('bignumber.js');
const Tx = require('./tx.js');
const exchangeRateToPrice = require('./orderUtil.js').exchangeRateToPrice;
const formatNewOrder = require('./orderUtil.js').formatNewOrder;
const formatOrder = require('./orderUtil.js').formatOrder;
const formatValue = require('./orderUtil.js').formatValue;
const fs = require('fs');

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
  .option('once', {
    describe: 'If true, run it once',
    type: 'boolean',
    default: false
  })
  .option('sequence_file', {
    alias: 'f',
    describe: 'The path of sequence file',
    type: 'string',
    default: 'sequence.json'
  })
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
var secret = secrets.secret;

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

const others = (order) => {
  return order.properties.maker !== account;
}

const ordersInRange = (orders, range, direction) => {
  return orders.filter(o => {
    if (direction === 'sell') {
      return o.price.lte(range[0]) && o.price.gt(range[1])
    }
    return o.price.gte(range[0]) && o.price.lt(range[1])
  });
}

const orderValue = (o) => {
  if (o.state) {
    if (o.specification.direction === 'buy') {
      return BigNumber(o.state.priceOfFundedAmount.value)
    }
    return BigNumber(o.state.fundedAmount.value)
  }
  return BigNumber(o.specification.quantity.value)
}

const orderTotalPrice = (o) => {
  if (o.state) {
    if (o.specification.direction === 'sell') {
      return BigNumber(o.state.priceOfFundedAmount.value)
    }
    return BigNumber(o.state.fundedAmount.value)
  }
  return BigNumber(o.specification.totalPrice.value)
}

const ordersBig = (orders, small) => {
  return orders.filter(o => {
    return o.value.gt(small);
  });
}

const previousOthersOrderIdx = (orders, idx) => {
  for (var i = idx-1; i > 0 && orders[i].mine; i--) {
  }
  return i;
}

const nextOthersOrderIdx = (orders, idx) => {
  for (var i = idx+1; orders[i].mine; i++) {
  }
  return i;
}

const isTipOutlier = (orders, direction) => {
  if (orders.length < 2) {
    throw 'orders length must be larger than 1'
  }
  if (orders[0].value.gt(20)) {
    return false 
  }
  if (direction === 'buy') {
    return orders[0].price.div(orders[1].price).gt(1.1)
  }
  return orders[1].price.div(orders[0].price).gt(1.1)
}

const getTargetPrice = (orders, range, direction) => {
  if (orders.length === 0) {
    return BigNumber(range[0])
  } else if (orders.length === 1) {
    return orders[0].price
  } else if (isTipOutlier(orders, direction)) {
    return orders[1].price
  } else {
    return orders[0].price
  }
}

const filterOrders = (orders, rule, direction) => {
  var myOrder;
  var myOrderIdx;
  orders.every((o, i) => {
    if (o.mine && o.properties.sequence === rule.sequence) {
      myOrder = _.cloneDeep(o);
      myOrderIdx = i
      return false;
    }
    return true;
  })
  if (!myOrder) {
    return;
  }
  var targetOrders = ordersInRange(orders, rule.range, direction)
  targetOrders = targetOrders.filter(others);
  targetOrders = ordersBig(targetOrders, rule.small);
  var targetPrice = getTargetPrice(targetOrders, rule.range, direction)
  var multiplier = 0.99999999;
  if (myOrder.specification.direction === 'buy') {
    var multiplier = 1.00000001
  }
  return {
    myOrder: myOrder,
    newPrice: targetPrice.times(multiplier),
  };
}

const setPrice = (order, price) => {
  if (order.direction === 'sell') {
    order.totalPrice.value = formatValue(BigNumber(order.quantity.value).times(price), order.totalPrice.currency);
  } else {
    var BN = BigNumber.clone({
      ROUNDING_MODE: BigNumber.ROUND_DOWN
    })
    order.quantity.value = formatValue(BN(order.totalPrice.value).div(price), order.quantity.currency);
  }
}
const isSameOrder = (newOrder, oldOrder) => {
  return (
    BigNumber(newOrder.quantity.value).eq(
      oldOrder.specification.quantity.value) &&
    BigNumber(newOrder.totalPrice.value).eq(
      oldOrder.specification.totalPrice.value));
}

const validateRule = (rule, direction) => {
  if ((direction === 'buy' && rule.range[0] >= rule.range[1]) ||
      (direction === 'sell' && rule.range[0] <= rule.range[1])) {
    throw 'invalid rule: ' + JSON.stringify(rule, null, 2)
  }
}

const processOrder = (orders, oppositeOrder, rule, promises, sequences) => {
  var direction = orders[0].specification.direction
  validateRule(rule, direction)
  var allOrders = [oppositeOrder].concat(orders);
  // Find out myOrder to move and targetPrice to move to.
  var rv = filterOrders(allOrders, rule, direction)
  if (!rv) {
    console.log('order not found. sequence:', rule.sequence);
    return;
  }
  var spec = _.cloneDeep(rv.myOrder.specification);
  var newOrder = {
    direction: spec.direction,
    quantity: spec.quantity,
    totalPrice: spec.totalPrice,
    orderToReplace: rv.myOrder.properties.sequence
  };
  setPrice(newOrder, rv.newPrice);
  if (isSameOrder(newOrder, rv.myOrder)) {
    console.log('same order');
    return;
  }
  if (argv.debug) {
    console.log(formatNewOrder(newOrder));
    return;
  }
  promises.push(
    api.prepareOrder(account, newOrder, {
      maxLedgerVersionOffset: 5
    }).then(prepared => {
      // console.log(prepared);
      return Tx.submit(
        api, prepared, secret,
        Tx.recordSequence(newOrder, rv.newPrice, sequences),
        console.log, console.log);
    })
  );
}

const combineOrders = (orders) => {
  var lastPrice;
  var curIdx;
  var newOrders = _.cloneDeep(orders)
  return _.values(_.compact(_.map(newOrders, (o, i) => {
    o.value = orderValue(o);
    o.totalPrice = orderTotalPrice(o);
    if (o.value.eq(0) || o.totalPrice.eq(0)) {
      return false;
    }
    o.price = exchangeRateToPrice(o);
    o.mine = o.properties.maker === account;
    if (lastPrice && lastPrice.eq(o.price) && !o.mine && !newOrders[curIdx].mine) {
      newOrders[curIdx].value = newOrders[curIdx].value.plus(o.value);
      newOrders[curIdx].totalPrice = newOrders[curIdx].totalPrice.plus(o.totalPrice);
      return false;
    }
    curIdx = i;
    lastPrice = o.price;
    return o;
  })));
}

function update() {
  api.connect().then(() => {
    return api.getOrderbook(account, secrets.pair).then(book => {
      book.bids = combineOrders(book.bids);
      book.asks = combineOrders(book.asks);
      var promises = [];
      var sequences = JSON.parse(fs.readFileSync(argv.sequence_file, 'utf8'));
      var oldSequences = _.cloneDeep(sequences);
      sequences.buy.forEach(rule => {
        processOrder(book.bids, book.asks[0], rule, promises, sequences);
      });
      sequences.sell.forEach(rule => {
        processOrder(book.asks, book.bids[0], rule, promises, sequences);
      });
      return Promise.all(promises).then(() => {
        if (_.isEqual(sequences, oldSequences)) {
          return;
        }
        fs.copyFile(argv.sequence_file, argv.sequence_file + '.bak', (err) => {
            if (err) throw err;
        });
        return fs.writeFile(argv.sequence_file, JSON.stringify(sequences, null, 2), function(err) {
          if(err) {
            return console.log(err);
          }
          console.log(argv.sequence_file, "saved")
        });
      });
    });
  }).then(() => {
    api.disconnect().then(() => {
      console.log("Last updated: " + new Date().toLocaleString());
      if (argv.once) {
          process.exit();
      }
      setTimeout(update, 10000);
    });
  }).catch(err => {
    console.error(err);
    process.exit();
  });
}

update();

// // Find another candidate price such that the sum of quantity of all orders
// // above it is right below a certain threshold. This is to deal with the
// // case in which people flood the tip of bid book with small amount orders.
// var sum = BigNumber(0);
// var sumThreshold = 50;
// for (var i = 0; i < book.bids.length; i++) {
//   if (book.bids[i].properties.maker === account) {
//     continue;
//   }
//   sum = sum.plus(BigNumber(book.bids[i].specification.quantity.value))
//   if (sum.gt(sumThreshold)) {
//     let p = exchangeRateToPrice(book.bids[i]);
//     if (p.gt(cap)) {
//       continue
//     }
//     // If price is higher than the existing candidate price and yet lower
//     // than cap, use it.
//     if (p.gt(targetPrice)) {
//       // targetPrice = p
//     }
//     break;
//   }
// }
