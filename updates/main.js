const { fetchFireflyAccounts, fetchFireflyTransactions, uploadTransaction } = require("./firefly-api");
const { generateGenericTransaction } = require("./parsers/generic");
const { parseTransactions } = require("./parsers/parser");
const { generateTransferTransaction } = require("./parsers/transfer");
const { fetchSebAccounts, fetchSebTransactions, fetchSebTransactionDetails } = require("./seb-api");
const { assetAccountsMap, invoices } = require("./vars");
const standingTransfers = require('./.standing-transfers.json');
const crypto = require('crypto');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


const readline = require('readline');
const { addReservedTransactions, removeReservedTransactions } = require("./reserved");
const { upcomingTransactions } = require("./upcoming");

// Create an interface for input and output
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

const sebIdToFireflyAccountMap = new Map();
const transferTransactions = new Map(); // sebAccound --> 180/182 transactions
const alreadyHandeledIds = new Set(); // Ids of transactions we can parse as transfers

run();
async function run() {
    await removeReservedTransactions();
    const sebAccounts = await fetchSebAccounts();
    const fireflyAssetAccounts = await fetchFireflyAccounts('asset');

    // Verify that each seb account has a corresponding firefly account
    for (const sebAccount of sebAccounts) {
        if (process.argv[2] && !process.argv.includes(sebAccount.bban)) continue; // Only process the account given as argument
        const fireflyAccount = fireflyAssetAccounts.find(fireflyAccount => fireflyAccount.attributes.iban === sebAccount.iban)
        // If no matching account found, throw an error for now, later we can make so that is creates the account etc etc.
        if (!fireflyAccount) throw new Error('No matching Firefly account found for SEB account with IBAN: ' + sebAccount.iban);

        console.log(`Found matching Firefly account for SEB account with IBAN: ${sebAccount.iban}`);
        sebIdToFireflyAccountMap.set(sebAccount, fireflyAccount);
        assetAccountsMap.set(sebAccount.bban, fireflyAccount.id);
    }

    fireflyAssetAccounts.forEach(fireflyAccount => {
        assetAccountsMap.set(fireflyAccount.attributes.account_number, fireflyAccount.id);
    });

    console.log('All SEB accounts have a matching Firefly account');
    console.log('------------------------------------');
    const uploadTransactions = [];

    for (const [sebAccount, fireflyAccount] of sebIdToFireflyAccountMap.entries()) {
        console.log(`SEB Account ID: ${sebAccount.id}, Firefly Account ID: ${fireflyAccount.id}, IBAN: ${fireflyAccount.attributes.iban}`);

        const sebTransactions = (await fetchSebTransactions(sebAccount.id, null, 200))
        const fireflyTransactions = await fetchFireflyTransactions(fireflyAccount.id, 200);
        const alreadyHandeledHashes = new Set();
        fireflyTransactions.forEach(t => t.attributes.transactions.forEach(tx => {
            tx.external_id?.split('|').forEach(id => alreadyHandeledHashes.add(id));
        }));

        console.log(alreadyHandeledHashes);
        let transactionsSinceLast = sebTransactions.transactions.filter(transaction => {
            const hash = crypto.createHash('sha256').update(transaction.id).digest('hex');
            return !alreadyHandeledHashes.has(hash);
        })

        // filter stuff out before the change of system
        const changeDate = new Date('2025-09-29T12:00:00').getTime();
        transactionsSinceLast = transactionsSinceLast.filter(t => new Date(t.entry_date_time).getTime() > changeDate);

        // TODO: rewrite this system; fetch 200 from firefly and seb, compare the two lists to find the transactions that are missing in firefly
        /*const lastTransaction = await fetchFireflyTransactions(fireflyAccount.id, 1);
        const lastTransactionDate = lastTransaction[0]?.attributes?.transactions[0]?.process_date;
        if (!lastTransactionDate) {
            console.log('No last transaction date found, this means it is a new account correct????', sebAccount.bban);
            const answer = await askQuestion('Is this a new account/empty account? (y/n): ');
            if (answer.toLowerCase() !== 'y') {
                console.log('Aborting, exiting...');
                rl.close();
                return;
            }
            emptyAcc = true;
        }
        const lastTransactionAmount = lastTransaction[0]?.attributes?.transactions[0]?.amount;

        const transactionsSinceLast = [];
        let tries = 0;
        let toFetchMore = true;
        let pagingCursor = null;
        while (toFetchMore) {
            if (tries > 3) throw new Error('Too many tries to fetch transactions, something is wrong..');
            tries++;
            const transactions = await fetchSebTransactions(sebAccount.id, pagingCursor, 200);
            const lastTransactionMatchIndex = transactions.transactions.findIndex(t =>
                new Date(lastTransactionDate).getTime() === new Date(`${t.entry_date_time}+00:00`).getTime() &&
                Number(lastTransactionAmount) === Number(t.transaction_amount.amount.replace('-', ''))
            );

            if (emptyAcc) {
                transactionsSinceLast.push(...transactions.transactions);
                toFetchMore = false;
                continue;
            }

            if (lastTransactionMatchIndex === -1) {
                transactionsSinceLast.push(...transactions.transactions);
                pagingCursor = transactions.nextPagingCursor;
                continue;
            }

            transactionsSinceLast.push(...transactions.transactions.splice(0, lastTransactionMatchIndex));
            toFetchMore = false;
        }*/

        // Now we have all transactions to upload!
        transactionsSinceLast.forEach(transaction => {
            const hash = crypto.createHash('sha256').update(transaction.id).digest('hex');
            console.log('Transaction to upload:', transaction.entry_date_time, transaction.transaction_amount.amount, transaction.transaction_type.code, transaction.descriptive_text, hash);
        })
        const diffSum = transactionsSinceLast.reduce((acc, t) => {
            return acc + Number(t.transaction_amount.amount);
        }, 0);
        const verifyBalance = Number(fireflyAccount.attributes.current_balance) + diffSum;
        const EPSILON = 0.00001; // 0.01 öre
        if (Math.abs(verifyBalance - Number(sebAccount.balance.amount)) > EPSILON) {
            console.log(transactionsSinceLast, fireflyAccount);
            console.log('MISSING STUFF:', verifyBalance - Number(sebAccount.balance.amount));
            transactionsSinceLast.forEach(t => {
                console.log(t.entry_date_time, t.transaction_amount.amount, t.transaction_type.code, t.descriptive_text);
            });
            throw new Error(`Balance mismatch for account ${fireflyAccount.attributes.iban}: Firefly balance ${fireflyAccount.attributes.current_balance}, SEB balance ${sebAccount.balance.amount}, diff sum ${diffSum}, verify balance ${verifyBalance}`);
        }

        transferTransactions.set(sebAccount, transactionsSinceLast.filter(t => [180, 182, 184].includes(t.transaction_type.code)));
        const transactionsToParse = transactionsSinceLast.filter(t => ![180, 182, 184].includes(t.transaction_type.code));

        console.log(`Found ${transactionsToParse.length} transactions to upload for account ${fireflyAccount.attributes.iban}`);

        uploadTransactions.push(...await parseTransactions(sebAccount, transactionsToParse));
    }

    for (const [sebAccount, transactions] of transferTransactions.entries()) {
        if (transactions.length === 0) continue; // Skip if no transactions to process

        console.log(`Processing ${transactions.length} transfer transactions for SEB account: ${sebAccount.bban}`);

        for (const transaction of transactions) {
            if (alreadyHandeledIds.has(transaction.id)) continue; // Skip if already handeled as a match
            let toAccountNumber, standingTransfer;
            if (transaction.transaction_type.code === 182) {
                if (!transaction.link) throw new Error('182 transfer should have a link for details!');
                const details = await fetchSebTransactionDetails(transaction);
                toAccountNumber = details.additional_info.to_account;
            } else if (transaction.transaction_type.code === 184) {
                standingTransfer = standingTransfers.find(st => 
                    st.text === transaction.descriptive_text &&
                    st.amount === Number(transaction.transaction_amount.amount.replace('-', ''))
                );
                if (!standingTransfer) throw new Error('Found a standing transfer; but it was not defined in the .standing-transfers.json file!');
                toAccountNumber = standingTransfer.to_account;
            } else continue; // I can only link 182 and 184 transactions

            const toSebAccount = sebAccounts.find(sa => sa.bban === toAccountNumber);
            // if (!toSebAccount) throw new Error('Expected there to be a seb accound!')
            const transactionsToSearch = transferTransactions.get(toSebAccount) || [];
            const possbileMatches = transactionsToSearch.filter(t =>
                t.value_date === transaction.value_date &&
                t.transaction_type.code === (transaction.transaction_type.code === 184 ? 184 : 180) && // 184 --> 184, 182 --> 180
                t.transaction_amount.amount === transaction.transaction_amount.amount.replace('-', '')
            );

            if (possbileMatches.length === 0 && !standingTransfer) {
                console.log(`No matching transactions found for ${transaction.id}, skipping...`);
                continue;
            }

            let match = possbileMatches.find(t =>
                t.entry_date_time === transaction.entry_date_time
            )

            if (!match && possbileMatches.length > 0) {
                console.log('++++++++++++++++++++');
                console.log('Could not auto match transfer. There is', possbileMatches.length, 'possible matches.');
                console.log('Original transaction:', transaction.descriptive_text);
                console.log(transaction.message1);
                console.log(transaction.entry_date_time);
                console.log('--------------------------------');
                possbileMatches.forEach((t, i) => {
                    console.log('Possbile match', i);
                    console.log('From', sebAccount.custom_name, 'to', toAccountNumber);
                    console.log('Descriptive text:', t.descriptive_text);
                    console.log('Message:', t.message1);
                    console.log('Spesific date and diff', t.entry_date_time, new Date(t.entry_date_time).getTime() - new Date(transaction.entry_date_time).getTime());
                    console.log('---------------------------------');
                })
                console.log('++++++++++++++++++++');
                const answer = await askQuestion('What index to use: (n for none)');
                if (answer === 'n') {
                    console.log('Skipping this transaction, no match found.');
                    continue;
                }

                const index = parseInt(answer);
                if (possbileMatches[index]) match = possbileMatches[index];
            }

            if (!match && !standingTransfer) {
                console.log('If no match at this point, then something is wrong. Skipping this transaction.');
                continue;
            } else if (standingTransfer) {
                alreadyHandeledIds.add(transaction.id);
                uploadTransactions.push(generateTransferTransaction(sebAccount.bban, toAccountNumber, transaction, undefined, standingTransfer))
                continue;
            }

            alreadyHandeledIds.add(match.id);
            alreadyHandeledIds.add(transaction.id);

            uploadTransactions.push(generateTransferTransaction(sebAccount.bban, toAccountNumber, transaction, match, standingTransfer))
        }
    }

    // Rest 180 transactions
    for (const [sebAccount, transactions] of transferTransactions.entries()) {
        const restTransactions = transactions.filter(t => !alreadyHandeledIds.has(t.id));
        if (restTransactions.length === 0) continue; // Skip if no transactions to process
        console.log(`Processing ${restTransactions.length} rest 180 transactions for SEB account: ${sebAccount.custom_name}`);
        uploadTransactions.push(...restTransactions.map(t => generateGenericTransaction(sebAccount, t)));
    }

    // Reserved stuff
    for (const [sebAccount, fireflyAccount] of sebIdToFireflyAccountMap.entries()) {
        await addReservedTransactions(sebAccount, fireflyAccount);
        await upcomingTransactions(sebAccount);
    }

    console.log('Transactions to upload:', uploadTransactions.length);
    if (uploadTransactions.length === 0) {
        console.log('Nothing needs to be done!')
        rl.close();
        return;
    }

    // Ask user to check transactions before uploading
    uploadTransactions.forEach(t => {
        console.log(t.type, t.description, t.amount, new Date(t.date).toLocaleString('se-SV'), new Date(t.process_date).toLocaleString('se-SV'));
        console.log('full', t);
    })

    const answer = await askQuestion('Do you want to upload these transactions? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
        console.log('Aborting upload, exiting...');
        rl.close();
        return;
    }

    console.log('Uploading transactions to Firefly...');
    for (const transaction of uploadTransactions) {
        const invoice = invoices.get(transaction.id);
        delete transaction.id; // Remove id for firefly upload
        await uploadTransaction(transaction, invoice);
    }

    console.log('all is done!')
    rl.close();
}