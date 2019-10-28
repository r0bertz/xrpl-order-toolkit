const BigNumber = require('bignumber.js');
const sprintf=require('sprintf-js').sprintf;

const exchangeRateToPrice = (order) => {
  if (order.specification.direction === 'buy') {
    return BigNumber(1).div(BigNumber(order.properties.makerExchangeRate));
  }
  return BigNumber(order.properties.makerExchangeRate);
}

const formatAmount = (amount) => {
  if (amount.currency === 'XRP') {
    return sprintf("%s %s", formatValue(amount.value, amount.currency), amount.currency)
  }
  return sprintf("%s %s/%s", formatValue(amount.value, amount.currency), amount.currency, amount.counterparty)
}

const formatOrder = (order) => {
  return sprintf('sequence: %5s price: %s quantity: %s totalPrice: %s',
    order.properties.sequence,
    exchangeRateToPrice(order).toFixed(5),
    formatAmount(order.specification.quantity),
    formatAmount(order.specification.totalPrice))
}

const formatValue = (bn, currency) => {
  bn = typeof bn.toFixed === 'function' ? bn : BigNumber(bn);
  rv = currency === 'XRP' ? bn.toFixed(6) : bn.toPrecision(16);
  // Remove trailing 0.
  // See https://github.com/ripple/ripple-lib/pull/1026#issuecomment-534242547
  return rv.replace(new RegExp('0+$'),'').replace(new RegExp('\\.$'), '')
}

const formatNewOrder = (order) => {
  return sprintf('price: %s quantity: %s totalPrice: %s',
    BigNumber(order.totalPrice.value).div(
      BigNumber(order.quantity.value)).toFixed(5),
    formatAmount(order.quantity),
    formatAmount(order.totalPrice))
}

module.exports = {
  formatOrder: formatOrder,
  formatNewOrder: formatNewOrder,
  exchangeRateToPrice: exchangeRateToPrice,
  formatValue: formatValue,
  formatAmount: formatAmount,
}
