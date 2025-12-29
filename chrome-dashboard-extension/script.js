// Global variables
let bookmarksData = [];
let customButtons = [];
let readingListData = [];
let jiraData = [];
let jiraConfig = null;

// Favorites navigation state
let currentFolderId = null; // Currently displayed folder ID
let currentFolderNode = null; // Full folder node object
let bookmarksBarId = null; // Store bookmarks bar ID for quick access

// Initialize extension
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chrome Dashboard Extension loaded');
    
    // Removed createParticles() call
    updateTime();
    setInterval(updateTime, 1000);
    
    loadFavorites();
    loadCustomButtons();
    loadJiraConfig();
    loadJiraIssues();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Custom search functionality
    const searchInput1 = document.getElementById('mainSearchInput');
    const searchSubmit = document.getElementById('searchSubmit');
    
    if (searchInput1 && searchSubmit) {
        // Handle Enter key in search input
        searchInput1.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
        
        // Handle search button click
        searchSubmit.addEventListener('click', performSearch);
    }
    
    // Refresh favorites
    const refreshBtn = document.getElementById('refreshFavorites');
    if (refreshBtn) refreshBtn.addEventListener('click', loadFavorites);
    
    // Add favorite
    const addFavBtn = document.getElementById('addFavorite');
    if (addFavBtn) addFavBtn.addEventListener('click', openAddFavoriteModal);

    // Add folder
    const addFolderBtn = document.getElementById('addFolder');
    if (addFolderBtn) addFolderBtn.addEventListener('click', openCreateFolderModal);

    // Refresh Jira
    const refreshJiraBtn = document.getElementById('refreshJira');
    if (refreshJiraBtn) refreshJiraBtn.addEventListener('click', loadJiraIssues);
    
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
}

// Create floating particles animation
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Update time display
function updateTime() {
    const timeDisplay = document.getElementById('timeDisplay');
    if (!timeDisplay) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit',
        minute: '2-digit' 
    });
    const dateString = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    timeDisplay.textContent = `${timeString} | ${dateString}`;
}

// Load favorites from Chrome bookmarks with folder navigation support
async function loadFavorites(folderId = null) {
    try {
        console.log('Loading favorites...', folderId ? `Folder: ${folderId}` : 'Root');
        const bookmarks = await chrome.bookmarks.getTree();
        const favoritesGrid = document.getElementById('favoritesGrid');

        if (!favoritesGrid) {
            console.error('Favorites grid element not found');
            return;
        }

        // Find bookmarks bar on first load
        if (!bookmarksBarId) {
            const bookmarkBar = bookmarks[0].children[1];

            if (!bookmarkBar) {
                favoritesGrid.innerHTML = '<div class="loading">Bookmarks bar not found</div>';
                return;
            }

            bookmarksBarId = bookmarkBar.id;
            currentFolderId = bookmarkBar.id;
            currentFolderNode = bookmarkBar;
        }

        // If folderId provided, fetch that specific folder
        if (folderId) {
            try {
                const folder = await chrome.bookmarks.getSubTree(folderId);
                if (folder && folder[0]) {
                    currentFolderId = folderId;
                    currentFolderNode = folder[0];
                }
            } catch (error) {
                console.error('Error loading folder:', error);
                // Fall back to bookmarks bar
                currentFolderId = bookmarksBarId;
            }
        }

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
        const favoritesGrid = document.getElementById('favoritesGrid');
        if (favoritesGrid) {
            favoritesGrid.innerHTML = '<div class="loading">Error loading favorites. Check permissions.</div>';
        }
    }
}

// Create favorite item element (for bookmarks)
function createFavoriteItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'favorite-item favorite-bookmark';
    item.addEventListener('click', () => openUrl(bookmark.url));

    // Try to use favicon, fall back to initials
    const icon = document.createElement('div');
    icon.className = 'favorite-icon';

    // Use Google favicon service or fall back to initials
    const faviconUrl = getFaviconUrl(bookmark.url);
    if (faviconUrl) {
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.alt = bookmark.title || 'Bookmark';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '8px';
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

    const icon = document.createElement('div');
    icon.className = 'favorite-icon folder-icon';
    // Use folder emoji/icon
    icon.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: #fbbf24;">
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
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        // Use Google's favicon service
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (error) {
        return null;
    }
}

// Get initials from title
function getInitials(title) {
    if (!title) return '??';
    return title.split(' ')
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
    if (!currentFolderNode || !currentFolderNode.parentId) {
        // Already at top, reload bookmarks bar
        await loadFavorites();
        return;
    }

    // Navigate to parent folder
    await loadFavorites(currentFolderNode.parentId);
}

