// Global variables
let customButtons = [];
let jiraData = [];
let jiraConfig = null;
let jiraViewIndex = 0; // Which of the configured Jira views is shown
let jiraLoadSeq = 0; // Discards responses from a view the user already switched away from
// When each issue was last opened from here; issues updated after that get a dot.
// `since` covers issues never opened, so a first run doesn't flag everything.
let jiraSeen = { since: 0, keys: {} };

// Search (palette) state
let searchResults = [];
let searchResultsQuery = null; // Query the current results were built for
let searchSelected = 0;
let searchSeq = 0;

// Favorites navigation state
let currentFolderId = null; // Currently displayed folder ID (or ALL_BOOKMARKS_ID)
let currentFolderNode = null; // Full folder node object
let bookmarksBarId = null; // Store bookmarks bar ID for quick access
let otherBookmarksId = null; // Where "New folder" goes when viewing All bookmarks
let flattenedFolderIds = new Set(); // "Other bookmarks" folders, shown inline under All bookmarks

// Virtual top-level folder mirroring Chrome's "All Bookmarks" side panel
const ALL_BOOKMARKS_ID = 'all-bookmarks';

// Initialize extension
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chrome Dashboard Extension loaded');
    
    updateTime();
    setInterval(updateTime, 1000);
    
    loadFavorites();
    loadCustomButtons();
    loadRecentlyClosed();
    // Issues need the stored config, so wait for it before fetching
    loadJiraConfig().then(loadJiraIssues);
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    setupSearch();

    if (chrome.sessions) chrome.sessions.onChanged.addListener(loadRecentlyClosed);

    // Arrow keys move through the Jira status menu (Escape closing it is built into popover)
    const transitionMenu = document.getElementById('jiraTransitionMenu');
    if (transitionMenu) {
        transitionMenu.addEventListener('keydown', event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const options = [...transitionMenu.querySelectorAll('.transition-option:not(:disabled)')];
            const next = options.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
            options[(next + options.length) % options.length]?.focus();
        });
    }

    // Refresh favorites
    const refreshBtn = document.getElementById('refreshFavorites');
    // Wrapped so the click event isn't passed in as a folder ID
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadFavorites());
    
    // Add favorite
    const addFavBtn = document.getElementById('addFavorite');
    if (addFavBtn) addFavBtn.addEventListener('click', openAddFavoriteModal);

    // Add folder
    const addFolderBtn = document.getElementById('addFolder');
    if (addFolderBtn) addFolderBtn.addEventListener('click', openCreateFolderModal);

    // Refresh Jira
    const refreshJiraBtn = document.getElementById('refreshJira');
    if (refreshJiraBtn) refreshJiraBtn.addEventListener('click', loadJiraIssues);

    // Jira settings modal
    const jiraSettingsBtn = document.getElementById('jiraSettings');
    if (jiraSettingsBtn) jiraSettingsBtn.addEventListener('click', openJiraSettingsModal);

    const cancelJiraBtn = document.getElementById('cancelJiraSettings');
    if (cancelJiraBtn) cancelJiraBtn.addEventListener('click', closeJiraSettingsModal);

    const saveJiraBtn = document.getElementById('saveJiraSettings');
    if (saveJiraBtn) saveJiraBtn.addEventListener('click', saveJiraSettings);

    const clearJiraBtn = document.getElementById('clearJiraSettings');
    if (clearJiraBtn) clearJiraBtn.addEventListener('click', clearJiraSettings);

    // Custom button modal
    const addCustomBtn = document.getElementById('addCustomButton');
    if (addCustomBtn) addCustomBtn.addEventListener('click', openAddCustomButton);
    
    const cancelBtn = document.getElementById('cancelButton');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) saveBtn.addEventListener('click', saveCustomButton);
    
    // Add favorite modal
    const cancelFavBtn = document.getElementById('cancelFavorite');
    if (cancelFavBtn) cancelFavBtn.addEventListener('click', closeFavoriteModal);

    const saveFavBtn = document.getElementById('saveFavorite');
    if (saveFavBtn) saveFavBtn.addEventListener('click', saveFavorite);

    // Create folder modal
    const cancelFolderBtn = document.getElementById('cancelFolder');
    if (cancelFolderBtn) cancelFolderBtn.addEventListener('click', closeFolderModal);

    const saveFolderBtn = document.getElementById('saveFolder');
    if (saveFolderBtn) saveFolderBtn.addEventListener('click', createFolder);

    // Update action placeholder when selection changes
    const actionSelect = document.getElementById('buttonAction');
    if (actionSelect) actionSelect.addEventListener('change', updateActionPlaceholder);
    
    // Close modals when clicking outside
    const customModal = document.getElementById('customButtonModal');
    if (customModal) {
        customModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeModal();
            }
        });
    }
    
    const favoriteModal = document.getElementById('addFavoriteModal');
    if (favoriteModal) {
        favoriteModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeFavoriteModal();
            }
        });
    }

    const folderModal = document.getElementById('createFolderModal');
    if (folderModal) {
        folderModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeFolderModal();
            }
        });
    }

    const jiraModal = document.getElementById('jiraSettingsModal');
    if (jiraModal) {
        jiraModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeJiraSettingsModal();
            }
        });
    }

    // Issue list fade: recheck on scroll, resize, and whenever its content is replaced
    const jiraContent = document.getElementById('jiraContent');
    if (jiraContent) {
        jiraContent.addEventListener('scroll', updateJiraScrollFade, { passive: true });
        new ResizeObserver(updateJiraScrollFade).observe(jiraContent);
        new MutationObserver(updateJiraScrollFade).observe(jiraContent, { childList: true });
    }

    // Keyboard: Escape closes the open modal, Enter in a field submits it
    const modalClosers = {
        addFavoriteModal: closeFavoriteModal,
        customButtonModal: closeModal,
        createFolderModal: closeFolderModal,
        jiraSettingsModal: closeJiraSettingsModal
    };

    document.addEventListener('keydown', function(event) {
        const openModalId = Object.keys(modalClosers).find(id => {
            const modal = document.getElementById(id);
            return modal && modal.style.display === 'block';
        });
        if (!openModalId) return;

        if (event.key === 'Escape') {
            modalClosers[openModalId]();
        } else if (event.key === 'Enter' && !event.isComposing && event.target.matches('.modal input')) {
            event.preventDefault();
            const primaryButton = document.getElementById(openModalId).querySelector('.btn-primary');
            if (primaryButton) primaryButton.click();
        }
    });

    // Clear a field's error highlight as soon as it's edited
    document.querySelectorAll('.modal input, .modal select, .modal textarea').forEach(field => {
        field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
    });
}

// Update time display
function updateTime() {
    const timeDisplay = document.getElementById('timeDisplay');
    const dateDisplay = document.getElementById('dateDisplay');
    if (!timeDisplay) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit',
        minute: '2-digit' 
    });
    const dateString = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
    });
    timeDisplay.textContent = timeString;
    if (dateDisplay) dateDisplay.textContent = dateString;
}

// Find the bookmarks bar in a bookmarks tree.
// Shared by the favorites grid and "Add Favorite" so both always target the same folder.
function findBookmarksBar(tree) {
    const roots = (tree && tree[0] && tree[0].children) || [];

    // folderType is locale-independent (Chrome 134+). Profiles with account bookmarks
    // can expose more than one bar; prefer the one that actually has content.
    const bars = roots.filter(node => node.folderType === 'bookmarks-bar');
    if (bars.length > 0) {
        return bars.find(node => node.children && node.children.length > 0) || bars[0];
    }

    // Older Chrome: match by title, then fall back to the first root folder (the bar's standard slot)
    return roots.find(node =>
        node.title === 'Bookmarks bar' ||
        node.title === 'Bookmarks Bar'
    ) || roots[0] || null;
}

