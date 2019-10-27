const formatAmount = require('./orderUtil.js').formatAmount;

/* Milliseconds to wait between checks for a new ledger. */
const INTERVAL = 1000;

var submit = function(api, prepared, secret, onSuccess, onError, onSubmit) {
  return api.getLedger().then(ledger => {
    const signedData = api.sign(prepared.txJSON, secret);
    return api.submit(signedData.signedTransaction).then(data => {
      const submitResult = 'Submit: ' + data.resultCode + ": " +
        data.resultMessage;

      if (data.resultCode === 'tesSUCCESS') {
        if (onSubmit) onSubmit(submitResult);
      } else {
        onError(submitResult);
      }

      const options = {
        minLedgerVersion: ledger.ledgerVersion,
        maxLedgerVersion: prepared.instructions.maxLedgerVersion
      };
      return new Promise((resolve, reject) => {
        setTimeout(() => verify(api, signedData.id, options, onSuccess,
            onError).then(resolve, reject), INTERVAL);
      });
    });
  });
}

/* Verify a transaction is in a validated XRP Ledger version */
var verify = function(api, hash, options, onSuccess, onError) {
  return api.getTransaction(hash, options).then(data => {
    const verificationResult = 'Verify: ' + data.outcome.result;

    if (data.outcome.result === 'tesSUCCESS') {
      onSuccess(data.sequence);
    } else {
      onError(verificationResult);
    }
  }).catch(error => {
    /* If transaction not in latest validated ledger,
       try again until max ledger hit */
    if (error instanceof api.errors.PendingLedgerVersionError) {
      return new Promise((resolve, reject) => {
        setTimeout(() => verify(api, hash, options, onSuccess, onError)
            .then(resolve, reject), INTERVAL);
      });
    }

    onError('Verify: Transaction may have failed. getTransaction error: ' +
      error.toString());
  });
}

const recordSequence = (newOrder, newPrice, sequences) => {
  return (newSequence) => {
    console.log('Verify: tesSUCCESS: new order sequence:', newSequence)
    sequences[newOrder.direction].forEach(s => {
      if (s.sequence === newOrder.orderToReplace) {
        s.sequence = newSequence;
        s.price = newPrice.toFixed(5);
        s.quantity = formatAmount(newOrder.quantity);
      }
    })
  }
}

const reportSequence = (sequence) => {
  console.log('Verify: tesSUCCESS: new order sequence:', sequence)
}

module.exports = {
  submit: submit,
  verify: verify,
  recordSequence: recordSequence,
  reportSequence: reportSequence,
}
