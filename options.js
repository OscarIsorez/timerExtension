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
        controlledList.innerHTML = data.controlled?.map(url => createListItem(url, 'controlled')).join('') || '';
        redirectList.innerHTML = data.redirect?.map(url => createListItem(url, 'redirect')).join('') || '';
        addEventListeners();
    });
}

function createListItem(url, type) {
    return `
        <li draggable="true">
            <span class="drag-handle">☰</span>
            ${url}
            <button class="delete-btn" data-url="${url}" data-type="${type}">Supprimer</button>
        </li>
    `;
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

function addEventListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const url = event.target.getAttribute('data-url');
            const type = event.target.getAttribute('data-type');
            removeUrl(url, type);
        });
    });

    document.querySelectorAll('li[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function removeUrl(url, type) {
    chrome.storage.local.get([type], (data) => {
        const updated = (data[type] || []).filter(item => item !== url);
        chrome.storage.local.set({ [type]: updated }, updateLists);
    });
}

let draggedItem = null;

function handleDragStart(event) {
    draggedItem = event.target;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.innerHTML);
}

function handleDragOver(event) {
    if (event.preventDefault) {
        event.preventDefault();
    }
    return false;
}

function handleDrop(event) {
    if (event.stopPropagation) {
        event.stopPropagation();
    }

    if (draggedItem !== event.target) {
        draggedItem.innerHTML = event.target.innerHTML;
        event.target.innerHTML = event.dataTransfer.getData('text/html');

        const type = event.target.querySelector('.delete-btn').getAttribute('data-type');
        const items = Array.from(document.querySelectorAll(`#${type}-list li`)).map(li => li.textContent.trim());
        chrome.storage.local.set({ [type]: items }, updateLists);
    }
    return false;
}

function handleDragEnd(event) {
    draggedItem = null;
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

