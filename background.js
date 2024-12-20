// Add this utility function at the top level
async function isTabValid(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        return Boolean(tab);
    } catch (e) {
        return false;
    }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await chrome.storage.local.get(['controlled', 'redirect', 'siteStates', 'redirectMappings']);
        const controlledSites = data.controlled || [];
        const redirectSites = data.redirect || [];
        const siteStates = data.siteStates || {};
        const redirectMappings = data.redirectMappings || {};
        const url = tab.url;
        const now = Date.now();

        const matchedSite = controlledSites.find(site_name => url.includes(site_name));

        if (matchedSite) {
            const globalMode = await getGlobaMode();
            const siteState = siteStates[matchedSite] || {};

            if (globalMode) {
                const anySiteInRedirection = Object.values(siteStates).some(
                    state => state.redirectUntil && now <= state.redirectUntil
                );
                console.log('Any site in redirection:', anySiteInRedirection);

                if (anySiteInRedirection && redirectSites.length > 0) {
                    const redirectUrl = redirectMappings[matchedSite] || redirectSites[0];
                    await handleRedirect(tabId, redirectUrl);

                    return;
                }
            }

            if (siteState.redirectUntil && now <= siteState.redirectUntil) {
                if (redirectSites.length > 0) {
                    const redirectUrl = redirectMappings[matchedSite] || redirectSites[0];
                    await handleRedirect(tabId, redirectUrl);

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


async function handleRedirect(currentTabId, redirectUrl) {
    // Close current tab
    await chrome.tabs.remove(currentTabId);

    // Open new tab with redirect URL and focus on it
    await chrome.tabs.create({
        url: redirectUrl,
        active: true // This makes the tab focused
    });
}

// Replace the existing listener with enhanced error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setTimeLimit') {
        const { timeLimit, tabId, site } = message;

        chrome.storage.local.get(['siteStates'], async (data) => {
            try {
                const siteStates = data.siteStates || {};

                // Validate tab exists before proceeding
                if (tabId && !(await isTabValid(tabId))) {
                    sendResponse({ success: false, error: 'Tab no longer exists' });
                    return;
                }

                siteStates[site] = {
                    timeLeft: timeLimit,
                    endTime: Date.now() + (timeLimit * 1000),
                    tabId,
                    active: true // Add active flag
                };

                await chrome.storage.local.set({ siteStates });
                sendResponse({ success: true });

                // Set up timer interval if not already running
                if (!globalThis.timerInterval) {
                    globalThis.timerInterval = setInterval(async () => {
                        try {
                            const currentState = await chrome.storage.local.get(['siteStates']);
                            const updatedSiteStates = currentState.siteStates || {};
                            const now = Date.now();
                            let hasChanges = false;

                            for (const [site, state] of Object.entries(updatedSiteStates)) {
                                // Only update active timers
                                if (state.active && state.endTime) {
                                    const newTimeLeft = Math.ceil((state.endTime - now) / 1000);

                                    if (newTimeLeft <= 0) {
                                        state.timeLeft = 0;
                                        state.redirectUntil = now + (5 * 60 * 1000);
                                        hasChanges = true;
                                    } else {
                                        state.timeLeft = newTimeLeft;
                                        hasChanges = true;
                                    }
                                }
                            }

                            if (hasChanges) {
                                await chrome.storage.local.set({ siteStates: updatedSiteStates });
                            }
                        } catch (error) {
                            console.error('Timer interval error:', error);
                        }
                    }, 1000);
                }
            } catch (error) {
                console.error('SetTimeLimit error:', error);
                sendResponse({ success: false, error: error.message });
            }
        });

        return true;
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        console.log('Redirect Mappings:', JSON.stringify(data.redirectMappings, null, 2));
        console.log('==================');

    }, 1000
    );
}


async function setTimeLeftDebug(site) {
    chrome.storage.local.get(['siteStates'], (data) => {
        const siteStates = data.siteStates || {};
        siteStates[site] = {
            timeLeft: 0,
            endTime: Date.now(),
            redirectUntil: Date.now() + (5 * 60 * 1000),
            tabId: 1
        };
        chrome.storage.local.set({ siteStates });
    });
}



logStorageState();