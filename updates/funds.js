const { fetchSebFundsValue } = require("./seb-api");
const { fetchFireflyAccounts, uploadTransaction } = require('./firefly-api');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const magicalFireflyAccountId = "2715";

run();
async function run() {
    const funds = await fetchSebFundsValue();
    const totalValue = Object.values(funds).reduce((acc, fund) => acc + fund.value, 0);

    const fireflyAccounds = await fetchFireflyAccounts('asset');
    const fundAccount = fireflyAccounds.find(a => a.id === magicalFireflyAccountId);

    const balanceDiff = totalValue - Number(fundAccount.attributes.current_balance)
    console.log('Balance Diff: ', balanceDiff);
    const EPSILON = 0.1;
    if (Math.abs(balanceDiff) < EPSILON) {
        console.log('No new data to add');
        return;
    }

    let transaction;
    if (balanceDiff > 0) {
        // Add money to the accound
        transaction = {
            type: 'deposit',
            destination_id: magicalFireflyAccountId,
            source_name: 'SEB Fonder (Utveckling) (AUTO SCRIPT)'
        }
    } else {
        transaction = {
            type: 'withdrawal',
            source_id: magicalFireflyAccountId,
            destination_name: 'SEB Fonder (Utveckling) (AUTO SCRIPT)'
        }
    }

    const now = new Date();
    transaction = {
        ...transaction,
        description: 'Fondutveckling ' + now.toLocaleString('se-sv'),
        date: now.toISOString(),
        amount: Math.abs(balanceDiff),
        currency_code: "SEK",
        external_id: now.getTime(),
    }

    await uploadTransaction(transaction);
    console.log('Uploaded!')
}

