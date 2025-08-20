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

            if (transactionTypeCode !== 82) continue; // Only process payments

            if (!detail) {
                console.log('no detail for transaction, use generic transaction');
                const res = generateGenericTransaction(account, transaction);
                await uploadTransaction(res);
                continue;
            }
            
            if (!expenseAccountsMap.has(
                `${detail.additional_info.payment_type}-${detail.additional_info.bg_pg_number}`
            )) {
                console.log('No expense account!! for transaction:', transaction, detail);
            }

            if (transaction.credit_debit_indicator === 'CREDIT') {
                console.log('CREDIT! Payment should be a DEBET!!');
                continue; // Skip credits, we only want debits for payments
            }

            if (argv[2] !== 'upload') continue; // Skip uploading if not in upload mode

            const res = generateTransaction(
                assetAccountsMap.get(account.bban),
                expenseAccountsMap.get(`${detail.additional_info.payment_type}-${detail.additional_info.bg_pg_number}`),
                transaction,
                detail
            );

            const journal_id = await uploadTransaction(res);
            if (!invoiceExists) continue; // Skip adding attachment if no invoice exists
            await addAttachment(account.id, transaction, journal_id);

        }

        console.log('-----------------------------------');
        console.log(`Account ${account.custom_name} processed for payments.`);
    }

}

function generateGenericTransaction(account, transaction) {
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

function generateTransaction(fromAcc, toAcc, transaction, detail) {
    return {
        type: 'withdrawal',
        source_id: fromAcc,
        destination_id: toAcc,
        description: detail.additional_info.own_note || detail.additional_info.recipients_name,
        
        date: `${transaction.entry_date_time}+00:00`,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",

        notes: `
Message1: ${transaction.message1} \n
OCR: ${detail.additional_info.ocr_message} \n
Voucher: ${detail.additional_info.voucher_number} \n
SEB ID: ${detail.additional_info.seb_unique_accounting_transaction_id} \n
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
            "fire_webhooks": true,
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
    return data.data.attributes.transactions[0].transaction_journal_id;
}



async function addAttachment(accountId, transaction, journal_id) {
    const hash = crypto.createHash('md5').update(transaction.id).digest('hex');
    const attachment = {
        filename: `${hash}.pdf`,
        attachable_type: "TransactionJournal",
        attachable_id: journal_id
    };
    const invoicePath = `./data/${accountId}/invoices/${hash}.pdf`;
    if (!fs.existsSync(invoicePath)) {
        console.error('No invoice found for transaction:', transaction.id, 'at path:', invoicePath);
        return;
    }

    const data = fs.readFileSync(invoicePath);

    const res1 = await fetch('FIREFLY_BASE_URL/api/v1/attachments', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIREFLY_AUTH}`,
        },
        body: JSON.stringify(attachment)
    });
    if (!res1.ok) {
        console.error('Error creating attachment:', res1.status, res1.statusText);
        const errorData = await res1.json();
        fs.appendFileSync('./errors.txt', `Error creating attachment: ${res1.status} ${res1.statusText}\nAttachment: ${JSON.stringify(attachment, null, 2)} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        return;
    }

    const attachmentData = await res1.json();
    console.log('Attachment created:', attachmentData.data.id);
    const attachmentId = attachmentData.data.id;

    const res2 = await fetch(`FIREFLY_BASE_URL/api/v1/attachments/${attachmentId}/upload`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/octet-stream',
            'Authorization': `Bearer ${FIREFLY_AUTH}`,
        },
        body: data
    });
    if (!res2.ok) {
        console.error('Error uploading attachment:', res2.status, res2.statusText);
        const errorData = await res2.json();
        fs.appendFileSync('./errors.txt', `Error uploading attachment: ${res2.status} ${res2.statusText}\nAttachment ID: ${attachmentId} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        return;
    }

    console.log('Attachment uploaded successfully:', attachmentId);
    return attachmentId;
}