// "Other bookmarks" permanent folder(s). Chrome's standard ID for it is "2" on versions
// without folderType; profiles with account bookmarks can have more than one.
function isOtherBookmarksFolder(node) {
    return node.folderType ? node.folderType === 'other' : node.id === '2';
}

// Build the "All bookmarks" view the way Chrome's side panel lists it: the Bookmarks bar
// as a folder, the contents of "Other bookmarks" inline, and Mobile bookmarks if non-empty
function buildAllBookmarksNode(tree) {
    const roots = (tree && tree[0] && tree[0].children) || [];
    const children = [];

    flattenedFolderIds = new Set();
    otherBookmarksId = null;

    roots.forEach(node => {
        if (isOtherBookmarksFolder(node)) {
            flattenedFolderIds.add(node.id);
            if (!otherBookmarksId) otherBookmarksId = node.id;
            children.push(...(node.children || []));
        } else if (node.id === bookmarksBarId || (node.children && node.children.length > 0)) {
            children.push(node);
        }
    });

    return { id: ALL_BOOKMARKS_ID, title: 'All bookmarks', children };
}

// Load favorites from Chrome bookmarks with folder navigation support.
// Always re-fetches from Chrome, so refreshes and edits are reflected immediately.
// With no folderId, reloads the folder currently being shown.
async function loadFavorites(folderId = null) {
    const favoritesGrid = document.getElementById('favoritesGrid');

    if (!favoritesGrid) {
        console.error('Favorites grid element not found');
        return;
    }

    try {
        console.log('Loading favorites...', folderId ? `Folder: ${folderId}` : 'Current folder');

        // Find bookmarks bar on first load
        if (!bookmarksBarId) {
            const bookmarkBar = findBookmarksBar(await chrome.bookmarks.getTree());

            if (!bookmarkBar) {
                favoritesGrid.innerHTML = '<div class="loading">Bookmarks bar not found</div>';
                return;
            }

            bookmarksBarId = bookmarkBar.id;
        }

        const targetId = folderId || currentFolderId || ALL_BOOKMARKS_ID;
        let folder;
        try {
            folder = targetId === ALL_BOOKMARKS_ID
                ? buildAllBookmarksNode(await chrome.bookmarks.getTree())
                : (await chrome.bookmarks.getSubTree(targetId))[0];
        } catch (error) {
            console.error('Error loading folder:', error);
            // Folder was deleted or is invalid - fall back to All bookmarks
            folder = buildAllBookmarksNode(await chrome.bookmarks.getTree());
        }

        // Keep ID and node in sync so "Create Folder" targets the folder on screen
        currentFolderId = folder.id;
        currentFolderNode = folder;

        // Get children of current folder
        const children = currentFolderNode?.children || [];

        // Render breadcrumb navigation
        renderBreadcrumb();

        // Clear grid
        favoritesGrid.innerHTML = '';

        // Show empty state if no items
        if (children.length === 0) {
            favoritesGrid.innerHTML = '<div class="loading">No bookmarks in this folder</div>';
            return;
        }

        // Render folders and bookmarks
        children.forEach(item => {
            if (item.children) {
                // It's a folder
                const folderElement = createFolderItem(item);
                favoritesGrid.appendChild(folderElement);
            } else if (item.url) {
                // It's a bookmark
                const bookmarkElement = createFavoriteItem(item);
                favoritesGrid.appendChild(bookmarkElement);
            }
        });

        console.log(`Loaded ${children.length} items (folders & bookmarks)`);
    } catch (error) {
        console.error('Error loading favorites:', error);
        // Re-detect the bookmarks bar on the next load in case it changed (e.g. sign-out)
        bookmarksBarId = null;
        currentFolderId = null;
        currentFolderNode = null;
        favoritesGrid.innerHTML = '<div class="loading">Couldn\'t load favorites. Check the extension\'s bookmark permission.</div>';
    } finally {
        favoritesGrid.setAttribute('aria-busy', 'false');
    }
}

// Create favorite item element (for bookmarks)
function createFavoriteItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'favorite-item favorite-bookmark';
    item.addEventListener('click', () => openUrl(bookmark.url));
    makeActivatable(item, 'link');

    // Try to use favicon, fall back to initials
    const icon = document.createElement('div');
    icon.className = 'favorite-icon';

    // Use Google favicon service or fall back to initials
    const faviconUrl = getFaviconUrl(bookmark.url);
    if (faviconUrl) {
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.alt = ''; // Decorative - the title is shown next to it
        // Fallback to initials if image fails to load
        img.onerror = () => {
            icon.innerHTML = '';
            icon.textContent = getInitials(bookmark.title || bookmark.url);
        };
        icon.appendChild(img);
    } else {
        icon.textContent = getInitials(bookmark.title || bookmark.url);
    }

    const title = document.createElement('div');
    title.className = 'favorite-title';
    title.textContent = bookmark.title || new URL(bookmark.url).hostname;
    title.title = bookmark.url; // Tooltip shows URL

    item.appendChild(icon);
    item.appendChild(title);

    return item;
}

