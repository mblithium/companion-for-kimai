/* Render the package version's changelog section for GitHub Actions. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function main() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '';
  const tagVersion = tag.replace(/^v/, '');
  if (tag && tagVersion !== packageJson.version) {
    throw new Error(`Tag ${tag} does not match package version ${packageJson.version}`);
  }

  const version = tag ? tagVersion : packageJson.version;
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const headings = [...changelog.matchAll(/^##\s+\[([^\]]+)\].*$/gm)];
  const index = headings.findIndex((heading) => heading[1] === version);
  if (index < 0) throw new Error(`No CHANGELOG.md section found for version ${version}`);

  const start = headings[index].index + headings[index][0].length;
  const end = index + 1 < headings.length ? headings[index + 1].index : changelog.length;
  const changes = changelog.slice(start, end).trim();
  console.log(`## ${packageJson.name} v${version}\n`);
  console.log(changes || '_No changes listed for this version._');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`Unable to render release notes: ${error.message}`);
  process.exitCode = 1;
}
