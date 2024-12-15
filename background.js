// Structure pour stocker les timers par site et par tab
const timers = {
    // tabId: {
    //    siteUrl: { timeLeft: number, timer: Timer, redirectUntil: timestamp }
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
                            }, timeLimit * 1000),
                            redirectUntil: null
                        };
                    }
                } else {
                    // Timer existe
                    const siteTimer = timers[tabId][matchedSite];
                    
                    // Vérifier si le timer est à 0 et si la période de redirection est active
                    if (siteTimer.timeLeft <= 0 && siteTimer.redirectUntil && Date.now() < siteTimer.redirectUntil) {
                        // Rediriger vers le premier site de redirection
                        if (redirectSites.length > 0) {
                            chrome.tabs.update(tabId, { url: redirectSites[0] });
                        }
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
        const { timeLimit, tabId, site } = message;
        
        if (!timers[tabId]) {
            timers[tabId] = {};
        }
        
        timers[tabId][site] = {
            timeLeft: timeLimit,
            timer: setInterval(() => {
                if (timers[tabId][site].timeLeft > 0) {
                    timers[tabId][site].timeLeft--;
                } else if (!timers[tabId][site].redirectUntil) {
                    // Définir la période de redirection de 5 minutes
                    timers[tabId][site].redirectUntil = Date.now() + (5 * 60 * 1000);
                }
            }, 1000),
            redirectUntil: null
        };
        
        sendResponse({ success: true });
    }
    
    if (message.action === 'getTimer') {
        const { tabId, url } = message;
        chrome.storage.local.get(['controlled'], (data) => {
            const controlledSites = data.controlled || [];
            const matchedSite = controlledSites.find(site => url.includes(site));
            
            if (matchedSite && timers[tabId] && timers[tabId][matchedSite]) {
                sendResponse({
                    timeLeft: Math.ceil(timers[tabId][matchedSite].timeLeft),
                    redirectUntil: timers[tabId][matchedSite].redirectUntil
                });
            } else {
                sendResponse({ timeLeft: undefined });
            }
        });
        return true;
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
