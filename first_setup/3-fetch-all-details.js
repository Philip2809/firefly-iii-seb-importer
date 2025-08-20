const HEADERS = require('./config.js').HEADERS;
const fs = require('fs');
const crypto = require('crypto');
const { argv } = require('process');

const url = `https://apps.seb.se/ssc/payments/accounts/api/accounts/transactionDetails`;

const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));

run();
async function run() {
    for (const account of accounts) {
        fs.mkdirSync(`./data/${account.id}/details`, { recursive: true });
        const transactions = JSON.parse(fs.readFileSync(`./data/${account.id}/transactions.json`, 'utf8'));
        const detailsToFetch = transactions.filter(transaction => !!transaction.link);
        console.log(`Account: ${account.custom_name}, Transactions with details: ${detailsToFetch.length}`);

        if (argv[2] === 'understood') await fetchAllDetails(account.id, detailsToFetch)
    }
}

if (argv[2] !== 'understood') {
    console.log();
    console.log('This script will take some time to fetch all the details. It will wait 2 seconds between each fetch to not be spammy.');
    console.log('To run the script add "understood" as an argument.');
    console.log('Example: node 3-fetch-all-details.js understood');
}


async function fetchAllDetails(id, transactions) {
    console.log('-----------------------------------');
    for (const transaction of transactions) {
        const hash = crypto.createHash('md5').update(transaction.id).digest('hex');
        // check if details already exists
        if (fs.existsSync(`./data/${id}/details/${hash}.json`)) {
            console.log(`Details for transaction ${hash} already exists, skipping...`);
            continue;
        }

        console.log(`Transaction ${hash} has a detail code: ${transaction.transaction_type.code}`);
        await fetchDetails(id, hash, transaction);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before fetching the next transaction
    }
}

async function fetchDetails(id, hash, transaction) {
    console.log('Fetching details for transaction:', hash);
    const res = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(transaction)
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        console.log(transaction)
        throw new Error(`Failed to fetch details for transaction ${hash}: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Data parsed, saving to file...');
    fs.writeFileSync(`./data/${id}/details/${hash}.json`, JSON.stringify(data, null, 2));
    console.log('Data written to file.');
    console.log('-----------------------------------');
}





