document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('minutes').focus();
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
