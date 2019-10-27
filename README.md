# XRPL Order Toolkit

This is a collection of scripts that manipulates XRPL orders.

They share a common config file which is specified by flag `--secret_file` whose
default value is `.secret.json`. The format looks like:

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
