# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension (Manifest V3) that replaces the default new tab page with a customized dashboard. The extension provides quick access to bookmarks, reading lists, Chrome settings, and custom shortcuts.

## Architecture

### Extension Structure

- **manifest.json** - Chrome extension configuration (Manifest V3)
  - Overrides the new tab page with `newtab.html`
  - Requires permissions: `bookmarks`, `readingList`, `storage`, `tabs`

- **newtab.html** - Main dashboard interface
  - Single-page application with embedded modals
  - Favorites section displays first 8 bookmarks from bookmarks bar
  - Chrome Controls section with expandable bookmarks/reading list
  - Custom buttons section (conditionally shown when buttons exist)

- **script.js** - Core functionality
  - All JavaScript is vanilla (no frameworks)
  - Uses Chrome Extension APIs: `chrome.bookmarks`, `chrome.readingList`, `chrome.storage.local`, `chrome.tabs`
  - Global state variables: `bookmarksData`, `customButtons`, `readingListData`

- **styles.css** - Styling
  - Gradient background with dark theme
  - Responsive grid layout
  - Custom scrollbar and hover animations

### Key Features

1. **Favorites Grid** - Displays bookmarks from the Chrome bookmarks bar (max 8)
   - Loaded via `loadFavorites()` which searches for bookmarks bar by title or folderType
   - Can add new favorites via modal that creates bookmarks in bookmarks bar

2. **Chrome Controls** - Quick access buttons with expandable sections
   - Bookmarks: Tree view with search, lazy-loaded on first expand
   - Reading List: Shows items with read/unread status
   - Extensions/Passwords: Direct links to `chrome://` URLs

3. **Custom Buttons** - User-defined actions stored in `chrome.storage.local`
   - Action types: `url`, `chrome`, `search`, `bookmark`
   - Persistent across sessions

4. **Custom Search Bar** - Main search input at top
   - Currently hardcoded to search Jira (ZMOB- prefix)
   - Located in `performSearch()` function in script.js:717-740

## Development Commands

This is a pure client-side extension with no build process.

### Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this repository directory

### Testing Changes

After making code changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension card
3. Open a new tab to see changes

### Debugging

- Right-click on the new tab page and select "Inspect" to open DevTools
- Console logs are prefixed with function context (e.g., "Loading favorites...")
- Check Chrome Extension API errors in the extension's background page (if any)

## Important Implementation Details

### Bookmarks Bar Detection

The extension searches for the bookmarks bar using multiple strategies (script.js:162-166):
```javascript
const bookmarkBar = bookmarks[0].children.find(child =>
    child.title === 'Bookmarks bar' ||
    child.title === 'Bookmarks Bar' ||
    child.folderType === 'bookmarks-bar'
);
```

### Reading List API Compatibility

Reading list API availability is checked before use (script.js:387-388):
```javascript
if (chrome.readingList && chrome.readingList.query) {
```

### State Management

- Custom buttons: Persisted in `chrome.storage.local`
- Bookmarks/Reading list: Fetched on-demand from Chrome APIs
- Favorites: Reloaded each time the new tab opens

### Modal Interactions

- Click outside modal to close
- Two modals: `addFavoriteModal` and `customButtonModal`
- Forms validate input before saving

## Common Modifications

### Changing Search Behavior

To modify the main search bar behavior, edit `performSearch()` in script.js:717-740. Currently configured for Jira ticket search with "ZMOB-" prefix.

### Adjusting Favorites Limit

Change the slice limit in `loadFavorites()` at script.js:168:
```javascript
const favorites = bookmarkBar ? bookmarkBar.children.slice(0, 8) : [];
```

### Customizing Theme Colors

Primary colors are defined in styles.css:
- Background gradient: lines 9-10
- Accent color: `#a8dadc` (cyan/teal)
- Secondary text: `#94a3b8` (slate gray)

### Adding New Chrome Controls

Add new button elements in newtab.html within the `.control-buttons` div (lines 69-110), then add event listener in `setupEventListeners()` function.