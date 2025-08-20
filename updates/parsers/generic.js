const { assetAccountsMap } = require('../vars');

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
${transaction.message3 ? `Message3: ${transaction.message3}` : ''} \n
${transaction.exchange_rate ? `Exchange rate: ${transaction.exchange_rate} \n` : ''}
`,
        interest_date: transaction.value_date,
        process_date: transaction.posting_date,
    }
}

module.exports = {
    generateGenericTransaction
}
