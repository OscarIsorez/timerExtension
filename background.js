// Structure pour stocker les timers par site et par tab
const timers = {
    // tabId: {
    //    siteUrl: { timeLeft: number, timer: Timer }
    // }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('url', tab.url);
    if (changeInfo.status === 'complete' && tab.url) {
        chrome.storage.local.get(['controlled', 'redirect', 'timeLimit'], (data) => {
            const controlledSites = data.controlled || [];
            const redirectSites = data.redirect || [];
            const matchedSite = controlledSites.find(site => tab.url.includes(site));

            if (matchedSite) {
                if (!timers[tabId] || !timers[tabId][matchedSite]) {
                    const timeLimit = data.timeLimit || 0;
                    if (timeLimit === 0) {
                        chrome.storage.local.set({
                            pendingUrl: tab.url,
                            pendingSite: matchedSite
                        }, () => {
                            chrome.tabs.update(tabId, {
                                url: chrome.runtime.getURL('timer.html')
                            });
                        });
                    } else {
                        // Initialiser le timer pour ce site spécifique
                        if (!timers[tabId]) {
                            timers[tabId] = {};
                        }
                        timers[tabId][matchedSite] = {
                            timeLeft: timeLimit,
                            timer: setTimeout(() => {
                                if (redirectSites.length > 0) {
                                    chrome.tabs.update(tabId, { url: redirectSites[0] });
                                }
                                delete timers[tabId][matchedSite];
                            }, timeLimit * 1000)
                        };
                    }
                }
            }
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (timers[tabId]) {
        Object.values(timers[tabId]).forEach(siteTimer => {
            clearTimeout(siteTimer.timer);
        });
        delete timers[tabId];
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setTimeLimit') {
        chrome.storage.local.set({ timeLimit: message.timeLimit });
        sendResponse({ success: true });
    }
    if (message.action === 'getTimer') {
        const tab = message.tabId;
        const url = message.url;

        chrome.storage.local.get(['controlled'], (data) => {
            const controlledSites = data.controlled || [];
            const matchedSite = controlledSites.find(site => url.includes(site));

            if (matchedSite && timers[tab] && timers[tab][matchedSite]) {
                sendResponse({
                    timeLeft: Math.ceil(timers[tab][matchedSite].timeLeft)
                });
            } else {
                sendResponse({ timeLeft: undefined });
            }
        });
        return true; // Keep the message channel open for async response
    }
});


setInterval(() => {
    Object.keys(timers).forEach(tabId => {
        Object.keys(timers[tabId]).forEach(site => {
            if (timers[tabId][site].timeLeft > 0) {
                timers[tabId][site].timeLeft--;
            }
        });
    });
}, 1000);

