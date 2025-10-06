const { fetchFireflyTagTransactions, deleteFireflyTransaction, uploadTransaction, fireflyPurgeData } = require("./firefly-api");
const { fetchSebReserved } = require("./seb-api");

async function addReservedTransactions(sebAccount, fireflyAccount) {
    const reserved = await fetchSebReserved(sebAccount.id);
    const reservedParsed = reserved.data.reserved_amounts.map(transaction => ({
        type: 'withdrawal',
        source_id: fireflyAccount.id,
        destination_name: "Cash account",

        description: 'RESERVED ' + transaction.descriptive_text,
        date: transaction.transaction_date,
        amount: transaction.amount.amount.replace('-', ''),
        currency_code: "SEK",

        tags: ['RESERVED'],
    }));
    if (!reservedParsed.length) {
        console.log('No reserved transactions for account', sebAccount.bban);
        return;
    }
    console.log('Uploading reserved transactions for account', sebAccount.bban, 'count:', reservedParsed.length);
    for (const transaction of reservedParsed) {
        console.log('Uploading', transaction.description);
        await uploadTransaction(transaction);
    }
    console.log('Done uploading reserved transactions for account', sebAccount.bban);
}

async function removeReservedTransactions() {
    const data = await fetchFireflyTagTransactions('RESERVED');
    const ids = data.map(t => t.id);
    for (const id of ids) {
        await deleteFireflyTransaction(id)
    }
    await fireflyPurgeData();
}

module.exports = {
    removeReservedTransactions,
    addReservedTransactions
}
