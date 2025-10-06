

const { fetchFireflyAccounts, makeFireflyAccount } = require('../firefly-api');
const { fetchSebTransactionDetails, fetchSebTransactionInvoice } = require('../seb-api');
const { assetAccountsMap, expenseAccountsMap, revenueAccountsMap, invoices } = require('../vars');
const { generateGenericTransaction } = require('./generic');
const { generatePaymentTransaction } = require('./payment');
const { generateSwishTransaction } = require('./swish');

async function parseReceipt(account, transaction, kivraData) {
    const receipts = kivraData.data.receiptsV2.list;

    const transactionPurchaseDate = new Date(transaction.purchase_date);

    for (const receipt of receipts) {
        receiptDate = new Date(receipt.purchaseDate);
        if (transactionPurchaseDate.toLocaleDateString('se-sv') !== receiptDate.toLocaleDateString('se-sv')) continue;
        if (Number(receipt.totalAmount.formatted.slice(0, -3).replace(',', '.')) !== Number(transaction.transaction_amount.amount.replace('-', ''))) continue;
        
        
    }

}


module.exports = {
    parseReceipt
}


