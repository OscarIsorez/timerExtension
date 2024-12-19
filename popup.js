// Suppression des fonctions inutiles startCountdown et countdown

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateTimerDisplay(timeLeft) {
    const timerElement = document.getElementById('timer');
    const timerContainer = document.getElementById('timer-container');

    if (timeLeft !== undefined) {
        timerContainer.style.display = 'block';
        timerElement.textContent = formatTime(timeLeft);
    } else {
        timerContainer.style.display = 'none';
    }
}

function getCurrentTimer() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];

        if (!currentTab) return;

        chrome.runtime.sendMessage({
            action: 'getTimer',
            tabId: currentTab.id,
            url: currentTab.url
        }, (response) => {
            if (response && response.timeLeft !== undefined) {
                updateTimerDisplay(response.timeLeft);
            } else {
                updateTimerDisplay(undefined);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    getCurrentTimer();
    // Mettre à jour l'affichage toutes les secondes
    setInterval(getCurrentTimer, 1000);

    document.getElementById('settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Charger l'état du Global mode
    chrome.storage.local.get('globalMode', function (data) {
        document.getElementById('global-mode-switch').checked = data.globalMode || false;
    });
});

document.getElementById('global-mode-switch').addEventListener('change', function (e) {
    const isGlobalMode = e.target.checked;
    chrome.storage.local.set({ 'globalMode': isGlobalMode });
});