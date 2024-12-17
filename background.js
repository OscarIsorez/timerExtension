const memory = {};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await chrome.storage.local.get(['controlled', 'redirect', 'siteRedirects', 'globalRedirectUntil']);
        const controlledSites = data.controlled || [];
        const redirectSites = data.redirect || [];
        const siteRedirects = data.siteRedirects || {};
        const globalRedirectUntil = data.globalRedirectUntil;
        const url = tab.url;

        const matchedSite = controlledSites.find(site_name => url.includes(site_name));

        if (matchedSite) {
            const now = Date.now();
            const redirectUntil = siteRedirects[matchedSite];
            const globalMode = await getGlobalState(matchedSite);

            if ((globalMode && globalRedirectUntil && now <= globalRedirectUntil) ||
                (!globalMode && redirectUntil && now <= redirectUntil)) {
                if (redirectSites.length > 0) {
                    await chrome.tabs.update(tabId, { url: redirectSites[0] });
                    return;
                } else {
                    alert('No redirect site set');
                }
            } else if (redirectUntil && now > redirectUntil) {
                // Nettoyage du storage si le temps est expiré
                const updatedSiteRedirects = { ...siteRedirects };
                delete updatedSiteRedirects[matchedSite];
                await chrome.storage.local.set({
                    siteRedirects: updatedSiteRedirects,
                    globalRedirectUntil: null
                });
            }

            if (!memory[matchedSite]) {
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

        if (!memory[site]) {
            memory[site] = {};
        }

        if (memory[site].timer) {
            clearInterval(memory[site].timer);
        }

        memory[site] = {
            timeLeft: timeLimit,
            timer: setInterval(async () => {
                console.log('cache memory :', memory);
                console.log('now ', Date.now());
                if (memory[site].timeLeft > 0) {
                    memory[site].timeLeft--;

                    // Modifier la partie du setTimeLimit où le timer atteint 0
                    if (memory[site].timeLeft === 0) {
                        const redirectUntil = Date.now() + (5 * 60 * 1000);
                        memory[site].redirectUntil = redirectUntil;

                        const globalMode = await getGlobalState(site);

                        // Stocker dans le storage local
                        const currentRedirects = (await chrome.storage.local.get(['siteRedirects'])).siteRedirects || {};
                        if (globalMode) {
                            // En mode global, on applique le redirectUntil à tous les sites contrôlés
                            const controlledSites = (await chrome.storage.local.get(['controlled'])).controlled || [];
                            const globalRedirects = {};
                            controlledSites.forEach(site => {
                                globalRedirects[site] = redirectUntil;
                            });

                            await chrome.storage.local.set({
                                siteRedirects: {
                                    ...currentRedirects,
                                    ...globalRedirects
                                },
                                globalRedirectUntil: redirectUntil
                            });
                        } else {
                            await chrome.storage.local.set({
                                siteRedirects: {
                                    ...currentRedirects,
                                    [site]: redirectUntil
                                }
                            });
                        }

                        try {
                            const data = await chrome.storage.local.get(['redirect']);
                            const redirectSites = data.redirect || [];
                            if (redirectSites.length > 0) {
                                try {
                                    const tab = await chrome.tabs.get(tabId);
                                    if (tab) {
                                        await chrome.tabs.update(tabId, { url: redirectSites[0] });
                                    }
                                } catch (error) {
                                    console.error('Failed to get or update tab:', error);
                                }
                            }
                        } catch (error) {
                            console.error('Redirect error:', error);
                        }
                    }
                } else if (memory[site].redirectUntil && Date.now() >= memory[site].redirectUntil) {
                    clearInterval(memory[site].timer);
                } else if (memory[site].redirectUntil && Date.now() <= memory[site].redirectUntil) {
                    console.log('now < redirectUntil', memory[site].redirectUntil);
                    const tab = await chrome.tabs.get(tabId).catch(error => {
                        console.error('Failed to get tab:', error);
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
                                try {
                                    await chrome.tabs.update(tabId, { url: redirectSites[0] });
                                } catch (error) {
                                    console.error(`Failed to update tab with id ${tabId}:`, error);
                                }
                            } else {
                                alert('No redirect site set');
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

            if (matchedSite && memory[matchedSite]) {
                sendResponse({
                    timeLeft: Math.ceil(memory[matchedSite].timeLeft),
                    redirectUntil: memory[matchedSite].redirectUntil
                });
            } else {
                sendResponse({ timeLeft: undefined });
            }
        });
        return true;
    }
});

async function getGlobalState(site) {
    const { globalMode, globalRedirectUntil } = await chrome.storage.local.get(['globalMode', 'globalRedirectUntil']);
    return globalMode && globalRedirectUntil && Date.now() <= globalRedirectUntil;
}

