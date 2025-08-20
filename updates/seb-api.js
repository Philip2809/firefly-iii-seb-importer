const { SEB_HEADERS, ORGANIZATION_ID } = require('./config.js');


async function fetchSebAccounts() {
    console.log('Fetching SEB accounts');
    const res = await fetch('https://apps.seb.se/ssc/payments/accounts/api/accounts', {
        headers: SEB_HEADERS
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch accounts: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Parsing accounts data, length:', data.data.active_accounts.length);
    return data.data.active_accounts;
}


async function fetchSebTransactions(sebAccountId, nextPagingCursor = null, rows = 5) {
    console.log('Fetching transactions from SEB, rows to fetch:', rows);
    const res = await fetch(`https://apps.seb.se/ssc/payments/accounts/api/accounts/${sebAccountId}/transactions/search`, {
        method: 'POST',
        headers: SEB_HEADERS,
        body: JSON.stringify({
            "filters": {
                "type": 0
            },
            "maxRows": rows,
            "pagingCursor": nextPagingCursor
        })
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch transactions: ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Found', data.account_transactions.length, 'transactions!');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second to not be too spammy
    return {
        transactions: data.account_transactions,
        nextPagingCursor: data.paging_parameters.cursor
    };
}

async function fetchSebTransactionDetails(transaction) {
    const res = await fetch('https://apps.seb.se/ssc/payments/accounts/api/accounts/transactionDetails', {
        method: 'POST',
        headers: SEB_HEADERS,
        body: JSON.stringify(transaction)
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch details for transaction! ${transaction.id} ${res.statusText}`);
    }
    const data = await res.json();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second to not be too spammy
    return data;
}

async function fetchSebTransactionInvoice(account, transaction) {
    console.log('Fetching invoice details for transaction');
    const res = await fetch('https://apps.seb.se/ssc/payments/accounts/api/einvoicepdf/details', {
        method: 'POST',
        headers: {
            ...SEB_HEADERS,
            'Client-id': ORGANIZATION_ID,
            'bban': account.bban,
            'Origin': 'https://apps.seb.se',
            'link': transaction.link
        }
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch invoice details for transaction ${transaction.id}: ${res.statusText}`);
    }
    const data = await res.json();

    console.log('Got invoice details, fetching invoice...');
    const invoiceUrl = data.additional_info.e_invoice_url;
    const ticket_data = data.additional_info.ticket_data;
    const resInvoice = await fetch(invoiceUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'ticket': ticket_data
        })
    })
    console.log('Response status (invoice pdf):', resInvoice.status);
    if (!resInvoice.ok) {
        throw new Error(`Failed to fetch invoice for transaction ${transaction.id}: ${resInvoice.statusText}`);
    }
    console.log('Invoice fetched!');
    const invoice = await resInvoice.bytes()
    return invoice;
}

async function fetchSebFundsValue() {
    const res = await fetch('https://apps.seb.se/ssc/portfolio-overview-backend/ibp/api/v1/accounts/market-values', {
        headers: {
            ...SEB_HEADERS,
            Referer: 'https://apps.seb.se/cps/savings-and-investments/overview/',
            'X-Channel': 'idp'
        },
    });

    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch funds value! ${res.statusText}`);
    }
    return await res.json();
}




module.exports = {
    fetchSebAccounts,
    fetchSebTransactions,
    fetchSebTransactionDetails,
    fetchSebTransactionInvoice,
    fetchSebFundsValue
}


