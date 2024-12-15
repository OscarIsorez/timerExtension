document.getElementById('confirm').addEventListener('click', () => {
    const minutes = parseInt(document.getElementById('minutes').value);
    if (minutes > 0) {
        chrome.runtime.sendMessage({
            action: 'setTimeLimit',
            timeLimit: minutes * 60
        }, () => {
            chrome.storage.local.get(['pendingUrl', 'pendingSite'], (data) => {
                if (data.pendingUrl) {
                    chrome.tabs.update({ url: data.pendingUrl });
                    chrome.storage.local.remove(['pendingUrl', 'pendingSite']);
                }
            });
        });
    }
});
