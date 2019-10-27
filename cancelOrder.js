#!/usr/bin/node
const RippleAPI = require('ripple-lib').RippleAPI;
const Tx = require('./tx.js');
const fs = require('fs');

const api = new RippleAPI({
  server: 'wss://s1.ripple.com', // Public rippled server hosted by Ripple, Inc.
  maxFeeXRP: '0.00001'
});

const argv = require('yargs')
  .option('sequence', {
    alias: 's',
    describe: 'The price of the new order to be placed'
  })
  .option('secret_file', {
    describe: 'The path of secrt file',
    type: 'string',
    default: '.secret.json'
  })
  .demandOption(['sequence'])
  .help()
  .strict()
  .argv

var secrets = JSON.parse(fs.readFileSync(argv.secret_file, 'utf8'));
var account = secrets.account;
var secret = secrets.secret;

api.connect().then(() => {
  console.log('connected');
  return api.prepareOrderCancellation(account, {
    'orderSequence': Number(argv.sequence),
  }).then(prepared => {
    return Tx.submit(api, prepared, secret, Tx.reportSequence, console.log, console.log);
  });
}).then(() => {
  api.disconnect().then(() => {
    console.log('api disconnected');
    process.exit();
  });
}).catch(console.error);