// Create folder item element
function createFolderItem(folder) {
    const item = document.createElement('div');
    item.className = 'favorite-item favorite-folder';
    item.addEventListener('click', () => navigateToFolder(folder.id));
    makeActivatable(item, 'button');

    const icon = document.createElement('div');
    icon.className = 'favorite-icon folder-icon';
    // Folder icon (sized and colored in CSS)
    icon.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
        </svg>
    `;

    const title = document.createElement('div');
    title.className = 'favorite-title';
    title.textContent = folder.title || 'Untitled Folder';
    title.title = `Open folder: ${folder.title || 'Untitled Folder'}`;

    item.appendChild(icon);
    item.appendChild(title);

    return item;
}

// Get favicon URL for a bookmark
// Uses Chrome's own favicon cache (the same icons the bookmarks bar shows), so internal
// and signed-in sites get real icons and no hostnames are sent to a third party.
// Requires the "favicon" permission.
function getFaviconUrl(url) {
    try {
        new URL(url);
        const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
        faviconUrl.searchParams.set('pageUrl', url);
        faviconUrl.searchParams.set('size', '32');
        return faviconUrl.toString();
    } catch (error) {
        return null;
    }
}

// Get initials from title
function getInitials(title) {
    if (!title) return '??';
    return title.split(/\s+/)
        // Skip words like "-" so "Demo App - 2" becomes "DA", not "DA-2"
        .filter(word => /^[\p{L}\p{N}]/u.test(word))
        .map(word => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

// Navigate to a specific folder
async function navigateToFolder(folderId) {
    await loadFavorites(folderId);
}

// Navigate back to parent folder
async function navigateUp() {
    const parentId = currentFolderNode && currentFolderNode.parentId;

    // Top-level folders (and anything directly in "Other bookmarks", which is shown
    // inline) go back to All bookmarks rather than to a folder the grid never shows
    if (!parentId || parentId === '0' || flattenedFolderIds.has(parentId)) {
        await loadFavorites(ALL_BOOKMARKS_ID);
        return;
    }

    await loadFavorites(parentId);
}

// Render breadcrumb navigation
async function renderBreadcrumb() {
    const container = document.getElementById('breadcrumbNav');
    if (!container) return;

    container.innerHTML = '';

    // Nothing to navigate back to at the top level
    if (!currentFolderNode || currentFolderNode.id === ALL_BOOKMARKS_ID) return;

    // Add home/root button
    const homeBtn = document.createElement('button');
    homeBtn.className = 'breadcrumb-btn breadcrumb-home';
    homeBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
    `;
    homeBtn.title = 'Back to all bookmarks';
    homeBtn.setAttribute('aria-label', 'Back to all bookmarks');
    homeBtn.addEventListener('click', () => loadFavorites(ALL_BOOKMARKS_ID));
    container.appendChild(homeBtn);

    // Add back button if not at root
    if (currentFolderNode && currentFolderNode.id !== ALL_BOOKMARKS_ID) {
        const backBtn = document.createElement('button');
        backBtn.className = 'breadcrumb-btn breadcrumb-back';
        backBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back
        `;
        backBtn.title = 'Go back to parent folder';
        backBtn.addEventListener('click', navigateUp);
        container.appendChild(backBtn);

        // Show current folder name
        if (currentFolderNode.title) {
            const folderName = document.createElement('span');
            folderName.className = 'breadcrumb-current';
            folderName.textContent = currentFolderNode.title;
            container.appendChild(folderName);
        }
    }
}

// Open URL in new tab
function openUrl(url) {
    if (!url) return;
    chrome.tabs.create({ url: url });
}

// Make a clickable tile reachable with Tab and operable with Enter/Space
function makeActivatable(element, role) {
    element.tabIndex = 0;
    element.setAttribute('role', role);
    element.addEventListener('keydown', event => {
        // Leave keys pressed on nested controls (e.g. a delete button) alone
        if (event.target !== element) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            element.click();
        }
    });
}

// Show a validation or save error inside a modal instead of an alert() dialog
function showFormError(modalId, message, input = null) {
    const modal = document.getElementById(modalId);
    const errorElement = modal && modal.querySelector('.form-error');

    if (!errorElement) {
        console.error(message);
        return;
    }

    clearFormError(modalId);
    errorElement.textContent = message;
    errorElement.hidden = false;

    if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
    }
}

function clearFormError(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const errorElement = modal.querySelector('.form-error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.hidden = true;
    }
    modal.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
}

function focusFirstField(modal) {
    const field = modal.querySelector('input, select');
    if (field) setTimeout(() => field.focus(), 50);
}

// Custom button functionality
function openAddCustomButton() {
    const modal = document.getElementById('customButtonModal');
    if (!modal) return;
    modal.style.display = 'block';
    focusFirstField(modal);
}

function closeModal() {
    const modal = document.getElementById('customButtonModal');
    if (modal) modal.style.display = 'none';
    clearFormError('customButtonModal');
    
    // Clear form
    const buttonName = document.getElementById('buttonName');
    const buttonValue = document.getElementById('buttonValue');
    const buttonIcon = document.getElementById('buttonIcon');
    const buttonAction = document.getElementById('buttonAction');
    
    if (buttonName) buttonName.value = '';
    if (buttonValue) buttonValue.value = '';
    if (buttonIcon) buttonIcon.value = '';
    if (buttonAction) buttonAction.value = 'url';
    
    updateActionPlaceholder();
}

function updateActionPlaceholder() {
    const actionSelect = document.getElementById('buttonAction');
    const valueInput = document.getElementById('buttonValue');
    
    if (!actionSelect || !valueInput) return;
    
    const action = actionSelect.value;
    const placeholders = {
        url: 'https://example.com',
        chrome: 'chrome://settings/',
        search: 'your search term',
        bookmark: 'bookmark title or URL'
    };
    
    valueInput.placeholder = placeholders[action] || 'Enter value';
}

async function saveCustomButton() {
    const nameInput = document.getElementById('buttonName');
    const actionSelect = document.getElementById('buttonAction');
    const valueInput = document.getElementById('buttonValue');
    const iconInput = document.getElementById('buttonIcon');
    
    if (!nameInput || !actionSelect || !valueInput) {
        console.error('Form elements not found');
        return;
    }
    
    const name = nameInput.value.trim();
    const action = actionSelect.value;
    const value = valueInput.value.trim();
    const icon = iconInput ? iconInput.value.trim() || '🔗' : '🔗';
    
    if (!name || !value) {
        showFormError('customButtonModal', 'Enter a name and a target.', name ? valueInput : nameInput);
        return;
    }
    
    const newButton = {
        id: Date.now().toString(),
        name,
        action,
        value,
        icon
    };
    
    customButtons.push(newButton);
    await saveCustomButtonsToStorage();
    renderCustomButtons();
    closeModal();
}

async function saveCustomButtonsToStorage() {
    try {
        await chrome.storage.local.set({ customButtons });
        console.log('Custom buttons saved');
    } catch (error) {
        console.error('Error saving custom buttons:', error);
    }
}

async function loadCustomButtons() {
    try {
        const result = await chrome.storage.local.get(['customButtons']);
        customButtons = result.customButtons || [];
        renderCustomButtons();
        console.log(`Loaded ${customButtons.length} custom buttons`);
    } catch (error) {
        console.error('Error loading custom buttons:', error);
    }
}

// Jira defaults, used until the user saves settings from the Jira settings modal
const JIRA_DEFAULTS = {
    baseUrl: 'https://zineone.atlassian.net',
    email: '',
    apiToken: '',
    // One view per line, "Name | JQL"
    jql: 'Mine | assignee = currentUser() AND statusCategory != done ORDER BY updated DESC',
    maxResults: 50
};

// Project used when a bare number is typed into search
const JIRA_DEFAULT_PROJECT = 'ZMOB';

// Placeholder credentials written to storage by earlier versions - treated as "not set"
const JIRA_PLACEHOLDERS = ['EMAIL_HERE', 'API_TOKEN_HERE', 'YOUR_API_TOKEN_HERE'];

// Status categories that have a matching .jira-status-* CSS class
const JIRA_STATUS_CATEGORIES = ['new', 'indeterminate', 'done'];

const JIRA_MAX_RESULTS_LIMIT = 100;

// Placeholder rows shown while issues load
const JIRA_SKELETON = '<div class="skeleton skeleton-row"></div>'.repeat(4);

// Load Jira configuration
async function loadJiraConfig() {
    try {
        const result = await chrome.storage.local.get(['jiraConfig', 'jiraSeen']);
        jiraConfig = { ...JIRA_DEFAULTS, ...(result.jiraConfig || {}) };

        if (result.jiraSeen) {
            jiraSeen = result.jiraSeen;
        } else {
            jiraSeen = { since: Date.now(), keys: {} };
            await chrome.storage.local.set({ jiraSeen });
        }
    } catch (error) {
        console.error('Error loading Jira config:', error);
        jiraConfig = { ...JIRA_DEFAULTS };
    }

    if (JIRA_PLACEHOLDERS.includes(jiraConfig.email)) jiraConfig.email = '';
    if (JIRA_PLACEHOLDERS.includes(jiraConfig.apiToken)) jiraConfig.apiToken = '';

    // Never log the config itself - it contains the API token
    console.log(isJiraConfigured() ? 'Jira config loaded' : 'Jira credentials not configured');
}

function isJiraConfigured() {
    return Boolean(jiraConfig && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken);
}

// Origin of a URL (e.g. https://x.atlassian.net), or null if it can't be parsed
function getOrigin(url) {
    try {
        return new URL(url).origin;
    } catch (_) {
        return null;
    }
}

// Normalize user input to a Jira base URL, or return null if it isn't a valid https URL
function normalizeJiraBaseUrl(value) {
    let input = value.trim();
    if (!input) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
        input = `https://${input}`;
    }

    try {
        const url = new URL(input);
        // Basic auth sends the token with every request, so require TLS
        if (url.protocol !== 'https:') return null;
        // Jira Cloud's API lives at the site root; self-hosted Jira may use a context path
        if (url.hostname.endsWith('.atlassian.net')) return url.origin;
        return url.origin + url.pathname.replace(/\/+$/, '');
    } catch (_) {
        return null;
    }
}

