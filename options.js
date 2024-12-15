import { formatUrl } from './utils.js';


const controlledList = document.getElementById('controlled-list');
const redirectList = document.getElementById('redirect-list');
const controlledInput = document.getElementById('controlled-input');
const redirectInput = document.getElementById('redirect-input');

function updateLists() {
    chrome.storage.local.get(['controlled', 'redirect'], (data) => {
        controlledList.innerHTML = data.controlled?.map(url => `<li>${url}</li>`).join('') || '';
        redirectList.innerHTML = data.redirect?.map(url => `<li>${url}</li>`).join('') || '';
    });
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
    const domain = formatUrl(url);
    console.log(domain);
    if (!domain) return;
    chrome.storage.local.get(['controlled'], (data) => {
        const updated = [...(data.controlled || []), domain];
        chrome.storage.local.set({ controlled: updated }, updateLists);
    });
    controlledInput.value = '';
});

document.getElementById('add-redirect').addEventListener('click', () => {
    const url = redirectInput.value.trim();
    if (!url) return;
    chrome.storage.local.get(['redirect'], (data) => {
        const updated = [...(data.redirect || []), url];
        chrome.storage.local.set({ redirect: updated }, updateLists);
    });
    redirectInput.value = '';
});

updateLists();
