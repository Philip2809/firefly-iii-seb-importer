const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('./.creds.json', 'utf8'));
const fireflyConfig = JSON.parse(fs.readFileSync('./.firefly.json', 'utf8'));
const FIREFLY_AUTH = fireflyConfig.fireflyAuthToken;
const FIREFLY_BASE_URL = fireflyConfig.fireflyBaseUrl;
const COOKIE = creds.cookie;
const ORGANIZATION_ID = creds.orgId;
const USER_AGENT = creds.userAgent;

const SEB_HEADERS = {
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

const FIREFLY_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${FIREFLY_AUTH}`,
}

module.exports = {
    SEB_HEADERS,
    ORGANIZATION_ID,

    FIREFLY_BASE_URL,
    FIREFLY_HEADERS,
    FIREFLY_AUTH
};