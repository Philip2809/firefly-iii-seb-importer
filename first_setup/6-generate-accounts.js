const MY_SWISH_NUMBER = '';

const { FIREFLY_AUTH } = require('./config.js');
const fs = require('fs');
const crypto = require('crypto');
const { argv } = require('process');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let count = 0;
let failed = 0;
const assetAccountNumbers = new Set();


// savingAsset, defaultAsset
const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));

run();
async function run() {
    // Generate accounts based on accounts
    console.log('Generating asset accounts...');
    for (const account of accounts) {
        assetAccountNumbers.add(account.iban);
        assetAccountNumbers.add(account.bban);

        await generateAccount(account.custom_name, 'asset', {
            iban: account.iban,
            account_number: account.bban,
            notes: `SEB ID: ${account.id}`,
            account_role: account.account_type.code === '1' ? 'defaultAsset' : 'savingAsset'
        })
    }

    console.log('-----------------------------------');
    console.log('Generating expense and revenue accounts based on transaction details...');

    for (const account of accounts) {
        const details = JSON.parse(fs.readFileSync(`./data/${account.id}/details.json`, 'utf8'));
        console.log(`Account: ${account.custom_name}, loading details: ${details.length}`);
        await generateAccounts(details);
    }
}



// generateAccounts();
async function generateAccounts(details) {
    console.log('-----------------------------------');
    for (const detail of details) {
        console.log('-----------------------------------');
        console.log('checking detail');

        // Swish transactions
        if (detail.additional_info.swish_reference_id) {
            console.log('Swish transaction found!');
            // Generate swish expense and revenue account!
            // console.log('-------------------------------');
            // console.log(details.additional_info.recipients_name);
            // console.log(details.additional_info.receiver_name);
            // console.log(details.additional_info.receiver_swish_number);

            // console.log(details.additional_info.sender_name);
            // console.log(details.additional_info.senders_name_address);
            // console.log(details.additional_info.sender_swish_number);
            let number = null, name;
            // My number always has to be one of the two, i realize now i should have used credit or debit hehe
            if (detail.additional_info.receiver_swish_number === MY_SWISH_NUMBER) { // if reciver is my number, its a deposit, credit
                number = detail.additional_info.sender_swish_number;
                name = detail.additional_info.sender_name;
            }
            else {
                number = detail.additional_info.receiver_swish_number;
                name = detail.additional_info.receiver_name;
            }

            console.log('generating swish for', name || detail.additional_info.recipients_name);

            if (number === null) {
                // If its credit, we got the money so we are the recipient, using "senders_name_address" because its uppercase
                await generateAccount(
                    `${detail.credit_debit_indicator === 'CREDIT' ? 
                        detail.additional_info.senders_name_address : 
                        detail.additional_info.recipients_name} (Swish)`,
                    detail.credit_debit_indicator === 'CREDIT' ? 'revenue' : 'expense'
                );
                continue;
            }

            await generateAccount(
                `${name} (Swish)`,
                detail.credit_debit_indicator === 'CREDIT' ? 'revenue' : 'expense',
                { account_number: `SWISH-${number}` }
            );
        } else {
            failed++;
            console.log('transfer found; its of type:', detail.additional_info.payment_type);
            // console.log(details.credit_debit_indicator, details.additional_info.payment_type, details.additional_info.bg_pg_number);
            // Only debit transactions, for some reason credit transactions do not have details!
            if (['BG', 'PG'].includes(detail.additional_info.payment_type)) {
                await generateAccount(
                    `${detail.additional_info.recipients_name} (${detail.additional_info.payment_type}-${detail.additional_info.bg_pg_number})`,
                    'expense',
                    { account_number: `${detail.additional_info.payment_type}-${detail.additional_info.bg_pg_number}` }
                );
            } else if (detail.additional_info.payment_type === 'SEB') {
                if (assetAccountNumbers.has(detail.additional_info.to_account)) {
                    console.log('Skipping account, it is an asset account that already exists:', detail.additional_info.to_account);
                    continue;
                }
                await generateAccount(
                    `SEB ${detail.additional_info.to_account}`,
                    'expense',
                    { account_number: `${detail.additional_info.to_account}` }
                );
            }
        }


        count++;
    }
}

console.log('failed:', failed);

async function generateAccount(name, type, details) {
    const acc = {
        name,
        type,
        ...details
    };

    const res1 = await fetch('FIREFLY_BASE_URL/api/v1/accounts', {
        method: 'POST',
        body: JSON.stringify(acc),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIREFLY_AUTH}`,
        }
    })
    if (!res1.ok) {
        throw new Error(`Failed to create expense account: ${res1.statusText}`);
    }
}