// Render breadcrumb navigation
async function renderBreadcrumb() {
    const container = document.getElementById('breadcrumbNav');
    if (!container) return;

    container.innerHTML = '';

    // Add home/root button
    const homeBtn = document.createElement('button');
    homeBtn.className = 'breadcrumb-btn breadcrumb-home';
    homeBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
    `;
    homeBtn.title = 'Back to Bookmarks Bar';
    homeBtn.addEventListener('click', () => loadFavorites(bookmarksBarId));
    container.appendChild(homeBtn);

    // Add back button if not at root
    if (currentFolderNode && currentFolderNode.id !== bookmarksBarId) {
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

// Custom button functionality
function openAddCustomButton() {
    const modal = document.getElementById('customButtonModal');
    if (modal) modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('customButtonModal');
    if (modal) modal.style.display = 'none';
    
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
        alert('Form elements not found');
        return;
    }
    
    const name = nameInput.value.trim();
    const action = actionSelect.value;
    const value = valueInput.value.trim();
    const icon = iconInput ? iconInput.value.trim() || '🔗' : '🔗';
    
    if (!name || !value) {
        alert('Please fill in all required fields');
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

// Load Jira configuration
async function loadJiraConfig() {
    try {
        const result = await chrome.storage.local.get(['jiraConfig']);

        if (result.jiraConfig) {
            jiraConfig = result.jiraConfig;
            console.log('Jira config loaded from storage');
            console.log(jiraConfig);
        } else {
            // Hardcoded default config - UPDATE THESE VALUES
            jiraConfig = {
                baseUrl: 'https://zineone.atlassian.net',
                email: 'EMAIL_HERE', // TODO: ENTER YOUR EMAIL
                apiToken: 'API_TOKEN_HERE', // TODO: ENTER YOUR API TOKEN
                jql: 'assignee = currentUser() AND statusCategory != done ORDER BY updated DESC',
                maxResults: 50
            };

            await chrome.storage.local.set({ jiraConfig });
            console.log('Jira config initialized with defaults');
        }
    } catch (error) {
        console.error('Error loading Jira config:', error);
    }
}

// Fetch issues from Jira API
async function fetchJiraIssues() {
    if (!jiraConfig || !jiraConfig.apiToken || jiraConfig.apiToken === 'YOUR_API_TOKEN_HERE') {
        await loadJiraConfig()
        if (!jiraConfig || !jiraConfig.apiToken || jiraConfig.apiToken === 'YOUR_API_TOKEN_HERE') {
            throw new Error('Jira API token not configured. Please update the credentials in the code.');
        }
    }

    // Use the new /search/jql endpoint (old /search is deprecated)
    const url = `${jiraConfig.baseUrl}/rest/api/3/search/jql`;

    const auth = btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`);

    console.log('Fetching from URL:', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'omit',
        body: JSON.stringify({
            jql: jiraConfig.jql,
            maxResults: jiraConfig.maxResults,
            fields: ['summary', 'status', 'updated']
        })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Jira API error details:', errorText);

        if (response.status === 401) {
            throw new Error('Authentication failed. Check your email and API token.');
        } else if (response.status === 403) {
            throw new Error('Access denied. Check your Jira permissions.');
        } else if (response.status === 410) {
            throw new Error('Jira API endpoint deprecated or unavailable. Please check your Jira instance configuration.');
        } else {
            throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
        }
    }

    const data = await response.json();
    console.log('Successfully fetched issues:', data.total);
    return data.issues || [];
}

// Load and display Jira issues
async function loadJiraIssues() {
    const container = document.getElementById('jiraContent');
    const statsContainer = document.getElementById('jiraStats');

    if (!container) return;

    try {
        container.innerHTML = '<div class="loading">Loading Jira issues...</div>';
        if (statsContainer) statsContainer.textContent = '';

        console.log('Fetching Jira issues...');
        const issues = await fetchJiraIssues();

        jiraData = issues;
        renderJiraIssues();

        console.log(`Loaded ${issues.length} Jira issues`);
    } catch (error) {
        console.error('Error loading Jira issues:', error);

        container.innerHTML = `
            <div class="jira-error">
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div class="jira-error-title">Failed to load Jira issues</div>
                <div class="jira-error-message">${error.message}</div>
            </div>
        `;

        if (statsContainer) {
            statsContainer.textContent = 'Error loading data';
        }
    }
}

// Render Jira issues to DOM
function renderJiraIssues() {
    const container = document.getElementById('jiraContent');
    const statsContainer = document.getElementById('jiraStats');

    if (!container) return;

    if (jiraData.length === 0) {
        container.innerHTML = '<div class="loading">No issues assigned to you</div>';
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
        statsContainer.textContent = `${statsText} (${statusParts})`;
    }

    // Render issues
    container.innerHTML = '';

    sortedIssues.forEach(issue => {
        const issueElement = createJiraIssueElement(issue);
        container.appendChild(issueElement);
    });
}

