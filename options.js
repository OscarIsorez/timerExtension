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
    chrome.storage.local.get(['controlled', 'redirect', 'siteStates'], (data) => {
        controlledList.innerHTML = data.controlled?.map(url => createListItem(url, 'controlled', data.siteStates)).join('') || '';
        redirectList.innerHTML = data.redirect?.map(url => createListItem(url, 'redirect')).join('') || '';
        addEventListeners();
    });
    createMappingUI();
}

function createListItem(url, type, siteStates = {}) {
    let timeRemainingText = '';

    if (type === 'controlled') {
        const siteState = siteStates[url];
        if (siteState && siteState.redirectUntil) {
            const now = Date.now();
            const timeRemaining = Math.ceil((siteState.redirectUntil - now) / 1000);
            if (timeRemaining > 0) {
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;
                timeRemainingText = ` - Time left: ${minutes}m ${seconds}s`;
            }
        }
    }

    return `
        <li>
            ${url}${timeRemainingText}
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
    document.querySelectorAll('.go-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const url = event.target.getAttribute('data-url');
            chrome.tabs.create({ url: url });
        });
    });
}


function removeUrl(url, type) {
    chrome.storage.local.get([type], (data) => {
        const updated = (data[type] || []).filter(item => item !== url);
        chrome.storage.local.set({ [type]: updated }, updateLists);
    });
}

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
    if (!url) {
        showErrorMessage(controlledErrorMessage, 'Please enter something.');
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
    redirectInput.value = 'https://www.example.com';
    hideErrorMessage(redirectErrorMessage);
});

function createMappingUI() {
    const container = document.getElementById('mapping-container');
    chrome.storage.local.get(['controlled', 'redirect', 'redirectMappings'], (data) => {
        const controlled = data.controlled || [];
        const redirect = data.redirect || [];
        let mappings = data.redirectMappings || {};

        // If only one redirect URL is present
        if (redirect.length === 1) {
            const redirectUrl = redirect[0];

            // Assign the single redirect URL to all controlled sites without a mapping
            controlled.forEach(site => {
                if (!mappings[site]) {
                    mappings[site] = redirectUrl;
                }
            });

            // Update chrome storage with new mappings
            chrome.storage.local.set({ redirectMappings: mappings }, () => {
                // Re-fetch mappings after update
                chrome.storage.local.get(['redirectMappings'], (newData) => {
                    mappings = newData.redirectMappings || {};
                    renderMappings(controlled, redirect, mappings, container);
                });
            });
        } else {
            renderMappings(controlled, redirect, mappings, container);
        }
    });
}

function renderMappings(controlled, redirect, mappings, container) {
    container.innerHTML = controlled.map(site => `
        <div class="mapping-row">
            <span>${site}</span>
            <select data-site="${site}" class="redirect-select">
                ${redirect.map(url => `
                    <option value="${url}" ${mappings[site] === url ? 'selected' : ''}>
                        ${url}
                    </option>
                `).join('')}
            </select>
        </div>
    `).join('');

    // Add change listeners
    document.querySelectorAll('.redirect-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const site = e.target.dataset.site;
            const redirectUrl = e.target.value;
            updateMapping(site, redirectUrl);
        });
    });
}

function updateMapping(site, redirectUrl) {
    chrome.storage.local.get(['redirectMappings'], (data) => {
        const mappings = data.redirectMappings || {};
        mappings[site] = redirectUrl;
        chrome.storage.local.set({ redirectMappings: mappings });
    });
}


async function resetTimeLeftDebug() {
    const controlled_sites = await chrome.storage.local.get(['controlled']);
    let siteStates = await chrome.storage.local.get('siteStates');
    siteStates = siteStates.siteStates || {};
    for (const site of controlled_sites.controlled) {
        siteStates[site] = {
            timeLeft: 0,
        };
    }
    await chrome.storage.local.set({ siteStates });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('reset-time-left').addEventListener('click', async () => {
        await resetTimeLeftDebug();
        updateLists(); // Refresh the lists to reflect the changes
    });
});

updateLists();