// Structure pour stocker les timers par site et par tab
const timers = {
    // tabId: {
    //    siteUrl: { timeLeft: number, timer: Timer, redirectUntil: timestamp }
    // }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        chrome.storage.local.get(['controlled', 'redirect'], (data) => {
            const controlledSites = data.controlled || [];
            const redirectSites = data.redirect || [];
            const matchedSite = controlledSites.find(site => tab.url.includes(site));

            if (matchedSite) {
                // Vérifier si un timer existe pour ce site
                if (!timers[tabId] || !timers[tabId][matchedSite]) {
                    // Pas de timer actif, rediriger vers timer.html
                    chrome.storage.local.set({
                        pendingUrl: tab.url,
                        pendingSite: matchedSite
                    }, () => {
                        chrome.tabs.update(tabId, {
                            url: chrome.runtime.getURL('timer.html')
                        });
                    });
                } else {
                    // Timer existe
                    const siteTimer = timers[tabId][matchedSite];

                    // Vérifier si le timer est à 0 et si la période de redirection est active
                    if (siteTimer.timeLeft <= 0 && siteTimer.redirectUntil && Date.now() < siteTimer.redirectUntil) {
                        // Rediriger vers le premier site de redirection
                        if (redirectSites.length > 0) {
                            let formattedUrl = formatUrl(redirectSites[0]);

                            chrome.tabs.update(tabId, { url: formattedUrl });
                        }
                    }
                }
            }
        });
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

                    // When timer hits 0
                    if (timers[tabId][site].timeLeft === 0) {
                        // Set redirect period
                        timers[tabId][site].redirectUntil = Date.now() + (5 * 60 * 1000);

                        // Get redirect URL and perform redirect
                        chrome.storage.local.get(['redirect'], (data) => {
                            const redirectSites = data.redirect || [];
                            if (redirectSites.length > 0) {
                                let formattedUrl = formatUrl(redirectSites[0]);
                                chrome.tabs.update(tabId, { url: formattedUrl });
                            }
                        });
                    }
                } else if (timers[tabId][site].redirectUntil && Date.now() >= timers[tabId][site].redirectUntil) {
                    // Cleanup timer after redirect period ends
                    clearInterval(timers[tabId][site].timer);
                    delete timers[tabId][site];
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

// Nettoyage des timers quand un onglet est fermé
chrome.tabs.onRemoved.addListener((tabId) => {
    if (timers[tabId]) {
        Object.values(timers[tabId]).forEach(siteTimer => {
            clearInterval(siteTimer.timer);
        });
        delete timers[tabId];
    }
});

function formatUrl(url) {
    // Remove any whitespace
    url = url.trim();

    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    // Add .com if no domain extension present
    const commonExtensions = ['.com', '.org', '.net', '.edu', '.gov', '.fr'];
    const hasExtension = commonExtensions.some(ext => url.includes(ext));

    if (!hasExtension) {
        url += '.com';
    }

    return url;
}

// Example usage:
// formatUrl("google") -> "https://google.com"
// formatUrl("www.blablacar.fr") -> "https://www.blablacar.fr"
// formatUrl("https://facebook") -> "https://facebook.com"
