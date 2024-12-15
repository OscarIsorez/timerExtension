// Structure pour stocker les timers par site et par tab
const timers = {
    // tabId: {
    //    siteUrl: { timeLeft: number, timer: Timer, redirectUntil: timestamp }
    // }
};

async function setRedirectState(site, until) {
    await chrome.storage.local.set({
        [`redirect_${site}`]: {
            until: until
        }
    });
}

async function getRedirectState(site) {
    const data = await chrome.storage.local.get([`redirect_${site}`]);
    return data[`redirect_${site}`];
}

// Update tabs.onUpdated listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await chrome.storage.local.get(['controlled', 'redirect']);
        const controlledSites = data.controlled || [];
        const redirectSites = data.redirect || [];
        const tabDomain = tab.url

        // Match based on domain
        console.log('Current site: ' + tabDomain);
        console.log('Controlled sites: ' + controlledSites);
        const matchedSite = controlledSites.find(site => tabDomain.includes(site));

        if (matchedSite) {
            // Check redirect state first
            const redirectState = await getRedirectState(matchedSite);
            const now = Date.now();

            if (redirectState && redirectState.until > now) {
                // Still in redirect period - force redirect
                if (redirectSites.length > 0) {
                    const formattedUrl = redirectSites[0];
                    await chrome.tabs.update(tabId, { url: formattedUrl });
                    return;
                }
            }

            // Normal timer check
            if (!timers[tabId] || !timers[tabId][matchedSite]) {
                await chrome.storage.local.set({
                    pendingUrl: tab.url,
                    pendingSite: matchedSite
                });
                await chrome.tabs.update(tabId, {
                    url: chrome.runtime.getURL('timer.html')
                });
            }
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setTimeLimit') {
        const { timeLimit, tabId, site } = message;
        const domain = site;

        if (!timers[tabId]) {
            timers[tabId] = {};
        }

        // Clear existing timer if any
        if (timers[tabId][domain] && timers[tabId][domain].timer) {
            clearInterval(timers[tabId][domain].timer);
        }

        timers[tabId][domain] = {
            timeLeft: timeLimit,
            timer: setInterval(async () => {
                // on affiche le site 
                console.log('Current site: ' + site);
                console.log('Redirecting back to original site' + timers[tabId][domain].redirectUntil >= Date.now());
                console.log(`Timer for ${site}: ${timers[tabId][domain].timeLeft}`);
                console.log(`Redirect until: ${timers[tabId][domain].redirectUntil}`);
                console.log('Current time: ' + Date.now());

                if (timers[tabId][domain].timeLeft > 0) {
                    //  si l'url du site courant est dans la liste des sites contrôlés

                    timers[tabId][domain].timeLeft--;

                    // Update timer completion logic in setTimeLimit handler
                    if (timers[tabId][domain].timeLeft === 0) {
                        const redirectUntil = Date.now() + (5 * 60 * 1000);
                        timers[tabId][domain].redirectUntil = redirectUntil;

                        // Store redirect state
                        await setRedirectState(site, redirectUntil);

                        try {
                            const data = await chrome.storage.local.get(['redirect']);
                            const redirectSites = data.redirect || [];

                            if (redirectSites.length > 0) {
                                const formattedUrl = redirectSites[0];
                                console.log(`Redirecting to: ${formattedUrl}`);
                                await chrome.tabs.update(tabId, { url: formattedUrl });
                            }
                        } catch (error) {
                            console.error('Redirect error:', error);
                        }
                    }
                } else if (timers[tabId][domain].redirectUntil && Date.now() >= timers[tabId][domain].redirectUntil) {
                    // Clean up redirect state when timer expires
                    await chrome.storage.local.remove([`redirect_${site}`]);
                    clearInterval(timers[tabId][domain].timer);
                    delete timers[tabId][domain];
                }
                else if (timers[tabId][domain].redirectUntil && Date.now() <= timers[tabId][domain].redirectUntil) {
                    // redirecting to the first site in the redirect list
                    const data = await chrome.storage.local.get(['redirect']);
                    const redirectSites = data.redirect || [];
                    if (redirectSites.length > 0) {
                        const formattedUrl = redirectSites[0];
                        console.log(`Redirecting to: ${formattedUrl}`);
                        await chrome.tabs.update(tabId, { url: formattedUrl });
                    }


                }

            }, 1000),
            redirectUntil: null
        };

        sendResponse({ success: true });
        return true; // Keep message channel open for async response
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



