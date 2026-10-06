/* Build production archives for the browser extension. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const VARIANTS = ['chrome', 'firefox'];
const JUNK_NAMES = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);
const CRC_TABLE = new Uint32Array(256);

for (let n = 0; n < CRC_TABLE.length; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[n] = value >>> 0;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function fail(message) {
  throw new Error(message);
}

function loadVariant(target) {
  const manifestPath = path.join(ROOT, 'manifest', `${target}.json`);
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Invalid or missing manifest (${manifestPath}): ${error.message}`);
  }
}

function checkVersions(manifests) {
  const versions = Object.fromEntries(Object.entries(manifests).map(([target, manifest]) => [target, manifest.version || '']));
  const uniqueVersions = new Set(Object.values(versions));
  if (uniqueVersions.size !== 1 || !Object.values(versions)[0]) {
    fail(`Manifest versions are missing or inconsistent: ${JSON.stringify(versions)}`);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = Object.values(versions)[0];
  if (packageJson.version !== version) {
    fail(`package.json (${packageJson.version}) does not match manifest versions (${JSON.stringify(versions)})`);
  }
  return version;
}

function referencedFiles(manifest) {
  const refs = [];
  for (const contentScript of manifest.content_scripts || []) {
    refs.push(...(contentScript.js || []), ...(contentScript.css || []));
  }
  refs.push(...Object.values(manifest.icons || {}));

  const action = manifest.action || {};
  if (action.default_popup) refs.push(action.default_popup);
  refs.push(...Object.values(action.default_icon || {}));

  const options = manifest.options_ui || {};
  if (options.page) refs.push(options.page);

  const background = manifest.background || {};
  if (background.service_worker) refs.push(background.service_worker);
  refs.push(...(background.scripts || []));

  const workerPath = path.join(ROOT, 'src', 'background', 'worker.js');
  if (fs.existsSync(workerPath)) {
    const source = fs.readFileSync(workerPath, 'utf8');
    for (const [, imports] of source.matchAll(/importScripts\(([\s\S]*?)\)/g)) {
      for (const [, importedPath] of imports.matchAll(/'([^']+)'/g)) {
        refs.push(path.posix.normalize(path.posix.join('src/background', importedPath)));
      }
    }
  }

  for (const htmlPath of [action.default_popup, options.page]) {
    if (!htmlPath) continue;
    const absolutePath = path.join(ROOT, htmlPath);
    if (!fs.existsSync(absolutePath)) continue;
    const html = fs.readFileSync(absolutePath, 'utf8');
    const base = path.posix.dirname(htmlPath);
    for (const [, reference] of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g)) {
      if (/^(?:https?:|data:)/i.test(reference)) continue;
      refs.push(path.posix.normalize(path.posix.join(base, reference)));
    }
  }

  return [...new Set(refs.map((file) => file.replaceAll('\\', '/')))];
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath));
    else if (entry.isFile() && !JUNK_NAMES.has(entry.name) && !entry.name.endsWith('.log')) files.push(absolutePath);
  }
  return files;
}

function collectProductionFiles() {
  const files = [];
  for (const directory of ['icons', 'src']) {
    const absolutePath = path.join(ROOT, directory);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) fail(`Production directory is missing: ${directory}/`);
    files.push(...walkFiles(absolutePath));
  }
  files.push(path.join(ROOT, 'LICENSE'));
  for (const file of files) {
    if (!fs.existsSync(file)) fail(`Production file is missing: ${path.relative(ROOT, file)}`);
  }
  return files.map((file) => ({ absolutePath: file, name: path.relative(ROOT, file).split(path.sep).join('/') }));
}

function makeZip(files) {
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  const dosDate = 0x21;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data || fs.readFileSync(file.absolutePath);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralRecords.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

function verifyZip(files, zipData) {
  let offset = 0;
  for (const file of files) {
    if (zipData.readUInt32LE(offset) !== 0x04034b50) fail(`Invalid ZIP entry: ${file.name}`);
    const flags = zipData.readUInt16LE(offset + 6);
    const method = zipData.readUInt16LE(offset + 8);
    const expectedCrc = zipData.readUInt32LE(offset + 14);
    const compressedSize = zipData.readUInt32LE(offset + 18);
    const size = zipData.readUInt32LE(offset + 22);
    const nameLength = zipData.readUInt16LE(offset + 26);
    const extraLength = zipData.readUInt16LE(offset + 28);
    const dataOffset = offset + 30 + nameLength + extraLength;
    const entryName = zipData.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    if (flags !== 0x0800 || method !== 8 || entryName !== file.name) fail(`Invalid ZIP metadata: ${file.name}`);
    const data = zlib.inflateRawSync(zipData.subarray(dataOffset, dataOffset + compressedSize));
    if (data.length !== size || crc32(data) !== expectedCrc) fail(`Corrupt ZIP entry: ${file.name}`);
    offset = dataOffset + compressedSize;
  }
  if (zipData.readUInt32LE(offset) !== 0x02014b50) fail('Missing ZIP central directory');
  const names = files.map((file) => file.name);
  if (!names.includes('manifest.json')) fail('Archive does not contain manifest.json');
  const leaked = names.filter((name) => /^(?:tests|docs|scripts|manifest|dist)\//.test(name) || /^(?:package\.json|README\.md|CHANGELOG\.md)$/.test(name));
  if (leaked.length) fail(`Development files leaked into archive: ${leaked.slice(0, 5).join(', ')}`);
}

function parseArgs(argv) {
  const args = { target: 'all', out: 'dist', clean: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--target' || value === '--out') {
      const next = argv[++i];
      if (!next) fail(`Missing value for ${value}`);
      args[value === '--target' ? 'target' : 'out'] = next;
    } else if (value === '--clean') args.clean = true;
    else if (value === '--help' || value === '-h') args.help = true;
    else fail(`Unknown option: ${value}`);
  }
  return args;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/build-zip.js [--target chrome|firefox|all] [--out dist] [--clean]');
      return 0;
    }
    if (!['all', ...VARIANTS].includes(args.target)) fail(`Invalid target: ${args.target}`);

    const allManifests = Object.fromEntries(VARIANTS.map((target) => [target, loadVariant(target)]));
    const version = checkVersions(allManifests);
    const targets = args.target === 'all' ? VARIANTS : [args.target];
    const outputDirectory = path.resolve(ROOT, args.out);
    if (args.clean) {
      const relativeOutputPath = path.relative(ROOT, outputDirectory);
      if (!relativeOutputPath || relativeOutputPath === '..' || relativeOutputPath.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutputPath)) {
        fail('With --clean, the output directory must be inside the project and not the project root');
      }
      fs.rmSync(outputDirectory, { recursive: true, force: true });
    }

    for (const target of targets) {
      const manifest = allManifests[target];
      const missing = referencedFiles(manifest).filter((name) => !fs.existsSync(path.join(ROOT, name)));
      if (missing.length) fail(`[${target}] Referenced files are missing:\n  - ${missing.join('\n  - ')}`);

      const files = [
        { name: 'manifest.json', absolutePath: null, data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8') },
        ...collectProductionFiles(),
      ];
      const zipEntries = files.map((file) => {
        if (file.data) return file;
        return { ...file, data: fs.readFileSync(file.absolutePath) };
      });
      const zipData = makeZip(zipEntries);
      verifyZip(zipEntries, zipData);
      fs.mkdirSync(outputDirectory, { recursive: true });
      const zipPath = path.join(outputDirectory, `companion-for-kimai-${target}-${version}.zip`);
      fs.writeFileSync(zipPath, zipData);
      console.log(`ok   ${path.basename(zipPath)} (${zipEntries.length} files, ${(zipData.length / 1024).toFixed(1)} KiB)`);
    }

    console.log(`\nReady in ${path.relative(ROOT, outputDirectory) || '.'}/`);
    return 0;
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    return 1;
  }
}

process.exitCode = main();
