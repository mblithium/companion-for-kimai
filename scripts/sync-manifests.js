/* Sync shared manifest fields from package.json into all manifest variants. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VARIANTS = ['chrome', 'firefox'];
const VERSION_RE = /^\d+\.\d+\.\d+$/;

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function writeJson(rel, obj) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(obj, null, 2) + '\n');
}

// Variant-specific keys: everything else must stay identical across variants.
function stripVariant(manifest) {
  const copy = JSON.parse(JSON.stringify(manifest));
  delete copy.version;
  delete copy.background;
  if (copy.browser_specific_settings && copy.browser_specific_settings.gecko) {
    delete copy.browser_specific_settings.gecko.strict_min_version;
    delete copy.browser_specific_settings.gecko.data_collection_permissions;
  }
  return copy;
}

function parseArgs(argv) {
  const args = { setVersion: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--set-version') {
      const next = argv[++i];
      if (!next) throw new Error('Missing value for --set-version');
      args.setVersion = next;
    } else if (value === '--help' || value === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  return args;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/sync-manifests.js [--set-version X.Y.Z]');
      console.log('  Copies version (+ description/homepage) from package.json');
      console.log('  into manifest/chrome.json, manifest/firefox.json and manifest.json.');
      return 0;
    }
    if (args.setVersion) {
      if (!VERSION_RE.test(args.setVersion)) throw new Error(`Invalid version: ${args.setVersion} (expected X.Y.Z)`);
      const pkgPath = path.join(ROOT, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = args.setVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    const pkg = readJson('package.json');
    if (!VERSION_RE.test(pkg.version || '')) throw new Error(`Invalid version in package.json: ${pkg.version}`);
    if (typeof pkg.description !== 'string' || !pkg.description) throw new Error('Missing description in package.json');
    if (typeof pkg.homepage !== 'string' || !pkg.homepage) throw new Error('Missing homepage in package.json');

    const loaded = Object.fromEntries(VARIANTS.map((target) => [`manifest/${target}.json`, readJson(`manifest/${target}.json`)]));
    const stripped = Object.values(loaded).map(stripVariant);
    if (JSON.stringify(stripped[0]) !== JSON.stringify(stripped[1])) {
      throw new Error('Variants differ beyond version/background/gecko settings; fix manifest/chrome.json and manifest/firefox.json manually');
    }

    const changed = [];
    for (const [rel, manifest] of Object.entries(loaded)) {
      const before = JSON.stringify(manifest);
      manifest.version = pkg.version;
      manifest.description = pkg.description;
      manifest.homepage_url = pkg.homepage;
      if (JSON.stringify(manifest) !== before) {
        writeJson(rel, manifest);
        changed.push(rel);
      }
    }

    const root = readJson('manifest.json');
    const rootStripped = JSON.stringify(stripVariant(root));
    const active = Object.entries(loaded).find(([, manifest]) => JSON.stringify(stripVariant(manifest)) === rootStripped);
    if (!active) throw new Error('manifest.json does not match any variant; run npm run manifest:chrome or npm run manifest:firefox first');
    const before = JSON.stringify(root);
    root.version = pkg.version;
    root.description = pkg.description;
    root.homepage_url = pkg.homepage;
    if (JSON.stringify(root) !== before) {
      writeJson('manifest.json', root);
      changed.push('manifest.json');
    }

    const activeName = active[0].replace('manifest/', '').replace('.json', '');
    console.log(`synced v${pkg.version} (active variant: ${activeName})${changed.length ? '' : ' — already in sync'}`);
    changed.forEach((rel) => console.log(`  updated ${rel}`));
    return 0;
  } catch (error) {
    console.error(`Manifest sync failed: ${error.message}`);
    return 1;
  }
}

process.exitCode = main();
