const { assetAccountsMap } = require("../vars")


function generateTransferTransaction(fromAcc, toAcc, transaction) {
    return {
        type: 'transfer',
        source_id: assetAccountsMap.get(fromAcc),
        destination_id: assetAccountsMap.get(toAcc),

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
    generateTransferTransaction
}




