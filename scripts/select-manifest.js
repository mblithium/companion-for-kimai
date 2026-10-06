/* Select the browser-specific extension manifest. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const variants = ['chrome', 'firefox'];

function main() {
  const target = String(process.argv[2] || '').toLowerCase();
  if (!variants.includes(target)) {
    console.error('Usage: npm run manifest:chrome | npm run manifest:firefox');
    return 2;
  }

  const source = path.join(root, 'manifest', `${target}.json`);
  const destination = path.join(root, 'manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
    fs.copyFileSync(source, destination);
    console.log(`manifest.json <- manifest/${target}.json (v${manifest.version})`);
    return 0;
  } catch (error) {
    console.error(`Unable to select manifest: ${error.message}`);
    return 1;
  }
}

process.exitCode = main();