// Authenticated call to the Jira REST API. Resolves to the parsed JSON body
// (null for 204 No Content); throws an Error with a user-facing message.
async function jiraRequest(path, { method = 'GET', body } = {}) {
    if (!jiraConfig) await loadJiraConfig();

    if (!isJiraConfigured()) {
        throw new Error('Jira credentials not configured. Open Jira settings to add them.');
    }

    const origin = getOrigin(jiraConfig.baseUrl);
    if (!origin) {
        throw new Error('Jira URL is invalid. Open Jira settings to fix it.');
    }

    // Instances other than the default need access granted from the settings modal
    const hasAccess = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (!hasAccess) {
        throw new Error(`No access to ${origin}. Open Jira settings and save to grant access.`);
    }

    const auth = btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`);
    const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${jiraConfig.baseUrl}${path}`, {
        method,
        headers,
        credentials: 'omit',
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Jira API error details:', errorText);

        if (response.status === 401) {
            throw new Error('Authentication failed. Check your email and API token in Jira settings.');
        } else if (response.status === 403) {
            throw new Error('Access denied. Check your Jira permissions.');
        } else if (response.status === 410) {
            throw new Error('Jira API endpoint deprecated or unavailable. Please check your Jira instance configuration.');
        }

        // Jira explains 400s (bad JQL, missing required fields) in errorMessages/errors
        let detail = '';
        try {
            const data = JSON.parse(errorText);
            detail = [...(data.errorMessages || []), ...Object.values(data.errors || {})].join(' ');
        } catch (_) { /* not JSON */ }
        throw new Error(detail || `Jira API error: ${response.status} ${response.statusText}`);
    }

    return response.status === 204 ? null : response.json();
}

// Fetch issues matching a JQL query
async function fetchJiraIssues(jql) {
    // Use the new /search/jql endpoint (old /search is deprecated)
    const data = await jiraRequest('/rest/api/3/search/jql', {
        method: 'POST',
        body: {
            jql,
            maxResults: jiraConfig.maxResults,
            fields: ['summary', 'status', 'updated']
        }
    });
    return data.issues || [];
}

// The configured views, parsed from the multi-line JQL setting
function getJiraViews() {
    return parseJiraViews((jiraConfig && jiraConfig.jql) || JIRA_DEFAULTS.jql);
}

// "Name | JQL" per line; a line without "|" is JQL only (settings saved before views existed)
function parseJiraViews(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const bar = line.indexOf('|');
            return bar > 0
                ? { name: line.slice(0, bar).trim(), jql: line.slice(bar + 1).trim() }
                : { name: index === 0 ? 'Mine' : `View ${index + 1}`, jql: line };
        })
        .filter(view => view.jql);
}

// View switcher, only shown when there's more than one view
function renderJiraViews() {
    const container = document.getElementById('jiraViews');
    if (!container) return;

    container.innerHTML = '';
    const views = getJiraViews();
    if (!isJiraConfigured() || views.length < 2) return;

    views.forEach((view, index) => {
        const button = document.createElement('button');
        button.className = 'jira-view-btn';
        button.textContent = view.name;
        button.title = view.jql;
        button.setAttribute('aria-pressed', String(index === jiraViewIndex));
        button.addEventListener('click', () => {
            if (index === jiraViewIndex) return;
            jiraViewIndex = index;
            loadJiraIssues();
        });
        container.appendChild(button);
    });
}

// Load and display Jira issues for the selected view
async function loadJiraIssues() {
    const container = document.getElementById('jiraContent');
    const statsContainer = document.getElementById('jiraStats');

    if (!container) return;

    if (!jiraConfig) await loadJiraConfig();

    const views = getJiraViews();
    if (jiraViewIndex >= views.length) jiraViewIndex = 0;
    renderJiraViews();

    if (!isJiraConfigured()) {
        renderJiraSetupPrompt();
        return;
    }

    const seq = ++jiraLoadSeq;

    try {
        container.innerHTML = JIRA_SKELETON;
        container.setAttribute('aria-busy', 'true');
        if (statsContainer) statsContainer.textContent = '';

        const issues = await fetchJiraIssues(views[jiraViewIndex].jql);
        if (seq !== jiraLoadSeq) return; // Another view was picked meanwhile

        jiraData = issues;
        renderJiraIssues();

        console.log(`Loaded ${issues.length} Jira issues`);
    } catch (error) {
        if (seq !== jiraLoadSeq) return;
        console.error('Error loading Jira issues:', error);

        container.innerHTML = `
            <div class="jira-error">
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div class="jira-error-title">Failed to load Jira issues</div>
                <div class="jira-error-message"></div>
            </div>
        `;
        // Set as text so error details can't inject markup
        container.querySelector('.jira-error-message').textContent = error.message;
        container.querySelector('.jira-error').appendChild(createJiraSettingsButton('Open Jira settings'));

        if (statsContainer) {
            statsContainer.textContent = 'Error loading data';
        }
    } finally {
        if (seq === jiraLoadSeq) container.setAttribute('aria-busy', 'false');
    }
}

// Shown in place of issues until credentials are saved
function renderJiraSetupPrompt() {
    const container = document.getElementById('jiraContent');
    const statsContainer = document.getElementById('jiraStats');

    if (!container) return;

    jiraData = [];
    container.innerHTML = '';
    container.setAttribute('aria-busy', 'false');

    const setup = document.createElement('div');
    setup.className = 'jira-setup';

    const message = document.createElement('div');
    message.textContent = 'Connect your Jira account to see your assigned issues.';

    setup.appendChild(message);
    setup.appendChild(createJiraSettingsButton('Configure Jira'));
    container.appendChild(setup);

    if (statsContainer) statsContainer.textContent = 'Not configured';
}

function createJiraSettingsButton(label) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', openJiraSettingsModal);
    return button;
}

