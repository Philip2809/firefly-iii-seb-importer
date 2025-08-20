const { HEADERS } = require('./config.js');
const fs = require('fs');

const url = `https://apps.seb.se/ssc/payments/accounts/api/accounts`;

async function fetchAllAccounts() {
    console.log('Fetching accounts');
    const res = await fetch(url, {
        headers: HEADERS
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch accounts: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Data parsed, length:', data.data.active_accounts.length);

    console.log('Writing data to file...');
    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync(`./data/accounts.json`, JSON.stringify(data.data.active_accounts, null, 2));
    console.log('Data written to file.');
}

fetchAllAccounts();

