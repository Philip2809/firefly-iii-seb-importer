const { fetchFireflyAccounts, makeFireflyAccount } = require('../firefly-api');
const { fetchSebTransactionDetails, fetchSebTransactionInvoice } = require('../seb-api');
const { assetAccountsMap, expenseAccountsMap, revenueAccountsMap, invoices } = require('../vars');
const { generateGenericTransaction } = require('./generic');
const { generatePaymentTransaction } = require('./payment');
const { generateSwishTransaction } = require('./swish');

async function parseTransactions(account, transactions) {

    const parsed = [];
    console.log(transactions.length, 'transactions to parse');
    for (const transaction of transactions) {
        switch (transaction.transaction_type.code) {
            case 41: // Card purchase
            case 71: // Card foreign purchase
            case 990: // Other
            case 10: // Direct debit
            case 184: // Standing transfer
                console.log('Proccesing generic transaction...');
                parsed.push(generateGenericTransaction(account, transaction));
                break;

            case 141: // Swish
                console.log('Proccesing Swish transaction...');
                if (!transaction.link) throw new Error('Swish transaction does not have a link, cannot fetch details');
                await ensureAccountsLoaded();
                const swishDetail = await fetchSebTransactionDetails(transaction);
                parsed.push(generateSwishTransaction(account, transaction, swishDetail));
                break;

            case 82: // Payment
                console.log('Proccesing payment transaction...');
                if (!transaction.link) throw new Error('Swish transaction does not have a link, cannot fetch details');
                if (transaction.credit_debit_indicator === 'CREDIT') throw new Error('Payment should be a debit transaction!');
                
                await ensureAccountsLoaded();
                const paymentDetail = await fetchSebTransactionDetails(transaction);
                
                let destAccountId;
                const accountKey = `${paymentDetail.additional_info.payment_type}-${paymentDetail.additional_info.bg_pg_number}`;
                if (!expenseAccountsMap.has(accountKey)) destAccountId = await makeFireflyAccount(
                    `${paymentDetail.additional_info.recipients_name} (${accountKey})`,
                    'expense', { account_number: accountKey }
                ); else destAccountId = expenseAccountsMap.get(accountKey);
                if (!destAccountId) throw new Error('Something really really bad')

                
                // Invoice handling & parsing
                let invoice;
                if (paymentDetail.additional_info.einvoiceUrl) invoice = await fetchSebTransactionInvoice(account, transaction);
                parsed.push(generatePaymentTransaction(account, destAccountId, transaction, detail));
                if (invoice) invoices.set(transaction.id, invoice);
                break;

            case 1301: // Funds sell (CREDIT)
                console.log('Proccesing funds sell transaction...');
                const fundsSell = generateGenericTransaction(account, transaction);
                fundsSell.source_name = 'SEB FONDER (1301/1302)';
                parsed.push(fundsSell);
                break;

            case 1302: // Funds purchase (DEBET)
                console.log('Proccesing funds purchase transaction...');
                const fundsPurchase = generateGenericTransaction(account, transaction);
                fundsPurchase.destination_name = 'SEB FONDER (1301/1302)';
                parsed.push(fundsPurchase);
                break;

            default:
                console.log('Unknown transaction type code:', transaction.transaction_type.code);
                break;
        }
    }

    return parsed;
}

async function ensureAccountsLoaded() {
    if (expenseAccountsMap.size > 0) return; // Already loaded

    const accounts = await fetchFireflyAccounts();
    const revenueAccounts = accounts.filter(account => account.attributes.type === 'revenue');
    const expenseAccounts = accounts.filter(account => account.attributes.type === 'expense');

    for (const account of revenueAccounts) {
        revenueAccountsMap.set(account.attributes.account_number || account.attributes.name, account.id);
    }
    for (const account of expenseAccounts) {
        expenseAccountsMap.set(account.attributes.account_number || account.attributes.name, account.id);
    }
}


module.exports = {
    parseTransactions
}
