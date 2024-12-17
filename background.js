const memory = {};






chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await chrome.storage.local.get(['controlled', 'redirect']);
        const controlledSites = data.controlled || [];
        const redirectSites = data.redirect || [];
        const url = tab.url

        const matchedSite = controlledSites.find(site_name => url.includes(site_name));

        if (matchedSite) {
            const redirectUntil = null
            try {

                redirectUntil = memory[matchedSite].redirectUntil
            }
            catch (error) {
            }


            const now = Date.now();

            if (redirectUntil && redirectUntil < now) {
                if (redirectSites.length > 0) {

                    await chrome.tabs.update(tabId, { url: redirectSites[0] });
                    return;
                }
                else {
                    alert('No redirect site set');
                }
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

                if (memory[site].timeLeft > 0) {
                    console.log('cache memory :', memory);

                    memory[site].timeLeft--;

                    if (memory[site].timeLeft === 0) {
                        const redirectUntil = Date.now() + (5 * 60 * 1000);
                        memory[site].redirectUntil = redirectUntil;


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
                } else if (memory[site].redirectUntil && Date.now() >= memory[site].redirectUntil) {
                    clearInterval(memory[site].timer);
                } else if (memory[site].redirectUntil && Date.now() <= memory[site].redirectUntil) {
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

// Fonction appelée lorsque le timer d'un site atteint zéro
async function getGlobalState(site) {
    const data = await chrome.storage.local.get(['globalMode', 'controlled']);
    const globalMode = data.globalMode || false;
    return globalMode;
}