// Render Jira issues to DOM
function renderJiraIssues() {
    const container = document.getElementById('jiraContent');
    const statsContainer = document.getElementById('jiraStats');

    if (!container) return;

    if (jiraData.length === 0) {
        container.innerHTML = '<div class="loading">No issues in this view</div>';
        if (statsContainer) statsContainer.textContent = '';
        return;
    }

    // Define status priority for sorting (lower number = higher priority)
    const statusPriority = {
        'In Review': 1,
        'Code Review': 1,
        'Review': 1,
        'In Progress': 2,
        'To Do': 3,
        'Todo': 3,
        'Backlog': 4
    };

    // Sort issues by status priority
    const sortedIssues = [...jiraData].sort((a, b) => {
        const statusA = a.fields.status.name;
        const statusB = b.fields.status.name;
        const priorityA = statusPriority[statusA] || 999; // Unknown statuses go to the end
        const priorityB = statusPriority[statusB] || 999;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // If same priority, sort by updated date (most recent first)
        return new Date(b.fields.updated) - new Date(a.fields.updated);
    });

    // Calculate stats by status
    const statusCounts = {};
    sortedIssues.forEach(issue => {
        const status = issue.fields.status.name;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Display stats
    if (statsContainer) {
        const statsText = `${sortedIssues.length} total`;
        const statusParts = Object.entries(statusCounts)
            .map(([status, count]) => `${count} ${status}`)
            .join(', ');
        const updatedCount = sortedIssues.filter(isJiraIssueUpdated).length;
        const updatedText = updatedCount ? ` · ${updatedCount} updated` : '';
        statsContainer.textContent = `${statsText} (${statusParts})${updatedText}`;
    }

    // Render issues
    container.innerHTML = '';

    sortedIssues.forEach(issue => {
        const issueElement = createJiraIssueElement(issue);
        container.appendChild(issueElement);
    });
}

// Fade the bottom edge of the issue list while more issues are hidden below
function updateJiraScrollFade() {
    const container = document.getElementById('jiraContent');
    if (!container) return;
    const hiddenBelow = container.scrollHeight - container.scrollTop - container.clientHeight > 4;
    container.classList.toggle('has-more', hiddenBelow);
}

// Create individual issue DOM element
function createJiraIssueElement(issue) {
    const issueDiv = document.createElement('div');
    issueDiv.className = 'jira-issue';
    issueDiv.addEventListener('click', () => openJiraIssue(issue.key));
    makeActivatable(issueDiv, 'link');

    // Only known categories are used in the class name
    const categoryKey = issue.fields.status.statusCategory?.key;
    const statusCategory = JIRA_STATUS_CATEGORIES.includes(categoryKey) ? categoryKey : 'new';

    issueDiv.innerHTML = `
        <div class="jira-issue-key"></div>
        <div class="jira-issue-content">
            <div class="jira-issue-title"></div>
            <button class="jira-status-badge jira-status-${statusCategory}" aria-haspopup="menu"></button>
        </div>
        <svg class="icon jira-arrow" viewBox="0 0 24 24">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
    `;

    // Jira fields are set as text, never parsed as HTML
    issueDiv.querySelector('.jira-issue-key').textContent = issue.key;
    issueDiv.querySelector('.jira-issue-title').textContent = issue.fields.summary;

    const badge = issueDiv.querySelector('.jira-status-badge');
    badge.textContent = issue.fields.status.name;
    badge.setAttribute('aria-label', `Status: ${issue.fields.status.name}. Change status`);
    badge.addEventListener('click', event => {
        event.stopPropagation(); // Don't open the issue
        openTransitionMenu(issue, badge);
    });

    if (isJiraIssueUpdated(issue)) {
        issueDiv.classList.add('is-updated');
        const note = document.createElement('span');
        note.className = 'visually-hidden';
        note.textContent = 'Updated since you last opened it';
        issueDiv.querySelector('.jira-issue-content').appendChild(note);
    }

    return issueDiv;
}

// Updated in Jira after it was last opened from here (or after first run, if never opened)
function isJiraIssueUpdated(issue) {
    return Date.parse(issue.fields.updated) > (jiraSeen.keys[issue.key] || jiraSeen.since);
}

// ponytail: compares Jira's server clock to this machine's; a few seconds of skew can
// leave your own change flagged. Store the issue's `updated` instead if that shows up.
function markJiraSeen(issueKey) {
    jiraSeen.keys[issueKey] = Date.now();
    chrome.storage.local.set({ jiraSeen }).catch(error => console.error('Error saving Jira seen state:', error));
    if (jiraData.some(issue => issue.key === issueKey)) renderJiraIssues();
}

// Open Jira issue in new tab
function openJiraIssue(issueKey) {
    if (!issueKey) return;

    const baseUrl = (jiraConfig || JIRA_DEFAULTS).baseUrl;
    chrome.tabs.create({ url: `${baseUrl}/browse/${encodeURIComponent(issueKey)}` });
    markJiraSeen(issueKey);
}

// Status menu: lists the issue's available transitions and applies the one picked
async function openTransitionMenu(issue, badge) {
    const menu = document.getElementById('jiraTransitionMenu');
    if (!menu) return;

    // The menu is positioned against whichever badge carries the anchor name (CSS anchor positioning)
    document.querySelectorAll('.jira-status-badge').forEach(other => { other.style.anchorName = ''; });
    badge.style.anchorName = '--transition-anchor';

    if (menu.matches(':popover-open')) menu.hidePopover();
    menu.dataset.issueKey = issue.key;
    menu.removeAttribute('role'); // Set to "menu" once there are options
    menu.innerHTML = '<div class="transition-status">Loading…</div>';
    menu.showPopover({ source: badge }); // source: focus returns to the badge on close

    try {
        const data = await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(issue.key)}/transitions`);
        if (menu.dataset.issueKey !== issue.key) return; // Opened for another issue meanwhile

        menu.innerHTML = '';
        const transitions = data.transitions || [];
        if (transitions.length === 0) {
            showTransitionStatus(menu, 'No status changes available.');
            return;
        }

        transitions.forEach(transition => {
            const option = document.createElement('button');
            option.className = 'transition-option';
            option.setAttribute('role', 'menuitem');

            const categoryKey = transition.to?.statusCategory?.key;
            const dot = document.createElement('span');
            dot.className = `transition-dot dot-${JIRA_STATUS_CATEGORIES.includes(categoryKey) ? categoryKey : 'new'}`;

            const label = document.createElement('span');
            label.textContent = transition.to?.name || transition.name;
            if (transition.name !== label.textContent) option.title = transition.name;

            option.append(dot, label);
            option.addEventListener('click', () => applyTransition(issue, transition, menu, option));
            menu.appendChild(option);
        });
        menu.setAttribute('role', 'menu');
        menu.querySelector('.transition-option').focus();
    } catch (error) {
        if (menu.dataset.issueKey !== issue.key) return;
        menu.innerHTML = '';
        showTransitionStatus(menu, error.message);
    }
}

function showTransitionStatus(menu, message) {
    const status = document.createElement('div');
    status.className = 'transition-status';
    status.textContent = message;
    menu.appendChild(status);
}

async function applyTransition(issue, transition, menu, option) {
    menu.querySelectorAll('.transition-option').forEach(other => { other.disabled = true; });
    menu.querySelectorAll('.transition-status').forEach(status => status.remove());

    try {
        await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(issue.key)}/transitions`, {
            method: 'POST',
            body: { transition: { id: transition.id } }
        });
        menu.hidePopover();
        markJiraSeen(issue.key); // Your own change isn't news
        await loadJiraIssues();
    } catch (error) {
        console.error('Error changing Jira status:', error);
        menu.querySelectorAll('.transition-option').forEach(other => { other.disabled = false; });
        option.focus(); // Disabling it dropped focus out of the menu
        // Usually a transition that needs a screen (e.g. resolution) - Jira's message says which field
        showTransitionStatus(menu, error.message);
    }
}

// Jira settings modal
function getJiraSettingsInputs() {
    const inputs = {
        baseUrl: document.getElementById('jiraBaseUrl'),
        email: document.getElementById('jiraEmail'),
        apiToken: document.getElementById('jiraApiToken'),
        jql: document.getElementById('jiraJql'),
        maxResults: document.getElementById('jiraMaxResults')
    };
    return Object.values(inputs).every(Boolean) ? inputs : null;
}

