const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('./.creds.json', 'utf8'));
const USER_AGENT = creds.userAgent;

const COOKIE = creds.SEB_cookie;
const ORGANIZATION_ID = creds.SEB_orgId;
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

const KIVRA_AUTH = creds.KIVRA_auth;
const KIVRA_ACTOR_KEY = creds.KIVRA_actorKey;
const KIVRA_HEADERS = {
    "Host": "bff.kivra.com",
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
    "Accept-Language": "sv",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "content-type": "application/json",
    "authorization": KIVRA_AUTH,
    "x-actor-key": KIVRA_ACTOR_KEY,
    "x-actor-type": "user",
    "x-session-actor": `user_${KIVRA_ACTOR_KEY}`,
    "Origin": "https://inbox.kivra.com",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Priority": "u=4",
    "TE": "trailers"
}

const fireflyConfig = JSON.parse(fs.readFileSync('./.firefly.json', 'utf8'));
const FIREFLY_AUTH = fireflyConfig.fireflyAuthToken;
const FIREFLY_BASE_URL = fireflyConfig.fireflyBaseUrl;
const FIREFLY_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${FIREFLY_AUTH}`,
}

module.exports = {
    SEB_HEADERS,
    ORGANIZATION_ID,

    KIVRA_HEADERS,

    FIREFLY_BASE_URL,
    FIREFLY_HEADERS,
    FIREFLY_AUTH
};