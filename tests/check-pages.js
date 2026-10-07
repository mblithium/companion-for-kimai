/* Static page integration checks. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function scriptsOf(htmlFile) {
  const html = fs.readFileSync(path.join(ROOT, htmlFile), 'utf8');
  const dir = path.posix.dirname(htmlFile);
  return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => path.posix.normalize(path.posix.join(dir, m[1])));
}

function definedNames(files) {
  const defs = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/KE\.([A-Za-z_$][\w$]*)\s*=/g)) defs.add(m[1]);
  }
  return defs;
}

function usedNames(pageScript) {
  const src = fs.readFileSync(path.join(ROOT, pageScript), 'utf8');
  const used = new Set();
  for (const m of src.matchAll(/KE\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
  return used;
}

for (const html of ['src/popup/popup.html', 'src/popup/focus.html', 'src/options/options.html']) {
  const files = scriptsOf(html);
  for (const f of files) {
    if (!fs.existsSync(path.join(ROOT, f))) {
      failures++;
      console.log('FALHOU script inexistente: ' + html + ' -> ' + f);
    }
  }
  const pageScript = files[files.length - 1];
  const libs = files.slice(0, -1);
  const defs = definedNames(libs);
  const missing = [...usedNames(pageScript)].filter((n) => !defs.has(n));
  if (missing.length) {
    failures++;
    console.log('FALHOU ' + html + ' usa KE.* sem definição nas libs: ' + missing.map((n) => 'KE.' + n).join(', '));
  } else {
    console.log('ok   ' + html + ' (' + files.length + ' scripts, ' + usedNames(pageScript).size + ' usos cobertos)');
  }
}
{
  const wfile = 'src/background/worker.js';
  const wsrc = fs.readFileSync(path.join(ROOT, wfile), 'utf8');
  const m = wsrc.match(/importScripts\(([\s\S]*?)\);/);
  if (!m) {
    failures++;
    console.log('FALHOU worker sem importScripts: ' + wfile);
  } else {
    const files = [...m[1].matchAll(/'([^']+)'/g)].map((x) => path.posix.normalize(path.posix.join('src/background', x[1])));
    for (const f of files) {
      if (!fs.existsSync(path.join(ROOT, f))) {
        failures++;
        console.log('FALHOU import inexistente: ' + wfile + ' -> ' + f);
      }
    }
    const defs = definedNames(files);
    const missing = [...usedNames(wfile)].filter((n) => !defs.has(n));
    if (missing.length) {
      failures++;
      console.log('FALHOU ' + wfile + ' usa KE.* sem definição nos imports: ' + missing.map((n) => 'KE.' + n).join(', '));
    } else {
      console.log('ok   ' + wfile + ' (' + files.length + ' imports, ' + usedNames(wfile).size + ' usos cobertos)');
    }
  }
}
{
  const variants = ['manifest/chrome.json', 'manifest/firefox.json'];
  const loaded = {};
  for (const f of variants) {
    try {
      loaded[f] = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    } catch (e) {
      failures++;
      console.log('FALHOU manifest inválido: ' + f);
    }
  }
  if (loaded[variants[0]] && loaded[variants[1]]) {
    const [c, f] = [loaded[variants[0]], loaded[variants[1]]];
    const strip = (m) => {
      const copy = JSON.parse(JSON.stringify(m));
      delete copy.background;
      if (copy.browser_specific_settings && copy.browser_specific_settings.gecko) {
        delete copy.browser_specific_settings.gecko.strict_min_version;
      }
      return copy;
    };
    if (c.version !== f.version) {
      failures++;
      console.log('FALHOU versões divergentes: chrome=' + c.version + ' firefox=' + f.version);
    }
    if (JSON.stringify(strip(c)) !== JSON.stringify(strip(f))) {
      failures++;
      console.log('FALHOU variantes divergem além de background/gecko-min');
    }
    const contentScripts = (c.content_scripts && c.content_scripts[0] && c.content_scripts[0].js) || [];
    if (contentScripts.indexOf('src/content/sitegroup.js') < 0 ||
        contentScripts.indexOf('src/content/sitegroup.js') > contentScripts.indexOf('src/content/quicktimer.js')) {
      failures++;
      console.log('FALHOU sitegroup.js ausente ou fora de ordem antes de quicktimer.js');
    }
    if (!c.background || !c.background.service_worker) {
      failures++;
      console.log('FALHOU chrome sem background.service_worker');
    }
    if (!f.background || !Array.isArray(f.background.scripts) || 'persistent' in f.background) {
      failures++;
      console.log('FALHOU firefox sem background.scripts (sem persistent, removido no MV3)');
    }
    if (!failures) console.log('ok   variantes chrome/firefox consistentes (v' + c.version + ')');
  }
}

console.log(failures === 0 ? 'CHECK-PAGES OK' : failures + ' FALHA(S)');
process.exit(failures === 0 ? 0 : 1);
