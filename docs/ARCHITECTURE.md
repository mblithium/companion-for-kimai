# Architecture

## Principles

- **No build step**: vanilla JavaScript and plain CSS can be loaded directly as an
  unpacked extension. Content scripts do not use ES modules because support is
  inconsistent between Chrome and Firefox; files in `src/content` are classic
  scripts loaded in order (see `manifest.json`) in the same isolated world.
- **One namespace, IIFEs**: each module is an IIFE that publishes its API through
  `KE` (defined in `namespace.js`). Shared state and functions go through `KE`;
  no implicit globals.
- **Layers**: data modules (`kimai.js` and `api.js`) do not depend on the DOM;
  UI modules (`quicktimer.js` and `combo.js`) orchestrate the interface.

## Content modules (`src/content/`, load order)

| File | Responsibility | Publishes |
|---|---|---|
| `namespace.js` | Namespace root | `KE` |
| `i18n.js` | UI language detection and `_locales/*/messages.json` loading, with English fallback | `KE.T`, `KE.uiText` |
| `utils.js` | Pure helpers for dates, DOM, and Kimai events | `KE.el`, `KE.norm`, `KE.nowLocal`, `KE.elapsedSince`, `KE.asArray`, `KE.isTimesheetListPage`, `KE.notifyKimaiUpdate`, `KE.sleep` |
| `api.js` | Same-origin `fetch` and server-error extraction | `KE.api`, `KE.apiGet/Post/Patch` |
| `storage.js` | `browser`/`chrome.storage` compatibility wrapper | `KE.storageGet/Set` |
| `combo.js` | Reusable searchable combobox | `KE.createCombo` |
| `kimai.js` | Local state, API access, and labels | `KE.state`, `KE.projectLabel`, `KE.load*`, `KE.apply*`, `KE.fetchActiveTimesheets`, `KE.ensureTags`, `KE.describeProjectRef/ActivityRef` |
| `cache.js` | `storage.local` cache (24-hour catalog / 1-hour timesheet TTL) | `KE.CACHE_TTL`, `KE.get*Cached`, `KE.cacheGet/Set/Fresh` |
| `quicktimer.js` | Timer bar UI, start/stop, cascading fields, mounting, and lifecycle | Injects the timer section |

Styles: `quicktimer.css`, `combo.css` (unscoped and shared by content pages and
the popup, with the `ke-` prefix), and `src/popup/popup.css`.

## Popup and options (`src/popup/`, `src/options/`, `src/common/`)

- Reuse content modules (`namespace` through `kimai`, `combo`, and `theme`) plus
  `common/permissions.js` (browser compatibility, base URL, optional host
  permissions) and `common/format.js` (pure duration, date, and deduplication
  helpers).
- `quicktimer.js` is **not** loaded in the popup; it injects UI into Kimai.
- Kimai base URL (`keSettings.kimaiBaseUrl`), locale (`keLocale`), and username
  (`keUsername`) are detected by the content script. The options page syncs
  locale and username through `GET /api/users/me`. Feedback uses a 5-second
  toast.
- Without host access, the popup offers to grant access for that host only.
  Requests use the absolute base URL, `Authorization: Bearer`, and
  `credentials: omit`. The API key is stored in `storage.local`, outside sync
  storage; there is no session-only mode.
- **Cache**: catalogs and timesheets use `cache.js` (`storage.local`, not sync,
  to avoid quota limits). The popup and timer bar render cached data
  immediately; the bar revalidates in the background and updates combos only
  when the data changes. The popup refreshes timesheets manually and hourly.
- **Popup**: the New timer form uses `KE.T` labels and a
  Customer → Project → Activity cascade with multi-select Tags. After a timer
  starts, `reloadKimaiTabs()` reloads tabs for the configured base
  (`tabs.reload`, no additional permission). Recent entries use
  `format.recentOthers()` (excluding today and including dates) and
  `cache.getRecentCached()`.
- **Themes**: each `common/themes/*.css` file defines a palette.
  `common/theme.css` maps variables to Tabler/Kimai, while `common/theme.js`
  manages theme selection and application. The popup, options page, and Kimai
  page share the theme; GNOME follows the system light/dark preference.
- **Shortcuts**: `utils` normalizes and compares (`describeKeyEvent`,
  `shortcutMatches`). `quicktimer` listens for `keydown` (ignoring editable
  fields and repeats), reads `keSettings.shortcuts` (P starts the default timer
  via `startDefaultTimer`; S calls `stopAllTimers`), and reacts to
  `onStorageChanged`.

## Main flows

- **Mount**: `init()` → `findAnchor()` (the `.datatable_timesheet` table) →
  `mount()` + `loadAll()` (customers → projects → activities, restoring
  `storage`) + `loadActive()`. If the table is not ready, the script polls;
  the fallback mounts in `.page-body`.
- **Survive page updates**: Kimai redraws the timesheet via AJAX after start or
  stop, removing the injected section. `startPersistentObserver()` remounts it
  (400 ms debounce) and reloads data.
- **Start**: `flush(true)` commits pending combo text without triggering a
  cascade → `ensureTags()` creates missing tags and sends them as a comma-
  separated string → `POST /api/timesheets` with only populated fields → save
  selection → `notifyKimaiUpdate()` → `loadActive()`.
- **Inline edit**: `openEdit()` replaces a row with a small form (its own combos
  and `ensureTags`) → `PATCH /api/timesheets/{id}` → `loadActive()`.
  `Escape`/Cancel return to `renderActive()`.
- **Group in popup**: `format.groupByTask()` groups by project and activity;
  groups can expand and continue the most recent entry. The `groupTasks`
  preference is stored in sync storage.
- **Group on the Kimai page** (`content/sitegroup.js`, pure and testable): a
  discreet button above the table groups only **adjacent** identical entries,
  like Clockify (customer, project, activity, description). Ungrouped entries
  remain standalone. Group rows mirror the table columns (group checkbox,
  period, start/end, summed duration) in Kimai's style. A debounced observer
  reapplies grouping after redraws without looping; disabling restores order.
  Running-timer totals update every minute.

## No background worker

There is no `background.service_worker` or event page. Behavior runs in the
popup, options page, tracker window, and content scripts. Lists load on demand
with a local cache (24-hour catalog / 1-hour timesheet TTL); the extension icon
is static.

## Tests

`tests/harness.js` executes the **real files** in manifest order using a stub
DOM and API. It covers restore, accent-insensitive search, cascading fields,
keyboard input, POST, validation, HTTP 400 server messages, and remounting after
a wipe. Run `npm test`. `npm run check` validates JavaScript syntax and runs
`tests/check-pages.js`, which checks that every `KE.*` reference used by popup
and options pages is defined by their loaded scripts.

## Production build (`scripts/build-zip.js`, `dist/`)

- Source of truth: `manifest/chrome.json` and `manifest/firefox.json` (not the
  root `manifest.json`, which is only the active development variant).
- Each ZIP contains the variant's `manifest.json`, `icons/`, `src/`, and
  `LICENSE`.
- Before packaging, the builder checks synchronized versions (manifests and
  `package.json`), valid manifest syntax, and all referenced JS/CSS/HTML/icon
  files. It refuses to include `tests/`, `docs/`, `scripts/`, or `manifest/`.
- Do not edit manifest version, description, or homepage fields by hand.
  `package.json` is the source of truth; `npm run manifest:sync` propagates
  these fields to both variants and the root `manifest.json`. Use
  `--set-version X.Y.Z` to bump the version directly.
- `npm run build` runs checks, tests, and builds both ZIPs. `build:chrome` and
  `build:firefox` build only the selected variant (without the full check/test
  gates).
