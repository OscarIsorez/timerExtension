document.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
});
