
let sebCreds = {};
const activeSebTabs = new Set();

function sebCredListener(details) {
    const SEB_cookie = details.requestHeaders.find(header => header.name.toLowerCase() === 'cookie')?.value;
    const SEB_orgId = details.requestHeaders.find(header => header.name.toLowerCase() === 'organization-id')?.value;
    const userAgent = details.requestHeaders.find(header => header.name.toLowerCase() === 'user-agent')?.value;

    sebCreds = {
        SEB_cookie: SEB_cookie || sebCreds.SEB_cookie,
        SEB_orgId: SEB_orgId || sebCreds.SEB_orgId,
        userAgent: userAgent || sebCreds.userAgent,
    }

    activeSebTabs.add(details.tabId);
    browser.browserAction.setBadgeBackgroundColor({ color: 'green' })
    browser.browserAction.setBadgeText({ text: 'OK' })
}

browser.browserAction.onClicked.addListener(() => {
    navigator.clipboard.writeText(JSON.stringify(sebCreds, null, 2))
});

browser.tabs.onRemoved.addListener((tab) => {
    activeSebTabs.delete(tab);

    if (activeSebTabs.size > 0) return;
    browser.browserAction.setBadgeText({ text: '' });
    sebCreds = {};
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!activeSebTabs.has(tabId)) return;
        if (changeInfo.status !== 'complete') return;
    if (changeInfo.url) return;

    activeSebTabs.delete(tabId);
    if (activeSebTabs.size > 0) return;
    browser.browserAction.setBadgeText({ text: '' });
    sebCreds = {};
});

function sebLogoutListener(details) {
    activeSebTabs.delete(details.tabId);

    if (activeSebTabs.size > 0) return;
    browser.browserAction.setBadgeText({ text: '' });
    sebCreds = {};
}

function createListeners() {
    browser.webRequest.onBeforeSendHeaders.addListener(
        sebCredListener,
        { urls: ['https://apps.seb.se/ssc/*'] },
        ["blocking", "requestHeaders"]
    );

    browser.webRequest.onBeforeSendHeaders.addListener(
        sebLogoutListener,
        { urls: ['https://id.seb.se/login/logged-out*'] },
        ["blocking"]
    );
};


// On startup
browser.webRequest.onBeforeSendHeaders.removeListener(sebCredListener);
browser.webRequest.onBeforeSendHeaders.removeListener(sebLogoutListener);
createListeners();
