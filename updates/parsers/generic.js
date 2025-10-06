const { assetAccountsMap } = require('../vars');
const crypto = require('crypto');

function generateGenericTransaction(account, transaction) {
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
        const entry_date = new Date(`${transaction.entry_date_time}+00:00`);
        const purchase_date = new Date(transaction.purchase_date || transaction.value_date);
        purchase_date.setHours(entry_date.getHours());
        purchase_date.setMinutes(entry_date.getMinutes());
        purchase_date.setSeconds(entry_date.getSeconds());
        purchase_date.setMilliseconds(entry_date.getMilliseconds());
        base = {
            ...base,
            payment_date: purchase_date.toISOString(),
        }
    }

    return {
        ...base,

        description: transaction.descriptive_text,
        date: base.payment_date || transaction.value_date,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",
        external_id: crypto.createHash('sha256').update(transaction.id).digest('hex'),

        notes: `

${transaction.exchange_rate ? `Exchange rate: ${transaction.exchange_rate} \n` : ''}
`,
        book_date: transaction.value_date,
        interest_date: transaction.posting_date,
        process_date: `${transaction.entry_date_time}+00:00`,
    }
}

module.exports = {
    generateGenericTransaction
}
