# Companion for Kimai

This extension is unofficial. [Leia em português](docs/README-PT_BR.md).

A browser extension for Chrome and Firefox that enhances the Kimai timesheet
page, starting with a **Quick Timer** bar above the records so you do not have
to use the play button at the top.

It works with any Kimai installation (for example,
`https://kimai.example.com/en/timesheet/`).

## Install for development

### Google Chrome

1. From the project directory, run **`npm run manifest:chrome`**. The root
   `manifest.json` defaults to the Firefox variant.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this project directory.
5. Open your Kimai timesheet and use the bar above the records.

### Firefox

1. The root `manifest.json` is already the Firefox variant; no selection step
   is needed.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **This Firefox** → **Load Temporary Add-on**, then choose
   `manifest.json`.
4. Open your timesheet. Production builds must be signed through AMO.

> Why are there two variants? Chrome MV3 requires
> `background.service_worker`; Firefox uses `background.scripts` (an event
> page). Both variants share `worker.js`. The `check-pages` test verifies that
> they differ only in background configuration and the minimum Gecko version.

## Install a production ZIP

```bash
npm run build            # checks, tests, and Chrome/Firefox ZIPs in dist/
npm run build:chrome     # Chrome ZIP only (without checks)
npm run build:firefox    # Firefox ZIP only (without checks)
npm run manifest:chrome  # select the Chrome manifest for development
npm run manifest:firefox # select the Firefox manifest for development
```

The build creates `dist/companion-for-kimai-chrome-<version>.zip` and
`dist/companion-for-kimai-firefox-<version>.zip`. Each contains its variant's
`manifest.json`, the `LICENSE`, and only files referenced by the manifest, its
HTML pages, or the background worker. The build fails if versions differ or a
required file is missing.

- **Chrome:** Open `chrome://extensions`, enable Developer mode, and load the
  Chrome ZIP (or submit it to the Chrome Web Store).
- **Firefox:** Open `about:debugging#/runtime/this-firefox` → **This Firefox** →
  **Load Temporary Add-on** and select the Firefox ZIP. AMO submissions must be
  signed.

## Usage

1. Enter a **Description** (`Enter` starts the timer; `Shift+Enter` inserts a
   line break), then choose **Customer / Project / Activity** by typing to
   search. Press `Enter` to confirm or `Esc` to revert. **Tags** are searchable;
   press `Enter` to add a tag and `Backspace` to remove the last one. Missing
   tags are created automatically.
2. Select **▶ Start** (or press `Enter` in the description). The timer appears
   at the top of the bar with a live duration.
3. While a timer is running, it appears in the **Now** widget below Quick Timer.
   Stop it with that timer's **Stop** button, or click it (or **✎**) to edit the
   project, activity, description, and tags without stopping it. The table
   refreshes automatically.

## Compatibility

- Manifest V3: Chrome uses a service worker; Firefox uses an event page via
  `background.scripts`. Both share the same worker implementation.
- `browser_specific_settings.gecko.id` is included as required by AMO.
- Permissions are limited to `storage`, `alarms`, `contextMenus`, and an
  optional host permission requested only for the configured Kimai host. The
  content script uses same-origin `fetch`; the popup and worker use the
  configured API URL.
- The toolbar icon changes while a timer is running, including an elapsed-time
  badge. The context menu offers Pause and Continue. Firefox 121 or later is
  required.
- Tested against the official demo (`demo.kimai.org`, Kimai 2.68.0) with a
  logged-in session.

## Development

Edit `src/*` and reload the extension; no compile step is required. See
`docs/ARCHITECTURE.md` for the module conventions (IIFEs publishing to `KE`),
theme palettes in `src/common/themes/`, and the data/UI layers. Record changes
in `CHANGELOG.md`.

```bash
npm test          # functional tests
npm run check     # syntax, page integration, and contrast checks
npm run build     # checks, tests, and production ZIPs in dist/
```

## CI

GitHub Actions builds Chrome and Firefox on pushes to `main`, pull requests,
and `v*` tags. Both ZIPs are uploaded as workflow artifacts for 30 days, and
the run summary includes the matching version's `CHANGELOG.md` section. A `v*`
tag must match the version in `package.json`; matching tags also create a GitHub
Release with both ZIPs attached and the changelog notes.

## License

MIT.
