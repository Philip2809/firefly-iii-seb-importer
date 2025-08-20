const fs = require('fs');

const accounts = JSON.parse(fs.readFileSync('./data/accounts.json', 'utf8'));

for (const account of accounts) {
    let combinedDetails = [];
    fs.readdirSync(`./data/${account.id}/details`).forEach(file => {
        const data = fs.readFileSync(`./data/${account.id}/details/${file}`, 'utf8');
        try {
            const details = JSON.parse(data);
            combinedDetails = [...combinedDetails, details];
        } catch (parseError) {
            console.error(`Error parsing JSON from file ${account.id} ${file}:`, parseError);
            process.exit(1);
        }
    });

    fs.writeFileSync(`./data/${account.id}/details.json`, JSON.stringify(combinedDetails, null, 2));
    console.log(`Combined for account ${account.custom_name} total ${combinedDetails.length} details`);
    console.log('-----------------------------------')
}
