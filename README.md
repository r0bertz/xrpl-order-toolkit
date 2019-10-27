# XRPL Order Toolkit

This is a collection of scripts to manipulate [XRPL](https://xrpl.org) orders.
XRPL has a builtin [decentralized
exchange](https://xrpl.org/decentralized-exchange.html) which natively supports
[limit order](https://www.investopedia.com/terms/l/limitorder.asp).

Most of the scripts share a common config file which is specified by flag
`--secret_file` whose default value is `.secret.json`. The format looks like:

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

You can see the live orderbook for any currency pair on the following two websites:

* https://xrpcharts.ripple.com
* https://orderbook.xrp.ninja
