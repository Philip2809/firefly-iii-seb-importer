const { FIREFLY_HEADERS, FIREFLY_BASE_URL } = require('./config.js');
const crypto = require('crypto');


async function fetchFireflyAccounts(type = 'all') {
    console.log('Fetching Firefly accounts, of type:', type);
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts?limit=10000&type=${type}`, {
        headers: FIREFLY_HEADERS
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch accounts: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Parsing accounts data, length:', data.data.length);
    return data.data;
}

async function fetchFireflyTransactions(fireflyAccountId, limit = 1) {
    console.log('Fetching transactions from firefly, items to fetch:', limit);
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts/${fireflyAccountId}/transactions?limit=${limit}`, {
        headers: FIREFLY_HEADERS,
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Found', data.data.length, 'transactions!');
    return data.data;
}

async function updateFireflyAccount(fireflyAccountId, data) {
    console.log('Updating firely account:', fireflyAccountId);
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts/${fireflyAccountId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: FIREFLY_HEADERS,
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to update firefly account: ${res.statusText}`);
    }
    return await res.json();
}

async function makeFireflyAccount(name, type, details) {
    const acc = {
        name,
        type,
        ...details
    };

    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/accounts`, {
        method: 'POST',
        body: JSON.stringify(acc),
        headers: FIREFLY_HEADERS
    })
    if (!res.ok) {
        throw new Error(`Failed to create firefly account: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data.id;
}

const fs = require('fs');
async function uploadTransaction(transaction, invoice) {
    const res = await fetch(`${FIREFLY_BASE_URL}/api/v1/transactions`, {
        method: 'POST',
        headers: FIREFLY_HEADERS,
        body: JSON.stringify({
            "error_if_duplicate_hash": true,
            "apply_rules": true,
            "fire_webhooks": !!invoice,
            "transactions": [transaction]
        })
    });
    if (!res.ok) {
        console.error('Error uploading transaction:', res.status, res.statusText);
        const errorData = await res.json();
        fs.appendFileSync('./.errors.txt', `Error uploading transaction: ${res.status} ${res.statusText}\nTransaction: ${JSON.stringify(transaction, null, 2)} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        console.error('Error data:', errorData);
        return;
    }
    const data = await res.json();
    console.log('Transaction uploaded:', data.data.id);
    fs.appendFileSync('./.success.txt', `Transaction uploaded: ${data.data.id}\n`);
    
    if (!invoice) return; // No invoice to upload
    await addAttachment(transaction, invoice, data.data.attributes.transactions[0].transaction_journal_id)
}

async function addAttachment(transaction, invoice, journal_id) {
    const hash = crypto.createHash('md5').update(JSON.stringify(transaction)).digest('hex');
    const attachment = {
        filename: `${hash}.pdf`,
        attachable_type: "TransactionJournal",
        attachable_id: journal_id
    };

    const resAttachment = await fetch(`${FIREFLY_BASE_URL}/api/v1/attachments`, {
        method: 'POST',
        headers: FIREFLY_HEADERS,
        body: JSON.stringify(attachment)
    });
    if (!resAttachment.ok) {
        console.error('Error creating attachment:', resAttachment.status, resAttachment.statusText);
        const errorData = await resAttachment.json();
        fs.appendFileSync('./errors.txt', `Error creating attachment: ${resAttachment.status} ${resAttachment.statusText}\nAttachment: ${JSON.stringify(attachment, null, 2)} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        return;
    }

    const attachmentData = await resAttachment.json();
    console.log('Attachment created:', attachmentData.data.id);
    const attachmentId = attachmentData.data.id;

    const resUpload = await fetch(`${FIREFLY_BASE_URL}/api/v1/attachments/${attachmentId}/upload`, {
        method: 'POST',
        headers: {
            ...FIREFLY_HEADERS,
            'Content-Type': 'application/octet-stream',
        },
        body: invoice
    });
    if (!resUpload.ok) {
        console.error('Error uploading attachment:', resUpload.status, resUpload.statusText);
        const errorData = await resUpload.json();
        fs.appendFileSync('./errors.txt', `Error uploading attachment: ${resUpload.status} ${resUpload.statusText}\nAttachment ID: ${attachmentId} ERROR: ${JSON.stringify(errorData, null, 2)}\n\n`);
        return;
    }

    console.log('Attachment uploaded successfully:', attachmentId);
    return attachmentId;
}


module.exports = {
    makeFireflyAccount,
    fetchFireflyAccounts,
    fetchFireflyTransactions,
    uploadTransaction,
    updateFireflyAccount
}


