document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('minutes').focus();

    // Récupérer pendingUrl et afficher le hostname
    chrome.storage.local.get(['pendingUrl'], (data) => {
        if (data.pendingUrl) {
            const url = new URL(data.pendingUrl);
            const hostname = url.hostname;
            document.getElementById('hostname').textContent = hostname;

            // Console.log du storage
            chrome.storage.local.get(null, (storageData) => {
                console.log('Chrome storage:', storageData);
            });
        }
    });
});

document.getElementById('confirm').addEventListener('click', () => {
    const minutes = parseInt(document.getElementById('minutes').value);
    if (minutes > 0) {
        chrome.storage.local.get(['pendingUrl', 'pendingSite'], (data) => {
            if (data.pendingUrl && data.pendingSite) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.runtime.sendMessage({
                        action: 'setTimeLimit',
                        timeLimit: minutes * 60,
                        tabId: tabs[0].id,
                        site: data.pendingSite
                    }, () => {
                        chrome.tabs.update({ url: data.pendingUrl });
                        chrome.storage.local.remove(['pendingUrl', 'pendingSite']);
                    });
                });
            }
        });
    }
});

document.getElementById('minutes').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('confirm').click();
    }
});
    