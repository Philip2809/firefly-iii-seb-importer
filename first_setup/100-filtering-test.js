
const { FIREFLY_AUTH } = require('./config.js');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { argv } = require('process');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));
let count82 = 0;
let count180 = 0;
let count182 = 0;
let countWierdShitNumber = 0;
let totalCount = 0;

const uniue = new Set();

run();
async function run() {
    for (const account of accounts) {
        const transactions = JSON.parse(fs.readFileSync(`./data/${account.id}/transactions.json`, 'utf8'));

        totalCount += transactions.length;
        count180 += transactions.filter(t => t.transaction_type.code === 180).length;
        count182 += transactions.filter(t => t.transaction_type.code === 182).length;
        count82 += transactions.filter(t => t.transaction_type.code === 82).length;

        countWierdShitNumber += transactions.filter(t => t.transaction_type.code === 1302).length;
        countWierdShitNumber += transactions.filter(t => t.transaction_type.code === 1301).length;

        // add to unique set
        for (const transaction of transactions) {
            uniue.add(transaction.transaction_type.code);
        }

    }

    console.log('-----------------------------------');
    console.log(`Total transactions processed: ${totalCount}`);
    console.log(`Total 180 transactions: ${count180}`);
    console.log(`Total 182 transactions: ${count182}`);
    console.log(`Total 82 transactions: ${count82}`);
    console.log('Total wierd shit numbers (1301, 1302):', countWierdShitNumber);
    console.log('-----------------------------------');

    console.log(uniue);
}