# Changelog

English version. [Leia em português](docs/CHANGELOG-PT_BR.md).

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.22.15] — 2026-10-08
### Added
- Popup "Continue today" and "Recent" sections now open collapsed;
  clicking the title expands/collapses each section.
### Fixed
- The `hidden` attribute now wins over `display` rules in the popup and
  the options (the disabled draft checkbox kept reappearing).
- Toggling "Enable draft" now warns that saving is required to apply it.

## [0.22.14] — 2026-10-08
### Added
- Draft built into the popup New timer section: checkbox below the
  description fills and locks Customer/Project/Activity/Tags from the
  default Timer in settings; Start uses those values.
- Edit button (✎) next to Stop on each running popup timer,
  with inline form (project, activity, description, tags).

## [0.22.13] — 2026-10-07
### Added
- Edit button on the collapsed group row: changes Customer, Project,
  Activity, Description and Tags of grouped items via PATCH per entry,
  without touching dates or duration.

## [0.22.12] — 2026-10-07
### Added
- Current-day total (`HOJE HH:MM:SS`) to the left of the weekly total,
  above the timesheet table.
### Fixed
- Weekly total now sums only the most recent ISO week in the listing.

## [0.22.11] — 2026-10-07
### Fixed
- `innerHTML` hygiene: container clears use `replaceChildren()`;
  HTML copies between cells centralized in a documented helper.

## [0.22.10] — 2026-10-07
### Fixed
- Firefox manifest declares `data_collection_permissions.required: ["none"]`,
  required by the AMO validator for new submissions.

## [0.22.9] — 2026-10-07
### Added
- Interface language selector (Portuguese or English) in settings,
  applied to the popup, options page, floating panel and widgets;
  includes accessibility labels, worker menus and remaining strings.

## [0.22.8] — 2026-10-06
### Added
- Compact floating panel to follow the running timer and pause/resume it,
  preserving project, activity, description and tags.
- Extension information section in settings, with version, author and GitHub.
### Changed
- Interface settings to hide the Kimai navigation or action bar;
  removed the old hide-Date-column option.
- Timer icons and start buttons aligned with stable shapes and spacing.
- ZIP builds resolve manifest and page dependencies without copying
  unreferenced code files; `sitegroup.js` included in the variants.

## [0.22.7] — 2026-10-06
### Changed
- Popup header stays pinned to the top while scrolling, keeping
  the title and the open-Kimai/settings buttons accessible.

## [0.22.6] — 2026-10-06
### Changed
- Popup collapses the **New timer** section when a timer is running; the
  accessible header allows expanding and collapsing the form manually.
- In the site listing, daily summary rows show the summed time as
  `HH:MM:SS` in the last column.

## [0.22.5] — 2026-10-06
### Changed
- GitHub Actions now creates GitHub Releases for version tags, with the
  Chrome/Firefox packages attached and notes extracted from this changelog.
- `npm run check` includes the repository sensitive-information scan.

## [0.22.4] — 2026-10-06
### Changed
- Replaced the Python manifest-selection and packaging scripts with
  dependency-free Node.js versions; added npm commands to select the
  Chrome/Firefox variants.

## [0.22.3] — 2026-10-06
### Changed
- Split theme palettes into `src/common/themes/`, one CSS file per theme;
  `theme.css` keeps only the shared integration.
- Code comments standardized in English and reduced to module headers.

## [0.22.2] — 2026-10-06
### Added
- **GNOME/Adwaita** theme, with libadwaita color tokens, blue accent and
  light/dark variants that follow the system preference, also in Kimai.

## [0.22.1] — 2026-10-06
### Fixed
- Quick Timer feedback (started/stopped/updated/errors) now appears in a
  bottom-right toast (auto-dismisses in 5s, click to dismiss) instead of
  inside the widget; same standardization as the options page.

## [0.22.0] — 2026-10-06
### Changed
- Running timer now lives in its own **Now** widget below the Quick Timer
  (title + timer only); the **Stop** button left the Quick Timer and
  stopping is per-timer, in Now itself.
### Fixed
- Unstyled Now buttons and boxes: shared components (buttons, inputs,
  editing) now apply to both widgets via `.ke-card`.

