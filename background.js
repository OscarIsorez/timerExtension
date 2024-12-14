
// background.js
const timers = {};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        chrome.storage.local.get(['controlled', 'redirect'], (data) => {
            const controlledSites = data.controlled || [];
            const redirectSites = data.redirect || [];

            if (controlledSites.some(site => tab.url.includes(site))) {
                const timeLimit = parseInt(prompt('Combien de temps souhaitez-vous passer sur ce site ? (en minutes)'), 10);
                if (!isNaN(timeLimit) && timeLimit > 0) {
                    timers[tabId] = setTimeout(() => {
                        if (redirectSites.length > 0) {
                            chrome.tabs.update(tabId, { url: redirectSites[0] });
                            setTimeout(() => {
                                chrome.tabs.update(tabId, { url: redirectSites[0] });
                            }, 5 * 60 * 1000);
                        }
                    }, timeLimit * 60 * 1000);
                }
            }
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (timers[tabId]) {
        clearTimeout(timers[tabId]);
        delete timers[tabId];
    }
});