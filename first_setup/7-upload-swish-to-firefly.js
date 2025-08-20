const url = `https://apps.seb.se/ssc/payments/accounts/api/accounts/transactionDetails`;

const { FIREFLY_AUTH } = require('./config.js');
const fs = require('fs');
const crypto = require('crypto');
const { argv } = require('process');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


// get all expense and revenue accounts
const assetAccountsMap = new Map();
const expenseAccountsMap = new Map();
const revenueAccountsMap = new Map();
async function getAccounts() {
    const res = await fetch('FIREFLY_BASE_URL/api/v1/accounts?limit=10000', {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${FIREFLY_AUTH}`,
        }
    });
    const data = await res.json();
    const assetAccounts = data.data.filter(account => account.attributes.type === 'asset');
    const revenueAccounts = data.data.filter(account => account.attributes.type === 'revenue');
    const expenseAccounts = data.data.filter(account => account.attributes.type === 'expense');
    for (const account of assetAccounts) {
        assetAccountsMap.set(account.attributes.account_number, account.id);
    }
    for (const account of revenueAccounts) {
        revenueAccountsMap.set(account.attributes.account_number || account.attributes.name, account.id);
    }
    for (const account of expenseAccounts) {
        expenseAccountsMap.set(account.attributes.account_number || account.attributes.name, account.id);
    }

    // DEBUG
    fs.writeFileSync('./data/assetAccountsMap.json', JSON.stringify(Object.fromEntries(assetAccountsMap), null, 2));
    fs.writeFileSync('./data/expenseAccountsMap.json', JSON.stringify(Object.fromEntries(expenseAccountsMap), null, 2));
    fs.writeFileSync('./data/revenueAccountsMap.json', JSON.stringify(Object.fromEntries(revenueAccountsMap), null, 2));
}



const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));
uploadAllTransactions();

const allData = {};

async function uploadAllTransactions() {
    console.log('Fetching all accounts...');
    await getAccounts();
    console.log('All accounts loaded!');
    console.log('-----------------------------------');

    console.log('Loading all transactions into memory to be able to cross reference etc...');
    for (const account of accounts) {
        const transactions = JSON.parse(fs.readFileSync(`./data/${account.id}/transactions.json`, 'utf8'));
        const details = JSON.parse(fs.readFileSync(`./data/${account.id}/details.json`, 'utf8'));
        allData[account.id] = {
            account,
            transactions: transactions,
            details: details
        };

    }
    console.log('All transactions loaded into memory, ready to loop and push!');
    console.log('-----------------------------------');

    for (const accountId in allData) {
        const { account, transactions, details } = allData[accountId];
        console.log('-----------------------------------');
        console.log('Account:', account.custom_name);
        console.log('Account ID:', account.id);
        console.log('Transactions:', transactions.length);
        console.log('Details:', details.length);

        for (const transaction of transactions) {
            const detail = details.find(d => d.additional_info.transaction_details_link === transaction.link);
            const invoiceExists = !!detail?.additional_info?.einvoiceUrl || false;
            const transactionTypeCode = transaction.transaction_type.code;

            // Swish transactions
            if (transactionTypeCode === 141) {
                const res = generateSwishTransaction(account, transaction, detail);
                await uploadTransaction(res);
            }
        }

        console.log('-----------------------------------');
        console.log(`Account ${account.custom_name} processed for SWISH transactions.`);
    }
}

function generateSwishTransaction(account, transaction, detail) {
    console.log('------------------------------------');

    let base;
    if (transaction.credit_debit_indicator === 'CREDIT') {
        // Credit, deposit
        base = {
            type: 'deposit',
            description: `Swish from ${detail?.additional_info?.sender_name || detail?.additional_info?.senders_name_address || transaction.descriptive_text}`,
            destination_id: assetAccountsMap.get(account.bban)
        }
        let swishKey = `SWISH-${detail?.additional_info?.sender_swish_number || transaction.descriptive_text}`;
        if (revenueAccountsMap.has(swishKey)) {
            base.source_id = revenueAccountsMap.get(swishKey);
        }
        else {
            base.source_name = `${detail?.additional_info?.senders_name_address || transaction.descriptive_text} (Swish)`
        }
    } else {
        // Debit, withdrawal
        base = {
            type: 'withdrawal',
            description: `Swish to ${detail?.additional_info?.receiver_name || detail?.additional_info?.recipients_name || transaction.descriptive_text}`,
            source_id: assetAccountsMap.get(account.bban)
        }
        let swishKey = `SWISH-${detail?.additional_info?.receiver_swish_number || transaction.descriptive_text}`;
        if (expenseAccountsMap.has(swishKey)) {
            base.destination_id = expenseAccountsMap.get(swishKey);
        } else {
            base.destination_name = `${detail?.additional_info?.recipients_name || transaction.descriptive_text} (Swish)`
        }
    }

    if (detail?.additional_info?.message) {
        base.description = `Swish: "${detail.additional_info.message}"`;
    }

    return {
        ...base,

        date: `${transaction.entry_date_time}+00:00`,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",

        notes: `
Message1: ${transaction.message1} \n
${ transaction.message3 ? `Message3: ${transaction.message3}` : '' } \n
Swish Reference ID: ${detail?.additional_info?.swish_reference_id || ''}
`,
        interest_date: transaction.value_date,
        process_date: transaction.posting_date,
    }
}

async function uploadTransaction(transaction) {
    const res = await fetch('FIREFLY_BASE_URL/api/v1/transactions', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIREFLY_AUTH}`,
        },
        body: JSON.stringify({
            "error_if_duplicate_hash": true,
            "apply_rules": false,
            "fire_webhooks": false,
            "transactions": [transaction]
        })
    });
    if (!res.ok) {
        console.error('Error uploading transaction:', res.status, res.statusText);
        const errorData = await res.json();
        fs.appendFileSync('./errors.txt', `Error uploading transaction: ${res.status} ${res.statusText}\nTransaction: ${JSON.stringify(transaction, null, 2)} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        console.error('Error data:', errorData);
        return;
    }
    const data = await res.json();
    console.log('Transaction uploaded:', data.data.id);
    return data.data.id;
}