function openJiraSettingsModal() {
    const modal = document.getElementById('jiraSettingsModal');
    const inputs = getJiraSettingsInputs();

    if (!modal || !inputs) return;

    const config = jiraConfig || JIRA_DEFAULTS;

    inputs.baseUrl.value = config.baseUrl || '';
    inputs.email.value = config.email || '';
    inputs.jql.value = config.jql || JIRA_DEFAULTS.jql;
    inputs.maxResults.value = config.maxResults || JIRA_DEFAULTS.maxResults;

    // The saved token is never written back into the page; blank means "keep it"
    inputs.apiToken.value = '';
    inputs.apiToken.placeholder = config.apiToken
        ? 'Saved - leave blank to keep current token'
        : 'Paste your Jira API token';

    modal.style.display = 'block';

    // Focus the first field that still needs a value
    setTimeout(() => {
        const firstEmpty = [inputs.baseUrl, inputs.email].find(input => !input.value)
            || (config.apiToken ? null : inputs.apiToken);
        (firstEmpty || inputs.baseUrl).focus();
    }, 100);
}

function closeJiraSettingsModal() {
    const modal = document.getElementById('jiraSettingsModal');
    if (modal) modal.style.display = 'none';
    clearFormError('jiraSettingsModal');

    // Don't leave a typed token sitting in the DOM
    const tokenInput = document.getElementById('jiraApiToken');
    if (tokenInput) tokenInput.value = '';
}

async function saveJiraSettings() {
    const inputs = getJiraSettingsInputs();

    if (!inputs) {
        console.error('Form elements not found');
        return;
    }

    // Validation runs synchronously so the permission prompt below still counts as
    // part of the click (chrome.permissions.request requires a user gesture)
    const baseUrl = normalizeJiraBaseUrl(inputs.baseUrl.value);
    if (!baseUrl) {
        showFormError('jiraSettingsModal', 'Enter a valid https:// Jira URL, e.g. https://your-domain.atlassian.net', inputs.baseUrl);
        return;
    }

    const email = inputs.email.value.trim();
    if (!email) {
        showFormError('jiraSettingsModal', 'Enter the email for your Jira account.', inputs.email);
        return;
    }

    // A blank token keeps the saved one, but only for the same Jira instance,
    // so a token is never sent to a new host without being re-entered
    const origin = getOrigin(baseUrl);
    const canKeepToken = Boolean(jiraConfig && jiraConfig.apiToken && getOrigin(jiraConfig.baseUrl) === origin);
    const apiToken = inputs.apiToken.value.trim() || (canKeepToken ? jiraConfig.apiToken : '');
    if (!apiToken) {
        showFormError('jiraSettingsModal', 'Enter your Jira API token.', inputs.apiToken);
        return;
    }

    const jql = inputs.jql.value.trim() || JIRA_DEFAULTS.jql;
    const viewLines = jql.split('\n').filter(line => line.trim());
    if (parseJiraViews(jql).length !== viewLines.length) {
        showFormError('jiraSettingsModal', 'Each view needs JQL after the "|", e.g. Mine | assignee = currentUser()', inputs.jql);
        return;
    }

    const maxResultsText = inputs.maxResults.value.trim();
    const maxResults = maxResultsText ? Number(maxResultsText) : JIRA_DEFAULTS.maxResults;
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > JIRA_MAX_RESULTS_LIMIT) {
        showFormError('jiraSettingsModal', `Max results must be a whole number from 1 to ${JIRA_MAX_RESULTS_LIMIT}.`, inputs.maxResults);
        return;
    }

    // Resolves immediately without a prompt if access is already granted
    let granted = false;
    try {
        granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch (error) {
        console.error('Error requesting Jira host permission:', error);
    }

    if (!granted) {
        showFormError('jiraSettingsModal', `Chrome access to ${origin} is needed to load issues. Save again and choose Allow.`);
        return;
    }

    const newConfig = { baseUrl, email, apiToken, jql, maxResults };

    try {
        await chrome.storage.local.set({ jiraConfig: newConfig });
    } catch (error) {
        console.error('Error saving Jira settings:', error);
        showFormError('jiraSettingsModal', 'Couldn\'t save Jira settings. Try again.');
        return;
    }

    jiraConfig = newConfig;
    console.log('Jira settings saved');

    closeJiraSettingsModal();
    await loadJiraIssues();
}

// Remove the saved email and token, keeping URL/JQL preferences
async function clearJiraSettings() {
    if (!confirm('Remove the saved Jira email and API token from this browser?')) return;

    const clearedConfig = { ...(jiraConfig || JIRA_DEFAULTS), email: '', apiToken: '' };

    try {
        await chrome.storage.local.set({ jiraConfig: clearedConfig });
    } catch (error) {
        console.error('Error clearing Jira settings:', error);
        showFormError('jiraSettingsModal', 'Couldn\'t clear Jira credentials. Try again.');
        return;
    }

    jiraConfig = clearedConfig;
    console.log('Jira credentials cleared');

    closeJiraSettingsModal();
    await loadJiraIssues();
}

function renderCustomButtons() {
    const container = document.getElementById('customButtonsGrid');

    if (!container) return;

    // The card stays visible even when empty so its "+" button can add the first one
    if (customButtons.length === 0) {
        container.innerHTML = '<div class="loading">No shortcuts yet. Use + to add links, Chrome pages or searches you open often.</div>';
        return;
    }

    container.innerHTML = '';
    
    customButtons.forEach(button => {
        const buttonElement = document.createElement('div');
        buttonElement.className = 'custom-button';
        buttonElement.addEventListener('click', () => executeCustomButtonAction(button));
        makeActivatable(buttonElement, 'button');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-custom-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove shortcut';
        deleteBtn.setAttribute('aria-label', `Remove ${button.name}`);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCustomButton(button.id);
        });
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'custom-button-icon';
        iconDiv.textContent = button.icon;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'custom-button-name';
        nameDiv.textContent = button.name;
        
        buttonElement.appendChild(deleteBtn);
        buttonElement.appendChild(iconDiv);
        buttonElement.appendChild(nameDiv);
        
        container.appendChild(buttonElement);
    });
}

function executeCustomButtonAction(button) {
    switch (button.action) {
        case 'url':
        case 'chrome':
            openUrl(button.value);
            break;
        case 'search':
            openUrl(webSearchUrl(button.value));
            break;
        case 'bookmark':
            searchAndOpenBookmark(button.value);
            break;
    }
}

async function searchAndOpenBookmark(query) {
    try {
        const bookmarks = await chrome.bookmarks.search(query);
        if (bookmarks.length > 0) {
            openUrl(bookmarks[0].url);
        } else {
            console.log('Bookmark not found'); // Or update a status message in the UI
        }
    } catch (error) {
        console.error('Error searching bookmark:', error);
    }
}

async function deleteCustomButton(buttonId) {
    customButtons = customButtons.filter(button => button.id !== buttonId);
    await saveCustomButtonsToStorage();
    renderCustomButtons();
}

// Add favorite functionality
function openAddFavoriteModal() {
    const modal = document.getElementById('addFavoriteModal');
    if (!modal) return;
    modal.style.display = 'block';
    focusFirstField(modal);
}

function closeFavoriteModal() {
    const modal = document.getElementById('addFavoriteModal');
    if (modal) modal.style.display = 'none';
    clearFormError('addFavoriteModal');

    // Clear form
    const titleInput = document.getElementById('favoriteTitle');
    const urlInput = document.getElementById('favoriteUrl');
    const positionSelect = document.getElementById('favoritePosition');

    if (titleInput) titleInput.value = '';
    if (urlInput) urlInput.value = '';
    if (positionSelect) positionSelect.value = 'end';
}

