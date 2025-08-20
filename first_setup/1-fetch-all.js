const HEADERS = require('./config.js').HEADERS;
const fs = require('fs');

let nextPagingCursor = null;
let count = 1;

function getUrl(id) {
    return `https://apps.seb.se/ssc/payments/accounts/api/accounts/${id}/transactions/search`
}

const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));

forEachAccount();

async function forEachAccount() {
    for (const account of accounts) {
        console.log(account.custom_name)
        // Reset values
        count = 1;
        nextPagingCursor = null;
        
        let hasNextPage = true;
        while (hasNextPage) {
            console.log('Fetching transactions for account:', account.custom_name);
            hasNextPage = await fetch200Rows(account.id);
            // If nextPagingCursor is null, there are no more pages
            // if (nextPagingCursor === null) {
            //     hasNextPage = false;
            // }
        }
    }
}

async function fetch200Rows(id) {
    const url = getUrl(id);
    console.log('Fetching 200 rows...', count);
    const res = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            "filters": {
                "type": 0
            },
            "maxRows": 200,
            "pagingCursor": nextPagingCursor
        })
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Data parsed, length:', data.account_transactions.length);
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before fetching the next page
    
    console.log('Writing data to file...');
    fs.mkdirSync(`./data/${id}/transactions`, { recursive: true });
    fs.writeFileSync(`./data/${id}/transactions/${count}.json`, JSON.stringify(data, null, 2));
    console.log('Data written to file.');
    
    count++;
    if (data.paging_parameters.nextPageExists) {
        nextPagingCursor = data.paging_parameters.cursor;
        console.log('Next paging cursor:', nextPagingCursor);
        return true; // There are more pages to fetch
    } else {
        console.log('No more pages to fetch.');
        return false; // No more pages to fetch
    }
}
