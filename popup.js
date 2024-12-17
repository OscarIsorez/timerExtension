let countdown;

function updateTimerDisplay(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startCountdown(duration) {
    let timeLeft = duration;
    updateTimerDisplay(timeLeft);

    countdown = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
            clearInterval(countdown);
            updateTimerDisplay(0);
        } else {
            updateTimerDisplay(timeLeft);
        }
    }, 1000);
}

chrome.storage.local.get(['timeLimit'], (data) => {
    const timeLimit = data.timeLimit || 0;
    if (timeLimit > 0) {
        startCountdown(timeLimit);
    }
});


document.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
});


let currentTab;

// Fonction pour formater le temps restant
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Fonction pour mettre à jour l'affichage du timer
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

// Fonction pour vérifier si l'URL est dans la liste des sites contrôlés
function checkIfControlledSite(url, controlledSites) {
    return controlledSites.some(site => url.includes(site));
}

// Fonction pour obtenir le timer actuel
function getCurrentTimer() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentTab = tabs[0];

        chrome.storage.local.get(['controlled'], (data) => {
            const controlledSites = data.controlled || [];

            if (currentTab && checkIfControlledSite(currentTab.url, controlledSites)) {
                // Demander au background script l'état actuel du timer
                chrome.runtime.sendMessage({
                    action: 'getTimer',
                    tabId: currentTab.id,
                    url: currentTab.url
                }, (response) => {
                    if (response && response.timeLeft !== undefined) {
                        updateTimerDisplay(response.timeLeft);
                    }
                });
            } else {
                updateTimerDisplay(undefined);
            }
        });
    });
}

// Initialisation et mise à jour périodique
document.addEventListener('DOMContentLoaded', () => {
    getCurrentTimer();
    setInterval(getCurrentTimer, 1000);

    document.getElementById('settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Charger l'état du Global mode
    chrome.storage.local.get('globalMode', function(data) {
        document.getElementById('global-mode-switch').checked = data.globalMode || false;
    });
});

document.getElementById('global-mode-switch').addEventListener('change', function(e) {
    const isGlobalMode = e.target.checked;
    chrome.storage.local.set({ 'globalMode': isGlobalMode });
});