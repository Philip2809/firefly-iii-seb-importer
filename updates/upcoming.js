const { fetchFireflyTagTransactions, deleteFireflyTransaction, uploadTransaction, fireflyPurgeData, fetchFireflyTransactions } = require("./firefly-api");
const { fetchSebUpcoming } = require("./seb-api");
const { assetAccountsMap } = require("./vars");
const crypto = require('crypto');

function parseUpcomingTransaction(transaction, upcomingFireflyAccountId) {
    return {
        type: 'withdrawal',
        source_id: upcomingFireflyAccountId,
        destination_name: "Cash account",

        description: transaction.recipient,
        date: transaction.payment_date,
        amount: Math.abs(transaction.amount.amount),
        currency_code: "SEK",

        tags: ['UPCOMING'],
    }
}

async function upcomingTransactions(sebAccount) {
    const upcomingFireflyAccountId = assetAccountsMap.get(`${sebAccount.bban}_INVOICES`);
    if (!upcomingFireflyAccountId) {
        console.log('No upcoming account mapped for account', sebAccount.bban);
        return;
    }

    const sebUpcoming = await fetchSebUpcoming(sebAccount.id);
    const sebUpcomingHashes = new Set();
    const fireflyUpcoming = await fetchFireflyTransactions(upcomingFireflyAccountId, 200);
    const fireflyUpcomingHashes = new Set(fireflyUpcoming.flatMap(t => t.attributes.transactions.map(tx => tx.external_id)));

    for (const transaction of sebUpcoming.data.upcoming_events) {
        const parsed = parseUpcomingTransaction(transaction, upcomingFireflyAccountId);
        const hash = crypto.createHash('sha256').update(JSON.stringify(transaction)).digest('hex');
        sebUpcomingHashes.add(hash);
        if (fireflyUpcomingHashes.has(hash)) {
            console.log('Skipping already handled upcoming transaction', parsed.description, parsed.date, parsed.amount);
            continue;
        }

        console.log('Uploading upcoming transaction', parsed.description, parsed.date, parsed.amount);
        await uploadTransaction({
            ...parsed,
            external_id: hash,
        });
    }

    for (const transaction of fireflyUpcoming) {
        const hash = transaction.attributes.transactions[0].external_id;
        if (sebUpcomingHashes.has(hash)) continue;
        console.log('Removing no longer upcoming transaction', transaction.attributes.description, transaction.attributes.date, transaction.attributes.amount);
        await deleteFireflyTransaction(transaction.id);
    }

    await fireflyPurgeData();
}

module.exports = {
    upcomingTransactions
}
