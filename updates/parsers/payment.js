const { assetAccountsMap } = require('../vars');
const crypto = require('crypto');

function generatePaymentTransaction(account, destAccountId, transaction, detail) {
    return {
        id: transaction.id,
        type: 'withdrawal',
        source_id: assetAccountsMap.get(account.bban),
        destination_id: destAccountId,
        description: detail.additional_info.own_note || detail.additional_info.recipients_name,
        
        date: `${transaction.entry_date_time}+00:00`,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",

        external_id: crypto.createHash('sha256').update(transaction.id).digest('hex'),

        notes: `

Message1: ${transaction.message1} \n
OCR: ${detail.additional_info.ocr_message} \n
`,
        book_date: transaction.value_date,
        interest_date: transaction.posting_date,
        process_date: `${transaction.entry_date_time}+00:00`,
    }
}

module.exports = {
    generatePaymentTransaction
}
