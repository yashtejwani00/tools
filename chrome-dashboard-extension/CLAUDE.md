# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension (Manifest V3) that replaces the default new tab page with a customized dashboard. The extension provides quick access to bookmarks, reading lists, Chrome settings, and custom shortcuts.

## Architecture

### Extension Structure

- **manifest.json** - Chrome extension configuration (Manifest V3)
  - Overrides the new tab page with `newtab.html`
  - Requires permissions: `bookmarks`, `favicon` (Chrome's local favicon cache for tile icons), `readingList`, `storage`, `tabs`

- **newtab.html** - Main dashboard interface
  - Single-page application with embedded modals
  - Favorites section starts at "All bookmarks" (like Chrome's bookmarks side panel) with folder navigation
  - Chrome Controls section with expandable bookmarks/reading list
  - Custom buttons section, labelled "Shortcuts" in the UI (always shown; "+" in its title opens the add modal)

- **script.js** - Core functionality
  - All JavaScript is vanilla (no frameworks)
  - Uses Chrome Extension APIs: `chrome.bookmarks`, `chrome.readingList`, `chrome.storage.local`, `chrome.tabs`
  - Global state variables: `bookmarksData`, `customButtons`, `readingListData`

- **styles.css** - Styling
  - Dark theme driven by design tokens (CSS custom properties on `:root`)
  - Responsive grid layout
  - 12-column grid: Favorites spans 7, Jira 5, Shortcuts full width; stacks below 960px

### Key Features

1. **Favorites Grid** - Browses the whole bookmarks tree, starting at a virtual "All bookmarks" folder
   - `buildAllBookmarksNode()` mirrors Chrome's side panel: Bookmarks bar as a folder, "Other bookmarks" contents inline, Mobile bookmarks only if non-empty
   - Back from a top-level folder returns to All bookmarks; "New folder" there creates it in Other bookmarks
   - Can add new favorites via modal that creates bookmarks in bookmarks bar
   - Pencil on a tile opens `editBookmarkModal`: rename, change URL, move (Folder select), delete. Top-level folders and managed bookmarks aren't editable (`isEditableNode()`)
   - Drag and drop: a tile's left/right edge reorders, the middle of a folder moves into it, the Back button moves up a level. Indices passed to `chrome.bookmarks.move` are positions among the target's current siblings; Chrome adjusts for same-folder moves
   - Deleting a bookmark or empty folder shows an Undo toast; a folder with contents asks `confirm()` first (Chrome has no bookmark trash)

2. **Chrome Controls** - Quick access buttons with expandable sections
   - Bookmarks: Tree view with search, lazy-loaded on first expand
   - Reading List: Shows items with read/unread status
   - Extensions/Passwords: Direct links to `chrome://` URLs

3. **Custom Buttons** - User-defined actions stored in `chrome.storage.local`
   - Action types: `url`, `chrome`, `search`, `bookmark`
   - Persistent across sessions
   - Pencil opens the same modal in edit mode (`openCustomButtonModal(button)`), with Delete + Undo toast; drag to reorder

4. **Custom Search Bar** - Main search input at top
   - Opens `<configured Jira URL>/browse/ZMOB-<query>`
   - Located in `performSearch()` in script.js

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

`findBookmarksBar()` in script.js is the single source of truth, used by both the favorites grid and "Add Favorite". It matches `folderType === 'bookmarks-bar'` (preferring a non-empty bar when account bookmarks expose two), then falls back to the title, then to the first root folder.

`loadFavorites(folderId)` always re-fetches from Chrome; with no argument it reloads the folder currently shown. `ALL_BOOKMARKS_ID` is the virtual top level. "Add favorite" still adds to the bookmarks bar (found by `findBookmarksBar()`).

### Jira Configuration

- Configured from the gear button on the Jira card (`jiraSettingsModal`): URL, email, API token, JQL, max results
- Stored in `chrome.storage.local` under `jiraConfig`; `JIRA_DEFAULTS` in script.js supplies unset values
- Saving requests host permission for the Jira origin (`optional_host_permissions` in manifest.json)
- The saved token is never written back into the form or logged; a blank token field keeps it, unless the Jira origin changed

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
- Modals: `addFavoriteModal`, `customButtonModal`, `createFolderModal`, `editBookmarkModal`, `jiraSettingsModal`
- Forms validate input before saving

## Common Modifications

### Changing Search Behavior

To modify the main search bar behavior, edit `performSearch()` in script.js. It opens Jira tickets on the configured Jira URL with the "ZMOB-" prefix.

### Adjusting Favorites Limit

Change the slice limit in `loadFavorites()` at script.js:168:
```javascript
const favorites = bookmarkBar ? bookmarkBar.children.slice(0, 8) : [];
```

### Customizing Theme Colors

All colors, radii, fonts and z-index values are tokens in the `:root` block at the top of styles.css. Change a token rather than hardcoding a value:
- Single accent: `--accent` (teal); status badges use `--status-*`, folders `--folder`, destructive actions `--danger`
- Text: `--text`, `--text-muted`, `--text-faint` (one cool-tinted gray family)
- Surfaces: `--bg`, `--surface`, `--surface-raised`, `--surface-hover`, `--inset`

### UI Conventions

- Form errors: call `showFormError(modalId, message, input)`; don't use `alert()`
- Clickable tiles built in JS (`div`s): call `makeActivatable(element, role)` so they work from the keyboard
- Modals: Escape closes the open modal, Enter in a field clicks its `.btn-primary`
- Loading placeholders use `.skeleton`; empty/status messages use `.loading`
- Tile edit buttons: `createEditButton(label, onClick)`; drag and drop: `enableDrag()` / `enableDrop()`
- Transient messages (with optional Undo): `showToast(message, undo)`

### Adding New Chrome Controls

Add new button elements in newtab.html within the `.control-buttons` div (lines 69-110), then add event listener in `setupEventListeners()` function.