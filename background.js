const controlledWebsites = {};

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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await chrome.storage.local.get(['controlled', 'redirect']);
        const controlledSites = data.controlled || [];
        const redirectSites = data.redirect || [];
        const url = tab.url

        const matchedSite = controlledSites.find(site_name => url.includes(site_name));

        if (matchedSite) {
            const redirectState = await getRedirectState(matchedSite);
            const now = Date.now();

            if (redirectState && redirectState.until > now) {
                if (redirectSites.length > 0) {

                    await chrome.tabs.update(tabId, { url: redirectSites[0] });
                    return;
                }
            }

            if (!controlledWebsites[matchedSite]) {
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

        if (!controlledWebsites[site]) {
            controlledWebsites[site] = {};
        }

        if (controlledWebsites[site].timer) {
            clearInterval(controlledWebsites[site].timer);
        }

        controlledWebsites[site] = {
            timeLeft: timeLimit,
            timer: setInterval(async () => {
                if (controlledWebsites[site].timeLeft > 0) {
                    controlledWebsites[site].timeLeft--;

                    if (controlledWebsites[site].timeLeft === 0) {
                        const redirectUntil = Date.now() + (5 * 60 * 1000);
                        controlledWebsites[site].redirectUntil = redirectUntil;

                        await setRedirectState(site, redirectUntil);

                        try {
                            const data = await chrome.storage.local.get(['redirect']);
                            const redirectSites = data.redirect || [];

                            if (redirectSites.length > 0) {
                                chrome.tabs.get(tabId, async (tab) => {
                                    if (chrome.runtime.lastError || !tab) {
                                        console.error('Tab does not exist:', chrome.runtime.lastError);
                                    } else {
                                        await chrome.tabs.update(tabId, { url: redirectSites[0] });
                                    }
                                });
                            }
                        } catch (error) {
                            console.error('Redirect error:', error);
                        }
                    }
                } else if (controlledWebsites[site].redirectUntil && Date.now() >= controlledWebsites[site].redirectUntil) {
                    await chrome.storage.local.remove([`redirect_${site}`]);
                    clearInterval(controlledWebsites[site].timer);
                    delete controlledWebsites[site];
                } else if (controlledWebsites[site].redirectUntil && Date.now() <= controlledWebsites[site].redirectUntil) {
                    const tab = await chrome.tabs.get(tabId).catch(error => {
                        return null;
                    });

                    if (tab) {
                        const url = tab.url;
                        const controlledSites = (await chrome.storage.local.get(['controlled'])).controlled || [];
                        const matchedSite = controlledSites.find(site_name => url.includes(site_name));

                        if (matchedSite) {
                            const data = await chrome.storage.local.get(['redirect']);
                            const redirectSites = data.redirect || [];
                            if (redirectSites.length > 0) {
                                const formattedUrl = redirectSites[0];
                                try {
                                    await chrome.tabs.update(tabId, { url: formattedUrl });
                                } catch (error) {
                                    console.error(`Failed to update tab with id ${tabId}:`, error);
                                }
                            }
                        }
                    }
                }
            }, 1000)
        };

        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'getTimer') {
        const { tabId, url } = message;
        chrome.storage.local.get(['controlled'], (data) => {
            const controlledSites = data.controlled || [];
            const matchedSite = controlledSites.find(site => url.includes(site));

            if (matchedSite && controlledWebsites[matchedSite]) {
                sendResponse({
                    timeLeft: Math.ceil(controlledWebsites[matchedSite].timeLeft),
                    redirectUntil: controlledWebsites[matchedSite].redirectUntil
                });
            } else {
                sendResponse({ timeLeft: undefined });
            }
        });
        return true;
    }
});