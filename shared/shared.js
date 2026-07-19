// Shared JavaScript for Project Tracker, Claude Tracker, and Git Tracker

// Opened locally (file:// or localhost), talk to the dev server directly.
// Served from any other host, the pages sit behind a reverse proxy (e.g.
// magus's nginx /tracker/) and the API is at ./api relative to the page.
const API_BASE_URL =
    (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname))
        ? 'http://localhost:3001/api'
        : new URL('api', location.href).href;

// --- XSS Sanitization ---

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsStr(str) {
    if (str == null) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e');
}

// --- Notifications ---

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'var(--notification-success)' :
                   type === 'error' ? 'var(--notification-error)' : 'var(--notification-info)';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 4px 12px var(--card-hover-shadow);
        font-weight: 500;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// --- Theme ---

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    showNotification(`Switched to ${newTheme} mode`, 'info');
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// --- Navigation ---

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Local Action Bridge ---

// True only when the backend reports the localhost-gated action bridge is
// usable (flag on + loopback). Otherwise actions fall back to clipboard.
let localActionsEnabled = false;

async function probeLocalActions() {
    try {
        const r = await fetch(`${API_BASE_URL}/actions/status`);
        if (r.ok) {
            const d = await r.json();
            localActionsEnabled = !!d.enabled;
        }
    } catch (e) {
        localActionsEnabled = false; // backend down → clipboard fallback
    }
}
document.addEventListener('DOMContentLoaded', probeLocalActions);

function copyToClipboardSafe(text) {
    return navigator.clipboard.writeText(text).catch(() => {
        showNotification(`Command: ${text}`, 'info');
    });
}

function copyToClipboard(text, message = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
        showNotification(message, 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification(message, 'success');
    });
}

// Close any open modal (used by the pages' Escape handlers).
function closeOpenModals() {
    document.querySelectorAll('.modal:not(.modal-hidden)').forEach((modal) => {
        modal.classList.add('modal-hidden');
    });
}

// Executes an action via the backend bridge when enabled; otherwise (or on
// any failure) copies the equivalent command. Always honest about which
// actually happened.
async function runProjectAction(actionName, path, legacyCommand) {
    if (localActionsEnabled) {
        try {
            const res = await fetch(`${API_BASE_URL}/actions/${actionName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: path })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                if (data.mode === 'copy' && data.text) {
                    await copyToClipboardSafe(data.text);
                    showNotification(`📋 Copied: ${data.text}`, 'success');
                } else {
                    showNotification('▶️ Launched on this machine', 'success');
                }
                return;
            }
        } catch (e) {
            // fall through to clipboard fallback
        }
    }
    await copyToClipboardSafe(legacyCommand);
    showNotification(
        `📋 Copied command${localActionsEnabled ? '' : ' (local actions off)'}: ${legacyCommand}`,
        localActionsEnabled ? 'warning' : 'info'
    );
}

// --- Folder Actions ---

function openFolder(path) {
    const isWindows = navigator.platform.indexOf('Win') > -1;
    const isMac = navigator.platform.indexOf('Mac') > -1;
    const legacy = isWindows ? `explorer "${path.replace(/\//g, '\\')}"`
                 : isMac ? `open "${path}"`
                 : `xdg-open "${path}"`;
    runProjectAction('open-folder', path, legacy);
}

// --- Path Normalization ---

function normalizePath(inputPath) {
    let p = inputPath.trim();
    if (p.includes('\\')) {
        p = p.replace(/\\/g, '/');
    }
    p = p.replace(/\/+$/, '');
    if ((p.startsWith('"') && p.endsWith('"')) ||
        (p.startsWith("'") && p.endsWith("'"))) {
        p = p.slice(1, -1);
    }
    return p;
}

// --- Directory Management ---

var currentDirectoriesData = [];

function toggleDirectoryManager() {
    const modal = document.getElementById('directoryModal');
    if (modal.classList.contains('modal-hidden')) {
        modal.classList.remove('modal-hidden');
        loadDirectoryConfig();
    } else {
        modal.classList.add('modal-hidden');
    }
}

async function loadDirectoryConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/config`);
        const data = await response.json();
        currentDirectoriesData = data.scanDirectories || [];
        renderDirectoryList();
    } catch (error) {
        console.error('Failed to load directory config:', error);
        showNotification('Failed to load directory configuration', 'error');
    }
}

function renderDirectoryList() {
    const container = document.getElementById('currentDirectories');
    if (currentDirectoriesData.length === 0) {
        container.innerHTML = '<div class="directory-item"><div class="directory-path">No directories configured</div></div>';
        return;
    }
    container.innerHTML = currentDirectoriesData.map(dir => `
        <div class="directory-item">
            <div class="directory-path">${escapeHtml(dir)}</div>
            <button class="remove-directory-btn" onclick="removeDirectory('${escapeJsStr(dir)}')">🗑️ Remove</button>
        </div>
    `).join('');
}

async function addDirectory() {
    const input = document.getElementById('newDirectoryPath');
    const directory = normalizePath(input.value);
    if (!directory) {
        showNotification('Please enter a directory path', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/directories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directory }),
        });
        const data = await response.json();
        if (data.success) {
            showNotification(`Added project: ${directory}`, 'success');
            input.value = '';
            loadDirectoryConfig();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Error adding directory:', error);
        showNotification('Failed to add directory', 'error');
    }
}

async function removeDirectory(directory) {
    if (!confirm(`Are you sure you want to remove "${directory}" from the scan list?`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/directories`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directory }),
        });
        const data = await response.json();
        if (data.success) {
            showNotification(`Removed: ${directory}`, 'success');
            loadDirectoryConfig();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Error removing directory:', error);
        showNotification('Failed to remove directory', 'error');
    }
}

async function resetToDefaults() {
    if (!confirm('Reset to default directories? This will remove all custom directories.')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/directories`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directories: [] }),
        });
        const data = await response.json();
        if (data.success) {
            showNotification('Directories reset to defaults', 'success');
            loadDirectoryConfig();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Error resetting directories:', error);
        showNotification('Failed to reset directories', 'error');
    }
}

// --- Tag Management ---

function toggleTagManager() {
    const modal = document.getElementById('tagModal');
    if (modal.classList.contains('modal-hidden')) {
        modal.classList.remove('modal-hidden');
        loadTagManager();
    } else {
        modal.classList.add('modal-hidden');
    }
}

function addNewTag() {
    const input = document.getElementById('newTagInput');
    const tagName = input.value.trim().toLowerCase();
    if (tagName && !allTags.has(tagName)) {
        allTags.add(tagName);
        input.value = '';
        renderCurrentTags();
        updateChangesSummary();
    }
}

function addPredefinedTag(tagName) {
    if (!allTags.has(tagName)) {
        allTags.add(tagName);
        renderCurrentTags();
        updateChangesSummary();
    }
}

function removeTag(tagName) {
    if (confirm(`Remove tag "${tagName}"? This will remove it from all projects.`)) {
        allTags.delete(tagName);
        renderCurrentTags();
        updateChangesSummary();
    }
}

// --- Initial Loader ---

function hideInitialLoader() {
    const loader = document.getElementById('initialLoader');
    if (loader) {
        loader.classList.add('loader-hidden');
        setTimeout(() => {
            if (loader && loader.parentNode) {
                loader.parentNode.removeChild(loader);
            }
        }, 500);
    }
}
