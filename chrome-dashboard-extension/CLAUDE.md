# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension (Manifest V3) that replaces the default new tab page with a customized dashboard: a search palette, bookmarks, Jira issues, custom shortcuts and recently closed tabs.

## Architecture

### Extension Structure

- **manifest.json** - Chrome extension configuration (Manifest V3)
  - Overrides the new tab page with `newtab.html`
  - Requires permissions: `bookmarks`, `favicon` (Chrome's local favicon cache for tile icons), `sessions`, `storage`, `tabs`

- **newtab.html** - Main dashboard interface
  - Single-page application with embedded modals
  - Header search palette (`#mainSearchInput` combobox + `#searchResults` listbox)
  - Favorites section starts at "All bookmarks" (like Chrome's bookmarks side panel) with folder navigation
  - Jira card with view switcher (`#jiraViews`) and a shared status menu popover (`#jiraTransitionMenu`)
  - Custom buttons section, labelled "Shortcuts" in the UI (always shown; "+" in its title opens the add modal)
  - Recently closed card (`#recentList`)

- **script.js** - Core functionality
  - All JavaScript is vanilla (no frameworks)
  - Uses Chrome Extension APIs: `chrome.bookmarks`, `chrome.sessions`, `chrome.storage.local`, `chrome.tabs`, `chrome.windows`
  - Global state variables: `customButtons`, `jiraData`, `jiraConfig`, `jiraSeen`, `searchResults`

- **styles.css** - Styling
  - Dark theme driven by design tokens (CSS custom properties on `:root`)
  - Responsive grid layout
  - 12-column grid: Favorites 7 / Jira 5, Shortcuts 7 / Recently closed 5; stacks below 960px

- **selftest.js** - Node check for the pure parsing helpers (`node selftest.js`); run it after changing `parseTicketKey`, `toUrl`, `parseJiraViews` or `timeAgo`

### Key Features

1. **Favorites Grid** - Browses the whole bookmarks tree, starting at a virtual "All bookmarks" folder
   - `buildAllBookmarksNode()` mirrors Chrome's side panel: Bookmarks bar as a folder, "Other bookmarks" contents inline, Mobile bookmarks only if non-empty
   - Back from a top-level folder returns to All bookmarks; "New folder" there creates it in Other bookmarks
   - Can add new favorites via modal that creates bookmarks in bookmarks bar

2. **Jira** - Issues for the selected view, with status changes and "updated" dots (see Jira Configuration)

3. **Custom Buttons** - User-defined actions stored in `chrome.storage.local`
   - Action types: `url`, `chrome`, `search`, `bookmark`
   - Persistent across sessions

4. **Search palette** - Main search input at top; `/` focuses it from anywhere on the page
   - `buildSearchResults()` order: ticket key (`parseTicketKey`: bare number → `JIRA_DEFAULT_PROJECT`, or any `ABC-123`), URL (`toUrl`), open tabs, loaded Jira issues, bookmarks, shortcuts, Google search
   - Choosing a tab switches to it and closes the blank new tab, like Chrome's "Switch to this tab"

5. **Recently closed** - `chrome.sessions.getRecentlyClosed`, refreshed on `sessions.onChanged`; click restores the tab or window. Blank new tabs are filtered out (`isNewTabUrl`)

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

- Configured from the gear button on the Jira card (`jiraSettingsModal`): URL, email, API token, views, max results
- Stored in `chrome.storage.local` under `jiraConfig`; `JIRA_DEFAULTS` in script.js supplies unset values
- Views: the `jql` setting holds one view per line, `Name | JQL` (`parseJiraViews()`); a line without `|` is plain JQL, so single-JQL configs from older versions still work. The switcher only shows with 2+ views
- All REST calls go through `jiraRequest(path, { method, body })`: permission check, Basic auth, error messages (400s surface Jira's own `errorMessages`/`errors`)
- Status change: clicking a badge opens the `#jiraTransitionMenu` popover (CSS anchor positioning via `anchor-name: --transition-anchor` on the clicked badge), GETs then POSTs `/issue/{key}/transitions`
- "Updated" dot: `jiraSeen` in storage = `{ since, keys: { KEY: ms } }`. An issue is flagged when Jira's `updated` is later than when it was last opened here (`markJiraSeen()`, called by `openJiraIssue()` and after a status change), or than `since` (first run) if never opened
- Saving requests host permission for the Jira origin (`optional_host_permissions` in manifest.json)
- The saved token is never written back into the form or logged; a blank token field keeps it, unless the Jira origin changed

### State Management

- Custom buttons, Jira config, Jira seen state: Persisted in `chrome.storage.local`
- Bookmarks, tabs, recently closed: Fetched on demand from Chrome APIs
- Favorites: Reloaded each time the new tab opens

### Modal Interactions

- Click outside modal to close
- Modals: `addFavoriteModal`, `customButtonModal`, `createFolderModal`, `jiraSettingsModal`
- Forms validate input before saving

## Common Modifications

### Changing Search Behavior

Result sources and their order live in `buildSearchResults()` in script.js. The project used for bare ticket numbers is `JIRA_DEFAULT_PROJECT`.

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
- Small favicon rows (search results, recently closed) use `.row-icon` + `setRowIcon(icon, url)`

### Previewing without loading the extension

The page runs in a plain browser tab if a stub defining `window.chrome` (runtime, storage, bookmarks, tabs, windows, sessions, permissions) and a fake `fetch` for `/rest/api/3/` is loaded before script.js. Favicons 404 there, since `/_favicon/` only exists inside Chrome.