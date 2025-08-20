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
    // fs.writeFileSync('./data/assetAccountsMap.json', JSON.stringify(Object.fromEntries(assetAccountsMap), null, 2));
    // fs.writeFileSync('./data/expenseAccountsMap.json', JSON.stringify(Object.fromEntries(expenseAccountsMap), null, 2));
    // fs.writeFileSync('./data/revenueAccountsMap.json', JSON.stringify(Object.fromEntries(revenueAccountsMap), null, 2));
}

const readline = require('readline');

// Create an interface for input and output
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};




const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));
uploadAllTransactions();

const allData = {};
const blackListed180 = new Set(); // If we match to a 180 deposit, we don't want to create another transaction for it.
const blackListed182 = new Set(); // The 182 transfers that has already been created, we don't want to make multiple transactions for the same transfer.
const allTransactions = [];

let total182 = 0;
let totalMatched = 0;

async function uploadAllTransactions() {
    console.log('Fetching all accounts...');
    await getAccounts();
    console.log('All accounts loaded!');
    console.log('-----------------------------------');

    console.log('Loading all transactions into memory to be able to cross reference etc...');
    for (const account of accounts) {
        const transactions = JSON.parse(fs.readFileSync(`./data/${account.id}/transactions.json`, 'utf8'));
        const details = JSON.parse(fs.readFileSync(`./data/${account.id}/details.json`, 'utf8'));
        allData[account.bban] = {
            account,
            transactions: transactions,
            details: details
        };

    }
    console.log('All transactions loaded into memory, ready to loop and push!');
    console.log('-----------------------------------');

    console.log('Map the transfers that have a link');
    for (const accountId in allData) {
        const { account, transactions, details } = allData[accountId];
        console.log('-----------------------------------');
        console.log('Account:', account.custom_name);
        console.log('Account ID:', account.id);
        console.log('Transactions:', transactions.length);
        console.log('Details:', details.length);

        for (const transaction of transactions) {
            const detail = details.find(d => d.additional_info.transaction_details_link === transaction.link);
            const transactionTypeCode = transaction.transaction_type.code;

            // 182 is a transfer, it it has a detail link, 182 is ALWAYS withdrawal
            if (transactionTypeCode === 182) {
                total182++;
                const accNumber = detail?.additional_info?.to_account || transaction.descriptive_text.trim();
                if (allData[accNumber]) {
                    const toSearch = allData[accNumber].transactions;
                    const possibleMatch = toSearch.filter(t =>
                        t.value_date === transaction.value_date &&
                        t.transaction_type.code === 180 &&
                        t.transaction_amount.amount === transaction.transaction_amount.amount.replace('-', '')
                    )

                    if (possibleMatch.length === 0) {
                        console.log('Skipping this transaction, no match found.');
                        continue;
                    }

                    let match = possibleMatch.find(t =>
                        t.entry_date_time === transaction.entry_date_time
                    )

                    if (!match) {
                        console.log('++++++++++++++++++++');
                        console.log('Could not auto match transfer. There is', possibleMatch.length, 'possible matches.');
                        console.log('Original transaction:', transaction.descriptive_text);
                        console.log(transaction.message1);
                        console.log(transaction.entry_date_time);
                        console.log('--------------------------------');
                        possibleMatch.forEach((t, i) => {
                            console.log('Possbile match', i);
                            console.log('From', account.custom_name, 'to', allData[accNumber].account.custom_name);
                            console.log('Descriptive text:', t.descriptive_text);
                            console.log('Message:', t.message1);
                            console.log('Spesific date and diff', t.entry_date_time, new Date(t.entry_date_time).getTime() - new Date(transaction.entry_date_time).getTime());
                            console.log('---------------------------------');
                        })
                        console.log('++++++++++++++++++++');
                        const answer = await askQuestion('What index to use: ');
                        if (answer === 'n') {
                            console.log('Skipping this transaction, no match found.');
                            continue;
                        }

                        const index = parseInt(answer);
                        if (possibleMatch[index]) {
                            match = possibleMatch[index];
                        }
                    }

                    if (!match) {
                        console.log('If no match at this point, then something is wrong. Skipping this transaction.');
                        continue;
                    }

                    totalMatched++;
                    blackListed180.add(match.id);
                    blackListed182.add(transaction.id);

                    const transfer = generateTransfer(account, allData[accNumber].account, transaction);
                    await uploadTransaction(transfer);
                }
            }
        }

        console.log('-----------------------------------');
        console.log(`Account ${account.custom_name} processed for transfers.`);
    }

    console.log('-----------------------------------');
    console.log('Total 182 transactions:', total182);
    console.log('Total matched transfers:', totalMatched);
    console.log('Total blacklisted 180 transactions:', blackListed180.size);
    console.log('Total blacklisted 182 transactions:', blackListed182.size);

    console.log('Made stuff that can be transfers as transfers, now we need to make the rest of the transactions.');
    for (const accountId in allData) {
        const { account, transactions, details } = allData[accountId];

        for (const transaction of transactions) {

            // make sure they are of type 180 or 182
            if (![180, 182].includes(transaction.transaction_type.code)) {
                continue; // Skip if not 180 or 182
            }

            if (blackListed180.has(transaction.id) || blackListed182.has(transaction.id)) {
                continue; // Skip blacklisted transactions
            }

            const res = generateTransaction(account, transaction);
            await uploadTransaction(res);
        }
    }

    console.log(allTransactions.length)
}

function generateTransfer(fromAcc, toAcc, transaction) {
    return {
        type: 'transfer',
        source_id: assetAccountsMap.get(fromAcc.bban),
        destination_id: assetAccountsMap.get(toAcc.bban),

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

function generateTransaction(account, transaction) {
    let base;
    if (transaction.credit_debit_indicator === 'CREDIT') {
        // Credit, deposit
        base = {
            type: 'deposit',
            destination_id: assetAccountsMap.get(account.bban),
            source_name: transaction.descriptive_text,
        }
    } else {
        // Debit, withdrawal
        base = {
            type: 'withdrawal',
            source_id: assetAccountsMap.get(account.bban),
            destination_name: transaction.descriptive_text,
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

    allTransactions.push(transaction);
    // return;

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

