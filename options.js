

const controlledList = document.getElementById('controlled-list');
const redirectList = document.getElementById('redirect-list');
const controlledInput = document.getElementById('controlled-input');
const redirectInput = document.getElementById('redirect-input');
const controlledErrorMessage = document.getElementById('error-message-controlled');
const redirectErrorMessage = document.getElementById('error-message-redirect');


controlledInput.addEventListener('input', () => {
    hideErrorMessage(controlledErrorMessage);
});

redirectInput.addEventListener('input', () => {
    hideErrorMessage(redirectErrorMessage);
});
function updateLists() {
    chrome.storage.local.get(['controlled', 'redirect'], (data) => {
        controlledList.innerHTML = data.controlled?.map(url => `<li>${url}</li>`).join('') || '';
        redirectList.innerHTML = data.redirect?.map(url => `<li>${url}</li>`).join('') || '';
    });
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}

function showErrorMessage(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function hideErrorMessage(element) {
    element.style.display = 'none';
}

// Ajouter les event listeners pour la touche Enter
document.getElementById('controlled-input').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('add-controlled').click();
    }
});

document.getElementById('redirect-input').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('add-redirect').click();
    }
});


document.getElementById('add-controlled').addEventListener('click', () => {
    const url = controlledInput.value.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
        showErrorMessage(controlledErrorMessage, 'Please enter a valid URL (https://www.example.com).');
        controlledInput.focus();
        return;
    }
    const domain = url;
    if (!domain) return;
    chrome.storage.local.get(['controlled'], (data) => {
        const updated = [...(data.controlled || []), domain];
        chrome.storage.local.set({ controlled: updated }, updateLists);
    });
    controlledInput.value = '';
    hideErrorMessage(controlledErrorMessage);
});

document.getElementById('add-redirect').addEventListener('click', () => {
    const url = redirectInput.value.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
        showErrorMessage(redirectErrorMessage, 'Please enter a valid URL (https://www.example.com).');
        redirectInput.focus();
        return;
    }
    chrome.storage.local.get(['redirect'], (data) => {
        const updated = [...(data.redirect || []), url];
        chrome.storage.local.set({ redirect: updated }, updateLists);
    });
    redirectInput.value = '';
    hideErrorMessage(redirectErrorMessage);
});

updateLists();
