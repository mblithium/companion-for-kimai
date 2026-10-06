/* Theme contrast checks. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIN_RATIO = 4.5;
let failures = 0;

function read(f) {
  return fs.readFileSync(path.join(ROOT, f), 'utf8');
}

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}
function parseThemes(css) {
  const themes = {};
  const base = css.match(/:root\s*,\s*:root\[data-ke-theme="light"\]\s*\{([\s\S]*?)\n\}/);
  themes.light = parseVars(base ? base[1] : '');
  const media = css.match(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{([\s\S]*)\}\s*$/);
  const mediaBody = media ? media[1] : '';
  const sys = mediaBody.match(/:root\[data-ke-theme="system"\][^{]*\{([\s\S]*?)\n\}/);
  themes.system = parseVars(sys ? sys[1] : '');
  for (const m of css.matchAll(/:root\[data-ke-theme="(\w+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    if (m[1] === 'system' || m[1] === 'light') continue;
    themes[m[1]] = Object.assign(themes[m[1]] || {}, parseVars(m[2]));
  }
  const gnomeLight = css.match(/:root\[data-ke-theme="gnome"\]\s*\{([\s\S]*?)\n\}/);
  if (gnomeLight) themes['gnome-light'] = parseVars(gnomeLight[1]);
  return themes;
}

function parseVars(body) {
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1].trim()] = m[2].trim();
  return out;
}
function parseRules(css) {
  css = stripComments(css);
  const rules = [];
  const chunks = [{ css, darkOs: false }];
  const mediaRe = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/g;
  let m;
  const top = [];
  let last = 0;
  const blocks = [];
  while ((m = mediaRe.exec(css)) !== null) {
    top.push(css.slice(last, m.index));
    let j = m.index + m[0].length;
    let depth = 1;
    while (depth && j < css.length) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    blocks.push(css.slice(m.index + m[0].length, j - 1));
    last = j;
  }
  top.push(css.slice(last));
  const pushRules = (src, darkOs) => {
    for (const r of src.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const decls = {};
      for (const d of r[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) decls[d[1].trim()] = d[2].trim();
      for (const sel of r[1].split(',')) {
        const s = sel.trim();
        if (s) rules.push({ sel: s, decls, darkOs });
      }
    }
  };
  top.forEach((t) => pushRules(t, false));
  blocks.forEach((b) => pushRules(b, true));
  return rules;
}

function resolveVar(value, vars) {
  let v = String(value || '').trim();
  for (let i = 0; i < 10; i++) {
    const m = v.match(/^var\(\s*(--[\w-]+)\s*(,\s*(.*))?\)$/s);
    if (!m) break;
    if (Object.prototype.hasOwnProperty.call(vars, m[1])) v = vars[m[1]];
    else if (m[3] !== undefined) v = m[3].trim();
    else return '';
  }
  return v;
}

function parseColor(v) {
  v = String(v || '').trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{6})$/);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16)).concat(1);
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
}

function composite(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))).concat(1);
}

function lum(c) {
  const v = c.slice(0, 3).map((x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

function ratio(a, b) {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function contextBg(file, theme) {
  if (file.includes('quicktimer')) return 'var(--ke-bg)';
  return 'var(--ke-bg)';
}

const themeCss = ['src/common/theme.css', ...fs.readdirSync(path.join(ROOT, 'src/common/themes'))
  .filter((f) => f.endsWith('.css')).map((f) => path.join('src/common/themes', f))]
  .map(read).join('\n');
const themes = parseThemes(themeCss);
for (const t of ['light', 'dark', 'dracula', 'catppuccin', 'nord', 'gruvbox', 'gnome', 'gnome-light', 'system']) {
  if (!themes[t]) {
    failures++;
    console.log('FALHOU tema ausente: ' + t);
  }
}

const files = ['src/popup/popup.css', 'src/options/options.css', 'src/content/quicktimer.css'];
for (const f of files) {
  const rules = parseRules(read(f));
  for (const theme of ['light', 'dark', 'dracula', 'catppuccin', 'nord', 'gruvbox', 'gnome', 'gnome-light']) {
    const vars = themes[theme] || {};
    for (const r of rules) {
      if (r.darkOs && theme === 'light') continue;
      const fgRaw = r.decls.color;
      if (!fgRaw || /^(inherit|initial|unset)$/.test(fgRaw)) continue;
      let bgRaw = r.decls['background-color'] || r.decls.background;
      if (!bgRaw) bgRaw = contextBg(f, theme);
      let fg = resolveVar(fgRaw, vars);
      let bg = resolveVar(bgRaw, vars);
      if (fg === 'inherit' || fg === 'currentcolor' || !fg) fg = resolveVar(contextBg(f, theme) === 'var(--ke-bg)' ? 'var(--ke-text)' : '#222222', vars);
      if (bg === 'inherit' || !bg) bg = resolveVar(contextBg(f, theme), vars);
      const fgC = parseColor(fg);
      let bgC = parseColor(bg);
      if (!fgC || !bgC) continue;
      if (bgC[3] < 1) {
        const ctx = parseColor(resolveVar(contextBg(f, theme), vars)) || [255, 255, 255, 1];
        bgC = composite(bgC, ctx);
      }
      const q = ratio(fgC, bgC);
      if (q < MIN_RATIO) {
        failures++;
        console.log(`FALHOU ${theme} ${f} ${r.sel}: "${fgRaw}" sobre "${bgRaw}" = ${q.toFixed(2)} (fg=${fg} bg=${bgC.slice(0, 3).join(',')})`);
      }
    }
  }
}

console.log(failures === 0 ? 'CHECK-CONTRAST OK (>= ' + MIN_RATIO + ')' : failures + ' FALHA(S)');
process.exit(failures === 0 ? 0 : 1);
