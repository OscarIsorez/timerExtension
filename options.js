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


document.getElementById('add-controlled').addEventListener('click', () => {
    const url = controlledInput.value.trim();
    if (!url) return;
    chrome.storage.local.get(['controlled'], (data) => {
        const updated = [...(data.controlled || []), url];
        chrome.storage.local.set({ controlled: updated }, updateLists);
    });
});

document.getElementById('add-redirect').addEventListener('click', () => {
    const url = redirectInput.value.trim();
    if (!url) return;
    chrome.storage.local.get(['redirect'], (data) => {
        const updated = [...(data.redirect || []), url];
        chrome.storage.local.set({ redirect: updated }, updateLists);
    });
});

updateLists();
