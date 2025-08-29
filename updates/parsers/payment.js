const { assetAccountsMap } = require('../vars');

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

module.exports = {
    generatePaymentTransaction
}
