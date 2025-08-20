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




let count = 0;

const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));
uploadAllTransactions();

const allData = {};
let totalCount = 0;
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
        let count = 0;
        const { account, transactions, details } = allData[accountId];
        console.log('-----------------------------------');
        console.log('Account:', account.custom_name);
        console.log('Account ID:', account.id);
        console.log('Transactions:', transactions.length);
        console.log('Details:', details.length);

        for (const transaction of transactions) {;
            const transactionTypeCode = transaction.transaction_type.code;

            // Card transactions, "Other", Direct debit, Standing transfer, and isk 1301, 1302
            if ([41, 71, 990, 10, 184, 1301, 1302].includes(transactionTypeCode)) {
                const res = generateCardTransaction(account, transaction);
                count++;
                uploadTransaction(res);
            }
        }

        console.log('-----------------------------------');
        console.log(`Account ${account.custom_name} processed for transaction types; 41, 71, 990, 10, 184, 1301, 1302. Total: ${count}`);
        totalCount += count;
    }
    console.log('-----------------------------------');
    console.log(`Total transactions processed: ${totalCount}`);
    console.log('All done!');
}

function generateCardTransaction(account, transaction) {
    let base;
    if (transaction.credit_debit_indicator === 'CREDIT') {
        // Credit, deposit
        base = {
            type: 'deposit',
            destination_id: assetAccountsMap.get(account.bban),
            source_name: transaction.merchant_name || transaction.descriptive_text,
        }
    } else {
        // Debit, withdrawal
        base = {
            type: 'withdrawal',
            source_id: assetAccountsMap.get(account.bban),
            destination_name: transaction.merchant_name || transaction.descriptive_text,
        }
    }

    if (transaction?.original_amount) {
        base = {
            ...base,
            foreign_amount: transaction.original_amount.amount,
            foreign_currency_code: transaction.original_amount.currency_code,
        }
    }

    // I have honestly no idea, but refunds seams to get the value "20" as purchase date, so don't set it then
    if (transaction?.purchase_date !== "20") {
        base = {
            ...base,
            due_date: transaction.purchase_date,
        }
    }

    return {
        ...base,

        description: transaction.descriptive_text,
        date: `${transaction.entry_date_time}+00:00`,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",
        external_id: transaction.reference_id,

        notes: `
Message1: ${transaction.message1} \n
${ transaction.message3 ? `Message3: ${transaction.message3}` : '' } \n
${ transaction.exchange_rate ? `Exchange rate: ${transaction.exchange_rate} \n` : '' }
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
        console.error('Error data:', errorData, transaction);
        fs.appendFileSync('./errors.txt', `Error uploading transaction: ${res.status} ${res.statusText}\nTransaction: ${JSON.stringify(transaction, null, 2)} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        return;
    }
    const data = await res.json();
    console.log('Transaction uploaded:', data.data.id);
    return data.data.id;
}

