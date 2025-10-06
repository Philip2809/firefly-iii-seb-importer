





const { KIVRA_HEADERS } = require('./config.js');


async function fetchKivraReceipts() {
    console.log('Fetching Kivra receipts...');
    const res = await fetch('https://bff.kivra.com/graphql', {
        method: 'POST',
        headers: KIVRA_HEADERS,
        body: JSON.stringify(
            [{"operationName":"Receipts","query":"query Receipts($search: String, $limit: Int, $offset: Int) {\n  receiptsV2(search: $search, limit: $limit, offset: $offset) {\n    __typename\n    total\n    offset\n    limit\n    list {\n      ...baseDetailsFields\n    }\n  }\n}\n\nfragment baseDetailsFields on ReceiptBaseDetails {\n  __typename\n  key\n  purchaseDate\n  totalAmount {\n    formatted\n  }\n  attributes {\n    isCopy\n    isExpensed\n    isReturn\n    isTrashed\n  }\n  store {\n    name\n    logo {\n      publicUrl\n    }\n  }\n  attachments {\n    id\n    type\n    name\n  }\n  accessInfo {\n    owner {\n      isMe\n      name\n    }\n  }\n}","variables":{"limit":20,"offset":0,"search":null}},{"operationName":"ReceiptSenders","query":"query ReceiptSenders {\n  receiptSenders(include: all) {\n    list {\n      key\n      name\n      logo {\n        publicUrl\n      }\n      isRejected\n      userIdentifiers\n      numberOfReceipts\n    }\n    total\n  }\n}"},{"operationName":"TokenizedCards","query":"query TokenizedCards {\n  tokenizedCards {\n    total\n    list {\n      id\n      issuerName\n      cardTypeId\n      cardNumber\n      expiryYear\n      expiryMonth\n      isExpired\n    }\n  }\n}"}]
        )
    });
    console.log('Response status:', res.status);
    if (!res.ok) {
        throw new Error(`Failed to fetch accounts: ${res.statusText}`);
    }
    const data = await res.json();
    return data;
    console.log(data);
    // save data to file for inspection
    const fs = require('fs');
    fs.writeFileSync('./kivra-accounts.json', JSON.stringify(data, null, 2));
    console.log('Saved accounts data to kivra-accounts.json');
}


// fetchKivraReceipts();
module.exports = {
    fetchKivraReceipts,
}


