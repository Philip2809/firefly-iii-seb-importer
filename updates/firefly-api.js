const { FIREFLY_HEADERS, FIREFLY_BASE_URL } = require('./config.js');


async function fetchFireflyAccounts(type = 'all') {
    console.log('Fetching Firefly accounts, of type:', type);
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts?limit=10000&type=${type}`, {
        headers: FIREFLY_HEADERS
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch accounts: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Parsing accounts data, length:', data.data.length);
    return data.data;
}

async function fetchFireflyTransactions(fireflyAccountId, limit = 1) {
    console.log('Fetching transactions from firefly, items to fetch:', limit);
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts/${fireflyAccountId}/transactions?limit=${limit}`, {
        headers: FIREFLY_HEADERS,
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Found', data.data.length, 'transactions!');
    return data.data;
}

async function makeFireflyAccount(name, type, details) {
    const acc = {
        name,
        type,
        ...details
    };

    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts`, {
        method: 'POST',
        body: JSON.stringify(acc),
        headers: FIREFLY_HEADERS
    })
    if (!res.ok) {
        throw new Error(`Failed to create firefly account: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data.id;
}

const fs = require('fs');
async function uploadTransaction(transaction, invoice) {
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/transactions`, {
        method: 'POST',
        headers: FIREFLY_HEADERS,
        body: JSON.stringify({
            "error_if_duplicate_hash": true,
            "apply_rules": true,
            "fire_webhooks": !!invoice,
            "transactions": [transaction]
        })
    });
    if (!res.ok) {
        console.error('Error uploading transaction:', res.status, res.statusText);
        const errorData = await res.json();
        fs.appendFileSync('./.errors.txt', `Error uploading transaction: ${res.status} ${res.statusText}\nTransaction: ${JSON.stringify(transaction, null, 2)} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        console.error('Error data:', errorData);
        return;
    }
    const data = await res.json();
    console.log('Transaction uploaded:', data.data.id);
    fs.appendFileSync('./.success.txt', `Transaction uploaded: ${data.data.id}\n`);
    
    
    // if (invoice)
    
    
    // return data.data.attributes.transactions[0].transaction_journal_id;
    // TODO: invoice upload


}


module.exports = {
    makeFireflyAccount,
    fetchFireflyAccounts,
    fetchFireflyTransactions,
    uploadTransaction
}


