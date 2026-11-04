/* Functional test harness. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const contentFiles = manifest.content_scripts[0].js;
if (!contentFiles.length) throw new Error('manifest without content_scripts js');
const SRC = contentFiles.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
console.log('modules under test: ' + contentFiles.length);
const SRC_EXTRA = ['src/common/format.js', 'src/common/permissions.js', 'src/common/theme.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
const SRC_TESTHOOK = '\n;globalThis.__keTest = { KE };';
const POP_SRC = fs.readFileSync(path.join(ROOT, 'src/popup/popup.js'), 'utf8');
const FOCUS_SRC = fs.readFileSync(path.join(ROOT, 'src/popup/focus.js'), 'utf8');
const OPT_SRC = fs.readFileSync(path.join(ROOT, 'src/options/options.js'), 'utf8');


function detachNode(c) {
  const p = c && c.parentNode;
  if (p && p.children) {
    const i = p.children.indexOf(c);
    if (i >= 0) p.children.splice(i, 1);
  }
  if (c) c.parentNode = null;
}
function syncClassName(elm) {
  elm.className = Array.from(elm.classList._set).join(' ');
}
function makeClassList(elm) {
  const s = new Set();
  return {
    _set: s,
    add(...c) { c.forEach((x) => s.add(x)); syncClassName(elm); },
    remove(...c) { c.forEach((x) => s.delete(x)); syncClassName(elm); },
    toggle(c, force) {
      const on = force === undefined ? !s.has(c) : !!force;
      if (on) s.add(c); else s.delete(c);
      syncClassName(elm);
      return on;
    },
    contains(c) { return s.has(c); },
  };
}
class StubEl {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.classList = makeClassList(this);
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.placeholder = '';
    this.textContent = '';
    this.type = '';
    this.href = '';
    this.tabIndex = 0;
    this.parentNode = null;
    this.attributes = {};
    this._handlers = {};
    this._innerHTML = '';
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    if (String(v) === '') this.children = [];
    this.textContent = String(v).replace(/<[^>]*>/g, '');
  }
  appendChild(c) { detachNode(c); c.parentNode = this; this.children.push(c); return c; }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) this.parentNode.children.splice(i, 1);
    this.parentNode = null;
  }
  insertBefore(node, ref) {
    detachNode(node);
    node.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i >= 0) this.children.splice(i, 0, node); else this.children.push(node);
    return node;
  }
  prepend(...nodes) { nodes.reverse().forEach((n) => this.insertBefore(n, this.children[0] || null)); }
  replaceChildren(...nodes) {
    this.children.forEach((c) => { c.parentNode = null; });
    this.children = [];
    this.textContent = '';
    nodes.forEach((n) => this.appendChild(n));
  }
  addEventListener(t, f) { (this._handlers[t] = this._handlers[t] || []).push(f); }
  removeEventListener() {}
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  select() {}
  focus() { document.activeElement = this; this.fire('focus'); }
  blur() { if (document.activeElement === this) document.activeElement = null; }
  scrollIntoView() {}
  matchesSel(sel) {
    return String(sel).split(',').some((one) => this._matchOne(one.trim()));
  }
  _matchOne(sel) {
    let rest = String(sel).replace(/\[[^\]]*\]/g, '');
    const tm = rest.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (tm && (rest.length === tm[0].length || rest[tm[0].length] === '.')) {
      if (this.tagName !== tm[0].toUpperCase()) return false;
      rest = rest.slice(tm[0].length);
    }
    return rest.split('.').filter(Boolean).every((p) => this.classList.contains(p));
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.matchesSel(sel)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  dispatchEvent(ev) { this.fire(ev && ev.type, ev); return true; }
  closest(sel) {
    let n = this;
    const cls = String(sel).replace(/^\./, '');
    while (n) { if (n.classList && n.classList.contains(cls)) return n; n = n.parentNode; }
    return null;
  }
  fire(type, ev) {
    const full = Object.assign({ preventDefault() {}, stopPropagation() {} }, ev);
    if (typeof this['on' + type] === 'function') this['on' + type].call(this, full);
    (this._handlers[type] || []).forEach((f) => f(full));
  }
}
Object.defineProperty(StubEl.prototype, 'className', {
  get() { return this._cls || ''; },
  set(v) {
    this._cls = String(v || '');
    this.classList._set.clear();
    String(v || '').split(/\s+/).filter(Boolean).forEach((c) => this.classList._set.add(c));
  },
});

const captured = {};
const mountedCards = [];
const anchor = new StubEl('div');
anchor.parentNode = {
  insertBefore(node) {
    if (node.id === 'ke-quick-timer') captured.card = node;
    if (node.id === 'ke-quick-timer' || node.id === 'ke-active-now') mountedCards.push(node);
    return node;
  },
};
const document = {
  __keComboOutside__: false,
  activeElement: null,
  documentElement: {
    getAttribute: (k) => (k === 'data-bs-theme' ? stubBsTheme : 'pt-BR'),
    setAttribute: (k, v) => { if (k === 'data-bs-theme') { stubBsTheme = v; stubBsRemoved = false; } },
    removeAttribute: (k) => { if (k === 'data-bs-theme') { stubBsTheme = null; stubBsRemoved = true; } },
    dataset: {},
  },
  readyState: 'complete',
  createElement: (t) => new StubEl(t),
  body: new StubEl('body'),
  createTextNode: (t) => ({ nodeType: 3, textContent: t, parentNode: null }),
  getElementById: (id) => {
    if (id === 'ke-quick-timer') return mountedCards[0] || null;
    if (!popEls[id]) popEls[id] = new StubEl('div');
    return popEls[id];
  },
  querySelector: () => anchor,
  querySelectorAll: () => [],
  addEventListener() {},
  dispatchEvent() { return true; },
};
const navigator = { language: 'pt-BR' };
const location = { pathname: '/en/timesheet/', href: '' };
const moInstances = [];
class MutationObserver {
  constructor(cb) { this.cb = cb; moInstances.push(this); }
  observe() {}
  disconnect() {}
}


const customers = [
  { id: 8, name: 'Bruen, Ziemann and Runolfsson', visible: true },
  { id: 13, name: 'Altenwerth-Donnelly', visible: true },
  { id: 20, name: 'São Paulo Tech', visible: true },
];
for (let i = 0; i < 197; i++) customers.push({ id: 1000 + i, name: 'Cliente Extra ' + String(i).padStart(3, '0'), visible: true });
const projAll = [
  { id: 97, name: 'Accusamus iste', parentTitle: 'Bruen, Ziemann and Runolfsson' },
  { id: 144, name: 'Tempore commodi', parentTitle: 'Altenwerth-Donnelly' },
  { id: 146, name: 'Aspernatur organica', parentTitle: 'Altenwerth-Donnelly' },
  { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' },
];
const projActs = [
  { id: 1655, name: 'Consequuntur dolor' },
  { id: 1661, name: 'Corrupti aut' },
];
const globals = [
  { id: 1, name: 'Reunião' },
  { id: 2, name: 'Desenvolvimento' },
];
const posted = [];
const createdTags = [];
const stoppedIds = [];
const patchedTimers = [];
const singleStub = {};
let activeStub = [];
let todayStub = [];
let recentStub = [];
let rangeStub = [];
let autoConnectPosts = [];
let autoConnectDeleted = [];
let autoConnectPage = '';
let autoConnectPostPage = '<html>ok</html>';
let failMode = null;
const fetchCounts = {};
const bump = (k) => { fetchCounts[k] = (fetchCounts[k] || 0) + 1; };
const stored = {};
const storedLocal = {};
const popEls = {};
let stubBsTheme = 'dark';
let stubBsRemoved = false;
let tabList = [];
function listenerReg() {
  const r = { fn: null, addListener(f) { r.fn = f; } };
  return r;
}
const sentMessages = [];
const chrome = {
  permissions: {
    granted: true,
    contains: async () => chrome.permissions.granted,
    request: async () => { chrome.permissions.granted = true; return true; },
    remove: async () => { chrome.permissions.granted = false; return true; },
  },
  runtime: {
    getManifest: () => manifest,
    getURL: (file) => 'chrome-extension://test/' + file,
    openOptionsPage() {},
    onInstalled: listenerReg(),
    onStartup: listenerReg(),
    onMessage: listenerReg(),
    sendMessage: async (m) => { sentMessages.push(m); },
  },
  tabs: {
    created: [],
    reloaded: [],
    create: async (o) => { chrome.tabs.created.push(o); return o; },
    reload: async (id) => { chrome.tabs.reloaded.push(id); return id; },
    query: async () => tabList.slice(),
  },
  windows: {
    created: [],
    create: async (options) => { chrome.windows.created.push(options); return { id: chrome.windows.created.length }; },
  },
  alarms: {
    create() {},
    onAlarm: listenerReg(),
  },
  i18n: { getUILanguage: () => 'pt-BR' },
  storage: {
    sync: {
      get: async (keys) => {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in stored) out[k] = stored[k]; });
        return out;
      },
      set: async (obj) => { Object.assign(stored, obj); },
      remove: async (keys) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => { delete stored[k]; }); },
    },
    local: {
      get: async (keys) => {
        if (keys == null) return Object.assign({}, storedLocal);
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in storedLocal) out[k] = storedLocal[k]; });
        return out;
      },
      set: async (obj) => { Object.assign(storedLocal, obj); },
      remove: async (keys) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => { delete storedLocal[k]; }); },
    },
  },
};
function jsonResp(data) {
  return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => data, text: async () => JSON.stringify(data) };
}
let lastReq = null;
const fetch = async (url, opts) => {
  lastReq = { url: String(url), opts: opts || {} };
  if (failMode === 'network') throw new TypeError('Failed to fetch');
  const u = String(url).replace(/^https?:\/\/[^/]+/, '');
  if (failMode === 'auth' && (u.startsWith('/api/projects') || u.startsWith('/api/timesheets'))) {
    return { ok: false, status: 401, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 401, message: 'Unauthorized.' }) };
  }
  const method = (opts && opts.method) || 'GET';
  if (u.startsWith('/api/customers')) { bump('customers'); return jsonResp(customers); }
  if (u.startsWith('/api/projects')) {
    bump('projects');
    if (u.includes('%5B%5D=8')) return jsonResp(projAll.filter((p) => p.parentTitle.includes('Bruen')));
    if (u.includes('%5B%5D=13')) return jsonResp(projAll.filter((p) => p.parentTitle.includes('Altenwerth')));
    if (u.includes('%5B%5D=20')) return jsonResp(projAll.filter((p) => p.parentTitle.includes('Paulo')));
    return jsonResp(projAll);
  }
  if (u.startsWith('/api/activities')) {
    bump('activities');
    if (u.includes('globals=true')) return jsonResp(globals);
    if (u.includes('projects%5B%5D=')) return jsonResp(projActs);
    return jsonResp([]);
  }
  if (u.startsWith('/api/tags') && method === 'GET') return jsonResp(['Alexander', 'Reunião']);
  if (u === '/api/tags' && method === 'POST') {
    const b = JSON.parse(opts.body);
    createdTags.push(b.name);
    return jsonResp({ id: 9000 + createdTags.length, name: b.name });
  }
  if (u === '/api/users/me' && method === 'GET') return jsonResp({ username: 'john_user', language: 'en', alias: 'John' });
  if (u === '/api/timesheets/active') return jsonResp(activeStub);
  if (u.startsWith('/api/timesheets?') && method === 'GET') {
    if (u.includes('size=1000')) { bump('range'); return jsonResp(rangeStub); }
    if (u.includes('size=100')) { bump('recent'); return jsonResp(recentStub); }
    bump('today'); return jsonResp(todayStub);
  }
  if (u === '/api/timesheets' && method === 'POST') {
    const b = JSON.parse(opts.body);
    if (b.description === 'FORCAR400') {
      return { ok: false, status: 400, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 400, message: 'Project is locked for this period.' }) };
    }
    if (Array.isArray(b.tags)) {
      return { ok: false, status: 400, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 400, message: 'Validation Failed', errors: { children: { tags: { errors: ['This value is not valid.'] } } } }) };
    }
    posted.push(b);
    return jsonResp({ id: 999, begin: b.begin, project: 1, activity: 1 });
  }
  if (/\/api\/timesheets\/\d+$/.test(u) && method === 'PATCH') {
    const id = u.match(/\/api\/timesheets\/(\d+)$/)[1];
    patchedTimers.push({ id, body: JSON.parse(opts.body) });
    return jsonResp({ id: Number(id) });
  }
  if (/\/api\/timesheets\/\d+$/.test(u) && method === 'GET') {
    const id = u.match(/\/api\/timesheets\/(\d+)$/)[1];
    if (singleStub[id]) return jsonResp(singleStub[id]);
  }
  if (/\/api\/timesheets\/\d+\/stop/.test(u)) {
    stoppedIds.push(u.match(/\/api\/timesheets\/(\d+)\/stop/)[1]);
    return jsonResp({});
  }
  if (u.match(/\/profile\/[^/]+\/create-access-token/) && method === 'GET') {
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<input type="hidden" name="access_token_form[_token]" value="CSRF123" />' };
  }
  if (u.match(/\/profile\/[^/]+\/create-access-token/) && method === 'POST') {
    autoConnectPosts.push(String((opts && opts.body) || ''));
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => autoConnectPostPage };
  }
  if (u.match(/\/profile\/[^/]+\/api-token/) && method === 'GET') {
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => autoConnectPage };
  }
  if (u.match(/\/api\/users\/api-token\/\d+/) && method === 'DELETE') {
    const id = u.match(/\/api\/users\/api-token\/(\d+)/)[1];
    autoConnectDeleted.push(id);
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}' };
  }
  if (u.match(/\/profile\/[^/]+\/api-token\/\d+/) && method === 'DELETE') {
    const id = u.match(/\/api-token\/(\d+)/)[1];
    autoConnectDeleted.push(id);
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}' };
  }
  throw new Error('unexpected fetch: ' + method + ' ' + u);
};

global.setInterval = () => 0;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.confirm = () => true;
stored.keCustomer = '13';
stored.keProject = '144';
stored.keActivity = '1661';


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('ok   ' + name);
  else { failures++; console.log('FAILED ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
}
function findAll(root, cls) {
  const out = [];
  const walk = (n) => (n.children || []).forEach((c) => { if (c.matchesSel && c.matchesSel('.' + cls)) out.push(c); walk(c); });
  walk(root);
  return out;
}
function fireInput(input, text) { input.value = text; input.fire('input'); }
function fireKey(input, key) { input.fire('keydown', { key }); }
function nowSection() { return mountedCards.find((n) => n.id === 'ke-active-now'); }
function pageToast() { return findAll(document.body, 'ke-toast')[0]; }

(async () => {
  eval(SRC + SRC_EXTRA + SRC_TESTHOOK);
  const KE = globalThis.__keTest.KE;
  let card = null;
  for (let i = 0; i < 100 && !card; i++) { await sleep(20); card = captured.card; }
  check('injected card', !!card);
  const titlePlayIcon = findAll(card, 'ke-play-icon')[0];
  check('title icon uses geometric shape in circle', !!titlePlayIcon && titlePlayIcon.textContent === '' &&
    findAll(card, 'ke-play')[0].getAttribute('aria-hidden') === 'true');
  const quickStartButton = findAll(card, 'ke-btn-start')[0];
  check('Start button icon and text are separate elements',
    findAll(quickStartButton, 'ke-btn-start-icon')[0].textContent === '' &&
    findAll(quickStartButton, 'ke-btn-start-label')[0].textContent === KE.T.start);
  const inputs = findAll(card, 'ke-combo-input');
  check('3 comboboxes', inputs.length === 3, inputs.length);
  const [custIn, projIn, actIn] = inputs;
  const descIn = findAll(card, 'ke-field').length ? null : null;
  await sleep(100);
  check('restores customer', custIn.value === 'Altenwerth-Donnelly', custIn.value);
  check('restores project', projIn.value === 'Altenwerth-Donnelly / Tempore commodi', projIn.value);
  check('restores activity', actIn.value === 'Corrupti aut', actIn.value);
  custIn.fire('focus');
  const custList = findAll(card, 'ke-combo-list')[0];
  check('caps at 150 options', custList.children.length === 150, custList.children.length);
  fireInput(custIn, 'sao');
  const names = custList.children.map((c) => c.textContent);
  check("busca 'sao'", names.length === 1 && names[0] === 'São Paulo Tech', names);
  fireKey(custIn, 'Enter');
  await sleep(100);
  check('customer selected', custIn.value === 'São Paulo Tech', custIn.value);
  projIn.fire('focus');
  const projList = findAll(card, 'ke-combo-list')[1];
  const pnames = projList.children.map((c) => c.textContent);
  check('projects filtered', pnames.length === 1 && pnames[0] === 'São Paulo Tech / Site São Paulo', pnames);
  fireKey(projIn, 'ArrowDown');
  fireKey(projIn, 'Enter');
  await sleep(100);
  check('project via keyboard', projIn.value === 'São Paulo Tech / Site São Paulo', projIn.value);
  actIn.fire('focus');
  fireKey(actIn, 'ArrowDown');
  fireKey(actIn, 'Enter');
  await sleep(50);
  check('activity via keyboard', actIn.value === 'Consequuntur dolor', actIn.value);
  const fields = findAll(card, 'ke-field');
  const desc = fields.map((f) => f.children.find((c) => (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA') && !c.classList.contains('ke-combo-input'))).find(Boolean);
  desc.value = 'revisão do layout';
  const startBtn = findAll(card, 'ke-btn-start')[0];
  startBtn.fire('click');
  await sleep(100);
  check('POST sent', posted.length === 1, posted.length);
  const body = posted[0] || {};
  check('POST project', body.project === 200, body);
  check('POST activity', body.activity === 1655, body);
  check('POST description', body.description === 'revisão do layout', body);
  check('POST begin format', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(body.begin || ''), body.begin);
  check('POST omits empty tags', !('tags' in body), Object.keys(body));
  check('storage updated', stored.keProject === '200' && stored.keActivity === '1655' && stored.keCustomer === '20', stored);
  const status = pageToast();
  check('ok status', status.textContent === 'Timer iniciado!', status.textContent);
  fireInput(actIn, '');
  await sleep(50);
  startBtn.fire('click');
  await sleep(50);
  check('validation requires activity', status.textContent === 'Selecione projeto e atividade para iniciar.', status.textContent);
  check('no extra POST', posted.length === 1, posted.length);
  fireInput(projIn, 'texto livre qualquer');
  fireKey(projIn, 'Escape');
  check('escape reverts', projIn.value === 'São Paulo Tech / Site São Paulo', projIn.value);
  fireInput(actIn, 'Consequuntur dolor');
  fireKey(actIn, 'Enter');
  await sleep(50);
  desc.value = 'FORCAR400';
  startBtn.fire('click');
  await sleep(100);
  check('error shows server reason', status.textContent === 'Não foi possível iniciar o timer. Project is locked for this period.', status.textContent);
  check('no POST on 400', posted.length === 1, posted.length);
  const tagsIn = findAll(card, 'ke-multi-input')[0];
  check('tags combobox exists', !!tagsIn);
  const tagsList = tagsIn.parentNode.parentNode.querySelector('.ke-combo-list');
  fireInput(tagsIn, 'Alex');
  check('tags filter available',
    tagsList.querySelectorAll('.ke-combo-opt').map((n) => n.textContent).join(',') === '+ Alex,Alexander');
  fireInput(tagsIn, 'Alexander');
  fireKey(tagsIn, 'Enter');
  await sleep(50);
  fireInput(tagsIn, 'NovaTag');
  fireKey(tagsIn, 'Enter');
  await sleep(50);
  desc.value = 'com tags';
  startBtn.fire('click');
  await sleep(150);
  check('missing tag created', createdTags.length === 1 && createdTags[0] === 'NovaTag', createdTags);
  const bodyTags = posted[1] || {};
  check('tags as string', bodyTags.tags === 'Alexander,NovaTag', bodyTags.tags);
  check('start with tags ok', status.textContent === 'Timer iniciado!', status.textContent);
  const bannerLink = findAll(card, 'ke-connect-manual')[0];
  check('banner has hidden manual link', !!bannerLink && bannerLink.hidden === true &&
    bannerLink.textContent === 'Criar chave manualmente');
  const savedBannerToken = storedLocal.keApiToken;
  delete storedLocal.keApiToken;
  autoConnectPage = '<table></table>';
  findAll(card, 'ke-btn-connect')[0].fire('click');
  await sleep(300);
  check('failure shows manual link with key URL', bannerLink.hidden === false &&
    bannerLink.href.indexOf('/api-token') >= 0, bannerLink.href);
  check('failure toast guides', pageToast().textContent === 'Não foi possível conectar.', pageToast().textContent);
  if (savedBannerToken !== undefined) storedLocal.keApiToken = savedBannerToken;
  const t0desc = KE.todayKey();
  todayStub = [
    { id: 701, project: 200, activity: 1655, begin: t0desc + 'T09:00:00', end: t0desc + 'T10:00:00', duration: 3600, description: 'manhã' },
  ];
  recentStub = [
    { id: 801, project: 144, activity: 1661, begin: '2000-01-02T09:00:00', end: '2000-01-02T10:00:00', duration: 1800, description: 'revisão do layout', tags: [{ name: 'Alexander' }] },
    { id: 802, project: 144, activity: 1661, begin: '2000-01-01T09:00:00', end: '2000-01-01T10:00:00', duration: 1800, description: 'revisão do layout' },
  ];
  Object.keys(storedLocal).forEach((k) => { if (k === 'keCacheToday' || k === 'keCacheRecent') delete storedLocal[k]; });
  const descArea = findAll(card, 'ke-input').filter((n) => n.tagName === 'TEXTAREA')[0];
  check('bar description is textarea', !!descArea);
  fireInput(descArea, 'revi');
  await sleep(300);
  const siteSuggest = findAll(card, 'ke-suggest')[0];
  const siteItems = findAll(siteSuggest, 'ke-suggest-item');
  check('bar suggests related recents', siteSuggest.hidden === false && siteItems.length === 1 &&
    findAll(siteItems[0], 'ke-suggest-title')[0].textContent === 'revisão do layout' &&
    siteItems[0].getAttribute('role') === 'option', siteItems.length);
  siteItems[0].onclick();
  await sleep(400);
  const siteCombos = findAll(card, 'ke-combo-input');
  check('suggestion fills everything in bar', descArea.value === 'revisão do layout' &&
    siteCombos[0].value === 'Altenwerth-Donnelly' &&
    siteCombos[1].value === 'Altenwerth-Donnelly / Tempore commodi' &&
    siteCombos[2].value === 'Corrupti aut' &&
    findAll(card, 'ke-chip').length === 1 && siteSuggest.hidden === true,
    siteCombos.map((i) => i.value));
  fireInput(descArea, 'zzz-nada');
  await sleep(300);
  check('no relation hides in bar', siteSuggest.hidden === true);
  fireInput(descArea, 'r');
  await sleep(300);
  check('short text hides in bar', siteSuggest.hidden === true);
  const postedBeforeSiteKeys = posted.length;
  fireInput(descArea, 'revi');
  await sleep(300);
  descArea.fire('keydown', { key: 'ArrowDown' });
  descArea.fire('keydown', { key: 'Enter' });
  await sleep(400);
  check('keyboard applies without starting in bar', descArea.value === 'revisão do layout' &&
    posted.length === postedBeforeSiteKeys, posted.length);
  Object.keys(storedLocal).forEach((k) => { if (k === 'keCacheToday' || k === 'keCacheRecent') delete storedLocal[k]; });
  const savedApiToken = storedLocal.keApiToken;
  storedLocal.keApiToken = 'tok-api-down';
  failMode = null;
  await KE.refreshCatalogHandler();
  await sleep(300);
  const siteBanner = findAll(card, 'ke-connect')[0];
  check('banner hidden with API ok', siteBanner.hidden === true);
  failMode = 'network';
  await KE.refreshCatalogHandler();
  await sleep(300);
  check('banner reappears with API down', siteBanner.hidden === false);
  failMode = null;
  await KE.refreshCatalogHandler();
  await sleep(300);
  check('banner hides on recovery', siteBanner.hidden === true);
  if (savedApiToken === undefined) delete storedLocal.keApiToken;
  else storedLocal.keApiToken = savedApiToken;
  failMode = null;
  moInstances.forEach((m) => m.cb());
  await sleep(700);
  check('no duplicate with card present', mountedCards.length === 2, mountedCards.length);
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  check('remounts after wipe', mountedCards.length === 2, mountedCards.length);
  const newInputs = findAll(mountedCards[0], 'ke-combo-input');
  check('combos reloaded after wipe',
    newInputs.length === 3 && newInputs[0].value === 'São Paulo Tech' &&
    newInputs[1].value === 'São Paulo Tech / Site São Paulo' &&
    newInputs[2].value === 'Consequuntur dolor',
    newInputs.map((i) => i.value));
  activeStub = [
    { id: 555, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'lendo docs' },
    { id: 556, project: 200, activity: 1655, begin: new Date(Date.now() - 65 * 60 * 1000).toISOString(), description: '' },
  ];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  const titles = findAll(nowSection(), 'ke-active-title').map((n) => n.textContent);
  check('active without [object Object]', titles.length === 2 && titles.every((t) => !t.includes('[object Object]')), titles);
  check('object active labeled', titles[0] === 'São Paulo Tech / Site São Paulo · Consequuntur dolor', titles);
  check('numeric active labeled', titles[1] === 'São Paulo Tech / Site São Paulo · Consequuntur dolor', titles);
  check('Now outside card', findAll(mountedCards[0], 'ke-active-title').length === 0 &&
    findAll(nowSection(), 'ke-now-title')[0].textContent === 'Agora');
  check('no stop in quick timer', findAll(mountedCards[0], 'ke-stop-all').length === 0);
  stoppedIds.length = 0;
  const agoraStops = findAll(nowSection(), 'ke-btn-stop');
  check('stop per timer in Now', agoraStops.length === 2, agoraStops.length);
  check('stop uses square icon with accessible label', agoraStops.every((b) => b.textContent === '■' &&
    b.getAttribute('aria-label') === KE.T.stop && b.title === KE.T.stop));
  agoraStops[0].fire('click');
  await sleep(150);
  check('stopped the timer', stoppedIds.join(',') === '555', stoppedIds);
  let curStatus = pageToast();
  check('stop status', curStatus.textContent === 'Timer parado!', curStatus.textContent);
  activeStub = [
    { id: 557, project: 200, activity: 1655, begin: new Date(Date.now() - 10 * 60 * 1000).toISOString(), description: '' },
  ];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  stoppedIds.length = 0;
  findAll(nowSection(), 'ke-btn-stop')[0].fire('click');
  await sleep(150);
  check('stopped the only one', stoppedIds.join(',') === '557', stoppedIds);
  curStatus = pageToast();
  check('singular stop status', curStatus.textContent === 'Timer parado!', curStatus.textContent);
  activeStub = [
    { id: 558, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'antes', tags: ['Alexander', 'NovaTag'] },
  ];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  createdTags.length = 0;
  patchedTimers.length = 0;
  findAll(nowSection(), 'ke-btn-edit')[0].fire('click');
  await sleep(250);
  let editForm = findAll(nowSection(), 'ke-edit-form')[0];
  check('edit form opens', !!editForm);
  const editCombos = findAll(editForm, 'ke-combo-input');
  check('edit fills project', editCombos[0].value === 'São Paulo Tech / Site São Paulo', editCombos.map((i) => i.value));
  check('edit fills activity', editCombos[1].value === 'Consequuntur dolor', editCombos.map((i) => i.value));
  const editTexts = findAll(editForm, 'ke-input').filter((n) => n.tagName === 'INPUT' && !n.classList.contains('ke-combo-input'));
  check('edit fills description', editTexts[0].value === 'antes', editTexts.map((i) => i.value));
  check('edit fills start time', editTexts[1].value === KE.timeValue(activeStub[0].begin), editTexts.map((i) => i.value));
  check('edit fills tags', editTexts[2].value === 'Alexander, NovaTag', editTexts.map((i) => i.value));
  editTexts[0].value = 'depois';
  const pastTime = KE.timeValue(new Date(new Date(activeStub[0].begin).getTime() - 120000).toISOString());
  editTexts[1].value = pastTime;
  findAll(editForm, 'ke-btn-save')[0].fire('click');
  await sleep(250);
  check('edit PATCH', patchedTimers.length === 1 && patchedTimers[0].id === '558' &&
    patchedTimers[0].body.project === 200 && patchedTimers[0].body.activity === 1655 &&
    patchedTimers[0].body.description === 'depois' && patchedTimers[0].body.tags === 'Alexander,NovaTag' &&
    patchedTimers[0].body.begin === KE.timeToApi(activeStub[0].begin, pastTime),
    patchedTimers);
  check('updated status', pageToast().textContent === 'Timer atualizado!');
  findAll(nowSection(), 'ke-btn-edit')[0].fire('click');
  await sleep(250);
  findAll(nowSection(), 'ke-btn-cancel')[0].fire('click');
  await sleep(50);
  check('cancel closes editor', findAll(nowSection(), 'ke-edit-form').length === 0 &&
    findAll(nowSection(), 'ke-btn-edit').length === 1);
  check('cancel without PATCH', patchedTimers.length === 1, patchedTimers.length);
  findAll(nowSection(), 'ke-btn-edit')[0].fire('click');
  await sleep(250);
  editForm = findAll(nowSection(), 'ke-edit-form')[0];
  const editAct = findAll(editForm, 'ke-combo-input')[1];
  fireInput(editAct, '');
  await sleep(50);
  findAll(editForm, 'ke-btn-save')[0].fire('click');
  await sleep(100);
  check('edit validates activity', pageToast().textContent === 'Selecione projeto e atividade para iniciar.');
  check('validation without PATCH', patchedTimers.length === 1, patchedTimers.length);
  delete stored.keSettings;
  chrome.permissions.granted = true;
  eval(POP_SRC);
  await sleep(300);
  check('popup setup without base', popEls['ke-pop-setup'].hidden === false && popEls['ke-pop-main'].hidden === true &&
    popEls['ke-pop-setup-msg'].textContent.includes('Configure'), popEls['ke-pop-setup-msg'].textContent);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo' };
  storedLocal.keApiToken = 'popup-token';
  activeStub = [
    { id: 801, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'rodando' },
  ];
  const tstr = KE.todayKey();
  todayStub = [
    { id: 701, project: 200, activity: 1655, begin: tstr + 'T09:00:00', end: tstr + 'T10:00:00', duration: 3600, description: 'manhã' },
    { id: 702, project: 200, activity: 1655, begin: tstr + 'T11:00:00', end: tstr + 'T12:00:00', duration: 3600, description: 'manhã' },
    { id: 703, project: 144, activity: 1661, begin: tstr + 'T14:00:00', end: tstr + 'T15:00:00', duration: 3600, description: 'tarde' },
  ];
  chrome.permissions.granted = false;
  eval(POP_SRC);
  await sleep(300);
  check('popup requests access', popEls['ke-pop-main'].hidden === true &&
    popEls['ke-pop-setup-btn'].textContent === 'Autorizar acesso', popEls['ke-pop-setup-btn'].textContent);
  await popEls['ke-pop-setup-btn'].onclick();
  await sleep(500);
  check('opens app after authorizing', popEls['ke-pop-main'].hidden === false && chrome.permissions.granted === true);
  const footKids = popEls['ke-pop-foot'].children;
  check('footer shows open-Kimai hint', footKids.length === 3 &&
    footKids[0].textContent === 'ALT + SHIFT + K para abrir o Kimai (' &&
    footKids[2].textContent === ')', footKids.map((n) => n.textContent));
  const footLink = findAll(popEls['ke-pop-foot'], 'ke-pop-link')[0];
  check('footer has shortcuts link', !!footLink && footLink.textContent === 'ver mais atalhos');
  chrome.tabs.created.length = 0;
  await footLink.onclick();
  check('link opens shortcuts section', chrome.tabs.created.length === 1 &&
    chrome.tabs.created[0].url === 'chrome-extension://test/src/options/options.html#ke-opt-shortcuts-card', chrome.tabs.created);
  const savedActiveStats = activeStub;
  const savedTodayStats = todayStub;
  const savedRecentStats = recentStub;
  activeStub = [];
  const statsDay = KE.todayKey();
  const daysSinceMonday = (new Date().getDay() + 6) % 7;
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - (daysSinceMonday > 0 ? 1 : 0));
  const padStats = (n) => String(n).padStart(2, '0');
  const recentKey = recentDate.getFullYear() + '-' + padStats(recentDate.getMonth() + 1) + '-' + padStats(recentDate.getDate());
  todayStub = [
    { id: 711, project: 200, activity: 1655, begin: statsDay + 'T09:00:00', end: statsDay + 'T10:00:00', duration: 3600, description: 'a' },
    { id: 712, project: 200, activity: 1655, begin: statsDay + 'T11:00:00', end: statsDay + 'T11:30:00', duration: 1800, description: 'b' },
  ];
  recentStub = [
    { id: 713, project: 144, activity: 1661, begin: recentKey + 'T09:00:00', end: recentKey + 'T10:00:00', duration: 600, description: 'c' },
  ];
  Object.keys(storedLocal).forEach((k) => { if (k === 'keCacheToday' || k === 'keCacheRecent') delete storedLocal[k]; });
  eval(POP_SRC);
  await sleep(500);
  check('stats sum today and week', popEls['ke-pop-stats-today'].textContent === (daysSinceMonday > 0 ? '01:30:00' : '01:40:00') &&
    popEls['ke-pop-stats-week'].textContent === '01:40:00',
    [popEls['ke-pop-stats-today'].textContent, popEls['ke-pop-stats-week'].textContent]);
  activeStub = savedActiveStats;
  todayStub = savedTodayStats;
  recentStub = savedRecentStats;
  Object.keys(storedLocal).forEach((k) => { if (k === 'keCacheToday' || k === 'keCacheRecent') delete storedLocal[k]; });
  eval(POP_SRC);
  await sleep(500);
  posted.length = 0;
  stoppedIds.length = 0;
  const popTitles = findAll(popEls['ke-pop-active'], 'ke-pop-timer-title').map((n) => n.textContent);
  check('popup shows active', popTitles.length === 1 &&
    popTitles[0] === 'São Paulo Tech / Site São Paulo · Consequuntur dolor', popTitles);
  check('New timer collapses with active timer', popEls['ke-pop-new-body'].hidden &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'false');
  popEls['ke-pop-new-toggle'].onclick();
  check('header reopens New timer', popEls['ke-pop-new-body'].hidden === false &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'true');
  popEls['ke-pop-new-toggle'].onclick();
  check('header collapses New timer again', popEls['ke-pop-new-body'].hidden &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'false');
  const popSecHtml = fs.readFileSync(path.join(ROOT, 'src/popup/popup.html'), 'utf8');
  check('today/recent titles are buttons with aria-controls',
    /id="ke-pop-today-toggle"[^>]*aria-controls="ke-pop-today"/.test(popSecHtml) &&
    /id="ke-pop-recent-toggle"[^>]*aria-controls="ke-pop-recent"/.test(popSecHtml));
  check('continue-today starts collapsed', popEls['ke-pop-today'].hidden === true &&
    popEls['ke-pop-today-toggle'].getAttribute('aria-expanded') === 'false');
  check('recents start collapsed', popEls['ke-pop-recent'].hidden === true &&
    popEls['ke-pop-recent-toggle'].getAttribute('aria-expanded') === 'false');
  popEls['ke-pop-today-toggle'].onclick();
  check('click expands continue-today', popEls['ke-pop-today'].hidden === false &&
    popEls['ke-pop-today-toggle'].getAttribute('aria-expanded') === 'true');
  popEls['ke-pop-recent-toggle'].onclick();
  check('click expands recents', popEls['ke-pop-recent'].hidden === false &&
    popEls['ke-pop-recent-toggle'].getAttribute('aria-expanded') === 'true');
  popEls['ke-pop-today-toggle'].onclick();
  check('clicking again recollapses', popEls['ke-pop-today'].hidden === true);
  eval(POP_SRC);
  await sleep(500);
  check('boot always starts collapsed', popEls['ke-pop-today'].hidden === true &&
    popEls['ke-pop-recent'].hidden === true &&
    popEls['ke-pop-today-toggle'].getAttribute('aria-expanded') === 'false' &&
    popEls['ke-pop-recent-toggle'].getAttribute('aria-expanded') === 'false');
  stored.keSettings.defaultTimer = { customer: '20', project: '200', activity: '1655', tags: ['Alexander'] };
  stored.keSettings.draftEnabled = true;
  eval(POP_SRC);
  await sleep(500);
  check('draft row appears with flag on', popEls['ke-pop-draft-row'].hidden === false);
  const preDraftProject = findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value;
  const preDraftChips = findAll(popEls['ke-pop-new-tags'], 'ke-chip').length;
  popEls['ke-pop-draft'].checked = true;
  popEls['ke-pop-draft'].fire('change');
  await sleep(400);
  check('draft fills default project', findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value === 'São Paulo Tech / Site São Paulo',
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value);
  check('draft fills default tags', findAll(popEls['ke-pop-new-tags'], 'ke-chip').length === 1);
  check('draft locks fields below description',
    findAll(popEls['ke-pop-new-customer'], 'ke-combo-input')[0].disabled === true &&
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].disabled === true &&
    findAll(popEls['ke-pop-new-activity'], 'ke-combo-input')[0].disabled === true &&
    findAll(popEls['ke-pop-new-tags'], 'ke-multi-input')[0].disabled === true &&
    popEls['ke-pop-new-desc'].disabled === false);
  posted.length = 0;
  popEls['ke-pop-new-desc'].value = 'via rascunho';
  popEls['ke-pop-start'].fire('click');
  await sleep(400);
  check('starting with draft uses default', posted.length === 1 && posted.every((p) => p.project === 200 &&
    p.activity === 1655 && p.description === 'via rascunho' && p.tags === 'Alexander'), posted);
  popEls['ke-pop-draft'].checked = false;
  popEls['ke-pop-draft'].fire('change');
  await sleep(400);
  check('unchecking unlocks and restores', findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].disabled === false &&
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value === preDraftProject &&
    findAll(popEls['ke-pop-new-tags'], 'ke-chip').length === preDraftChips,
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value);
  delete stored.keSettings.defaultTimer;
  popEls['ke-pop-draft'].checked = true;
  popEls['ke-pop-draft'].fire('change');
  await sleep(200);
  check('no default does not lock', popEls['ke-pop-draft'].checked === false &&
    popEls['ke-pop-status'].textContent.includes('Timer padrão') &&
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].disabled === false, popEls['ke-pop-status'].textContent);
  delete stored.keSettings.draftEnabled;
  eval(POP_SRC);
  await sleep(500);
  check('disabled draft hides row', popEls['ke-pop-draft-row'].hidden === true);
  const popDraftHtml = fs.readFileSync(path.join(ROOT, 'src/popup/popup.html'), 'utf8');
  const popDraftCss = fs.readFileSync(path.join(ROOT, 'src/popup/popup.css'), 'utf8');
  check('draft has configure-template link', /id="ke-pop-draft-config"[^>]*data-ke-i18n="ui.configureTemplate"/.test(popDraftHtml));
  check('hidden wins over any display (draft and future)',
    /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(popDraftCss) &&
    /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(
      fs.readFileSync(path.join(ROOT, 'src/options/options.css'), 'utf8')));
  check('draft checkbox matches field spacing',
    /\.ke-pop-check\s*\{[^}]*margin:\s*0 0 6px/s.test(popDraftCss) &&
    /\.ke-pop-draft-row\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/s.test(popDraftCss) &&
    /\.ke-pop-draft-row \.ke-pop-check\s*\{[^}]*margin:\s*0/s.test(popDraftCss));
  check('configure-template key in pt/en', KE.STRINGS.pt.ui.configureTemplate === 'Configurar template' &&
    KE.STRINGS.en.ui.configureTemplate === 'Configure template');
  const savedGetAttr = document.documentElement.getAttribute;
  const savedNavLang = navigator.language;
  document.documentElement.getAttribute = () => 'es';
  check('detectLang falls back to en', KE.detectLang() === 'en');
  check('setLocale falls back to en', KE.setLocale('es') === 'en' && KE.T === KE.STRINGS.en);
  document.documentElement.getAttribute = () => '';
  navigator.language = 'es';
  check('detectLang without lang falls back to en', KE.detectLang() === 'en');
  document.documentElement.getAttribute = savedGetAttr;
  navigator.language = savedNavLang;
  KE.setLocale('pt');
  check('pt still detected', KE.detectLang() === 'pt' && KE.T === KE.STRINGS.pt);
  check('draft options section has anchor',
    fs.readFileSync(path.join(ROOT, 'src/options/options.html'), 'utf8').includes('id="ke-opt-draft-card"'));
  check('shortcuts options section has anchor',
    fs.readFileSync(path.join(ROOT, 'src/options/options.html'), 'utf8').includes('id="ke-opt-shortcuts-card"'));
  chrome.tabs.created.length = 0;
  await popEls['ke-pop-draft-config'].onclick();
  check('link opens draft settings', chrome.tabs.created.length === 1 &&
    chrome.tabs.created[0].url === 'chrome-extension://test/src/options/options.html#ke-opt-draft-card', chrome.tabs.created);
  posted.length = 0;
  await popEls['ke-pop-focus'].onclick();
  check('popup opens tracker in floating window', chrome.windows.created.length === 1 &&
    chrome.windows.created[0].url === 'chrome-extension://test/src/popup/focus.html' &&
    chrome.windows.created[0].type === 'popup', chrome.windows.created);

  const previousFocusActive = activeStub;
  activeStub = [
    { id: 990, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'focus test', tags: ['Alexander'] },
  ];
  eval(FOCUS_SRC);
  await sleep(100);
  check('tracker shows active timer and pause option', popEls['ke-focus-row'].hidden === false &&
    popEls['ke-focus-task'].textContent.includes('Consequuntur dolor') &&
    popEls['ke-focus-action'].textContent === '⏸' &&
    popEls['ke-focus-action'].getAttribute('aria-label') === 'Pausar');
  activeStub = [];
  await popEls['ke-focus-action'].onclick();
  await sleep(100);
  check('tracker pauses and stores resume data', stoppedIds.includes('990') &&
    storedLocal.kePausedTimer.projectId === '200' && storedLocal.kePausedTimer.tags[0] === 'Alexander' &&
    popEls['ke-focus-action'].textContent === '▶' &&
    popEls['ke-focus-action'].getAttribute('aria-label') === 'Retomar');
  await popEls['ke-focus-action'].onclick();
  await sleep(100);
  const resumedByTracker = posted[posted.length - 1];
  check('tracker resumes same timer', resumedByTracker.project === 200 &&
    resumedByTracker.activity === 1655 && resumedByTracker.description === 'focus test' &&
    resumedByTracker.tags === 'Alexander' && !('kePausedTimer' in storedLocal), resumedByTracker);
  activeStub = previousFocusActive;
  posted.length = 0;
  stoppedIds.length = 0;
  const popProj = findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0];
  check('popup project prefilled', popProj.value === 'São Paulo Tech / Site São Paulo', popProj.value);
  const groups = findAll(popEls['ke-pop-today'], 'ke-pop-group');
  check('popup groups equal ones', groups.length === 2, groups.length);
  const g0title = findAll(groups[0], 'ke-pop-timer-title')[0].textContent;
  check('group 1 labeled', g0title === 'Altenwerth-Donnelly / Tempore commodi · Corrupti aut', g0title);
  check('group 1 counts and sums', findAll(groups[0], 'ke-pop-timer-sub')[0].textContent === '1 registro · 1:00:00',
    findAll(groups[0], 'ke-pop-timer-sub')[0].textContent);
  check('group 2 sums 2', findAll(groups[1], 'ke-pop-timer-sub')[0].textContent === '2 registros · 2:00:00',
    findAll(groups[1], 'ke-pop-timer-sub')[0].textContent);
  findAll(groups[1], 'ke-pop-expand')[0].fire('click');
  const kids = findAll(groups[1], 'ke-pop-group-kids')[0];
  check('expand shows grouped', kids.hidden === false && findAll(kids, 'ke-pop-today-row').length === 2);
  check('other group stays closed', findAll(groups[0], 'ke-pop-group-kids')[0].hidden === true);
  findAll(groups[0], 'ke-pop-btn-go')[0].fire('click');
  await sleep(200);
  check('group continue uses most recent', posted.length === 1 && posted[0].project === 144 &&
    posted[0].activity === 1661 && posted[0].description === 'tarde', posted);
  popEls['ke-pop-group-toggle'].fire('click');
  await sleep(200);
  check('ungroup lists plainly', findAll(popEls['ke-pop-today'], 'ke-pop-today-row').length === 2 &&
    findAll(popEls['ke-pop-today'], 'ke-pop-group').length === 0);
  check('preference persists', stored.keSettings.groupTasks === false, stored.keSettings);
  check('toggle unchecks', popEls['ke-pop-group-toggle'].classList.contains('ke-on') === false);
  const activeRow = findAll(popEls['ke-pop-active'], 'ke-pop-timer')[0];
  const activeEditBtn = findAll(activeRow, 'ke-pop-btn-edit')[0];
  check('active timer has edit button', !!activeEditBtn && activeEditBtn.getAttribute('aria-label') === KE.T.edit);
  activeEditBtn.fire('click');
  await sleep(400);
  const activeEditForm = findAll(popEls['ke-pop-active'], 'ke-pop-edit-form')[0];
  check('active edit opens form', !!activeEditForm);
  const activeEditInputs = activeEditForm.querySelectorAll('input');
  check('active edit has start-time field', activeEditInputs.length === 5 &&
    activeEditInputs.filter((n) => n.type === 'time').length === 1 &&
    activeEditInputs.filter((n) => n.type === 'text').length === 4, activeEditInputs.map((n) => n.type));
  check('active edit labels fields',
    findAll(activeEditForm, 'ke-pop-label').map((n) => n.textContent).join('|') ===
    [KE.T.project, KE.T.activity, KE.T.description, KE.T.begin, KE.T.tags].join('|'),
    findAll(activeEditForm, 'ke-pop-label').map((n) => n.textContent));
  check('active edit uses tags multi-combo', findAll(activeEditForm, 'ke-multi').length === 1 &&
    activeEditInputs.filter((n) => n.classList.contains('ke-pop-input') && n.placeholder === KE.T.tagsPh).length === 0);
  const activeDescIn = activeEditInputs.find((n) => n.getAttribute('maxlength') === '255');
  check('active edit fills description', activeDescIn && activeDescIn.value === 'rodando', activeDescIn && activeDescIn.value);
  const activeBeginIn = activeEditInputs.find((n) => n.type === 'time');
  check('active edit fills start time', activeBeginIn && activeBeginIn.value === KE.timeValue(activeStub[0].begin), activeBeginIn && activeBeginIn.value);
  const activePastTime = KE.timeValue(new Date(new Date(activeStub[0].begin).getTime() - 120000).toISOString());
  activeBeginIn.value = activePastTime;
  patchedTimers.length = 0;
  activeDescIn.value = 'revisado no popup';
  const activeTagsIn = findAll(activeEditForm, 'ke-multi-input')[0];
  fireInput(activeTagsIn, 'Alexander');
  fireKey(activeTagsIn, 'Enter');
  check('active edit adds tag via multi-combo', findAll(activeEditForm, 'ke-chip').length === 1);
  findAll(activeEditForm, 'ke-pop-edit-save')[0].fire('click');
  await sleep(300);
  check('active edit saves via PATCH', patchedTimers.length === 1 && patchedTimers[0].id === '801', patchedTimers);
  check('active PATCH with changed start time', patchedTimers.length === 1 &&
    patchedTimers[0].body.project === 200 && patchedTimers[0].body.activity === 1655 &&
    patchedTimers[0].body.description === 'revisado no popup' && patchedTimers[0].body.tags === 'Alexander' &&
    patchedTimers[0].body.begin === KE.timeToApi(activeStub[0].begin, activePastTime) &&
    Object.keys(patchedTimers[0].body).sort().join(',') === 'activity,begin,description,project,tags', patchedTimers[0] && patchedTimers[0].body);
  findAll(popEls['ke-pop-active'], 'ke-pop-btn-edit')[0].fire('click');
  await sleep(400);
  findAll(popEls['ke-pop-active'], 'ke-pop-edit-cancel')[0].fire('click');
  await sleep(200);
  check('cancel restores active row without PATCH', patchedTimers.length === 1 &&
    findAll(popEls['ke-pop-active'], 'ke-pop-edit-form').length === 0 &&
    findAll(popEls['ke-pop-active'], 'ke-pop-btn-stop').length === 1);
  activeStub = [];
  const popStopBtn = findAll(popEls['ke-pop-active'], 'ke-pop-btn-stop')[0];
  check('popup stop uses square icon with accessible label', !!popStopBtn && popStopBtn.textContent === '■' &&
    popStopBtn.getAttribute('aria-label') === KE.T.stop && popStopBtn.title === KE.T.stop);
  popStopBtn.fire('click');
  await sleep(200);
  check('popup stops active', stoppedIds.join(',') === '801', stoppedIds);
  check('New timer opens after stopping last timer', popEls['ke-pop-new-body'].hidden === false &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'true');
  check('popup stop status', popEls['ke-pop-status'].textContent === 'Timer parado!', popEls['ke-pop-status'].textContent);
  KE.apiBaseUrl = '';
  KE.apiCredentials = 'same-origin';
  KE.authToken = '';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('relative api default',
    lastReq.url === '/api/customers?visible=1&size=1000' && lastReq.opts.credentials === 'same-origin', lastReq);
  KE.apiBaseUrl = 'https://kimai.exemplo';
  KE.apiCredentials = 'include';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('absolute api popup',
    lastReq.url === 'https://kimai.exemplo/api/customers?visible=1&size=1000' && lastReq.opts.credentials === 'include', lastReq);
  KE.apiBaseUrl = '';
  KE.apiCredentials = 'same-origin';
  await KE.localSet({ keApiToken: 'tok123' });
  const tokGet = await KE.localGet(['keApiToken']);
  check('token in storage.local', tokGet.keApiToken === 'tok123', tokGet);
  check('token outside sync', !('keApiToken' in stored), Object.keys(stored));
  KE.authToken = 'tok123';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('Bearer header', lastReq.opts.headers && lastReq.opts.headers.Authorization === 'Bearer tok123', lastReq.opts.headers);
  await KE.apiPost('/api/tags', { name: 'Zzz' });
  check('Bearer preserves Content-Type',
    lastReq.opts.headers && lastReq.opts.headers.Authorization === 'Bearer tok123' &&
    lastReq.opts.headers['Content-Type'] === 'application/json', lastReq.opts.headers);
  KE.authToken = '';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('no token no header', !(lastReq.opts.headers && lastReq.opts.headers.Authorization), lastReq.opts.headers);
  await KE.localRemove(['keApiToken']);
  check('token removed', (await KE.localGet(['keApiToken'])).keApiToken === undefined);
  check('duration 0', KE.formatDuration(0) === '0:00');
  check('duration 90', KE.formatDuration(90) === '1:30');
  check('duration 3661', KE.formatDuration(3661) === '1:01:01');
  check('full time', KE.timeValue('2026-10-26T08:12:22') === '08:12');
  check('time without seconds', KE.timeValue('2026-10-26T08:12') === '08:12');
  check('invalid time', KE.timeValue('') === '' && KE.timeValue('ontem') === '');
  check('time-to-API keeps date', KE.timeToApi('2026-10-26T09:00:00', '08:12') === '2026-10-26T08:12:00');
  check('invalid time-to-API', KE.timeToApi('', '08:12') === '' && KE.timeToApi('2026-10-26T09:00:00', 'abc') === '');
  const todayStr = KE.todayKey();
  const recents = KE.todayRecents([
    { id: 1, project: 1, activity: 1, description: 'a', begin: todayStr + 'T09:00:00', end: todayStr + 'T10:00:00', duration: 3600 },
    { id: 2, project: 1, activity: 1, description: 'a', begin: todayStr + 'T11:00:00', end: todayStr + 'T12:00:00', duration: 3600 },
    { id: 3, project: 2, activity: 1, description: 'b', begin: todayStr + 'T08:00:00', end: null, duration: 0 },
    { id: 4, project: 3, activity: 1, description: 'c', begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 3600 },
    { id: 5, project: 9, activity: 1, description: 'z', begin: todayStr + 'T07:00:00', end: todayStr + 'T07:30:00', duration: 1800 },
  ], 8);
  check('today dedup/order', recents.length === 2 && recents[0].id === 2 && recents[1].id === 5, recents.map((r) => r.id));
  const many = [];
  for (let i = 0; i < 10; i++) many.push({ id: 10 + i, project: 100 + i, activity: 1, description: 'x', begin: todayStr + 'T08:00:00', end: todayStr + 'T09:00:00', duration: 60 });
  check('today limit', KE.todayRecents(many, 3).length === 3);
  Object.keys(storedLocal).forEach((k) => delete storedLocal[k]);
  storedLocal.keApiToken = 'popup-token';
  failMode = 'network';
  eval(POP_SRC);
  await sleep(500);
  check('popup error visible', popEls['ke-pop-error'].hidden === false && popEls['ke-pop-main'].hidden === true);
  check('popup error guides', popEls['ke-pop-error-msg'].textContent.includes('Testar conexão'), popEls['ke-pop-error-msg'].textContent);
  failMode = null;
  activeStub = [
    { id: 802, project: 200, activity: 1655, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'de volta' },
  ];
  await popEls['ke-pop-error-retry'].onclick();
  await sleep(600);
  check('retry opens app', popEls['ke-pop-main'].hidden === false && popEls['ke-pop-error'].hidden === true);
  check('retry loads data',
    findAll(popEls['ke-pop-active'], 'ke-pop-timer-title').length === 1 &&
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input').length === 1,
    findAll(popEls['ke-pop-active'], 'ke-pop-timer-title').map((n) => n.textContent));
  const popCss = fs.readFileSync(path.join(ROOT, 'src/popup/popup.css'), 'utf8');
  const popHtmlForIcons = fs.readFileSync(path.join(ROOT, 'src/popup/popup.html'), 'utf8');
  check('popup logo uses extension icon', /<img[^>]*class="ke-pop-logo"[^>]*src="[^"]*icons\/icon48\.png"/.test(popHtmlForIcons) &&
    /\.ke-pop-logo\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s.test(popCss) &&
    !/ke-pop-logo-icon/.test(popHtmlForIcons + popCss));
  check('options logo uses extension icon',
    /<img[^>]*class="ke-opt-logo"[^>]*src="[^"]*icons\/icon48\.png"/.test(
      fs.readFileSync(path.join(ROOT, 'src/options/options.html'), 'utf8')) &&
    /\.ke-opt-logo\s*\{[^}]*width:\s*30px[^}]*height:\s*30px/s.test(
      fs.readFileSync(path.join(ROOT, 'src/options/options.css'), 'utf8')));
  check('popup Start button separates and centers icon and text',
    /id="ke-pop-start"[^>]*class="[^"]*ke-pop-start-btn"[^>]*><span class="ke-pop-start-icon"[^>]*><\/span><span[^>]*>Iniciar<\/span>/.test(popHtmlForIcons) &&
    /\.ke-pop-start-btn\s*\{[^}]*display:\s*inline-flex[^}]*justify-content:\s*center[^}]*gap:\s*8px/s.test(popCss));
  const popupHeadCss = popCss.match(/\.ke-pop-head\s*\{([^}]*)\}/);
  check('popup header stays fixed on scroll', !!popupHeadCss &&
    /position:\s*sticky/.test(popupHeadCss[1]) && /top:\s*0/.test(popupHeadCss[1]) &&
    /background:\s*var\(--ke-bg\)/.test(popupHeadCss[1]));
  const popupFootCss = popCss.match(/\.ke-pop-foot\s*\{([^}]*)\}/);
  check('popup footer stays fixed on scroll', !!popupFootCss &&
    /position:\s*sticky/.test(popupFootCss[1]) && /bottom:\s*0/.test(popupFootCss[1]) &&
    /background:\s*var\(--ke-bg\)/.test(popupFootCss[1]));
  const optCss = fs.readFileSync(path.join(ROOT, 'src/options/options.css'), 'utf8');
  const themeCss = ['src/common/theme.css', ...fs.readdirSync(path.join(ROOT, 'src/common/themes'))
    .filter((f) => f.endsWith('.css')).map((f) => path.join('src/common/themes', f))]
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  check('per-theme color-scheme only on pages', themeCss.includes(':root[data-ke-theme="gnome"] {\n  color-scheme: light;') &&
    themeCss.includes('@media (prefers-color-scheme: dark)') &&
    popCss.includes('html { color-scheme: light dark; }') &&
    optCss.includes('html { color-scheme: light dark; }'));
  check('theme palettes', themeCss.includes('--ke-bg: #ffffff') && themeCss.includes('--ke-bg: #1c1c1e') &&
    themeCss.includes('--ke-text: #222222') && themeCss.includes('--ke-text: #eeeeee'));
  check('inputs use variables',
    popCss.includes('var(--ke-input-bg)') && popCss.includes('var(--ke-text)') &&
    optCss.includes('var(--ke-input-bg)') &&
    !/\.ke-pop-sec \.ke-input\s*{[^}]*background:\s*transparent/.test(popCss) &&
    !/\.ke-opt-field input\s*{[^}]*color:\s*inherit/.test(optCss));
  Object.keys(fetchCounts).forEach((k) => delete fetchCounts[k]);
  Object.keys(storedLocal).forEach((k) => delete storedLocal[k]);
  const p0 = await KE.getProjectsCached('', false);
  check('projects fetch first time', p0 === false && fetchCounts.projects === 1 && KE.state.projects.length > 0, fetchCounts);
  const p1 = await KE.getProjectsCached('', false);
  check('projects from cache', p1 === true && fetchCounts.projects === 1, fetchCounts);
  await KE.getProjectsCached('', true);
  check('force reloads', fetchCounts.projects === 2, fetchCounts);
  storedLocal['keCacheProjects:'] = { at: 0, data: [] };
  await KE.getProjectsCached('', false);
  check('stale cache expires', fetchCounts.projects === 3 && KE.state.projects.length > 0, fetchCounts);
  await KE.getActivitiesCached('97', false);
  await KE.getActivitiesCached('97', false);
  check('activities from cache', fetchCounts.activities === 2, fetchCounts);
  await KE.getTodayCached(false);
  await KE.getTodayCached(false);
  check('diaries from cache', fetchCounts.today === 1, fetchCounts);
  await KE.getTodayCached(true);
  check('diaries force reload', fetchCounts.today === 2, fetchCounts);
  const probe = KE.createCombo({ searchPlaceholder: 'x', allowEmpty: false });
  probe.setItems([{ value: '1', label: 'Um' }, { value: '2', label: 'Dois' }]);
  check('combo getValues', probe.getValues().join(',') === '1,2', probe.getValues());
  const fakeEv = (o) => Object.assign({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '', repeat: false, target: null }, o);
  check('describes Alt+Shift+S', KE.describeKeyEvent(fakeEv({ altKey: true, shiftKey: true, key: 's' })) === 'Alt+Shift+S');
  check('describes Ctrl+Space', KE.describeKeyEvent(fakeEv({ ctrlKey: true, key: ' ' })) === 'Ctrl+Space');
  check('matches exact', KE.shortcutMatches('Alt+Shift+S', fakeEv({ altKey: true, shiftKey: true, key: 'S' })) === true);
  check('does not match other', KE.shortcutMatches('Alt+Shift+S', fakeEv({ altKey: true, key: 's' })) === false);
  check('empty never matches', KE.shortcutMatches('', fakeEv({ altKey: true, shiftKey: true, key: 'S' })) === false);
  check('defaults exist', KE.DEFAULT_SHORTCUTS.startDefault === 'Alt+Shift+P' && KE.DEFAULT_SHORTCUTS.stop === 'Alt+Shift+S' &&
    !('restart' in KE.DEFAULT_SHORTCUTS));
  check('editable target', KE.isEditableTarget({ tagName: 'INPUT' }) === true && KE.isEditableTarget({ tagName: 'DIV' }) === false);
  check('onStorageChanged without support does not break', KE.onStorageChanged(() => {}) === null);
  todayStub = [
    { id: 901, project: 144, activity: 1661, begin: KE.todayKey() + 'T08:00:00', end: KE.todayKey() + 'T09:00:00', duration: 3600, description: 'antigo', tags: ['Alexander'] },
    { id: 902, project: 200, activity: 1655, begin: KE.todayKey() + 'T10:00:00', end: KE.todayKey() + 'T11:00:00', duration: 3600, description: 'recente', tags: [] },
  ];
  posted.length = 0;
  const qtSrc = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.js'), 'utf8');
  check('P shortcut starts default timer with template guard',
    qtSrc.includes('startDefaultTimer') && qtSrc.includes("KE.uiText('ui.needDefaultTimer')") &&
    !qtSrc.includes('doRestart') && !qtSrc.includes('restartLast'));
  check('themes available', KE.THEMES.map((t) => t.id).join(',') === 'system,light,dark,dracula,catppuccin,nord,gruvbox,gnome');
  check('theme label', KE.themeLabel('dark') === 'Escuro' && KE.themeLabel('x') === 'GNOME');
  check('dracula label', KE.themeLabel('dracula') === 'Dracula' && KE.themeLabel('catppuccin') === 'Catppuccin');
  check('gnome label', KE.themeLabel('gnome') === 'GNOME');
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const variantVersions = ['manifest/chrome.json', 'manifest/firefox.json']
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).version);
  check('manifests synced with package.json',
    variantVersions.every((v) => v === pkgJson.version) && manifest.version === pkgJson.version,
    { package: pkgJson.version, variants: variantVersions, root: manifest.version });
  check('adaptive Adwaita palette', themeCss.includes('--ke-green: #1c71d8') &&
    themeCss.includes('--ke-green-text: #007c3d') && themeCss.includes('--ke-green-text: #78e9ab') &&
    themeCss.includes('--ke-bg: #fafafb') && themeCss.includes('--ke-bg: #222226'));
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'dark' };
  await KE.applyTheme();
  check('applies dark', document.documentElement.dataset.keTheme === 'dark');
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo' };
  await KE.applyTheme();
  check('gnome default', document.documentElement.dataset.keTheme === 'gnome');
  let gnomeSchemeListener;
  let gnomeListenerRemoved = false;
  global.matchMedia = (query) => ({
    media: query,
    matches: true,
    addEventListener: (name, fn) => { if (name === 'change') gnomeSchemeListener = fn; },
    removeEventListener: (name, fn) => { if (name === 'change' && fn === gnomeSchemeListener) gnomeListenerRemoved = true; },
  });
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'gnome' };
  await KE.applyTheme();
  await KE.applyPageTheme();
  check('GNOME follows system dark mode', document.documentElement.dataset.keTheme === 'gnome' && stubBsTheme === 'dark');
  gnomeSchemeListener({ matches: false });
  check('GNOME follows change to light', stubBsTheme === 'light');
  stored.keSettings.theme = 'dark';
  await KE.applyPageTheme();
  check('GNOME removes listener on theme switch', gnomeListenerRemoved && stubBsTheme === 'dark');
  delete global.matchMedia;
  storedLocal.keCacheX = { at: Date.now(), data: [] };
  storedLocal.keApiToken = 'tok123';
  check('cacheClear counts and preserves', (await KE.cacheClear()) >= 1 && !('keCacheX' in storedLocal) && storedLocal.keApiToken === 'tok123', Object.keys(storedLocal));
  Object.keys(storedLocal).forEach((k) => delete storedLocal[k]);
  storedLocal.keApiToken = 'popup-token';
  failMode = 'auth';
  eval(POP_SRC);
  await sleep(500);
  check('popup explains 401', popEls['ke-pop-error'].hidden === false &&
    popEls['ke-pop-error-msg'].textContent.includes('Acesso negado'), popEls['ke-pop-error-msg'].textContent);
  failMode = null;
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo' };
  storedLocal.keApiToken = 'popup-token';
  chrome.permissions.granted = true;
  activeStub = [
    { id: 901, project: 200, activity: 1655, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'w' },
  ];
  const tkey = KE.todayKey();
  todayStub = [
    { id: 902, project: 200, activity: 1655, begin: tkey + 'T09:00:00', end: tkey + 'T10:00:00', duration: 3600, description: 'r', tags: [] },
  ];
  stoppedIds.length = 0;
  posted.length = 0;
  const gday = KE.todayKey();
  const gsrc = [
    { id: 1, project: 1, activity: 1, begin: gday + 'T09:00:00', end: gday + 'T10:00:00', duration: 3600, description: 'a' },
    { id: 2, project: 1, activity: 1, begin: gday + 'T11:00:00', end: gday + 'T12:00:00', duration: 1800, description: 'b' },
    { id: 3, project: 1, activity: 2, begin: gday + 'T12:00:00', end: gday + 'T13:00:00', duration: 600, description: 'c' },
    { id: 4, project: 1, activity: 1, begin: gday + 'T13:00:00', end: null, duration: 0, description: 'rodando' },
    { id: 5, project: 1, activity: 1, begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 60, description: 'ontem' },
  ];
  check('filterToday excludes running/yesterday', KE.filterToday(gsrc).map((t) => t.id).join(',') === '3,2,1');
  check('isoWeekKey matches siteWeekKey', KE.isoWeekKey('2026-10-13') === KE.siteWeekKey('20261013') &&
    KE.isoWeekKey('2026-01-01') === KE.siteWeekKey('20260101') && KE.isoWeekKey('xx') === '');
  check('formatHms zeroes and pads', KE.formatHms(0) === '00:00:00' && KE.formatHms(600) === '00:10:00' &&
    KE.formatHms(3661) === '01:01:01');
  const gs = KE.groupByTask(gsrc, 8);
  check('groups by task', gs.length === 2 && gs[0].entries.length === 1 && gs[1].entries.length === 2,
    gs.map((g) => g.entries.length));
  check('group sums durations', gs[1].totalDuration === 5400 && gs[1].entries[0].id === 2, gs[1]);
  check('most recent group first', gs[0].entries[0].id === 3, gs.map((g) => g.entries[0].id));
  const manyGroups = [];
  for (let i = 0; i < 12; i++) manyGroups.push({ id: 100 + i, project: 500 + i, activity: 1, begin: KE.todayKey() + 'T08:00:00', end: KE.todayKey() + 'T09:00:00', duration: 60 });
  check('group limit', KE.groupByTask(manyGroups, 8).length === 8);

  const qtCss = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.css'), 'utf8');
  check('Interface CSS hides menu, actions and header',
    qtCss.includes('body.ke-hide-sidebar .navbar-vertical') &&
    qtCss.includes('body.ke-hide-actionbar .page-header.d-print-none') &&
    qtCss.includes('body.ke-hide-header .navbar.navbar-expand-md'));
  check('weekly total row right-aligned',
    /\.ke-week-total\s*\{[^}]*justify-content:\s*flex-end[^}]*font-variant-numeric:\s*tabular-nums/s.test(qtCss) &&
    /\.ke-week-total \.ke-today-total\s*\{[^}]*margin-right:\s*16px/s.test(qtCss));
  const qtJs = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.js'), 'utf8');
  check('Interface applies prefs to body',
    ['hideNavigation', 'hideSidebar', 'hideActionBar', 'hideHeader'].every((key) => qtJs.includes(`settings.${key}`)));
  check('circular icon centers CSS triangle', /#ke-quick-timer \.ke-play\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center/s.test(qtCss) &&
    /#ke-quick-timer \.ke-play-icon,[\s\S]*?border-left:\s*8px solid currentColor/.test(qtCss));
  check('Start button centers icon and text with gap', /#ke-quick-timer \.ke-btn-start\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*gap:\s*8px/s.test(qtCss));
  KE._initialBsTheme = undefined;
  stubBsTheme = 'dark';
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'dracula' };
  await KE.applyPageTheme();
  check('dracula forces dark base', stubBsTheme === 'dark', stubBsTheme);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'light' };
  await KE.applyPageTheme();
  check('light forces light base', stubBsTheme === 'light', stubBsTheme);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'system' };
  await KE.applyPageTheme();
  check('system restores original', stubBsTheme === 'dark', stubBsTheme);
  KE._initialBsTheme = undefined;
  stubBsTheme = null;
  stubBsRemoved = false;
  await KE.applyPageTheme();
  check('system without original removes', stubBsRemoved === true && stubBsTheme === null);
  function siteCell(tr, cls, text) {
    const td = document.createElement('td');
    td.className = cls;
    td.textContent = text;
    td.innerHTML = text;
    tr.appendChild(td);
    return td;
  }
  function siteRow(o) {
    const tr = document.createElement('tr');
    const cb = document.createElement('td');
    cb.className = 'col_id';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.className = 'multi_update_single';
    inp.value = o.id;
    cb.appendChild(inp);
    tr.appendChild(cb);
    siteCell(tr, 'col_date', o.date);
    siteCell(tr, 'col_starttime', o.begin);
    siteCell(tr, 'col_endtime', o.end);
    siteCell(tr, 'col_duration', o.dur);
    siteCell(tr, 'col_customer', o.cust);
    siteCell(tr, 'col_project', o.proj);
    siteCell(tr, 'col_activity', o.act);
    siteCell(tr, 'col_description', o.desc || '');
    siteCell(tr, 'col_tags', o.tags || '');
    siteCell(tr, 'col_billable', o.bill || '');
    siteCell(tr, 'col_actions', '');
    return tr;
  }
  const stb = document.createElement('tbody');
  stb.appendChild(siteRow({ id: 'a', date: '18/10/2026', begin: '05:08', end: '17:11', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd1', tags: 't1', bill: 'Yes' }));
  stb.appendChild(siteRow({ id: 'b', date: '17/10/2026', begin: '03:58', end: '14:04', dur: '0:30', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd1', tags: 't1', bill: 'Yes' }));
  stb.appendChild(siteRow({ id: 'c', date: '18/10/2026', begin: '09:00', end: '10:00', dur: '2:00', cust: 'C2', proj: 'P2', act: 'A2', desc: 'd2', tags: 't9', bill: 'No' }));
  stb.appendChild(siteRow({ id: 'd', date: '16/10/2026', dur: '0:10', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd1', tags: 't1', bill: 'Yes' }));
  stb.appendChild(siteRow({ id: 'e', date: '15/10/2026', dur: '0:05', cust: 'C1', proj: 'P1', act: 'A1', desc: 'outra', tags: 't2', bill: 'Yes' }));
  check('site duration', KE.parseSiteDuration('12:03') === 12 * 3600 + 3 * 60 &&
    KE.parseSiteDuration('0:27') === 27 * 60 && KE.parseSiteDuration('1:02:03') === 3723 &&
    KE.parseSiteDuration('x') === 0 && KE.formatSiteHours(5400) === '1:30' &&
    KE.formatSiteHms(3723) === '01:02:03');
  const sgroups = KE.groupSiteRows(Array.from(stb.children));
  check('only equal adjacents group', sgroups.length === 4 &&
    sgroups.map((g) => g.rows.length).join(',') === '2,1,1,1', sgroups.map((g) => g.rows.length));
  check('description splits equal ones', sgroups[3].rows[0] === stb.children[4]);
  KE.applySiteGrouping(stb, true);
  const sheads = findAll(stb, 'ke-sitegroup');
  check('only multi-group has header', sheads.length === 1, sheads.length);
  const htds = sheads[0].children.filter((n) => n.tagName === 'TD');
  check('header mirrors columns', htds.length === 12 &&
    htds[1].className.includes('col_date') && htds[4].className.includes('col_duration') &&
    htds[htds.length - 1].className.includes('col_actions') &&
    htds[htds.length - 1].querySelector('.ke-sitegroup-toggle') !== null);
  const htext = (cls) => {
    const td = htds.find((n) => n.className.includes(cls));
    return td ? td.textContent : null;
  };
  check('aggregated cells', htext('col_date') === '17/10/2026 – 18/10/2026' &&
    htext('col_starttime') === '03:58' && htext('col_endtime') === '17:11' &&
    htext('col_duration') === '1:30' && htext('col_customer') === 'C1' &&
    htext('col_project') === 'P1' && htext('col_tags') === 't1' && htext('col_billable') === 'Yes', [
    htext('col_date'), htext('col_starttime'), htext('col_endtime'), htext('col_duration'), htext('col_billable'),
  ]);
  check('collapsed members', stb.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup') && n.style.display === 'none').length === 2);
  const gbox = findAll(sheads[0], 'ke-sitegroup-check')[0];
  check('group checkbox follows native style', ['form-check-input', 'm-0', 'align-middle'].every((c) => gbox.classList.contains(c)), gbox.className);
  gbox.checked = true;
  gbox.fire('change');
  const membersAB = stb.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup')).slice(0, 2);
  check('group checkbox checks members', membersAB.every((r) => (r.querySelector('input') || {}).checked === true));
  check('group checks all at once', membersAB.every((r) => (r.querySelector('input') || {}).checked === true) &&
    gbox.checked === true && gbox.indeterminate === false);
  gbox.checked = false;
  gbox.fire('change');
  check('group unchecks all at once', membersAB.every((r) => (r.querySelector('input') || {}).checked === false) &&
    gbox.checked === false && gbox.indeterminate === false);
  const firstMember = membersAB[0].querySelector('input');
  firstMember.checked = true;
  firstMember.fire('change');
  check('single member leaves partial', gbox.checked === false && gbox.indeterminate === true);
  firstMember.checked = false;
  firstMember.fire('change');
  findAll(sheads[0], 'ke-sitegroup-toggle')[0].fire('click');
  check('expand shows members', stb.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup') && n.style.display !== 'none').length === 5);
  check('expand marks visual bond', sheads[0].classList.contains('ke-open') &&
    stb.children.filter((n) => n.tagName === 'TR' && n.classList.contains('ke-sitemember')).length === 2);
  KE.applySiteGrouping(stb, true);
  check('reapply does not duplicate', findAll(stb, 'ke-sitegroup').length === 1);
  check('reapply keeps open', findAll(stb, 'ke-sitegroup')[0].querySelector('.ke-sitegroup-toggle').textContent === '▾');
  KE.applySiteGrouping(stb, false);
  check('disable restores', findAll(stb, 'ke-sitegroup').length === 0 &&
    stb.children.map((n) => (n.querySelector('input') || {}).value || '?').join(',') === 'a,b,c,d,e' &&
    stb.children.every((n) => n.style.display !== 'none' && !n.classList.contains('ke-sitemember')));
  const sumRow = (text) => {
    const tr = document.createElement('tr');
    tr.className = 'summary info';
    const td = document.createElement('td');
    td.setAttribute('colspan', '12');
    td.textContent = text;
    tr.appendChild(td);
    tr.textContent = text;
    return tr;
  };
  const stbS = document.createElement('tbody');
  stbS.appendChild(sumRow('SEG1'));
  stbS.appendChild(siteRow({ id: 'a', date: '18/10/2026', begin: '05:08', end: '17:11', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd1', tags: 't1', bill: 'Yes' }));
  stbS.appendChild(siteRow({ id: 'b', date: '17/10/2026', begin: '03:58', end: '14:04', dur: '0:30', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd1', tags: 't1', bill: 'Yes' }));
  stbS.appendChild(sumRow('SEG2'));
  stbS.appendChild(siteRow({ id: 'c', date: '18/10/2026', begin: '09:00', end: '10:00', dur: '2:00', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd1', tags: 't1', bill: 'Yes' }));
  stbS.appendChild(siteRow({ id: 'd', date: '18/10/2026', begin: '11:00', end: '12:00', dur: '3:00', cust: 'C2', proj: 'P2', act: 'A2', desc: 'd2', tags: 't9', bill: 'No' }));
  const kindOf = (n) => {
    if (n.classList.contains('ke-sitegroup')) return 'H';
    const inp = n.querySelector('input');
    if (inp && inp.value) return inp.value;
    const td = n.querySelector('td');
    return td ? td.textContent.slice(0, 4) : '?';
  };
  KE.applySiteGrouping(stbS, true);
  check('stopped separators and adjacent-only group',
    stbS.children.map(kindOf).join(',') === 'SEG1,H,a,b,SEG2,c,d' &&
    findAll(stbS, 'ke-sitegroup').length === 1, stbS.children.map(kindOf));
  check('separator never hides', stbS.children[0].style.display !== 'none' && stbS.children[4].style.display !== 'none');
  KE.applySiteGrouping(stbS, false);
  check('disable keeps separators', stbS.children.map(kindOf).join(',') === 'SEG1,a,b,SEG2,c,d' &&
    findAll(stbS, 'ke-sitegroup').length === 0);

  const dailyTotals = document.createElement('tbody');
  dailyTotals.appendChild(sumRow('18/10/2026'));
  dailyTotals.appendChild(siteRow({ id: 'day18a', date: '18/10/2026', dur: '1:15', cust: 'C1', proj: 'P1', act: 'A1' }));
  dailyTotals.appendChild(siteRow({ id: 'day18b', date: '18/10/2026', dur: '0:45', cust: 'C2', proj: 'P2', act: 'A2' }));
  dailyTotals.appendChild(sumRow('17/10/2026'));
  dailyTotals.appendChild(siteRow({ id: 'day17a', date: '17/10/2026', dur: '2:00', cust: 'C3', proj: 'P3', act: 'A3' }));
  dailyTotals.appendChild(siteRow({ id: 'day17b', date: '17/10/2026', dur: '3:00', cust: 'C4', proj: 'P4', act: 'A4' }));
  KE.applySiteGrouping(dailyTotals, false);
  const dailySummaryRows = dailyTotals.children.filter((row) => row.classList.contains('summary'));
  const dailyTotalText = (row) => findAll(row, 'ke-day-total')[0].textContent;
  check('daily sum in final column as HH:MM:SS', dailySummaryRows.length === 2 &&
    dailyTotalText(dailySummaryRows[0]) === '02:00:00' && dailyTotalText(dailySummaryRows[1]) === '05:00:00',
    dailySummaryRows.map(dailyTotalText));
  check('daily sum takes last column', dailySummaryRows.every((row) =>
    row.children[row.children.length - 1].classList.contains('ke-day-total') &&
    row.children[0].getAttribute('colspan') === '11'));
  dailyTotals.children[1].querySelector('.col_duration').textContent = '2:15';
  KE.applySiteGrouping(dailyTotals, false);
  check('daily sum updates without duplicating cell', dailyTotalText(dailySummaryRows[0]) === '03:00:00' &&
    findAll(dailySummaryRows[0], 'ke-day-total').length === 1);

  const weekTbody = document.createElement('tbody');
  weekTbody.appendChild(siteRow({ id: 'w1', date: '13/10/2026', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1' }));
  weekTbody.appendChild(siteRow({ id: 'w2', date: '14/10/2026', dur: '0:30', cust: 'C2', proj: 'P2', act: 'A2' }));
  weekTbody.appendChild(siteRow({ id: 'w3', date: '15/10/2026', dur: '2:00', cust: 'C3', proj: 'P3', act: 'A3' }));
  check('week total sums listing in seconds', KE.siteWeekTotalSeconds(weekTbody) === 12600, KE.siteWeekTotalSeconds(weekTbody));
  check('ISO week groups Sunday with previous Monday', KE.siteWeekKey('20261018') === KE.siteWeekKey('20261012') &&
    KE.siteWeekKey('20261018') !== KE.siteWeekKey('20261019'));
  const twoWeekTbody = document.createElement('tbody');
  twoWeekTbody.appendChild(siteRow({ id: 'o1', date: '18/10/2026', dur: '10:00', cust: 'C1', proj: 'P1', act: 'A1' }));
  twoWeekTbody.appendChild(siteRow({ id: 'n1', date: '19/10/2026', dur: '1:00', cust: 'C2', proj: 'P2', act: 'A2' }));
  check('week total ignores previous listing weeks', KE.siteWeekTotalSeconds(twoWeekTbody) === 3600,
    KE.siteWeekTotalSeconds(twoWeekTbody));
  check('week total uses pt/en labels', KE.STRINGS.pt.weekTotal === 'TOTAL DA SEMANA' && KE.STRINGS.en.weekTotal === 'WEEK TOTAL');
  check('today total uses pt/en labels', KE.STRINGS.pt.dayTotal === 'HOJE' && KE.STRINGS.en.dayTotal === 'TODAY');
  const nowDate = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayLabel = pad2(nowDate.getDate()) + '/' + pad2(nowDate.getMonth() + 1) + '/' + nowDate.getFullYear();
  const todayTbody = document.createElement('tbody');
  todayTbody.appendChild(siteRow({ id: 't1', date: todayLabel, dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1' }));
  todayTbody.appendChild(siteRow({ id: 't2', date: todayLabel, dur: '0:30', cust: 'C2', proj: 'P2', act: 'A2' }));
  todayTbody.appendChild(siteRow({ id: 'o1', date: '01/01/2000', dur: '9:00', cust: 'C3', proj: 'P3', act: 'A3' }));
  check('today total sums only current day', KE.siteTodayTotalSeconds(todayTbody) === 5400, KE.siteTodayTotalSeconds(todayTbody));
  const weekCardParent = document.createElement('div');
  const weekCard = document.createElement('div');
  weekCardParent.appendChild(weekCard);
  const weekLine = KE.renderSiteWeekTotal(weekCard, 3600, 7384);
  check('totals row above table on right', !!weekLine &&
    findAll(weekLine, 'ke-today-total')[0].textContent === KE.T.dayTotal + ' 01:00:00' &&
    findAll(weekLine, 'ke-week-total-value')[0].textContent === KE.T.weekTotal + ': 02:03:04' &&
    weekLine.children[0].classList.contains('ke-today-total') &&
    weekCardParent.children[0] === weekLine && weekCardParent.children[1] === weekCard);
  KE.renderSiteWeekTotal(weekCard, 3600, 7384);
  check('totals row does not duplicate', weekCardParent.children.length === 2 &&
    findAll(weekCardParent, 'ke-week-total').length === 1 &&
    findAll(weekLine, 'ke-today-total').length === 1 && findAll(weekLine, 'ke-week-total-value').length === 1);

  function realSumRow(date, dayTotal) {
    const tr = document.createElement('tr');
    tr.className = 'summary info';
    ['col_id', 'col_date', 'col_starttime', 'col_endtime', 'col_duration', 'col_customer',
      'col_project', 'col_activity', 'col_description', 'col_tags', 'col_billable', 'col_actions'
    ].forEach((cls) => {
      const td = document.createElement('td');
      td.className = cls;
      if (cls === 'col_date') td.textContent = date;
      if (cls === 'col_duration') td.textContent = dayTotal;
      tr.appendChild(td);
    });
    return tr;
  }
  const realTbody = document.createElement('tbody');
  realTbody.appendChild(siteRow({ id: 'a', date: '18/10/2026', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd' }));
  realTbody.appendChild(siteRow({ id: 'b', date: '18/10/2026', dur: '0:30', cust: 'C1', proj: 'P1', act: 'A1', desc: 'd' }));
  realTbody.appendChild(realSumRow('18/10/2026', '1:30'));
  realTbody.appendChild(siteRow({ id: 'c', date: '17/10/2026', dur: '2:00', cust: 'C2', proj: 'P2', act: 'A2', desc: 'x' }));
  realTbody.appendChild(realSumRow('17/10/2026', '2:00'));
  check('real summary never counts as data row', KE.siteWeekTotalSeconds(realTbody) === 12600, KE.siteWeekTotalSeconds(realTbody));
  KE.applySiteGrouping(realTbody, false);
  const realDaily = realTbody.children.filter((row) => row.classList.contains('summary'));
  check('daily totals ignore real-summary duration', realDaily.length === 2 &&
    findAll(realDaily[0], 'ke-day-total')[0].textContent === '01:30:00' &&
    findAll(realDaily[1], 'ke-day-total')[0].textContent === '02:00:00');
  KE.applySiteGrouping(realTbody, true);
  check('real summaries stay stopped and visible in grouping',
    realTbody.children.filter((r) => r.classList.contains('summary')).length === 2 &&
    realTbody.children.filter((r) => r.classList.contains('summary')).every((r) => r.style.display !== 'none'));

  rangeStub = [
    { id: 1, project: 1, activity: 1, begin: '2026-10-13T08:00:00', end: '2026-10-13T09:00:00', duration: 3600, description: 'api' },
    { id: 2, project: 1, activity: 1, begin: '2026-10-13T10:00:00', end: '2026-10-13T10:30:00', duration: 1800, description: 'api' },
    { id: 3, project: 1, activity: 1, begin: '2026-10-14T08:00:00', end: '2026-10-14T08:10:00', duration: 600, description: 'api' },
    { id: 4, project: 1, activity: 1, begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 99999, description: 'fora' },
  ];
  const apiTbody = document.createElement('tbody');
  apiTbody.appendChild(siteRow({ id: 'a', date: '13/10/2026', dur: '0:00', cust: 'C1', proj: 'P1', act: 'A1' }));
  apiTbody.appendChild(realSumRow('13/10/2026', '0:00'));
  const apiResult = await KE.refreshSiteTotals(apiTbody);
  check('totals come from API not DOM', apiResult && apiResult.from === '20261013' && apiResult.to === '20261013' &&
    apiResult.days === 1 && apiResult.week === 5400, apiResult);
  check('API fetch uses begin/end range', lastReq.url.includes('/api/timesheets?') && lastReq.url.includes('begin=2026-10-13'), lastReq.url);
  check('range uses ISO format with T', lastReq.url.includes('begin=2026-10-13T00%3A00%3A00') &&
    lastReq.url.includes('end=2026-10-13T23%3A59%3A59') && !/%20/.test(lastReq.url.split('begin=')[1] || ''), lastReq.url);
  check('daily cell uses API duration', findAll(apiTbody, 'ke-day-total')[0].textContent === '01:30:00');
  function bareRow(id, date) {
    const tr = document.createElement('tr');
    const cb = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.className = 'multi_update_single';
    inp.value = id;
    cb.appendChild(inp);
    tr.appendChild(cb);
    const dc = document.createElement('td');
    dc.className = 'col_date';
    dc.textContent = date;
    tr.appendChild(dc);
    const pc = document.createElement('td');
    pc.className = 'col_project';
    pc.textContent = 'P';
    tr.appendChild(pc);
    return tr;
  }
  function bareSumRow(date) {
    const tr = document.createElement('tr');
    tr.className = 'summary info';
    const td = document.createElement('td');
    td.textContent = date;
    tr.appendChild(td);
    return tr;
  }
  const bareTbody = document.createElement('tbody');
  bareTbody.appendChild(bareRow('b1', '13/10/2026'));
  bareTbody.appendChild(bareSumRow('13/10/2026'));
  const bareResult = await KE.refreshSiteTotals(bareTbody);
  check('API works without duration column', bareResult && bareResult.week === 5400, bareResult);
  check('no duration column creates no stray cell', findAll(bareTbody, 'ke-day-total').length === 0 &&
    bareTbody.children.every((r) => r.children.length <= 3));
  rangeStub = [
    { id: 10, project: 1, activity: 1, begin: '2026-10-12T08:00:00', end: '2026-10-12T09:00:00', duration: 3600, description: 'semana passada' },
    { id: 11, project: 1, activity: 1, begin: '2026-10-19T08:00:00', end: '2026-10-19T10:00:00', duration: 7200, description: 'semana atual' },
  ];
  const twoWeekApi = document.createElement('tbody');
  twoWeekApi.appendChild(realSumRow('12/10/2026', '0:00'));
  twoWeekApi.appendChild(realSumRow('19/10/2026', '0:00'));
  const twoWeekResult = await KE.refreshSiteTotals(twoWeekApi);
  check('API week total sums only most recent week', twoWeekResult && twoWeekResult.from === '20261012' &&
    twoWeekResult.to === '20261019' && twoWeekResult.days === 2 && twoWeekResult.week === 7200, twoWeekResult);
  check('API daily cells across distinct weeks',
    findAll(twoWeekApi, 'ke-day-total')[0].textContent === '01:00:00' &&
    findAll(twoWeekApi, 'ke-day-total')[1].textContent === '02:00:00');
  const rangeFetches = fetchCounts.range || 0;
  await KE.refreshSiteTotals(twoWeekApi);
  check('totals respect cooldown', (fetchCounts.range || 0) === rangeFetches, fetchCounts.range);
  rangeStub = [];
  failMode = 'network';
  const fallbackTbody = document.createElement('tbody');
  fallbackTbody.appendChild(siteRow({ id: 'f1', date: '13/10/2026', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1' }));
  fallbackTbody.appendChild(realSumRow('13/10/2026', '0:00'));
  check('API failure uses DOM fallback', (await KE.refreshSiteTotals(fallbackTbody)) === null &&
    findAll(fallbackTbody, 'ke-day-total')[0].textContent === '01:00:00');
  const rangeAfterFail = fetchCounts.range || 0;
  await KE.refreshSiteTotals(fallbackTbody);
  check('failure respects cooldown', (fetchCounts.range || 0) === rangeAfterFail, fetchCounts.range);
  failMode = null;
  rangeStub = [];

  const stb2 = document.createElement('tbody');
  stb2.appendChild(siteRow({ id: 'x', date: '18/10/2026', dur: '1:00', cust: 'Solo', proj: 'SP', act: 'SA', desc: 'u1' }));
  stb2.appendChild(siteRow({ id: 'y', date: '18/10/2026', dur: '0:10', cust: 'Outro', proj: 'OP', act: 'OA', desc: 'u2' }));
  KE.applySiteGrouping(stb2, true);
  check('no equals means no pollution', findAll(stb2, 'ke-sitegroup').length === 0 &&
    stb2.children.every((n) => n.style.display !== 'none'));
  const stb3 = document.createElement('tbody');
  const soloRow = (id) => {
    const tr = document.createElement('tr');
    const cb = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.className = 'multi_update_single';
    inp.value = id;
    cb.appendChild(inp);
    tr.appendChild(cb);
    siteCell(tr, 'col_project', 'SP');
    siteCell(tr, 'col_duration', '0:05');
    return tr;
  };
  stb3.appendChild(soloRow('p'));
  stb3.appendChild(soloRow('q'));
  KE.applySiteGrouping(stb3, true);
  const h3 = findAll(stb3, 'ke-sitegroup')[0];
  check('without actions column toggle goes in 1st cell',
    !!h3 && h3.children.filter((n) => n.tagName === 'TD')[0].querySelector('.ke-sitegroup-toggle') !== null);

  singleStub['901'] = { id: 901, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: '2026-10-13T08:00:00', end: '2026-10-13T09:00:00', duration: 3600, description: 'job', tags: ['Alexander'] };
  singleStub['902'] = { id: 902, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: '2026-10-13T10:00:00', end: '2026-10-13T11:00:00', duration: 3600, description: 'job', tags: ['Alexander'] };
  const editTbody = document.createElement('tbody');
  editTbody.appendChild(siteRow({ id: '901', date: '13/10/2026', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1', desc: 'job' }));
  editTbody.appendChild(siteRow({ id: '902', date: '13/10/2026', dur: '1:00', cust: 'C1', proj: 'P1', act: 'A1', desc: 'job' }));
  KE.applySiteGrouping(editTbody, true);
  const editHead = findAll(editTbody, 'ke-sitegroup')[0];
  const editBtn = findAll(editHead, 'ke-sitegroup-edit-btn')[0];
  check('group header has edit button', !!editBtn && editBtn.getAttribute('aria-label') === KE.T.edit, editBtn && editBtn.getAttribute('aria-label'));
  const headerBox = findAll(editHead, 'ke-sitegroup-header-actions')[0];
  check('edit sits left of expand', !!headerBox &&
    headerBox.children[0].classList.contains('ke-sitegroup-edit-btn') &&
    headerBox.children[1].classList.contains('ke-sitegroup-toggle'));
  editBtn.fire('click');
  await sleep(300);
  const editRow = findAll(editTbody, 'ke-sitegroup-edit')[0];
  check('group edit opens own row', !!editRow && editTbody.children.indexOf(editRow) === editTbody.children.indexOf(editHead) + 1);
  const editInputs = (editRow.querySelectorAll('input') || []).concat(editRow.querySelectorAll('textarea') || []);
  check('group edit without dates or duration', editRow && !editRow.querySelector('.col_date') && !editRow.querySelector('.col_duration') &&
    editInputs.length === 5, editInputs.length);
  const editDesc = editInputs.find((n) => n.type === 'text' && !n.classList.contains('ke-combo-input') && !n.classList.contains('ke-multi-input'));
  check('group edit fills common description', editDesc && editDesc.value === 'job', editDesc && editDesc.value);
  patchedTimers.length = 0;
  editDesc.value = 'revisado';
  findAll(editRow, 'ke-btn-save')[0].fire('click');
  await sleep(300);
  check('group edit saves via PATCH per member', patchedTimers.length === 2 &&
    patchedTimers.every((p) => ['901', '902'].includes(p.id)), patchedTimers.map((p) => p.id));
  check('group PATCH without dates or duration', patchedTimers.every((p) =>
    p.body.project === 200 && p.body.activity === 1655 && p.body.description === 'revisado' &&
    p.body.tags === 'Alexander' && !('begin' in p.body) && !('end' in p.body) && !('duration' in p.body)), patchedTimers);
  findAll(editTbody, 'ke-sitegroup-edit-btn')[0].fire('click');
  await sleep(300);
  const editRow2 = findAll(editTbody, 'ke-sitegroup-edit')[0];
  findAll(editRow2, 'ke-btn-cancel')[0].fire('click');
  check('cancel closes group edit without PATCH', patchedTimers.length === 2 && findAll(editTbody, 'ke-sitegroup-edit').length === 0);
  delete singleStub['901'];
  delete singleStub['902'];

  singleStub['901'] = { id: 901, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: '2026-10-13T08:00:00', end: '2026-10-13T09:00:00', duration: 3600, description: 'job', tags: ['Alexander'] };
  singleStub['902'] = { id: 902, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: '2026-10-13T10:00:00', end: '2026-10-13T11:00:00', duration: 3600, description: 'job', tags: ['Alexander'] };
  const collapseHead = findAll(editTbody, 'ke-sitegroup')[0];
  findAll(collapseHead, 'ke-sitegroup-toggle')[0].fire('click');
  await sleep(50);
  const visibleMembers = () => editTbody.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup') && !n.classList.contains('ke-sitegroup-edit') && n.style.display !== 'none');
  check('group expands before edit', visibleMembers().length === 2, visibleMembers().length);
  findAll(collapseHead, 'ke-sitegroup-edit-btn')[0].fire('click');
  await sleep(300);
  check('edit collapses list', findAll(editTbody, 'ke-sitegroup-edit').length === 1 && visibleMembers().length === 0);
  findAll(editTbody, 'ke-sitegroup-toggle')[0].fire('click');
  await sleep(50);
  check('toggling exits edit mode', findAll(editTbody, 'ke-sitegroup-edit').length === 0 && visibleMembers().length === 2);

  singleStub['901'] = { id: 901, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: '2026-10-13T08:00:00', end: '2026-10-13T09:00:00', duration: 3600, description: 'job', tags: ['Alexander'] };
  singleStub['902'] = { id: 902, project: { id: 200, name: 'Site São Paulo', parentTitle: 'São Paulo Tech' }, activity: { id: 1655, name: 'Consequuntur dolor' }, begin: '2026-10-13T10:00:00', end: '2026-10-13T11:00:00', duration: 3600, description: 'job', tags: ['Alexander'] };
  const toggleEditBtn = findAll(editTbody, 'ke-sitegroup-edit-btn')[0];
  toggleEditBtn.fire('click');
  await sleep(300);
  check('edit opens via button', findAll(editTbody, 'ke-sitegroup-edit').length === 1);
  toggleEditBtn.fire('click');
  await sleep(50);
  check('clicking edit again closes without reload', findAll(editTbody, 'ke-sitegroup-edit').length === 0);
  delete singleStub['901'];
  delete singleStub['902'];
  check('timesheetPath pt', KE.timesheetPath('https://kimai.exemplo/', 'pt_BR') === 'https://kimai.exemplo/pt_BR/timesheet/');
  check('timesheetPath default en', KE.timesheetPath('https://kimai.exemplo') === 'https://kimai.exemplo/en/timesheet/');
  check('apiTokenUrl', KE.apiTokenUrl('https://kimai.exemplo/', 'pt_BR', 'maria.silva') === 'https://kimai.exemplo/pt_BR/profile/maria.silva/api-token');
  check('locales include pt_BR', KE.SUPPORTED_LOCALES.indexOf('pt_BR') === 0 && KE.SUPPORTED_LOCALES.length >= 20, KE.SUPPORTED_LOCALES.length);
  const me = await KE.fetchCurrentUser();
  check('fetchCurrentUser', me.username === 'john_user' && me.language === 'en', me);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  chrome.tabs.created.length = 0;
  popEls['ke-pop-open'].fire('click');
  await sleep(100);
  check('button opens timesheet', chrome.tabs.created.length >= 1 &&
    chrome.tabs.created.every((c) => c.url === 'https://kimai.exemplo/pt_BR/timesheet/'), chrome.tabs.created);
  tabList = [
    { url: 'https://kimai.exemplo/pt_BR/timesheet/', cookieStoreId: 'firefox-container-1' },
    { url: 'https://outro.exemplo/', cookieStoreId: 'firefox-container-2' },
    { url: 'https://kimai.exemplo/en/dashboard/', cookieStoreId: 'firefox-default' },
  ];
  check('finds Kimai container', (await KE.kimaiContainer('https://kimai.exemplo')) === 'firefox-container-1');
  check('ignores foreign base', (await KE.kimaiContainer('https://naoexiste.exemplo')) === '');
  tabList = [{ url: 'https://kimai.exemplo/', cookieStoreId: 'firefox-default' }];
  check('default does not force', (await KE.kimaiContainer('https://kimai.exemplo')) === '');
  tabList = [{ url: 'https://kimai.exemplo/', cookieStoreId: 'firefox-private' }];
  check('private does not force', (await KE.kimaiContainer('https://kimai.exemplo')) === '');
  tabList = [{ url: 'https://kimai.exemplo/pt_BR/timesheet/', cookieStoreId: 'firefox-container-7' }];
  chrome.tabs.created.length = 0;
  await KE.openKimai('https://kimai.exemplo', 'pt_BR');
  check('open uses container', chrome.tabs.created.length === 1 &&
    chrome.tabs.created[0].cookieStoreId === 'firefox-container-7', chrome.tabs.created);
  tabList = [];
  chrome.tabs.created.length = 0;
  await KE.openKimai('https://kimai.exemplo', 'pt_BR');
  check('no tab opens default', chrome.tabs.created.length === 1 &&
    !('cookieStoreId' in chrome.tabs.created[0]), chrome.tabs.created);
  const scMap = { startDefault: 'Alt+Shift+P', stop: 'Alt+Shift+S' };
  const kEv = (o) => Object.assign({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '', repeat: false, target: null }, o);
  check('disabled ignores everything', KE.shortcutAction(scMap, false, kEv({ altKey: true, shiftKey: true, key: 'S' })) === null);
  check('enabled dispatches stop', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'S' })) === 'stop');
  check('enabled dispatches default', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'P' })) === 'startDefault');
  check('repeat ignores', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'S', repeat: true })) === null);
  check('in field ignores', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'S', target: { tagName: 'INPUT' } })) === null);
  check('no null match', KE.shortcutAction(scMap, true, kEv({ key: 'a' })) === null);
  const mc = KE.createMultiCombo({ searchPlaceholder: 't' });
  let emptyEnter = 0;
  const mc2 = KE.createMultiCombo({ searchPlaceholder: 't', onEnterEmpty: () => { emptyEnter++; } });
  mc.setItems([{ value: 'Alpha', label: 'Alpha' }, { value: 'Beta', label: 'Beta' }]);
  const mIn = mc.root.querySelector('.ke-multi-input');
  mIn.value = 'Alpha';
  mIn.fire('input');
  mIn.fire('keydown', { key: 'Enter' });
  mIn.value = 'Alpha';
  mIn.fire('input');
  mIn.fire('keydown', { key: 'Enter' });
  check('no duplicates', mc.getValues().join(',') === 'Alpha');
  check('chip renders', mc.root.querySelectorAll('.ke-chip').length === 1);
  check('chip remove uses translated label', mc.root.querySelector('.ke-chip-x').getAttribute('aria-label') === 'Remover Alpha');
  check('multiCombo toggle has accessible label', findAll(mc.root, 'ke-combo-toggle')[0].getAttribute('aria-label') === 'Expandir opções');
  const comboSrc = fs.readFileSync(path.join(ROOT, 'src/content/combo.js'), 'utf8');
  check('combo uses i18n keys', comboSrc.includes("KE.uiText('ui.removeItem')") && comboSrc.includes("KE.uiText('ui.newTagOption'") &&
    comboSrc.includes("KE.uiText('ui.expandOptions')"));
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'src/content/i18n.js'), 'utf8');
  check('new i18n keys in pt and en', ['removeItem', 'expandOptions', 'newTagOption', 'saveToApply', 'useSuggestion', 'startDefaultTask', 'stopTask', 'popupOpenHint', 'moreShortcuts', 'statsToday', 'statsWeek'].every((k) =>
    i18nSrc.includes(k + ':') && (i18nSrc.match(new RegExp(k + ':', 'g')) || []).length >= 2));
  check('plugin section keys in pt and en', ['kimaiPage', 'plugin', 'pluginHint', 'hideRecents', 'hideContinueToday'].every((k) =>
    i18nSrc.includes(k + ':') && (i18nSrc.match(new RegExp(k + ':', 'g')) || []).length >= 2));
  const optHtml = fs.readFileSync(path.join(ROOT, 'src/options/options.html'), 'utf8');
  check('translatable options title and languages', optHtml.includes('<title data-ke-i18n="ui.optionsTitle">') &&
    optHtml.includes('data-ke-i18n="ui.languagePortuguese"') && optHtml.includes('data-ke-i18n="ui.languageEnglish"'));
  check('popup icon buttons have translatable aria-label',
    ['ke-pop-open', 'ke-pop-settings', 'ke-pop-refresh-catalog', 'ke-pop-refresh-today', 'ke-pop-refresh-recent']
      .every((id) => new RegExp('id="' + id + '"[^>]*data-ke-i18n-aria-label').test(popHtmlForIcons)));
  mIn.value = '';
  mIn.fire('keydown', { key: 'Backspace' });
  check('backspace removes last', mc.getValues().length === 0 && mc.root.querySelectorAll('.ke-chip').length === 0);
  mIn.value = 'Novo Nome';
  check('flush commits pending', mc.flush() === true && mc.getValues().join(',') === 'Novo Nome');
  check('empty flush false', mc.flush() === false);
  mc2.input.value = '';
  mc2.input.fire('keydown', { key: 'Enter' });
  check('empty enter calls callback', emptyEnter === 1);
  check('parseCsrfToken', KE.parseCsrfToken('<input name="access_token_form[_token]" value="ABC123" />', 'access_token_form[_token]') === 'ABC123');
  check('empty parseCsrfToken', KE.parseCsrfToken('<html></html>', 'access_token_form[_token]') === '');
  check('parseAccessToken', KE.parseAccessToken('<pre><code>abc123token</code></pre>') === 'abc123token');
  check('empty parseAccessToken', KE.parseAccessToken('<html>sem token</html>') === '');
  const listHtml = '<table><tr><td>Companion for Kimai</td><td></td><td><a href="/api/users/api-token/11">x</a></td></tr>' +
    '<tr><td>Outro</td><td></td><td><a href="/api/users/api-token/22">x</a></td></tr></table>';
  const parsed = KE.parseTokenList(listHtml);
  check('parseTokenList', parsed.length === 2 && parsed[0].id === '11' && parsed[0].name === 'Companion for Kimai' && parsed[1].id === '22', parsed);
  autoConnectPage = '<table><tr><td>Companion for Kimai</td><td></td><td><a href="/api/users/api-token/11">x</a></td></tr>' +
    '<tr><td>Companion for Kimai a1b2c3</td><td></td><td><a href="/api/users/api-token/12">x</a></td></tr>' +
    '<tr><td>Outro token</td><td></td><td><a href="/api/users/api-token/99">x</a></td></tr></table><pre><code>novotoken123</code></pre>';
  autoConnectPosts.length = 0;
  autoConnectDeleted.length = 0;
  check('shortHash has 6 hex', /^[0-9a-f]{6}$/.test(KE.shortHash()), KE.shortHash());
  const auto = await KE.autoConnectKimai({ locale: 'pt_BR', username: 'john_user', name: 'Companion for Kimai' });
  check('autoConnect creates and replaces', auto.token === 'novotoken123' && auto.replaced.join(',') === '11,12', auto);
  check('autoConnect names with hash', /^Companion for Kimai [0-9a-f]{6}$/.test(auto.name), auto.name);
  check('autoConnect preserves others', autoConnectDeleted.indexOf('99') < 0, autoConnectDeleted);
  check('autoConnect posts form', autoConnectPosts.length === 1 &&
    /access_token_form%5Bname%5D=Companion\+for\+Kimai\+[0-9a-f]{6}/.test(autoConnectPosts[0]), autoConnectPosts);
  autoConnectPage = '<table><tr><td>Outro token</td><td></td><td><a href="/api/users/api-token/99">x</a></td></tr></table><pre><code>sozinho456</code></pre>';
  autoConnectDeleted.length = 0;
  const auto2 = await KE.autoConnectKimai({ locale: 'en', username: 'john_user', name: 'Companion for Kimai' });
  check('autoConnect without old ones', auto2.token === 'sozinho456' && auto2.replaced.length === 0, auto2);
  check('parseAccessToken with attributes', KE.parseAccessToken('<pre style="padding-left: 65px"><code>tok123</code></pre>') === 'tok123');
  check('parseCsrfToken reversed order', KE.parseCsrfToken('<input value="ABC" name="access_token_form[_token]" />', 'access_token_form[_token]') === 'ABC');
  check('parseCsrfToken single quotes', KE.parseCsrfToken("<input name='access_token_form[_token]' value='XYZ' />", 'access_token_form[_token]') === 'XYZ');
  const listAttr = '<table><thead><tr><th>Nome</th></tr></thead><tbody>' +
    '<tr class="odd"><td class="x">Companion for Kimai abc123</td><td></td><td><a href="/en/profile/john_user/api-token/77/delete">x</a></td></tr>' +
    '</tbody></table>';
  const parsedAttr = KE.parseTokenList(listAttr);
  check('parseTokenList with attributes', parsedAttr.length === 1 && parsedAttr[0].id === '77' &&
    parsedAttr[0].name === 'Companion for Kimai abc123', parsedAttr);
  autoConnectPostPage = '<div><pre><code>direto789</code></pre></div>';
  autoConnectPage = '<table><tr><td>Companion for Kimai oldrow</td><td></td><td><a href="/en/profile/john_user/api-token/78/delete">x</a></td></tr></table>';
  autoConnectDeleted.length = 0;
  const auto3 = await KE.autoConnectKimai({ locale: 'en', username: 'john_user', name: 'Companion for Kimai' });
  check('token comes from POST response', auto3.token === 'direto789', auto3);
  check('cleanup uses row URL', autoConnectDeleted.join(',') === '78', autoConnectDeleted);
  autoConnectPostPage = '<html>ok</html>';
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  stored.keCustomer = '20';
  stored.keProject = '200';
  stored.keActivity = '1655';
  storedLocal.keApiToken = 'popup-token';
  chrome.permissions.granted = true;
  failMode = null;
  activeStub = [];
  const t47 = KE.todayKey();
  todayStub = [
    { id: 701, project: 200, activity: 1655, begin: t47 + 'T09:00:00', end: t47 + 'T10:00:00', duration: 3600, description: 'manhã' },
  ];
  recentStub = [
    { id: 801, project: 144, activity: 1661, begin: '2000-01-02T09:00:00', end: '2000-01-02T10:00:00', duration: 1800, description: 'ontem' },
    { id: 802, project: 144, activity: 1661, begin: '2000-01-01T09:00:00', end: '2000-01-01T10:00:00', duration: 1800, description: 'ontem' },
    { id: 803, project: 200, activity: 1655, begin: '2000-01-03T09:00:00', end: '2000-01-03T10:00:00', duration: 600, description: 'outro dia', tags: [{ name: 'Alexander' }] },
  ];
  Object.keys(storedLocal).forEach((k) => { if (k.indexOf('keCache') === 0) delete storedLocal[k]; });
  eval(POP_SRC);
  await sleep(600);
  check('localized labels',
    popEls['ke-pop-label-desc'].textContent === 'Descrição' &&
    popEls['ke-pop-label-customer'].textContent === 'Cliente' &&
    popEls['ke-pop-label-project'].textContent === 'Projeto' &&
    popEls['ke-pop-label-activity'].textContent === 'Atividade' &&
    popEls['ke-pop-label-tags'].textContent === 'Tags',
    ['desc', 'customer', 'project', 'activity', 'tags'].map((k) => popEls['ke-pop-label-' + k].textContent));
  const popHtml = fs.readFileSync(path.join(ROOT, 'src/popup/popup.html'), 'utf8');
  check('HTML labels for the 5 fields',
    ['ke-pop-label-desc', 'ke-pop-label-customer', 'ke-pop-label-project', 'ke-pop-label-activity', 'ke-pop-label-tags']
      .every((id) => popHtml.includes('id="' + id + '"')));
  const custPop = findAll(popEls['ke-pop-new-customer'], 'ke-combo-input')[0];
  const tagsPop = findAll(popEls['ke-pop-new-tags'], 'ke-multi-input')[0];
  check('customer and tags combos exist', !!custPop && !!tagsPop);
  check('restored customer filters', custPop.value === 'São Paulo Tech', custPop.value);
  check('restored project (filtered)', findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value === 'São Paulo Tech / Site São Paulo');
  check('restored activity', findAll(popEls['ke-pop-new-activity'], 'ke-combo-input')[0].value === 'Consequuntur dolor');
  fireInput(custPop, '');
  await sleep(200);
  check('clearing customer shows all', KE.state.projects.length === 4, KE.state.projects.length);
  const recentRows = findAll(popEls['ke-pop-recent'], 'ke-pop-today-row');
  check('recents exclude today', recentRows.length === 2, recentRows.length);
  check('recent shows date', findAll(recentRows[0], 'ke-pop-timer-sub')[0].textContent.indexOf('03/01') === 0,
    findAll(recentRows[0], 'ke-pop-timer-sub')[0].textContent);
  tabList = [
    { id: 7, url: 'https://kimai.exemplo/pt_BR/timesheet/' },
    { id: 8, url: 'https://other.exemplo/x' },
  ];
  chrome.tabs.reloaded.length = 0;
  posted.length = 0;
  fireInput(tagsPop, 'Alexander');
  fireKey(tagsPop, 'Enter');
  await sleep(50);
  popEls['ke-pop-desc'] = popEls['ke-pop-new-desc'];
  popEls['ke-pop-new-desc'].value = 'via popup';
  popEls['ke-pop-start'].fire('click');
  await sleep(400);
  check('popup start with tags', posted.some((p) => p.tags === 'Alexander' && p.project === 200), posted.slice(-2));
  check('reloads only Kimai tabs', chrome.tabs.reloaded.indexOf(7) >= 0 && chrome.tabs.reloaded.indexOf(8) < 0, chrome.tabs.reloaded);
  check('description field has suggestion box', popHtml.includes('id="ke-pop-desc-suggest"') &&
    popHtml.includes('aria-controls="ke-pop-desc-suggest"'));
  const popSuggestCss = fs.readFileSync(path.join(ROOT, 'src/popup/popup.css'), 'utf8');
  check('suggestions have positioned dropdown',
    /\.ke-pop-desc-field\s*\{[^}]*position:\s*relative/s.test(popSuggestCss) &&
    /\.ke-pop-suggest\s*\{[^}]*position:\s*absolute/s.test(popSuggestCss) &&
    /\.ke-pop-suggest-item\.ke-active\s*\{[^}]*background-color/s.test(popSuggestCss));
  popEls['ke-pop-new-desc'].value = 'ont';
  popEls['ke-pop-new-desc'].fire('input');
  await sleep(300);
  const suggestBox = popEls['ke-pop-desc-suggest'];
  const suggestFirst = findAll(suggestBox, 'ke-pop-suggest-item');
  check('description suggests related recents', suggestBox.hidden === false && suggestFirst.length === 1 &&
    findAll(suggestFirst[0], 'ke-pop-suggest-title')[0].textContent === 'ontem' &&
    suggestFirst[0].getAttribute('role') === 'option', suggestFirst.length);
  suggestFirst[0].onclick();
  await sleep(400);
  check('suggestion fills description and combos', popEls['ke-pop-new-desc'].value === 'ontem' &&
    findAll(popEls['ke-pop-new-customer'], 'ke-combo-input')[0].value === 'Altenwerth-Donnelly' &&
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value === 'Altenwerth-Donnelly / Tempore commodi' &&
    findAll(popEls['ke-pop-new-activity'], 'ke-combo-input')[0].value === 'Corrupti aut' &&
    suggestBox.hidden === true);
  posted.length = 0;
  popEls['ke-pop-start'].fire('click');
  await sleep(400);
  check('start after suggestion uses values', posted.length === 1 && posted[0].project === 144 &&
    posted[0].activity === 1661 && posted[0].description === 'ontem', posted.slice(-1));
  popEls['ke-pop-new-desc'].value = 'xyz-nada';
  popEls['ke-pop-new-desc'].fire('input');
  await sleep(300);
  check('no relation hides suggestions', suggestBox.hidden === true);
  popEls['ke-pop-new-desc'].value = 'o';
  popEls['ke-pop-new-desc'].fire('input');
  await sleep(300);
  check('short text hides suggestions', suggestBox.hidden === true);
  popEls['ke-pop-new-desc'].value = 'outro';
  popEls['ke-pop-new-desc'].fire('input');
  await sleep(300);
  check('suggestion with tags appears', findAll(suggestBox, 'ke-pop-suggest-item').length === 1);
  findAll(suggestBox, 'ke-pop-suggest-item')[0].onclick();
  await sleep(400);
  check('suggestion fills tags', findAll(popEls['ke-pop-new-tags'], 'ke-chip').length === 1 &&
    popEls['ke-pop-new-desc'].value === 'outro dia');
  const postedBeforeKeys = posted.length;
  popEls['ke-pop-new-desc'].value = 'ont';
  popEls['ke-pop-new-desc'].fire('input');
  await sleep(300);
  popEls['ke-pop-new-desc'].fire('keydown', { key: 'ArrowDown' });
  popEls['ke-pop-new-desc'].fire('keydown', { key: 'Enter' });
  await sleep(400);
  check('keyboard applies suggestion without starting', popEls['ke-pop-new-desc'].value === 'ontem' &&
    posted.length === postedBeforeKeys, posted.length);
  popEls['ke-pop-draft'].checked = true;
  popEls['ke-pop-new-desc'].value = 'ont';
  popEls['ke-pop-new-desc'].fire('input');
  await sleep(300);
  check('locked draft suppresses suggestions', suggestBox.hidden === true);
  popEls['ke-pop-draft'].checked = false;
  tabList = [
    { id: 11, url: 'https://kimai.exemplo/en/timesheet/' },
    { id: 12, url: 'HTTPS://KIMAI.EXEMPLO/en/x' },
    { id: 13, url: 'https://other.ex/' },
    { url: 'https://kimai.exemplo/en/y' },
    { id: 14 },
  ];
  chrome.tabs.reloaded.length = 0;
  check('reload counts and filters', (await KE.reloadKimaiTabs('https://kimai.exemplo/')) === 2 &&
    chrome.tabs.reloaded.join(',') === '11,12', chrome.tabs.reloaded);
  check('reload with empty base', (await KE.reloadKimaiTabs('')) === 0);
  const rday = KE.todayKey();
  const rentries = [
    { id: 1, project: 1, activity: 1, description: 'a', begin: rday + 'T09:00:00', end: rday + 'T10:00:00', duration: 60 },
    { id: 2, project: 2, activity: 1, description: 'b', begin: '2000-01-02T09:00:00', end: '2000-01-02T10:00:00', duration: 60 },
    { id: 3, project: 2, activity: 1, description: 'b', begin: '2000-01-01T09:00:00', end: '2000-01-01T10:00:00', duration: 60 },
    { id: 4, project: 3, activity: 1, description: 'c', begin: '2000-01-03T09:00:00', end: null, duration: 0 },
  ];
  const ro = KE.recentOthers(rentries, 8);
  check('recents exclude today, running and dedup', ro.length === 1 && ro[0].id === 2, ro.map((r) => r.id));
  const manyOld = [];
  for (let i = 0; i < 10; i++) manyOld.push({ id: 100 + i, project: 500 + i, activity: 1, description: 'x', begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 60 });
  check('recents limit', KE.recentOthers(manyOld, 3).length === 3);
  await popEls['ke-pop-refresh-recent'].onclick();
  await sleep(300);
  check('recents refresh keeps list',
    findAll(popEls['ke-pop-recent'], 'ke-pop-today-row').length === 2 &&
    popEls['ke-pop-status'].textContent === 'Listas atualizadas!', popEls['ke-pop-status'].textContent);
  const bar = KE.createSiteBar();
  const barBtns = bar.children.filter((n) => n.tagName === 'BUTTON');
  check('bar has group + refresh', barBtns.length === 2 &&
    barBtns[0].classList.contains('ke-sitegroup-bar-toggle') &&
    barBtns[1].classList.contains('ke-sitegroup-bar-refresh'),
    barBtns.map((n) => n.className));
  check('labeled buttons', barBtns[0].textContent === 'Agrupar' &&
    barBtns[1].getAttribute('aria-label') === 'Atualizar listas',
    [barBtns[0].textContent, barBtns[1].getAttribute('aria-label')]);
  const projFetches = fetchCounts.projects || 0;
  barBtns[1].fire('click');
  await sleep(300);
  check('refresh reloads lists', (fetchCounts.projects || 0) > projFetches &&
    pageToast().textContent === 'Listas atualizadas!',
    pageToast().textContent);
  const now = nowSection();
  check('Now is own section below card',
    !!now && now.id === 'ke-active-now' && mountedCards[1] === now &&
    findAll(now, 'ke-now-title')[0].textContent === 'Agora');
  activeStub = [
    { id: 559, project: 200, activity: 1655, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'visível' },
  ];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  check('Now shows running timer', nowSection().style.display !== 'none' &&
    findAll(nowSection(), 'ke-active-row').length === 1);
  activeStub = [];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  check('Now hides without timers', nowSection().style.display === 'none' &&
    findAll(nowSection(), 'ke-active-row').length === 0);
  const qtCssWidgets = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.css'), 'utf8');
  check('styles under .ke-card', ['.ke-btn-stop', '.ke-input', '.ke-btn-save', '.ke-btn-cancel', '.ke-btn-edit', '.ke-dot'].every((c) => qtCssWidgets.includes('.ke-card ' + c)));
  check('Now has own title', qtCssWidgets.includes('#ke-active-now .ke-now-title'));
  check('no status in widget', findAll(mountedCards[0], 'ke-status').length === 0 &&
    findAll(nowSection() || { children: [] }, 'ke-status').length === 0);
  check('bottom-right toast', /\.ke-toast\s*\{[^}]*position:\s*fixed[^}]*right:\s*24px[^}]*bottom:\s*24px/s.test(qtCssWidgets));
  check('toast dismisses itself', /setTimeout\(\(\) => \{\s*n\.classList\.remove\('ke-show'\);\s*n\.hidden = true;\s*\},\s*5000\)/.test(
    fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.js'), 'utf8')));
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  eval(OPT_SRC);
  await sleep(300);
  check('about shows manifest metadata',
    popEls['ke-opt-about-name'].textContent === manifest.name &&
    popEls['ke-opt-about-version'].textContent === 'v' + manifest.version &&
    popEls['ke-opt-about-author'].textContent === manifest.author &&
    popEls['ke-opt-about-github'].href === manifest.homepage_url);
  const optAboutHtml = fs.readFileSync(path.join(ROOT, 'src/options/options.html'), 'utf8');
  check('about shows Devmove publisher',
    /<dt[^>]*data-ke-i18n="ui\.publisher"[^>]*>/.test(optAboutHtml) &&
    optAboutHtml.includes('<a id="ke-opt-about-publisher" href="https://github.com/Devmove"') &&
    optAboutHtml.includes('>Devmove</a>'));
  check('publisher key in pt and en',
    KE.STRINGS.pt.ui.publisher === 'Publicador' && KE.STRINGS.en.ui.publisher === 'Publisher');
  const toast = popEls['ke-opt-toast'];
  const toastShown = () => toast.hidden === false && toast.classList.contains('ke-show');
  check('Interface starts with options unchecked',
    popEls['ke-opt-hide-navigation'].checked === false &&
    popEls['ke-opt-hide-actionbar'].checked === false &&
    popEls['ke-opt-hide-recent'].checked === false &&
    popEls['ke-opt-hide-continue'].checked === false);
  popEls['ke-opt-sc-default'].value = 'X';
  popEls['ke-opt-sc-reset'].fire('click');
  await sleep(20);
  check('shortcut reset uses toast', toastShown() && toast.textContent.includes('Padrões restaurados'), toast.textContent);
  check('reset fills defaults', popEls['ke-opt-sc-default'].value === 'Alt+Shift+P' &&
    popEls['ke-opt-sc-stop'].value === 'Alt+Shift+S', popEls['ke-opt-sc-default'].value);
  const scStopInput = popEls['ke-opt-sc-stop'];
  scStopInput.fire('focus');
  scStopInput.fire('keydown', { key: 'Alt', altKey: true });
  check('lone modifier does not capture', scStopInput.value === '', scStopInput.value);
  scStopInput.fire('keyup', { key: 'Alt' });
  check('releasing modifier does not confirm', scStopInput.value === '' && scStopInput.dataset.prev === 'Alt+Shift+S',
    scStopInput.value);
  scStopInput.fire('keydown', { key: 'x', altKey: true, shiftKey: true });
  scStopInput.fire('keydown', { key: 'x', altKey: true, shiftKey: true, repeat: true });
  scStopInput.fire('keyup', { key: 'x', altKey: true, shiftKey: true });
  check('capture remaps stop', scStopInput.value === 'Alt+Shift+X' && scStopInput.dataset.prev === 'Alt+Shift+X',
    scStopInput.value);
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  popEls['ke-opt-save'].fire('click');
  await sleep(100);
  check('stop remap persists', stored.keSettings.shortcuts.stop === 'Alt+Shift+X' &&
    stored.keSettings.shortcuts.startDefault === 'Alt+Shift+P', stored.keSettings.shortcuts);
  popEls['ke-opt-url'].value = 'se-url-valida';
  popEls['ke-opt-save'].fire('click');
  await sleep(50);
  check('invalid save uses toast', toastShown() && toast.textContent.includes('URL inválida'), toast.textContent);
  const origSetTimeout = global.setTimeout;
  const delays = [];
  global.setTimeout = (fn, ms, ...a) => { delays.push(ms); return origSetTimeout(fn, ms, ...a); };
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  popEls['ke-opt-hide-navigation'].checked = true;
  popEls['ke-opt-hide-actionbar'].checked = true;
  popEls['ke-opt-hide-recent'].checked = true;
  popEls['ke-opt-hide-continue'].checked = true;
  popEls['ke-opt-save'].fire('click');
  await sleep(100);
  check('valid save uses toast', toastShown() && toast.textContent === 'Configurações salvas.', toast.textContent);
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  chrome.permissions.granted = true;
  delete storedLocal.keApiToken;
  autoConnectPage = '<table></table><pre><code>tokenpelasconfig</code></pre>';
  popEls['ke-opt-autoconnect'].fire('click');
  await sleep(400);
  check('options autoconnect saves key', storedLocal.keApiToken === 'tokenpelasconfig', storedLocal.keApiToken);
  check('autoconnect uses toast', toastShown() && toast.textContent === 'Plugin conectado!', toast.textContent);
  check('autoconnect saves user', stored.keSettings.keUsername === 'john_user' &&
    stored.keSettings.kimaiBaseUrl === 'https://kimai.exemplo', stored.keSettings);
  check('autoconnect hides after connecting', popEls['ke-opt-autoconnect'].hidden === true);
  delete storedLocal.keApiToken;
  eval(OPT_SRC);
  await sleep(300);
  check('autoconnect appears without key', popEls['ke-opt-autoconnect'].hidden === false);
  storedLocal.keApiToken = 'chave-invalida';
  eval(OPT_SRC);
  await sleep(300);
  failMode = 'auth';
  popEls['ke-opt-test'].fire('click');
  await sleep(300);
  check('autoconnect appears on failure', popEls['ke-opt-autoconnect'].hidden === false &&
    toast.textContent.includes('Falhou'), toast.textContent);
  failMode = null;
  popEls['ke-opt-test'].fire('click');
  await sleep(300);
  check('autoconnect hides on success', popEls['ke-opt-autoconnect'].hidden === true &&
    toast.textContent.includes('Conexão ok'), toast.textContent);
  check('save persists Interface options', stored.keSettings.hideNavigation === true &&
    stored.keSettings.hideActionBar === true && stored.keSettings.hideSidebar === false &&
    stored.keSettings.hideHeader === false && stored.keSettings.hideRecents === true &&
    stored.keSettings.hideContinueToday === true, stored.keSettings);
  const prevPopupSettings = stored.keSettings;
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', hideRecents: true, hideContinueToday: true };
  storedLocal.keApiToken = 'popup-token';
  chrome.permissions.granted = true;
  eval(POP_SRC);
  await sleep(500);
  check('popup hides disabled sections', popEls['ke-pop-main'].hidden === false &&
    popEls['ke-pop-today-sec'].hidden === true && popEls['ke-pop-recent-sec'].hidden === true);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo' };
  eval(POP_SRC);
  await sleep(500);
  check('popup shows sections by default', popEls['ke-pop-today-sec'].hidden === false &&
    popEls['ke-pop-recent-sec'].hidden === false);
  stored.keSettings = prevPopupSettings;
  check('toast lasts 5 seconds', delays.includes(5000), delays.slice(-5));
  global.setTimeout = origSetTimeout;
  storedLocal.keApiToken = 'tok-desconectar';
  popEls['ke-opt-disconnect'].fire('click');
  await sleep(50);
  check('disconnect uses toast', toastShown() && toast.textContent === 'Desconectado.', toast.textContent);
  check('disconnect erases key', !('keApiToken' in storedLocal));
  popEls['ke-opt-draft-enabled'].checked = false;
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  popEls['ke-opt-save'].fire('click');
  await sleep(100);
  popEls['ke-opt-draft-enabled'].checked = true;
  popEls['ke-opt-draft-enabled'].fire('change');
  await sleep(20);
  check('toggling draft warns save needed', toastShown() && toast.textContent.includes('Salve para aplicar'), toast.textContent);
  check('unchecking draft persists disabled', stored.keSettings.draftEnabled === false, stored.keSettings);
  storedLocal.keApiToken = 'popup-token';
  chrome.permissions.granted = true;
  eval(POP_SRC);
  await sleep(500);
  check('popup hides checkbox with draft disabled', popEls['ke-pop-main'].hidden === false &&
    popEls['ke-pop-draft-row'].hidden === true, popEls['ke-pop-draft-row'].hidden);
  const optDraftHtml = fs.readFileSync(path.join(ROOT, 'src/options/options.html'), 'utf8');
  check('draft section exists in options', optDraftHtml.includes('id="ke-opt-draft-enabled"') &&
    optDraftHtml.includes('id="ke-opt-draft-form"') && optDraftHtml.includes('id="ke-opt-def-customer"') &&
    optDraftHtml.includes('id="ke-opt-def-project"') && optDraftHtml.includes('id="ke-opt-def-activity"') &&
    optDraftHtml.includes('id="ke-opt-def-tags"') && !optDraftHtml.includes('id="ke-opt-def-desc"') &&
    optDraftHtml.includes('data-ke-i18n="ui.enableDraft"'));
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  storedLocal.keApiToken = 'popup-token';
  chrome.permissions.granted = true;
  eval(OPT_SRC);
  await sleep(600);
  check('draft starts disabled', popEls['ke-opt-draft-enabled'].checked === false &&
    popEls['ke-opt-draft-form'].hidden === true);
  popEls['ke-opt-draft-enabled'].checked = true;
  popEls['ke-opt-draft-enabled'].fire('change');
  check('enabling shows form', popEls['ke-opt-draft-form'].hidden === false);
  const defCustIn = findAll(popEls['ke-opt-def-customer'], 'ke-combo-input')[0];
  fireInput(defCustIn, 'São Paulo Tech');
  fireKey(defCustIn, 'ArrowDown');
  fireKey(defCustIn, 'Enter');
  await sleep(200);
  const defProjIn = findAll(popEls['ke-opt-def-project'], 'ke-combo-input')[0];
  fireInput(defProjIn, 'Site São Paulo');
  fireKey(defProjIn, 'ArrowDown');
  fireKey(defProjIn, 'Enter');
  await sleep(200);
  const defActIn = findAll(popEls['ke-opt-def-activity'], 'ke-combo-input')[0];
  fireInput(defActIn, 'Consequuntur');
  fireKey(defActIn, 'ArrowDown');
  fireKey(defActIn, 'Enter');
  await sleep(200);
  const defTagsIn = findAll(popEls['ke-opt-def-tags'], 'ke-multi-input')[0];
  fireInput(defTagsIn, 'Alexander');
  fireKey(defTagsIn, 'Enter');
  await sleep(100);
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  popEls['ke-opt-save'].fire('click');
  await sleep(150);
  check('save persists default timer', stored.keSettings.draftEnabled === true &&
    stored.keSettings.defaultTimer.customer === '20' && stored.keSettings.defaultTimer.project === '200' &&
    stored.keSettings.defaultTimer.activity === '1655' && !('description' in stored.keSettings.defaultTimer) &&
    stored.keSettings.defaultTimer.tags.join(',') === 'Alexander', stored.keSettings.defaultTimer);
  delete stored.keSettings.defaultTimer;
  eval(OPT_SRC);
  await sleep(600);
  popEls['ke-opt-draft-enabled'].checked = true;
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  popEls['ke-opt-save'].fire('click');
  await sleep(150);
  check('save requires project and activity with draft enabled', toastShown() &&
    toast.textContent.includes('Timer padrão') && !stored.keSettings.defaultTimer, toast.textContent);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  storedLocal.keApiToken = 'popup-token';
  chrome.permissions.granted = true;
  const apiGetOrig = KE.apiGet;
  KE.apiGet = async function (path, opts) {
    if (!KE.apiBaseUrl || !KE.authToken) throw new Error('missing API configuration');
    const out = await apiGetOrig.call(this, path, opts);
    KE.apiBaseUrl = '';
    KE.authToken = '';
    KE.apiCredentials = 'same-origin';
    return out;
  };
  eval(OPT_SRC);
  await sleep(800);
  KE.apiGet = apiGetOrig;
  const raceProjIn = findAll(popEls['ke-opt-def-project'], 'ke-combo-input')[0];
  raceProjIn.fire('focus');
  check('catalogs survive concurrent reset', findAll(popEls['ke-opt-def-project'], 'ke-combo-opt').length > 0);
  fireInput(raceProjIn, 'Site São Paulo');
  check('project search filters after reset', findAll(popEls['ke-opt-def-project'], 'ke-combo-opt').length === 1);
  const raceCustIn = findAll(popEls['ke-opt-def-customer'], 'ke-combo-input')[0];
  fireInput(raceCustIn, 'Altenwerth');
  fireKey(raceCustIn, 'ArrowDown');
  fireKey(raceCustIn, 'Enter');
  await sleep(300);
  check('customer change reloads projects', findAll(popEls['ke-opt-def-project'], 'ke-combo-opt').length === 2);

  console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('harness ERROR:', e); process.exit(2); });