// Create individual issue DOM element
function createJiraIssueElement(issue) {
    const issueDiv = document.createElement('div');
    issueDiv.className = 'jira-issue';
    issueDiv.addEventListener('click', () => openJiraIssue(issue.key));

    const statusCategory = issue.fields.status.statusCategory?.key || 'new';

    issueDiv.innerHTML = `
        <div class="jira-issue-key">${issue.key}</div>
        <div class="jira-issue-content">
            <div class="jira-issue-title">${issue.fields.summary}</div>
            <div class="jira-status-badge jira-status-${statusCategory}">
                ${issue.fields.status.name}
            </div>
        </div>
        <svg class="icon jira-arrow" viewBox="0 0 24 24">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
    `;

    return issueDiv;
}

// Open Jira issue in new tab
function openJiraIssue(issueKey) {
    if (!issueKey || !jiraConfig) return;

    const url = `${jiraConfig.baseUrl}/browse/${issueKey}`;
    chrome.tabs.create({ url: url });
}

function renderCustomButtons() {
    const container = document.getElementById('customButtonsGrid');
    const card = document.getElementById('customButtonsCard');
    
    if (!container || !card) return;
    
    if (customButtons.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    container.innerHTML = '';
    
    customButtons.forEach(button => {
        const buttonElement = document.createElement('div');
        buttonElement.className = 'custom-button';
        buttonElement.addEventListener('click', () => executeCustomButtonAction(button));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-custom-btn';
        deleteBtn.textContent = '×';
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
            openUrl(`https://www.google.com/search?q=${encodeURIComponent(button.value)}`);
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
    if (modal) modal.style.display = 'block';
}

function closeFavoriteModal() {
    const modal = document.getElementById('addFavoriteModal');
    if (modal) modal.style.display = 'none';

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
            locationDisplay.textContent = 'Bookmarks Bar';
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
        alert('Form elements not found');
        return;
    }

    const folderName = folderNameInput.value.trim();

    // Validation: Check for empty folder name
    if (!folderName) {
        alert('Please enter a folder name');
        folderNameInput.focus();
        return;
    }

    // Validation: Check for reasonable length (Chrome limit is 255 chars)
    if (folderName.length > 255) {
        alert('Folder name is too long (maximum 255 characters)');
        return;
    }

    try {
        // Determine parent folder ID
        // If we're viewing a specific folder, create inside it
        // Otherwise, create in bookmarks bar
        const parentId = currentFolderId || bookmarksBarId;

        if (!parentId) {
            alert('Cannot determine parent folder. Please refresh and try again.');
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
            alert('Permission denied. Please check extension permissions.');
        } else if (error.message.includes('not found')) {
            alert('Parent folder not found. Please refresh and try again.');
        } else {
            alert(`Error creating folder: ${error.message}`);
        }
    }
}

async function saveFavorite() {
    const titleInput = document.getElementById('favoriteTitle');
    const urlInput = document.getElementById('favoriteUrl');
    const positionSelect = document.getElementById('favoritePosition');
    
    if (!titleInput || !urlInput || !positionSelect) {
        alert('Form elements not found');
        return;
    }
    
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();
    const position = positionSelect.value;
    
    if (!title || !url) {
        alert('Please fill in both title and URL');
        return;
    }
    
    // Validate URL format
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    try {
        // Get bookmarks bar folder with improved detection
        const bookmarks = await chrome.bookmarks.getTree();
        const bookmarkBar = bookmarks[0].children.find(child => 
            child.title === 'Bookmarks bar' || 
            child.title === 'Bookmarks Bar' ||
            child.folderType === 'bookmarks-bar'
        );
        
        if (!bookmarkBar) {
            alert('Bookmarks bar not found');
            return;
        }
        
        // Create new bookmark
        const newBookmark = {
            parentId: bookmarkBar.id,
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
        
        // Refresh favorites display
        await loadFavorites();
        
    } catch (error) {
        console.error('Error adding favorite:', error);
        alert('Error adding favorite. Please try again.');
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

// Custom search functionality
function performSearch() {
    const searchInput = document.getElementById('mainSearchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (!query) return;
    
    // Base URL for Google search
    const baseURL = 'https://zineone.atlassian.net/browse/ZMOB-';
    
    // Encode the search query to handle spaces and special characters
    const encodedQuery = encodeURIComponent(query);
    
    // Construct the final URL
    const searchURL = baseURL + encodedQuery;
    
    console.log('Searching for:', query);
    console.log('Search URL:', searchURL);
    
    // Open search in new tab
    chrome.tabs.create({ url: searchURL });
    
    // Clear the search input
    searchInput.value = '';
}