## [0.22.0] — 2026-10-06
### Changed
- Renamed to **Companion for Kimai** (“A browser extension that enhances
  your Kimai time-tracking workflow”, by mblithium,
  https://github.com/mblithium/companion-for-kimai). Previous identity
  fully removed (name, description, author, homepage, IDs and artifacts:
  `companion-for-kimai@mblithium`, `companion-for-kimai-*.zip`). No
  functional change.

## [0.21.2] — 2026-10-06
### Fixed
- Grouping checkbox now selects **all items at once**: partial repaint
  mid-loop unchecked the box and stopped marking at the first item (one
  per click). Repaint suppressed during the batch via the `bulkSyncing`
  flag.

## [0.21.1] — 2026-10-06
### Fixed
- Group header checkbox now uses Kimai's native visual classes
  (`form-check-input m-0 align-middle`), like the other rows.

## [0.21.0] — 2026-10-06
### Added
- Popup: New timer fields with **labels** (Description, Customer, Project,
  Activity, Tags), **Customer** and **Tags** filter in searchable
  comboboxes; **Recent** section (outside today, with date, its own ⟳
  and 1h auto-refresh).
- Popup **reloads Kimai tabs** after starting a timer (`tabs.reload`,
  only base-URL tabs, no new permission).

## [0.20.0] — 2026-10-06
### Added
- Production build tool integrated into `npm run build`
  (gated by `check` + `test`) generates `dist/kimai-enhancer-{chrome,firefox}-<versão>.zip`
  with production files only (variant manifest + `icons/`, `src/`, `LICENSE`),
  with version, manifest and reference validation.

## [0.19.1] — 2026-10-06
### Added
- Formatted `BASE/IDIOMA/USUARIO/api-token` link in the key section
  (updates with URL/language/user), showing where to create tokens.

## [0.19.0] — 2026-10-06
### Added
- **Tags in multi-select combobox** in the bar: searches system tags,
  removable chips, creates new ones with Enter, Backspace deletes the last.
- **Bigger description**: 2-row textarea with resizable height
  (Enter starts, Shift+Enter inserts a line break).
### Fixed
- `syncComboIfChanged` called the nonexistent `getValues()` on the simple
  combo (silent revalidation never updated — now it does).

## [0.18.3] — 2026-10-06
### Changed
- Single **Connect/Test connection** button: without a saved key it shows
  Connect (opens the Kimai keys page); with a key, it tests. Separate
  link removed.

## [0.18.2] — 2026-10-06
### Changed
- Settings with **fixed header** (title left, Save right; the single
  button left the bottom of the page) and **bottom-right toast**.

## [0.18.1] — 2026-10-06
### Added
- **Open Kimai in container** (Firefox): the ↗ button inherits the
  `cookieStoreId` of the tab where Kimai is already open (ignores
  default/private). New `cookies` permission (required by `tabs.create`
  with container).

## [0.18.0] — 2026-10-06
### Added
- **Language section** in settings: detects and syncs with the logged-in
  Kimai language (`GET /api/users/me`), with manual selection
  (`pt_BR` format).
- **Connect** instead of Disconnect when keyless: direct link to
  `BASE/IDIOMA/profile/USUARIO/api-token`.
- Statuses became 5s **toasts** (click dismisses); removed the
  end-of-page status.

## [0.17.0] — 2026-10-06
### Removed
- **Browser-session** authentication removed from popup/worker/options
  (only **API key** now). The page bar keeps using the logged-in page
  session, which keeps working.
### Added
- **↗ Open Kimai** button in the popup (next to ⚙): opens the timesheet
  at the configured base URL, in the detected page language (`keLocale`).

## [0.16.2] — 2026-10-05
### Fixed
- Groups follow the theme: new `--ke-group-bg` var per theme for headers
  and open members; open header gains a green accent bar instead of a
  loose tone (verified real render + contrast).

## [0.16.1] — 2026-10-05
### Fixed
- Custom themes now cover table header/footer, sidebar, dropdowns,
  inputs and secondary text (`--tblr-bg-surface-tertiary`,
  `--tblr-navbar-bg`, `--tblr-dropdown-bg`, `--tblr-bg-forms`,
  `--tblr-card-cap-bg`, `--tblr-secondary` + direct rule for sidebar,
  dropdown and offcanvas that locally reset the background).

## [0.16.0] — 2026-10-05
### Changed
- Theme now applies to the **entire Kimai page**: light/dark base via
  `data-bs-theme` + theme surfaces/accents via `--tblr-*` variables
  (System restores the Kimai default). Verified live on the demo.

## [0.15.0] — 2026-10-05
### Changed
- Kimai page follows the plugin theme: bar, combos, dropdowns and pill
  use theme variables (with Kimai fallback); group rows stay neutral to
  blend with the table. `color-scheme` restricted to our own pages
  (never leaks into Kimai).

## [0.14.4] — 2026-10-05
### Fixed
- Hide-Date rule fixed: collapsed groups follow the setting like the rest
  (no exception); what always shows the date are the native
  `tr.summary`/`tr.info` separators.

## [0.14.3] — 2026-10-05
### Fixed
- Grouping swallowed native date separators (`tr.summary.info`): only
  registry rows join a group (checkbox with value, or duration +
  project/customer cells); the rest stays put, visible and in position.

## [0.14.2] — 2026-10-05
### Fixed
- Hiding the Date column also hid group dates: the rule now exempts
  group rows (column gone, group period stays).

## [0.14.1] — 2026-10-05
### Fixed
- Open group is now obvious: expanded members inherit the header tone
  (`ke-sitemember`) and the open header darkens one level (`ke-open`),
  with hover preserved; clean marks on collapse/disable.

## [0.14.0] — 2026-10-05
### Changed
- **Clockify-style on-site grouping**: group row mirrors the table
  columns (group checkbox, period, start/end, summed duration, tags,
  billable/exported when equal, toggle in Actions) in Kimai's visual
  standard; group checkbox checks/unchecks members (partial
  indeterminate).

## [0.13.0] — 2026-10-05
### Changed
- **Redone on-site grouping**: discreet button right above the table
  (outside the bar) and Clockify-style grouping — only **adjacent
  equal** records (customer+project+activity+description), strays
  without header.
### Fixed
- `findSiteTbody` lost in the refactor (pinned by the harness).

## [0.12.0] — 2026-10-05
### Changed
- **On-site listing grouping**: the timesheet table groups by
  customer/project/activity with collapse/expand, count, summed duration
  and period; reapplies itself after sort/filter/paginate (same popup
  preference, bar button). Actions, checkboxes and running timers intact.

## [0.11.0] — 2026-10-05
### Added
- **Group tasks** in the popup: "Continue today" groups by
  customer/project/activity (count + summed duration), with per-group
  expand, continue via most recent, and pill to toggle (persists).
- **Hide Date column**: Appearance option that hides the column in the
  timesheet table (applies instantly, no reload).

## [0.10.1] — 2026-10-05
### Fixed
- Severe button contrast: text over colored backgrounds now uses
  `--ke-on-green`/`--ke-on-red` and colored text uses `--ke-green-text`/
  `--ke-red-text` (verified ≥ 4.5 across all 6 themes; e.g. white on
  green was 1.37–2.74). Light-mode warning yellow adjusted to `#96690f`.
  New `tests/check-contrast.js` gate (in `npm run check`).

## [0.10.0] — 2026-10-05
### Added
- New themes: **Dracula**, **Catppuccin** (Mocha), **Nord** and **Gruvbox**
  (official palettes, 10+ contrast verified) — 7 total with
  System/Light/Dark. Creating a theme = copying a block in `theme.css`.

## [0.9.2] — 2026-10-05
### Fixed
- Firefox warning (`persistent` unsupported in MV3): key removed from
  the Firefox variant (event page is already non-persistent by default).

## [0.9.1] — 2026-10-05
### Fixed
- Firefox without MV3 service worker (`background.service_worker is
  currently disabled`): `manifest/firefox.json` variant with event page
  (`background.scripts`, same `worker.js`) and minimum Gecko 109; Chrome
  keeps the service worker (`manifest/chrome.json`). Selection done by
  the manifest utility. `check-pages` validates consistency.

## [0.9.0] — 2026-10-05
### Added
- **Dynamic icon**: changes when a timer is running + badge with elapsed
  (`5m`, `2h`) and detailed title, updated every 1 min and on every
  start/stop/edit (via `background worker`).
- **Right-click on icon**: ⏸ Pause timer and ▶ Resume timer
  (`contexts: ["action"]`, visibility by state).
- `alarms` + `contextMenus` permissions (no warnings); minimum Firefox
  121 (MV3 service worker).

## [0.8.0] — 2026-10-05
### Added
- **Themes**: colors centralized in `src/common/theme.css` (easy to
  create new ones); System/Light/Dark setting with live preview (popup
  and options; the bar follows the Kimai theme).
- Configurable **keyboard shortcuts** on the timesheet page: start, stop
  and restart task (defaults `Alt+Shift+S/X/R`); popup opens via browser
  command (`Alt+Shift+K`, adjustable in extension shortcuts).
### Changed
- **Popup access** section right after **Kimai**.
- **Remove access** is now honest: disabled without access/URL, verifies
  the result and guides when the browser blocks.

## [0.7.1] — 2026-10-05
### Fixed
- Broken popup after caching (error screen even with token): `cache.js`
  was missing from `popup.html`. New `tests/check-pages.js` gate (in
  `npm run check`) ensures every `KE.*` used has a definition in each
  page's scripts.
### Added
- Options gains **Refresh cache** (forces customers+projects) and **Clear
  cache** (with counter), plus `KE.cacheClear()`.

## [0.7.0] — 2026-10-05
### Added
- `storage.local` cache: catalogs (customers/projects/activities, 24h
  TTL) and diaries (1h TTL) — instant popup and bar opening. ⟳ refresh
  button on lists and diaries; bar revalidates in background without
  erasing typed text; diaries self-update every 1h in the popup.
  Running timers always live, never cached.

## [0.6.5] — 2026-10-05
### Fixed
- Illegible popup comboboxes: inputs and list now have explicit
  background/text per scheme (`#222`/`#fff` in light, `#eee`/`#2c2c2e`
  in dark, 12+ contrast, verified) + `color-scheme: light dark`;
  `combo.css` loads before `popup.css`; same explicitness in options
  inputs.

## [0.6.4] — 2026-10-05
### Fixed
- Offline popup now shows a full-screen error ("Não foi possível
  conectar… abra as configurações e use Testar conexão") with Open
  settings and Retry buttons — never blank again.
- Single-action Authorize button; start/stop/continue errors show the
  server reason; 401/403 explains expired session; "continue" validates
  ids; today's list with its own message when empty.

## [0.6.3] — 2026-10-05
### Changed
- **Save settings** button spans the full row.
- Key field shows `••••••••••` when a token is saved.
- New **Disconnect** button (with confirmation): erases the saved key
  and returns the method to session.

## [0.6.2] — 2026-10-05
### Changed
- Settings with single **Save settings** button at the bottom of the
  page (URL + method + key); "Test connection" remains as secondary
  action.

## [0.6.1] — 2026-10-05
### Fixed
- Never-blank popup: boot with visible error fallback; single-handler
  Authorize button (previously opened options alongside); start/stop/
  continue errors show the server reason; expired session (401/403) has
  its own message; "continue" validates project/activity; today's list
  with correct message when empty.

## [0.6.0] — 2026-10-05
### Added
- **API key** authentication as a session alternative: in settings,
  choose between browser session or key (created in *Meu perfil → API
  Access*), with **Test connection** button. Key stored in
  `storage.local` (this device only); calls use `Authorization: Bearer`
  + `credentials: omit`.

## [0.5.0] — 2026-10-05
### Added
- Working popup: running timer(s) with Stop, new timer (comboboxes +
  description), continue today's timers (deduplicated) and ⚙ button for
  settings.
- Settings screen (`options_ui`): Kimai base URL + popup access
  authorization (`optional_host_permissions`, only the configured host).
- API now supports absolute base + `credentials: include`
  (popup/options); content script keeps relative + session.
- `KE.entityId()` normalizes number/object/IRI; labels centralized in
  `describeProjectRef`/`describeActivityRef`; `KE.tagNames()` in utils.

## [0.4.0] — 2026-10-05
### Added
- Inline editing of the running timer: click the running timer (or ✎)
  to adjust project, activity, description and tags via `PATCH`, with
  Save/Cancel, validation and server error messages.

## [0.3.3] — 2026-10-05
### Added
- "⏹ Stop" button next to "Start": visible only with a running timer,
  stops all active ones at once (singular/plural in the confirmation).

## [0.3.2] — 2026-10-05
### Fixed
- Running timer showed "Project #[object Object]": `GET
  /api/timesheets/active` returns `project`/`activity` as embedded
  objects (not ids). New `KE.entityId()` normalizes number/object/IRI
  and the label uses the cache or the embedded names.

## [0.3.1] — 2026-10-05
### Fixed
- Tags broke starting (400 "This value is not valid."): the API only
  accepts `tags` as a comma-separated string and ignores nonexistent
  names, so missing ones are now created via `POST /api/tags` before
  start.
- Description becomes the first field of the row.

## [0.3.0] — 2026-10-05
### Changed
- Internal reorganization with no behavior change: content script split
  into modules (`namespace`, `i18n`, `utils`, `api`, `storage`, `combo`,
  `kimai`, `quicktimer`), CSS split (`quicktimer.css`, `combo.css`,
  `popup.css`).
- Functional test moved to `tests/harness.js` with `npm test` /
  `npm run check`.
- Added `CHANGELOG.md`, `LICENSE` (MIT), `package.json`,
  `docs/ARCHITECTURE.md`.

## [0.2.2] — 2026-10-05
### Fixed
- Quick timer section now rebuilds itself when Kimai reloads the
  listing via AJAX (start/stop timer), via persistent observer.

## [0.2.1] — 2026-10-05
### Fixed
- Combobox dropdown above the table's fixed header (`z-index: 1050`).
- Start error shows the reason returned by the server, not just the
  HTTP code.
- `POST /api/timesheets` omits empty description/tags.

## [0.2.0] — 2026-10-05
### Added
- Customer, Project and Activity become searchable comboboxes (accents
  ignored, `↑`/`↓` + `Enter`, `Esc`, 150-item limit).

## [0.1.0] — 2026-10-05
### Added
- "Start quick timer" bar above the timesheet records.
- Running timers with live duration and Stop button; last selection
  remembered via `storage.sync`; table reload via Kimai events.
