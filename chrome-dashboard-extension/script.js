// Global variables
let bookmarksData = [];
let customButtons = [];
let readingListData = [];

// Initialize extension
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chrome Dashboard Extension loaded');
    
    // Removed createParticles() call
    updateTime();
    setInterval(updateTime, 1000);
    
    loadFavorites();
    loadCustomButtons();
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
    
    // Toggle bookmarks
    const toggleBookmarksBtn = document.getElementById('toggleBookmarks');
    if (toggleBookmarksBtn) toggleBookmarksBtn.addEventListener('click', toggleBookmarks);
    
    // Toggle reading list
    const toggleReadingListBtn = document.getElementById('toggleReadingList');
    if (toggleReadingListBtn) toggleReadingListBtn.addEventListener('click', toggleReadingList);
    
    // Open extensions/passwords
    const openExtensionsBtn = document.getElementById('openExtensions');
    if (openExtensionsBtn) {
        openExtensionsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'chrome://extensions/' });
        });
    }
    
    const openPasswordsBtn = document.getElementById('openPasswords');
    if (openPasswordsBtn) {
        openPasswordsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'chrome://password-manager/' });
        });
    }
    
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
    
    // Search bookmarks
    const searchInput = document.getElementById('bookmarkSearch');
    if (searchInput) searchInput.addEventListener('keyup', searchBookmarks);
    
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

// Load favorites from Chrome bookmarks
async function loadFavorites() {
    try {
        console.log('Loading favorites...');
        const bookmarks = await chrome.bookmarks.getTree();
        const favoritesGrid = document.getElementById('favoritesGrid');
        
        if (!favoritesGrid) {
            console.error('Favorites grid element not found');
            return;
        }
        
        // More reliable bookmarks bar detection
        const bookmarkBar = bookmarks[0].children.find(child => 
            child.title === 'Bookmarks bar' || 
            child.title === 'Bookmarks Bar' ||
            child.folderType === 'bookmarks-bar'
        );
        
        const favorites = bookmarkBar ? bookmarkBar.children.slice(0, 8) : [];
        
        if (favorites.length === 0) {
            favoritesGrid.innerHTML = '<div class="loading">No bookmarks found in bookmarks bar</div>';
            return;
        }
        
        favoritesGrid.innerHTML = '';
        
        favorites.forEach(bookmark => {
            if (bookmark.url) {
                const favoriteItem = createFavoriteItem(bookmark);
                favoritesGrid.appendChild(favoriteItem);
            }
        });
        
        console.log(`Loaded ${favorites.length} favorites`);
    } catch (error) {
        console.error('Error loading favorites:', error);
        const favoritesGrid = document.getElementById('favoritesGrid');
        if (favoritesGrid) {
            favoritesGrid.innerHTML = '<div class="loading">Error loading favorites</div>';
        }
    }
}

// Create favorite item element
function createFavoriteItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    item.addEventListener('click', () => openUrl(bookmark.url));
    
    const icon = document.createElement('div');
    icon.className = 'favorite-icon';
    icon.textContent = getInitials(bookmark.title);
    
    const title = document.createElement('div');
    title.className = 'favorite-title';
    title.textContent = bookmark.title;
    title.title = bookmark.title; // Tooltip
    
    item.appendChild(icon);
    item.appendChild(title);
    
    return item;
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

// Open URL in new tab
function openUrl(url) {
    if (!url) return;
    chrome.tabs.create({ url: url });
}

// Toggle bookmarks section
async function toggleBookmarks() {
    const content = document.getElementById('bookmarksContent');
    const button = document.getElementById('toggleBookmarks');
    
    if (!content || !button) return;
    
    if (content.classList.contains('show')) {
        content.classList.remove('show');
        button.classList.remove('expanded');
    } else {
        content.classList.add('show');
        button.classList.add('expanded');
        
        if (bookmarksData.length === 0) {
            await loadBookmarks();
        }
    }
}

// Load all bookmarks
async function loadBookmarks() {
    try {
        console.log('Loading bookmarks...');
        const bookmarks = await chrome.bookmarks.getTree();
        bookmarksData = bookmarks;
        renderBookmarks();
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        const bookmarksTree = document.getElementById('bookmarksTree');
        if (bookmarksTree) {
            bookmarksTree.innerHTML = '<div class="loading">Error loading bookmarks</div>';
        }
    }
}