// Create folder functionality
function openCreateFolderModal() {
    const modal = document.getElementById('createFolderModal');
    const locationDisplay = document.getElementById('folderLocation');

    if (!modal) return;

    // Update location display to show where folder will be created
    if (locationDisplay) {
        if (currentFolderNode && currentFolderNode.title) {
            locationDisplay.textContent = currentFolderNode.title;
        } else {
            locationDisplay.textContent = 'All bookmarks';
        }
    }

    // Focus on the input field
    modal.style.display = 'block';
    setTimeout(() => {
        const folderNameInput = document.getElementById('folderName');
        if (folderNameInput) folderNameInput.focus();
    }, 100);
}

function closeFolderModal() {
    const modal = document.getElementById('createFolderModal');
    if (modal) modal.style.display = 'none';
    clearFormError('createFolderModal');

    // Clear form
    const folderNameInput = document.getElementById('folderName');
    if (folderNameInput) folderNameInput.value = '';
}

/**
 * Creates a new folder in the current location
 * Uses Chrome Bookmarks API to create a folder bookmark node
 * Handles validation and error cases
 */
async function createFolder() {
    const folderNameInput = document.getElementById('folderName');

    if (!folderNameInput) {
        console.error('Form elements not found');
        return;
    }

    const folderName = folderNameInput.value.trim();

    // Validation: Check for empty folder name
    if (!folderName) {
        showFormError('createFolderModal', 'Enter a folder name.', folderNameInput);
        return;
    }

    // Validation: Check for reasonable length (Chrome limit is 255 chars)
    if (folderName.length > 255) {
        showFormError('createFolderModal', 'Folder names can be at most 255 characters.', folderNameInput);
        return;
    }

    try {
        // Determine parent folder ID
        // If we're viewing a specific folder, create inside it
        // Otherwise, create in bookmarks bar
        // All bookmarks is virtual - new folders there go into "Other bookmarks", as in Chrome
        const parentId = currentFolderId === ALL_BOOKMARKS_ID || !currentFolderId
            ? (otherBookmarksId || bookmarksBarId)
            : currentFolderId;

        if (!parentId) {
            showFormError('createFolderModal', 'Couldn\'t find the folder to create this in. Refresh and try again.');
            return;
        }

        console.log(`Creating folder "${folderName}" in parent: ${parentId}`);

        // Create folder using Chrome Bookmarks API
        // Note: Folders are created WITHOUT a 'url' field
        const newFolder = await chrome.bookmarks.create({
            parentId: parentId,
            title: folderName
            // No 'url' field = folder (not a bookmark)
        });

        console.log('Folder created successfully:', newFolder);

        // Close modal
        closeFolderModal();

        // Refresh the favorites display to show the new folder
        await loadFavorites(currentFolderId);

        // Optional: Show success feedback
        // You could add a toast notification here

    } catch (error) {
        console.error('Error creating folder:', error);

        // Provide user-friendly error messages
        if (error.message.includes('permission')) {
            showFormError('createFolderModal', 'Permission denied. Check the extension\'s bookmark permission.');
        } else if (error.message.includes('not found')) {
            showFormError('createFolderModal', 'That folder no longer exists. Refresh and try again.');
        } else {
            showFormError('createFolderModal', `Couldn't create the folder: ${error.message}`);
        }
    }
}

async function saveFavorite() {
    const titleInput = document.getElementById('favoriteTitle');
    const urlInput = document.getElementById('favoriteUrl');
    const positionSelect = document.getElementById('favoritePosition');
    
    if (!titleInput || !urlInput || !positionSelect) {
        console.error('Form elements not found');
        return;
    }
    
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();
    const position = positionSelect.value;
    
    if (!title || !url) {
        showFormError('addFavoriteModal', 'Enter a title and a URL.', title ? urlInput : titleInput);
        return;
    }
    
    // Validate URL format
    if (!isValidUrl(url)) {
        showFormError('addFavoriteModal', 'Enter a full URL, including https://', urlInput);
        return;
    }
    
    try {
        // Use the same bookmarks bar the favorites grid displays
        const barId = bookmarksBarId || findBookmarksBar(await chrome.bookmarks.getTree())?.id;

        if (!barId) {
            showFormError('addFavoriteModal', 'Couldn\'t find the bookmarks bar.');
            return;
        }

        // Create new bookmark
        const newBookmark = {
            parentId: barId,
            title: title,
            url: url
        };
        
        // Add index for position
        if (position === 'beginning') {
            newBookmark.index = 0;
        }
        
        await chrome.bookmarks.create(newBookmark);
        
        console.log('Favorite added successfully');
        closeFavoriteModal();
        
        // Show the bookmarks bar so the new favorite is visible
        await loadFavorites(barId);
        
    } catch (error) {
        console.error('Error adding favorite:', error);
        showFormError('addFavoriteModal', 'Couldn\'t add the favorite. Try again.');
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function webSearchUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getHostname(url) {
    try {
        return new URL(url).hostname || url;
    } catch (_) {
        return url;
    }
}

// Blank new tab pages (including this one) - left out of tab search and recently closed
function isNewTabUrl(url) {
    return !url || url.startsWith('chrome://newtab') || url.startsWith(chrome.runtime.getURL(''));
}

// Favicon from Chrome's cache in an icon box, keeping the box's text as the fallback
function setRowIcon(icon, url) {
    const faviconUrl = url && getFaviconUrl(url);
    if (!faviconUrl) return;
    const fallback = icon.textContent;
    const img = document.createElement('img');
    img.src = faviconUrl;
    img.alt = '';
    img.onerror = () => { icon.textContent = fallback; };
    icon.textContent = '';
    icon.appendChild(img);
}

// ==========================================================================
// Search palette
// ==========================================================================

function setupSearch() {
    const input = document.getElementById('mainSearchInput');
    const submit = document.getElementById('searchSubmit');
    if (!input) return;

    input.addEventListener('input', updateSearchResults);
    input.addEventListener('focus', updateSearchResults);
    input.addEventListener('blur', () => setSearchListOpen(false));

    input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (searchResults.length === 0) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            selectSearchResult((searchSelected + step + searchResults.length) % searchResults.length);
        } else if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            runSelectedSearchResult();
        } else if (event.key === 'Escape') {
            if (input.value) {
                input.value = '';
                updateSearchResults();
            } else {
                input.blur();
            }
        }
    });

    if (submit) submit.addEventListener('click', runSelectedSearchResult);

    // "/" jumps to search from anywhere on the page, unless typing somewhere else
    document.addEventListener('keydown', event => {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target.closest('input, textarea, select, [contenteditable]')) return;
        if (document.querySelector('.modal[style*="block"]')) return;
        event.preventDefault();
        input.focus();
    });
}

// Ticket key for a query: "123" means the default project, "ABC-45" any project
function parseTicketKey(query) {
    if (/^\d+$/.test(query)) return `${JIRA_DEFAULT_PROJECT}-${query}`;
    return /^[a-z][a-z0-9_]*-\d+$/i.test(query) ? query.toUpperCase() : null;
}

// URL to open when the query looks like one ("github.com/x", "localhost:3000"), else null
function toUrl(query) {
    if (/^(https?|chrome):\/\/\S+$/i.test(query)) return query;
    if (/^localhost(:\d+)?(\/\S*)?$/i.test(query)) return `http://${query}`;
    if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(query)) return `https://${query}`;
    return null;
}

