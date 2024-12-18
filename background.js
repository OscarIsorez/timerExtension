chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await chrome.storage.local.get(['controlled', 'redirect', 'siteStates']);
        const controlledSites = data.controlled || [];
        const redirectSites = data.redirect || [];
        const siteStates = data.siteStates || {};
        const url = tab.url;
        const now = Date.now();

        const matchedSite = controlledSites.find(site_name => url.includes(site_name));

        if (matchedSite) {
            const globalMode = await getGlobaMode();
            const siteState = siteStates[matchedSite] || {};

            // Vérifier le mode global d'abord
            if (globalMode) {
                // Vérifier si n'importe quel site est en redirection
                const anySiteInRedirection = Object.values(siteStates).some(
                    state => state.redirectUntil && now <= state.redirectUntil
                );
                console.log('Any site in redirection:', anySiteInRedirection);

                if (anySiteInRedirection && redirectSites.length > 0) {
                    await chrome.tabs.update(tabId, {
                        url: redirectSites[0]
                    });
                    return;
                }
            }

            // Continuer avec la logique normale si pas de redirection globale
            if (siteState.redirectUntil && now <= siteState.redirectUntil) {
                if (redirectSites.length > 0) {
                    await chrome.tabs.update(tabId, {
                        url: redirectSites[0]
                    });
                    return;
                }
            }

            if (!siteState.timeLeft || siteState.timeLeft === 0) {
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

        chrome.storage.local.get(['siteStates'], async (data) => {
            console.log(data);
            const siteStates = data.siteStates || {};

            if (siteStates[site] && siteStates[site].intervalId) {
                clearInterval(siteStates[site].intervalId);
            }

            siteStates[site] = {
                timeLeft: timeLimit,
                intervalId: setInterval(async () => {
                    const currentState = await chrome.storage.local.get(['siteStates']);
                    const updatedSiteStates = currentState.siteStates;

                    if (updatedSiteStates[site] && updatedSiteStates[site].timeLeft && updatedSiteStates[site].timeLeft > 0) {
                        updatedSiteStates[site].timeLeft--;

                        if (updatedSiteStates[site].timeLeft === 0) {
                            const redirectUntil = Date.now() + (5 * 60 * 1000);
                            updatedSiteStates[site].redirectUntil = redirectUntil;


                            await chrome.storage.local.set({
                                siteStates: updatedSiteStates
                            });


                            const redirectData = await chrome.storage.local.get(['redirect']);
                            const redirectSites = redirectData.redirect || [];

                            if (redirectSites.length > 0) {
                                chrome.tabs.update(tabId, { url: redirectSites[0] });
                            }
                        }

                        await chrome.storage.local.set({ siteStates: updatedSiteStates });
                    }
                }, 1000)
            };

            await chrome.storage.local.set({ siteStates });
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === 'getTimer') {
        const { tabId, url } = message;
        chrome.storage.local.get(['controlled', 'siteStates'], (data) => {
            const controlledSites = data.controlled || [];
            const siteStates = data.siteStates || {};
            const matchedSite = controlledSites.find(site => url.includes(site));

            if (matchedSite && siteStates[matchedSite]) {
                sendResponse({
                    timeLeft: Math.ceil(siteStates[matchedSite].timeLeft),
                    redirectUntil: siteStates[matchedSite].redirectUntil
                });
            } else {
                sendResponse({ timeLeft: undefined });
            }
        });
        return true;
    }
});

async function getGlobaMode() {
    const { globalMode } = await chrome.storage.local.get(['globalMode']);
    return globalMode
}
function logStorageState() {
    setInterval(async () => {
        const data = await chrome.storage.local.get(null);
        console.clear();
        console.log('=== Storage State ===');
        console.log('Controlled Sites:', data.controlled);
        console.log('Redirect Sites:', data.redirect);
        console.log('Global Mode:', data.globalMode);
        console.log('Site States:', JSON.stringify(data.siteStates, null, 2));
        console.log('Now:', Date.now());
        console.log('==================');
    }, 1000
    );
}

// Démarrer le logging
logStorageState();