// Render bookmarks tree
function renderBookmarks() {
    const container = document.getElementById('bookmarksTree');
    if (!container) return;
    
    container.innerHTML = '';
    
    function renderBookmarkNode(node, level = 0) {
        // Only exclude Mobile bookmarks, keep Other bookmarks as they're useful
        if (node.title === 'Mobile bookmarks') return null;
        
        const item = document.createElement('div');
        item.style.marginLeft = `${level * 20}px`;
        
        if (node.children) {
            // Folder
            item.className = 'bookmark-folder';
            item.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                </svg>
                ${node.title || 'Untitled Folder'}
            `;
            
            let isExpanded = false;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const children = item.nextElementSibling;
                if (children && children.classList.contains('bookmark-children')) {
                    isExpanded = !isExpanded;
                    children.style.display = isExpanded ? 'block' : 'none';
                }
            });
            
            container.appendChild(item);
            
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'bookmark-children';
            childrenContainer.style.display = 'none';
            
            node.children.forEach(child => {
                const childElement = renderBookmarkNode(child, level + 1);
                if (childElement) {
                    childrenContainer.appendChild(childElement);
                }
            });
            
            container.appendChild(childrenContainer);
            
        } else if (node.url) {
            // Bookmark
            item.className = 'bookmark-item';
            item.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H6.9C3.71 7 1 9.71 1 13s2.71 6 6 6h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c3.29 0 6-2.71 6-6s-2.71-6-6-6z"/>
                </svg>
                ${node.title || 'Untitled Bookmark'}
            `;
            
            item.addEventListener('click', () => openUrl(node.url));
            item.title = node.url;
            
            return item;
        }
        
        return item;
    }
    
    if (bookmarksData && bookmarksData[0] && bookmarksData[0].children) {
        bookmarksData[0].children.forEach(node => {
            const element = renderBookmarkNode(node);
            if (element) {
                container.appendChild(element);
            }
        });
    }
}

// Search bookmarks
function searchBookmarks() {
    const searchInput = document.getElementById('bookmarkSearch');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('.bookmark-item, .bookmark-folder');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query) || query === '') {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Toggle reading list section
async function toggleReadingList() {
    const content = document.getElementById('readingListContent');
    const button = document.getElementById('toggleReadingList');
    
    if (!content || !button) return;
    
    if (content.classList.contains('show')) {
        content.classList.remove('show');
        button.classList.remove('expanded');
    } else {
        content.classList.add('show');
        button.classList.add('expanded');
        
        if (readingListData.length === 0) {
            await loadReadingList();
        }
    }
}

// Load reading list
async function loadReadingList() {
    try {
        // Check if reading list API is available
        if (chrome.readingList && chrome.readingList.query) {
            console.log('Loading reading list...');
            const readingList = await chrome.readingList.query({});
            readingListData = readingList;
            renderReadingList();
            console.log(`Loaded ${readingList.length} reading list items`);
        } else {
            console.log('Reading list API not available');
            const container = document.getElementById('readingList');
            if (container) {
                container.innerHTML = '<div class="loading">Reading list not available in this Chrome version</div>';
            }
        }
    } catch (error) {
        console.error('Error loading reading list:', error);
        const container = document.getElementById('readingList');
        if (container) {
            container.innerHTML = '<div class="loading">Error loading reading list</div>';
        }
    }
}

// Render reading list
function renderReadingList() {
    const container = document.getElementById('readingList');
    const statsContainer = document.getElementById('readingListStats');
    
    if (!container) return;
    
    if (readingListData.length === 0) {
        container.innerHTML = '<div class="loading">No items in reading list</div>';
        if (statsContainer) statsContainer.textContent = '';
        return;
    }
    
    const unreadCount = readingListData.filter(item => !item.hasBeenRead).length;
    if (statsContainer) {
        statsContainer.textContent = `${readingListData.length} total, ${unreadCount} unread`;
    }
    
    container.innerHTML = '';
    
    readingListData.forEach(item => {
        const readingItem = document.createElement('div');
        readingItem.className = 'reading-item';
        readingItem.addEventListener('click', () => openUrl(item.url));
        
        readingItem.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <div class="reading-item-content">
                <div class="reading-item-title">${item.title || 'Untitled'}</div>
                <div class="reading-item-url">${item.url}</div>
            </div>
            ${item.hasBeenRead ? '' : '<div style="width: 8px; height: 8px; background: #64ffda; border-radius: 50%; margin-left: auto;"></div>'}
        `;
        
        container.appendChild(readingItem);
    });
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