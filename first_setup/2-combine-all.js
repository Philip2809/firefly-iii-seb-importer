const fs = require('fs');

const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));

for (const account of accounts) {
    let combinedTransactions = [];
    fs.readdirSync(`./data/${account.id}/transactions`).forEach(file => {
        const data = fs.readFileSync(`./data/${account.id}/transactions/${file}`, 'utf8');
        try {
            const transactions = JSON.parse(data);
            combinedTransactions = [...combinedTransactions, ...transactions.account_transactions];
        } catch (parseError) {
            console.error(`Error parsing JSON from file ${account.id} ${file}:`, parseError);
            process.exit(1);
        }
    });

    fs.writeFileSync(`./data/${account.id}/transactions.json`, JSON.stringify(combinedTransactions, null, 2));
    console.log(`Combined for account ${account.custom_name} total ${combinedTransactions.length} transactions`);
    console.log('-----------------------------------')
}
console.log()
console.log('Please verify that the total transaction count matches the number of transactions on your account.');
console.log('Download the CSV and make sure the total rows is the number you got -1 (because of the csv header)');
