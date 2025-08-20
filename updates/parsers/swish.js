const { revenueAccountsMap, expenseAccountsMap, assetAccountsMap } = require("../vars");

function generateSwishTransaction(account, transaction, detail) {
    let base;
    if (transaction.credit_debit_indicator === 'CREDIT') {
        // Credit, deposit
        base = {
            type: 'deposit',
            description: `Swish from ${detail?.additional_info?.sender_name || detail?.additional_info?.senders_name_address || transaction.descriptive_text}`,
            destination_id: assetAccountsMap.get(account.bban)
        }
        let swishKey = `SWISH-${detail?.additional_info?.sender_swish_number || transaction.descriptive_text}`;
        if (revenueAccountsMap.has(swishKey)) {
            base.source_id = revenueAccountsMap.get(swishKey);
        }
        else {
            base.source_name = `${detail?.additional_info?.senders_name_address || transaction.descriptive_text} (Swish)`
        }
    } else {
        // Debit, withdrawal
        base = {
            type: 'withdrawal',
            description: `Swish to ${detail?.additional_info?.receiver_name || detail?.additional_info?.recipients_name || transaction.descriptive_text}`,
            source_id: assetAccountsMap.get(account.bban)
        }
        let swishKey = `SWISH-${detail?.additional_info?.receiver_swish_number || transaction.descriptive_text}`;
        if (expenseAccountsMap.has(swishKey)) {
            base.destination_id = expenseAccountsMap.get(swishKey);
        } else {
            base.destination_name = `${detail?.additional_info?.recipients_name || transaction.descriptive_text} (Swish)`
        }
    }

    if (detail?.additional_info?.message) {
        base.description = `Swish: "${detail.additional_info.message}"`;
    }

    return {
        ...base,

        date: `${transaction.entry_date_time}+00:00`,
        amount: transaction.transaction_amount.amount.replace('-', ''),
        currency_code: "SEK",

        notes: `
Message1: ${transaction.message1} \n
${transaction.message3 ? `Message3: ${transaction.message3}` : ''} \n
${detail?.additional_info?.swish_reference_id ? `Swish Reference ID: ${detail?.additional_info?.swish_reference_id} \n` : ''}
`,
        interest_date: transaction.value_date,
        process_date: transaction.posting_date,
    }
}

module.exports = {
    generateSwishTransaction,
};
