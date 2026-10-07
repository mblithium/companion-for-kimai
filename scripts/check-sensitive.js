/* Scan repository files for likely credentials and personal email addresses. */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PLACEHOLDER = /^(?:|x{3,}|changeme|change_me|example|example[_-]?value|dummy|fake|placeholder|redacted|your[_-].*|<.*>)$/i;
const PATTERNS = [
  { kind: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { kind: 'GitHub token', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { kind: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { kind: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { kind: 'JWT', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { kind: 'email address', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ignore: (value) => /(?:^|\.)(?:example\.(?:com|org|net)|example|localhost|test)$/i.test(value.split('@')[1]) },
  {
    kind: 'credential assignment',
    regex: /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|password|passwd)\b\s*[:=]\s*(['"])([^'"\r\n]{8,})\1/gi,
    ignore: (_match, captures) => PLACEHOLDER.test(captures[1].trim()) || /\s/.test(captures[1]) || /^(?:process\.env|import\.meta\.env|env\.)/i.test(captures[1].trim()),
  },
  {
    kind: 'credential assignment',
    regex: /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|password|passwd)\b\s*[:=]\s*([A-Za-z0-9_~.+/-]{16,})\b/gi,
    ignore: (match, captures) => PLACEHOLDER.test(captures[0]) || /^(?:process\.env|import\.meta\.env|env\.)/i.test(captures[0]),
  },
  { kind: 'URL credential', regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:([^\s/@]{8,})@[^\s/]+/gi, ignore: (match, captures) => PLACEHOLDER.test(captures[0]) },
];

function listFiles() {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: ROOT,
    encoding: 'buffer',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to list repository files${result.error ? `: ${result.error.message}` : ''}`);
  }
  return [...new Set(result.stdout.toString('utf8').split('\0').filter(Boolean))];
}

function findLine(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function scanFile(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return [];
  const data = fs.readFileSync(filePath);
  if (data.includes(0)) return [];

  const text = data.toString('utf8');
  const findings = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const captures = match.slice(1);
      if (pattern.ignore && pattern.ignore(match[0], captures)) continue;
      findings.push({ file: relativePath, line: findLine(text, match.index), kind: pattern.kind });
    }
  }
  return findings;
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npm run check:sensitive');
    return 0;
  }

  try {
    const files = listFiles();
    const findings = files.flatMap(scanFile);
    if (findings.length) {
      for (const finding of findings) console.error(`${finding.file}:${finding.line}: possible ${finding.kind} (value omitted)`);
      console.error(`Sensitive scan found ${findings.length} possible issue(s) across ${files.length} repository file(s).`);
      return 1;
    }
    console.log(`Sensitive scan passed (${files.length} repository files checked).`);
    return 0;
  } catch (error) {
    console.error(`Sensitive scan failed: ${error.message}`);
    return 2;
  }
}

process.exitCode = main();
