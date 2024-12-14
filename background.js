const timers = {};

// Ajouter un listener pour le démarrage de l'extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('Tab Updated Event:', { tabId, changeInfo, tab });
    
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        console.log('Processing tab:', tab.url);
        
        chrome.storage.local.get(['controlled', 'redirect'], (data) => {
            console.log('Storage data:', data);
            const controlledSites = data.controlled || [];
            const redirectSites = data.redirect || [];

            if (controlledSites.some(site => tab.url.includes(site))) {
                console.log('Controlled site detected');
                const timeLimit = parseInt(prompt('Combien de temps souhaitez-vous passer sur ce site ? (en minutes)'), 10);
                if (!isNaN(timeLimit) && timeLimit > 0) {
                    console.log(`Setting timer for ${timeLimit} minutes`);
                    timers[tabId] = setTimeout(() => {
                        if (redirectSites.length > 0) {
                            chrome.tabs.update(tabId, { url: redirectSites[0] });
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