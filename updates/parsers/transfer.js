const { assetAccountsMap } = require("../vars")
const crypto = require('crypto');

function generateTransferTransaction(fromAcc, toAcc, transaction, matchTransaction, standingTransfer) {
    console.log('Generating transfer', fromAcc, '->', toAcc, transaction.descriptive_text, transaction.transaction_amount.amount.replace('-', ''));
    console.log('full', transaction);
    console.log('hash', crypto.createHash('sha256').update(transaction.id).digest('hex'));
    const hashes = [crypto.createHash('sha256').update(transaction.id).digest('hex')];
    if (matchTransaction) hashes.push(crypto.createHash('sha256').update(matchTransaction.id).digest('hex'));
    return {
        type: 'transfer',
        source_id: assetAccountsMap.get(fromAcc),
        destination_id: assetAccountsMap.get(toAcc),

        description: standingTransfer ? standingTransfer.info : transaction.descriptive_text,
        date: `${transaction.entry_date_time}+00:00`,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",
        external_id: hashes.join('|'),

        notes: `

${transaction.exchange_rate ? `Exchange rate: ${transaction.exchange_rate} \n` : ''}
`,
        book_date: transaction.value_date,
        interest_date: transaction.posting_date,
        process_date: `${transaction.entry_date_time}+00:00`,
    }
}

module.exports = {
    generateTransferTransaction
}




