///////////////////// REPLACE THESE VALUES /////////////////////
const COOKIE = ``.trim();
const ORGANIZATION_ID = '';
const USER_AGENT = '';
const FIREFLY_AUTH = '';
////////////////////////////////////////////////////////////////

const HEADERS = {
    'Host': 'apps.seb.se',
    'User-Agent': USER_AGENT,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Content-Type': 'application/json',
    'organization-id': ORGANIZATION_ID,
    'ADRUM': 'isAjax:true',
    'Connection': 'keep-alive',
    'Referer': 'https://apps.seb.se/cps/payments/accounts/',
    'Cookie': COOKIE,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'TE': 'Trailers'
};

module.exports = {
    HEADERS,
    ORGANIZATION_ID,
    FIREFLY_AUTH
};