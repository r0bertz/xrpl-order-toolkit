# XRPL Order Toolkit

This is a collection of scripts to manipulate [XRPL](https://xrpl.org) orders.
XRPL has a builtin [decentralized
exchange](https://xrpl.org/decentralized-exchange.html) which natively supports
[limit order](https://www.investopedia.com/terms/l/limitorder.asp).

You can see the live orderbook for any currency pair on the following two websites:

* https://xrpcharts.ripple.com
* https://orderbook.xrp.ninja

## Install dependencies

```
# npm install -g bignumber.js fs lodash ripple-lib ripple-lib-orderbook ripple-lib-value yargs
```

## Configuration

Most of the scripts share a common config file which is specified by flag
`--secret_file` whose default value is `.secret.json`. You need to create this
file yourself. The format looks like:

```
{ 
  "account": "rxxx",
  "secret": "sxxx",
  "pair": {
    "base": {
      "currency": "XRP"
    },
    "counter": {
      "currency": "USD",
      "counterparty": "ryyy"
    }
  }
}
```
The `base` currency means the currency to buy or sell.

## Example usage

The following example would work if you have a configuration file which looks
like the one above.

### Place buy order
Spend 100 USD to buy XRP at price $0.3:
```
$ ./placeOrder.js -t buy -q 100 -p 0.3
```
**Please note that the quantity here is not in XRP but in USD**

### Place sell order
Sell 300 XRP for USD at price $0.35:
```
$ ./placeOrder.js -t sell -q 300 -p 0.35
```

### Move an existing order to a new price
Move the order you placed at $0.35 to a new price $0.4:
```
$ ./moveOrder.js -t sell -o 0.35 -n 0.4
```

### Get existing orders
Get all sell orders:
```
$ ./getOrders.js -t sell
```
This will show the sequence of each order among other things.

### Cancel an existing order
Suppose the sequence of the order is 111:
```
$ ./cancelOrder.js -s 111
```
