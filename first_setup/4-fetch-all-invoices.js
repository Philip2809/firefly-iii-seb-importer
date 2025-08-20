const { HEADERS, ORGANIZATION_ID } = require('./config.js');
const fs = require('fs');
const crypto = require('crypto');
const { argv } = require('process');

const url = `https://apps.seb.se/ssc/payments/accounts/api/einvoicepdf/details`;
let invoiceCount = 0;

const countonly = argv[2] !== 'understood';
console.log('Count only:', countonly);
const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));

run();
async function run() {
    for (const account of accounts) {
        fs.mkdirSync(`./data/${account.id}/invoices`, { recursive: true });
        const transactions = JSON.parse(fs.readFileSync(`./data/${account.id}/transactions.json`, 'utf8'));
        console.log(`Account: ${account.custom_name}, loading invoice`);

        await fetchAllInvoices(account, transactions)
    }

    if (countonly) {
        console.log('This script will take some time to fetch all the invoices. It will wait 2 seconds between each fetch to not be spammy.');
        console.log('To run the script add "understood" as an argument.');
        console.log('Example: node 4-fetch-all-invoices.js understood');
        console.log(`Total invoices that will be fetched: ${invoiceCount}`);
    }
}


async function fetchAllInvoices(account, transactions) {
    console.log('-----------------------------------');
    for (const transaction of transactions) {
        if (transaction.is_old_transaction) {
            // Old transactions do not have details
            continue;
        }

        const hash = crypto.createHash('md5').update(transaction.id).digest('hex');
        // check if details exists
        if (!fs.existsSync(`./data/${account.id}/details/${hash}.json`)) {
            // console.log(`Details for transaction ${hash} does not exist, skipping...`);
            continue;
        }

        // check if invoice already exists
        if (fs.existsSync(`./data/${account.id}/invoices/${hash}.pdf`)) {
            // console.log(`Invoice for transaction ${hash} already exists, skipping...`);
            continue;
        }

        const transactionDetails = JSON.parse(fs.readFileSync(`./data/${account.id}/details/${hash}.json`, 'utf8'));
        if (!transactionDetails.additional_info.einvoiceUrl) {
            // console.log(`Transaction ${hash} does not have an invoice URL, skipping...`);
            continue;
        }

        invoiceCount++;
        if (countonly) continue; // only counting....

        await fetchInvoice(account, hash, transaction);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before fetching the next document
    }
}


async function fetchInvoice(account, hash, transaction) {
    console.log('Fetching invoice details for transaction:', hash);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            ...HEADERS,
            'Client-id': ORGANIZATION_ID,
            'bban': account.bban,
            'Origin': 'https://apps.seb.se',
            'link': transaction.link
        }
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch invoice details for transaction ${hash}: ${res.statusText}`);
    }
    const data = await res.json();

    console.log('Got output, fetching invoice...');
    const invoiceUrl = data.additional_info.e_invoice_url;
    const ticket_data = data.additional_info.ticket_data;
    const resInvoice = await fetch(invoiceUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'ticket': ticket_data
        })
    })
    console.log('Response status (invoice pdf):', resInvoice.status);
    if (!resInvoice.ok) {
        throw new Error(`Failed to fetch invoice for transaction ${hash}: ${resInvoice.statusText}`);
    }
    console.log('Invoice fetched, saving to file...');
    const buffer = await resInvoice.bytes()
    fs.writeFileSync(`./data/${account.id}/invoices/${hash}.pdf`, buffer);
    console.log('Invoice saved!');
    console.log('-----------------------------------');
}