async function buildSearchResults(query) {
    const terms = query.toLowerCase().split(/\s+/);
    const matches = text => terms.every(term => text.toLowerCase().includes(term));
    const jiraUrl = (jiraConfig || JIRA_DEFAULTS).baseUrl;
    const results = [];

    const ticketKey = parseTicketKey(query);
    if (ticketKey) {
        const known = jiraData.find(issue => issue.key === ticketKey);
        results.push({
            kind: 'Jira', title: `Open ${ticketKey}`, detail: known && known.fields.summary,
            iconUrl: jiraUrl, run: () => openJiraIssue(ticketKey)
        });
    }

    const url = toUrl(query);
    if (url) results.push({ kind: 'Open', title: url, iconUrl: url, run: () => openUrl(url) });

    const [tabs, bookmarks] = await Promise.all([
        chrome.tabs.query({}).catch(() => []),
        chrome.bookmarks.search(query).catch(() => [])
    ]);

    tabs.filter(tab => !isNewTabUrl(tab.url) && matches(`${tab.title} ${tab.url}`))
        .slice(0, 5)
        .forEach(tab => results.push({
            kind: 'Tab', title: tab.title || tab.url, detail: getHostname(tab.url),
            iconUrl: tab.url, run: () => switchToTab(tab)
        }));

    jiraData.filter(issue => issue.key !== ticketKey && matches(`${issue.key} ${issue.fields.summary}`))
        .slice(0, 5)
        .forEach(issue => results.push({
            kind: 'Jira', title: issue.fields.summary, detail: `${issue.key} · ${issue.fields.status.name}`,
            iconUrl: jiraUrl, run: () => openJiraIssue(issue.key)
        }));

    bookmarks.filter(bookmark => bookmark.url)
        .slice(0, 6)
        .forEach(bookmark => results.push({
            kind: 'Bookmark', title: bookmark.title || bookmark.url, detail: getHostname(bookmark.url),
            iconUrl: bookmark.url, run: () => openUrl(bookmark.url)
        }));

    customButtons.filter(button => matches(button.name))
        .slice(0, 3)
        .forEach(button => results.push({
            kind: 'Shortcut', title: button.name, icon: button.icon, run: () => executeCustomButtonAction(button)
        }));

    results.push({
        kind: 'Search', title: `Search Google for “${query}”`,
        iconUrl: 'https://www.google.com', run: () => openUrl(webSearchUrl(query))
    });

    return results;
}

async function updateSearchResults() {
    const input = document.getElementById('mainSearchInput');
    const query = input.value.trim();
    const seq = ++searchSeq;

    const results = query ? await buildSearchResults(query) : [];
    if (seq !== searchSeq) return; // A newer keystroke already rebuilt the list

    searchResults = results;
    searchResultsQuery = query;
    searchSelected = 0;
    renderSearchResults();
    setSearchListOpen(results.length > 0 && document.activeElement === input);
}

function renderSearchResults() {
    const list = document.getElementById('searchResults');
    list.innerHTML = '';

    searchResults.forEach((result, index) => {
        const item = document.createElement('li');
        item.id = `search-result-${index}`;
        item.className = 'search-result';
        item.setAttribute('role', 'option');
        // Keep focus in the input so blur doesn't close the list before the click lands
        item.addEventListener('mousedown', event => event.preventDefault());
        item.addEventListener('click', () => runSearchResult(result));

        const icon = document.createElement('span');
        icon.className = 'row-icon';
        icon.textContent = result.icon || result.kind[0];
        setRowIcon(icon, result.iconUrl);

        const text = document.createElement('span');
        text.className = 'search-result-text';
        const title = document.createElement('span');
        title.className = 'search-result-title';
        title.textContent = result.title;
        text.appendChild(title);
        if (result.detail) {
            const detail = document.createElement('span');
            detail.className = 'search-result-detail';
            detail.textContent = result.detail;
            text.appendChild(detail);
        }

        const kind = document.createElement('span');
        kind.className = 'search-result-kind';
        kind.textContent = result.kind;

        item.append(icon, text, kind);
        list.appendChild(item);
    });

    selectSearchResult(searchSelected);
}

function selectSearchResult(index) {
    searchSelected = index;
    const input = document.getElementById('mainSearchInput');
    document.querySelectorAll('.search-result').forEach((item, itemIndex) => {
        item.setAttribute('aria-selected', String(itemIndex === index));
    });

    const selected = document.getElementById(`search-result-${index}`);
    if (selected) {
        input.setAttribute('aria-activedescendant', selected.id);
        selected.scrollIntoView({ block: 'nearest' });
    } else {
        input.removeAttribute('aria-activedescendant');
    }
}

function setSearchListOpen(open) {
    document.getElementById('searchResults').hidden = !open;
    document.getElementById('mainSearchInput').setAttribute('aria-expanded', String(open));
}

async function runSelectedSearchResult() {
    const input = document.getElementById('mainSearchInput');
    // Enter can beat the async results for what was just typed
    if (searchResultsQuery !== input.value.trim()) await updateSearchResults();
    const result = searchResults[searchSelected];
    if (result) runSearchResult(result);
}

function runSearchResult(result) {
    document.getElementById('mainSearchInput').value = '';
    searchResults = [];
    searchResultsQuery = '';
    renderSearchResults();
    setSearchListOpen(false);
    result.run();
}

async function switchToTab(tab) {
    try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
    } catch (error) {
        // The tab was closed after the results were built
        console.error('Error switching tab:', error);
        openUrl(tab.url);
        return;
    }
    // Like Chrome's "Switch to this tab": don't leave this blank new tab behind
    const current = await chrome.tabs.getCurrent();
    if (current && current.id !== tab.id) chrome.tabs.remove(current.id);
}

// ==========================================================================
// Recently closed
// ==========================================================================

const RECENT_LIMIT = 8;

async function loadRecentlyClosed() {
    const container = document.getElementById('recentList');
    if (!container) return;

    if (!chrome.sessions) {
        container.innerHTML = '<div class="loading">Reload the extension to allow access to recently closed tabs.</div>';
        return;
    }

    try {
        // 25 is the API maximum; blank new tabs are filtered out before trimming
        const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
        const entries = sessions
            .filter(session => session.window || (session.tab && !isNewTabUrl(session.tab.url)))
            .slice(0, RECENT_LIMIT);

        container.innerHTML = '';
        if (entries.length === 0) {
            container.innerHTML = '<div class="loading">Nothing closed recently</div>';
            return;
        }

        entries.forEach(session => container.appendChild(createRecentItem(session)));
    } catch (error) {
        console.error('Error loading recently closed:', error);
        container.innerHTML = '<div class="loading">Couldn\'t load recently closed tabs</div>';
    }
}

function createRecentItem(session) {
    const item = document.createElement('div');
    item.className = 'recent-item';
    const sessionId = (session.tab || session.window).sessionId;
    item.addEventListener('click', () => {
        chrome.sessions.restore(sessionId).catch(error => console.error('Error restoring session:', error));
    });
    makeActivatable(item, 'button');

    const icon = document.createElement('span');
    icon.className = 'row-icon';

    const title = document.createElement('span');
    title.className = 'recent-title';

    if (session.tab) {
        const { url } = session.tab;
        title.textContent = session.tab.title || getHostname(url);
        item.title = url;
        icon.textContent = getInitials(title.textContent);
        setRowIcon(icon, url);
    } else {
        const tabs = session.window.tabs || [];
        title.textContent = `Window · ${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}`;
        item.title = tabs.map(tab => tab.title || tab.url).join('\n');
        icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H5V8h14v10z"/></svg>';
    }

    const time = document.createElement('span');
    time.className = 'recent-time';
    time.textContent = timeAgo(session.lastModified);

    item.append(icon, title, time);
    return item;
}

// "5m ago" from a time in seconds since the epoch (the sessions API's unit)
function timeAgo(seconds) {
    const minutes = Math.floor((Date.now() / 1000 - seconds) / 60);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
