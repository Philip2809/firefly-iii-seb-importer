const { fetchSebFundsValue } = require("./seb-api");
const { fetchFireflyAccounts, updateFireflyAccount } = require('./firefly-api');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const magicalFireflyAccountId = "2715";

run();
async function run() {
    const funds = await fetchSebFundsValue();
    const totalValue = Object.values(funds).reduce((acc, fund) => acc + fund.value, 0);

    const fireflyAccounds = await fetchFireflyAccounts('asset');
    const fundAccount = fireflyAccounds.find(a => a.id === magicalFireflyAccountId);

    const balanceDiff = totalValue - Number(fundAccount.attributes.current_balance);
    const currentOpeningBalance = Number(fundAccount.attributes.opening_balance);
    console.log('Balance Diff: ', balanceDiff);
    const EPSILON = 0.1;
    if (Math.abs(balanceDiff) < EPSILON) {
        console.log('No new data to add');
        return;
    }
    const newOpeningBalance = currentOpeningBalance + balanceDiff;

    // filter out null values:
    Object.entries(fundAccount.attributes).forEach(([key, value]) => {
        if (value === null) delete fundAccount.attributes[key];
    })

    const updatedAccount = {
        ...fundAccount.attributes,
        opening_balance: newOpeningBalance.toString()
    };

    await updateFireflyAccount(magicalFireflyAccountId, updatedAccount);
    console.log('updated!');
}

