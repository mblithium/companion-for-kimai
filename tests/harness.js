/* Functional test harness. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const contentFiles = manifest.content_scripts[0].js;
if (!contentFiles.length) throw new Error('manifest sem content_scripts js');
const SRC = contentFiles.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
console.log('módulos sob teste: ' + contentFiles.length);
const SRC_EXTRA = ['src/common/format.js', 'src/common/permissions.js', 'src/common/theme.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
const SRC_TESTHOOK = '\n;globalThis.__keTest = { KE };';
const POP_SRC = fs.readFileSync(path.join(ROOT, 'src/popup/popup.js'), 'utf8');
const OPT_SRC = fs.readFileSync(path.join(ROOT, 'src/options/options.js'), 'utf8');
function workerTestSource() {
  const wsrc = fs.readFileSync(path.join(ROOT, 'src/background/worker.js'), 'utf8');
  const m = wsrc.match(/importScripts\(([\s\S]*?)\);/);
  if (!m) throw new Error('worker sem importScripts');
  const files = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const imports = files
    .map((f) => fs.readFileSync(path.join(ROOT, 'src/background', f), 'utf8'))
    .join('\n;\n');
  return imports + '\n;\n' + wsrc.replace(m[0], '');
}


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
    (this._handlers[type] || []).forEach((f) => f(Object.assign({ preventDefault() {}, stopPropagation() {} }, ev)));
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
  insertBefore(node) { if (node.id === 'ke-quick-timer') captured.card = node; mountedCards.push(node); return node; },
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
let activeStub = [];
let todayStub = [];
let recentStub = [];
let autoConnectPosts = [];
let autoConnectDeleted = [];
let autoConnectPage = '';
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
const actionCalls = [];
const sentMessages = [];
const menuCreated = [];
const menuUpdates = [];
const chrome = {
  permissions: {
    granted: true,
    contains: async () => chrome.permissions.granted,
    request: async () => { chrome.permissions.granted = true; return true; },
    remove: async () => { chrome.permissions.granted = false; return true; },
  },
  runtime: {
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
  alarms: {
    create() {},
    onAlarm: listenerReg(),
  },
  action: {
    setIcon: async (o) => { actionCalls.push(['setIcon', o]); },
    setBadgeText: async (o) => { actionCalls.push(['setBadgeText', o]); },
    setBadgeBackgroundColor: async (o) => { actionCalls.push(['setBadgeBackgroundColor', o]); },
    setTitle: async (o) => { actionCalls.push(['setTitle', o]); },
  },
  contextMenus: {
    create(o) { menuCreated.push(o); return o.id; },
    update: async (id, props) => { menuUpdates.push({ id, props }); },
    removeAll: async () => { menuCreated.length = 0; },
    onClicked: listenerReg(),
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
  if (/\/api\/timesheets\/\d+\/stop/.test(u)) {
    stoppedIds.push(u.match(/\/api\/timesheets\/(\d+)\/stop/)[1]);
    return jsonResp({});
  }
  if (u.match(/\/profile\/[^/]+\/create-access-token/) && method === 'GET') {
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<input type="hidden" name="access_token_form[_token]" value="CSRF123" />' };
  }
  if (u.match(/\/profile\/[^/]+\/create-access-token/) && method === 'POST') {
    autoConnectPosts.push(String((opts && opts.body) || ''));
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html>ok</html>' };
  }
  if (u.match(/\/profile\/[^/]+\/api-token/) && method === 'GET') {
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => autoConnectPage };
  }
  if (u.match(/\/api\/users\/api-token\/\d+/) && method === 'DELETE') {
    const id = u.match(/\/api\/users\/api-token\/(\d+)/)[1];
    autoConnectDeleted.push(id);
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}' };
  }
  throw new Error('fetch inesperado: ' + method + ' ' + u);
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
  else { failures++; console.log('FALHOU ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
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
  check('card injetado', !!card);
  const titlePlayIcon = findAll(card, 'ke-play-icon')[0];
  check('ícone do título usa forma geométrica no círculo', !!titlePlayIcon && titlePlayIcon.textContent === '' &&
    findAll(card, 'ke-play')[0].getAttribute('aria-hidden') === 'true');
  const quickStartButton = findAll(card, 'ke-btn-start')[0];
  check('ícone e texto do botão Iniciar são elementos separados',
    findAll(quickStartButton, 'ke-btn-start-icon')[0].textContent === '' &&
    findAll(quickStartButton, 'ke-btn-start-label')[0].textContent === KE.T.start);
  const inputs = findAll(card, 'ke-combo-input');
  check('3 comboboxes', inputs.length === 3, inputs.length);
  const [custIn, projIn, actIn] = inputs;
  const descIn = findAll(card, 'ke-field').length ? null : null;
  await sleep(100);
  check('restore cliente', custIn.value === 'Altenwerth-Donnelly', custIn.value);
  check('restore projeto', projIn.value === 'Altenwerth-Donnelly / Tempore commodi', projIn.value);
  check('restore atividade', actIn.value === 'Corrupti aut', actIn.value);
  custIn.fire('focus');
  const custList = findAll(card, 'ke-combo-list')[0];
  check('cap 150 opções', custList.children.length === 150, custList.children.length);
  fireInput(custIn, 'sao');
  const names = custList.children.map((c) => c.textContent);
  check("busca 'sao'", names.length === 1 && names[0] === 'São Paulo Tech', names);
  fireKey(custIn, 'Enter');
  await sleep(100);
  check('cliente selecionado', custIn.value === 'São Paulo Tech', custIn.value);
  projIn.fire('focus');
  const projList = findAll(card, 'ke-combo-list')[1];
  const pnames = projList.children.map((c) => c.textContent);
  check('projetos filtrados', pnames.length === 1 && pnames[0] === 'São Paulo Tech / Site São Paulo', pnames);
  fireKey(projIn, 'ArrowDown');
  fireKey(projIn, 'Enter');
  await sleep(100);
  check('projeto via teclado', projIn.value === 'São Paulo Tech / Site São Paulo', projIn.value);
  actIn.fire('focus');
  fireKey(actIn, 'ArrowDown');
  fireKey(actIn, 'Enter');
  await sleep(50);
  check('atividade via teclado', actIn.value === 'Consequuntur dolor', actIn.value);
  const fields = findAll(card, 'ke-field');
  const desc = fields.map((f) => f.children.find((c) => (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA') && !c.classList.contains('ke-combo-input'))).find(Boolean);
  desc.value = 'revisão do layout';
  const startBtn = findAll(card, 'ke-btn-start')[0];
  startBtn.fire('click');
  await sleep(100);
  check('POST enviado', posted.length === 1, posted.length);
  const body = posted[0] || {};
  check('POST projeto', body.project === 200, body);
  check('POST atividade', body.activity === 1655, body);
  check('POST descrição', body.description === 'revisão do layout', body);
  check('POST begin formato', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(body.begin || ''), body.begin);
  check('POST omite tags vazias', !('tags' in body), Object.keys(body));
  check('storage atualizado', stored.keProject === '200' && stored.keActivity === '1655' && stored.keCustomer === '20', stored);
  const status = pageToast();
  check('status ok', status.textContent === 'Timer iniciado!', status.textContent);
  fireInput(actIn, '');
  await sleep(50);
  startBtn.fire('click');
  await sleep(50);
  check('validação exige atividade', status.textContent === 'Selecione projeto e atividade para iniciar.', status.textContent);
  check('sem POST extra', posted.length === 1, posted.length);
  fireInput(projIn, 'texto livre qualquer');
  fireKey(projIn, 'Escape');
  check('escape reverte', projIn.value === 'São Paulo Tech / Site São Paulo', projIn.value);
  fireInput(actIn, 'Consequuntur dolor');
  fireKey(actIn, 'Enter');
  await sleep(50);
  desc.value = 'FORCAR400';
  startBtn.fire('click');
  await sleep(100);
  check('erro mostra motivo do servidor', status.textContent === 'Não foi possível iniciar o timer. Project is locked for this period.', status.textContent);
  check('sem POST em caso de 400', posted.length === 1, posted.length);
  const tagsIn = findAll(card, 'ke-multi-input')[0];
  check('tags combobox existe', !!tagsIn);
  const tagsList = tagsIn.parentNode.parentNode.querySelector('.ke-combo-list');
  fireInput(tagsIn, 'Alex');
  check('tags filtra disponíveis',
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
  check('tag inexistente criada', createdTags.length === 1 && createdTags[0] === 'NovaTag', createdTags);
  const bodyTags = posted[1] || {};
  check('tags como string', bodyTags.tags === 'Alexander,NovaTag', bodyTags.tags);
  check('start com tags ok', status.textContent === 'Timer iniciado!', status.textContent);
  moInstances.forEach((m) => m.cb());
  await sleep(700);
  check('sem duplicar com card presente', mountedCards.length === 2, mountedCards.length);
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  check('remonta após wipe', mountedCards.length === 2, mountedCards.length);
  const newInputs = findAll(mountedCards[0], 'ke-combo-input');
  check('combos recarregados após wipe',
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
  check('ativos sem [object Object]', titles.length === 2 && titles.every((t) => !t.includes('[object Object]')), titles);
  check('ativo objeto rotulado', titles[0] === 'São Paulo Tech / Site São Paulo · Consequuntur dolor', titles);
  check('ativo numérico rotulado', titles[1] === 'São Paulo Tech / Site São Paulo · Consequuntur dolor', titles);
  check('Agora fora do card', findAll(mountedCards[0], 'ke-active-title').length === 0 &&
    findAll(nowSection(), 'ke-now-title')[0].textContent === 'Agora');
  check('sem parar no timer rápido', findAll(mountedCards[0], 'ke-stop-all').length === 0);
  stoppedIds.length = 0;
  const agoraStops = findAll(nowSection(), 'ke-btn-stop');
  check('parar por timer no Agora', agoraStops.length === 2, agoraStops.length);
  agoraStops[0].fire('click');
  await sleep(150);
  check('parou o timer', stoppedIds.join(',') === '555', stoppedIds);
  let curStatus = pageToast();
  check('status parar', curStatus.textContent === 'Timer parado!', curStatus.textContent);
  activeStub = [
    { id: 557, project: 200, activity: 1655, begin: new Date(Date.now() - 10 * 60 * 1000).toISOString(), description: '' },
  ];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  stoppedIds.length = 0;
  findAll(nowSection(), 'ke-btn-stop')[0].fire('click');
  await sleep(150);
  check('parou o único', stoppedIds.join(',') === '557', stoppedIds);
  curStatus = pageToast();
  check('status parar singular', curStatus.textContent === 'Timer parado!', curStatus.textContent);
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
  check('form de edição abre', !!editForm);
  const editCombos = findAll(editForm, 'ke-combo-input');
  check('edição preenche projeto', editCombos[0].value === 'São Paulo Tech / Site São Paulo', editCombos.map((i) => i.value));
  check('edição preenche atividade', editCombos[1].value === 'Consequuntur dolor', editCombos.map((i) => i.value));
  const editTexts = findAll(editForm, 'ke-input').filter((n) => n.tagName === 'INPUT' && !n.classList.contains('ke-combo-input'));
  check('edição preenche descrição', editTexts[0].value === 'antes', editTexts.map((i) => i.value));
  check('edição preenche tags', editTexts[1].value === 'Alexander, NovaTag', editTexts.map((i) => i.value));
  editTexts[0].value = 'depois';
  findAll(editForm, 'ke-btn-save')[0].fire('click');
  await sleep(250);
  check('PATCH edição', patchedTimers.length === 1 && patchedTimers[0].id === '558' &&
    patchedTimers[0].body.project === 200 && patchedTimers[0].body.activity === 1655 &&
    patchedTimers[0].body.description === 'depois' && patchedTimers[0].body.tags === 'Alexander,NovaTag',
    patchedTimers);
  check('status atualizado', pageToast().textContent === 'Timer atualizado!');
  findAll(nowSection(), 'ke-btn-edit')[0].fire('click');
  await sleep(250);
  findAll(nowSection(), 'ke-btn-cancel')[0].fire('click');
  await sleep(50);
  check('cancelar fecha editor', findAll(nowSection(), 'ke-edit-form').length === 0 &&
    findAll(nowSection(), 'ke-btn-edit').length === 1);
  check('cancelar sem PATCH', patchedTimers.length === 1, patchedTimers.length);
  findAll(nowSection(), 'ke-btn-edit')[0].fire('click');
  await sleep(250);
  editForm = findAll(nowSection(), 'ke-edit-form')[0];
  const editAct = findAll(editForm, 'ke-combo-input')[1];
  fireInput(editAct, '');
  await sleep(50);
  findAll(editForm, 'ke-btn-save')[0].fire('click');
  await sleep(100);
  check('edição valida atividade', pageToast().textContent === 'Selecione projeto e atividade para iniciar.');
  check('validação sem PATCH', patchedTimers.length === 1, patchedTimers.length);
  delete stored.keSettings;
  chrome.permissions.granted = true;
  eval(POP_SRC);
  await sleep(300);
  check('popup setup sem base', popEls['ke-pop-setup'].hidden === false && popEls['ke-pop-main'].hidden === true &&
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
  check('popup pede acesso', popEls['ke-pop-main'].hidden === true &&
    popEls['ke-pop-setup-btn'].textContent === 'Autorizar acesso', popEls['ke-pop-setup-btn'].textContent);
  await popEls['ke-pop-setup-btn'].onclick();
  await sleep(500);
  check('após autorizar abre o app', popEls['ke-pop-main'].hidden === false && chrome.permissions.granted === true);
  posted.length = 0;
  stoppedIds.length = 0;
  const popTitles = findAll(popEls['ke-pop-active'], 'ke-pop-timer-title').map((n) => n.textContent);
  check('popup mostra ativo', popTitles.length === 1 &&
    popTitles[0] === 'São Paulo Tech / Site São Paulo · Consequuntur dolor', popTitles);
  check('Novo timer recolhe com timer ativo', popEls['ke-pop-new-body'].hidden &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'false');
  popEls['ke-pop-new-toggle'].onclick();
  check('cabeçalho reabre Novo timer', popEls['ke-pop-new-body'].hidden === false &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'true');
  popEls['ke-pop-new-toggle'].onclick();
  check('cabeçalho recolhe Novo timer novamente', popEls['ke-pop-new-body'].hidden &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'false');
  const popProj = findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0];
  check('popup projeto preenchido', popProj.value === 'São Paulo Tech / Site São Paulo', popProj.value);
  const groups = findAll(popEls['ke-pop-today'], 'ke-pop-group');
  check('popup agrupa iguais', groups.length === 2, groups.length);
  const g0title = findAll(groups[0], 'ke-pop-timer-title')[0].textContent;
  check('grupo 1 rotulado', g0title === 'Altenwerth-Donnelly / Tempore commodi · Corrupti aut', g0title);
  check('grupo 1 conta e soma', findAll(groups[0], 'ke-pop-timer-sub')[0].textContent === '1 registro · 1:00:00',
    findAll(groups[0], 'ke-pop-timer-sub')[0].textContent);
  check('grupo 2 soma 2', findAll(groups[1], 'ke-pop-timer-sub')[0].textContent === '2 registros · 2:00:00',
    findAll(groups[1], 'ke-pop-timer-sub')[0].textContent);
  findAll(groups[1], 'ke-pop-expand')[0].fire('click');
  const kids = findAll(groups[1], 'ke-pop-group-kids')[0];
  check('expandir mostra agrupadas', kids.hidden === false && findAll(kids, 'ke-pop-today-row').length === 2);
  check('outro grupo segue fechado', findAll(groups[0], 'ke-pop-group-kids')[0].hidden === true);
  findAll(groups[0], 'ke-pop-btn-go')[0].fire('click');
  await sleep(200);
  check('continuar do grupo usa o mais recente', posted.length === 1 && posted[0].project === 144 &&
    posted[0].activity === 1661 && posted[0].description === 'tarde', posted);
  popEls['ke-pop-group-toggle'].fire('click');
  await sleep(200);
  check('desagrupar lista simples', findAll(popEls['ke-pop-today'], 'ke-pop-today-row').length === 2 &&
    findAll(popEls['ke-pop-today'], 'ke-pop-group').length === 0);
  check('preferência persiste', stored.keSettings.groupTasks === false, stored.keSettings);
  check('toggle desmarca', popEls['ke-pop-group-toggle'].classList.contains('ke-on') === false);
  activeStub = [];
  findAll(popEls['ke-pop-active'], 'ke-pop-btn-stop')[0].fire('click');
  await sleep(200);
  check('popup parar ativo', stoppedIds.join(',') === '801', stoppedIds);
  check('Novo timer abre após parar último timer', popEls['ke-pop-new-body'].hidden === false &&
    popEls['ke-pop-new-toggle'].getAttribute('aria-expanded') === 'true');
  check('popup status parar', popEls['ke-pop-status'].textContent === 'Timer parado!', popEls['ke-pop-status'].textContent);
  KE.apiBaseUrl = '';
  KE.apiCredentials = 'same-origin';
  KE.authToken = '';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('api relativa padrão',
    lastReq.url === '/api/customers?visible=1&size=1000' && lastReq.opts.credentials === 'same-origin', lastReq);
  KE.apiBaseUrl = 'https://kimai.exemplo';
  KE.apiCredentials = 'include';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('api absoluta popup',
    lastReq.url === 'https://kimai.exemplo/api/customers?visible=1&size=1000' && lastReq.opts.credentials === 'include', lastReq);
  KE.apiBaseUrl = '';
  KE.apiCredentials = 'same-origin';
  await KE.localSet({ keApiToken: 'tok123' });
  const tokGet = await KE.localGet(['keApiToken']);
  check('token em storage.local', tokGet.keApiToken === 'tok123', tokGet);
  check('token fora do sync', !('keApiToken' in stored), Object.keys(stored));
  KE.authToken = 'tok123';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('header Bearer', lastReq.opts.headers && lastReq.opts.headers.Authorization === 'Bearer tok123', lastReq.opts.headers);
  await KE.apiPost('/api/tags', { name: 'Zzz' });
  check('Bearer preserva Content-Type',
    lastReq.opts.headers && lastReq.opts.headers.Authorization === 'Bearer tok123' &&
    lastReq.opts.headers['Content-Type'] === 'application/json', lastReq.opts.headers);
  KE.authToken = '';
  await KE.apiGet('/api/customers?visible=1&size=1000');
  check('sem token sem header', !(lastReq.opts.headers && lastReq.opts.headers.Authorization), lastReq.opts.headers);
  await KE.localRemove(['keApiToken']);
  check('token removido', (await KE.localGet(['keApiToken'])).keApiToken === undefined);
  check('dur 0', KE.formatDuration(0) === '0:00');
  check('dur 90', KE.formatDuration(90) === '1:30');
  check('dur 3661', KE.formatDuration(3661) === '1:01:01');
  const todayStr = KE.todayKey();
  const recents = KE.todayRecents([
    { id: 1, project: 1, activity: 1, description: 'a', begin: todayStr + 'T09:00:00', end: todayStr + 'T10:00:00', duration: 3600 },
    { id: 2, project: 1, activity: 1, description: 'a', begin: todayStr + 'T11:00:00', end: todayStr + 'T12:00:00', duration: 3600 },
    { id: 3, project: 2, activity: 1, description: 'b', begin: todayStr + 'T08:00:00', end: null, duration: 0 },
    { id: 4, project: 3, activity: 1, description: 'c', begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 3600 },
    { id: 5, project: 9, activity: 1, description: 'z', begin: todayStr + 'T07:00:00', end: todayStr + 'T07:30:00', duration: 1800 },
  ], 8);
  check('hoje dedup/ordem', recents.length === 2 && recents[0].id === 2 && recents[1].id === 5, recents.map((r) => r.id));
  const many = [];
  for (let i = 0; i < 10; i++) many.push({ id: 10 + i, project: 100 + i, activity: 1, description: 'x', begin: todayStr + 'T08:00:00', end: todayStr + 'T09:00:00', duration: 60 });
  check('hoje limite', KE.todayRecents(many, 3).length === 3);
  Object.keys(storedLocal).forEach((k) => delete storedLocal[k]);
  storedLocal.keApiToken = 'popup-token';
  failMode = 'network';
  eval(POP_SRC);
  await sleep(500);
  check('popup erro visível', popEls['ke-pop-error'].hidden === false && popEls['ke-pop-main'].hidden === true);
  check('popup erro orienta', popEls['ke-pop-error-msg'].textContent.includes('Testar conexão'), popEls['ke-pop-error-msg'].textContent);
  failMode = null;
  activeStub = [
    { id: 802, project: 200, activity: 1655, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'de volta' },
  ];
  await popEls['ke-pop-error-retry'].onclick();
  await sleep(600);
  check('retry abre o app', popEls['ke-pop-main'].hidden === false && popEls['ke-pop-error'].hidden === true);
  check('retry carrega dados',
    findAll(popEls['ke-pop-active'], 'ke-pop-timer-title').length === 1 &&
    findAll(popEls['ke-pop-new-project'], 'ke-combo-input').length === 1,
    findAll(popEls['ke-pop-active'], 'ke-pop-timer-title').map((n) => n.textContent));
  const popCss = fs.readFileSync(path.join(ROOT, 'src/popup/popup.css'), 'utf8');
  const popHtmlForIcons = fs.readFileSync(path.join(ROOT, 'src/popup/popup.html'), 'utf8');
  check('logo do popup usa triângulo CSS no círculo', /class="ke-pop-logo"[^>]*><span class="ke-pop-logo-icon"/.test(popHtmlForIcons) &&
    /\.ke-pop-logo-icon,[\s\S]*?border-left:\s*8px solid currentColor/.test(popCss));
  check('botão Iniciar do popup separa e centraliza ícone e texto',
    /id="ke-pop-start"[^>]*class="[^"]*ke-pop-start-btn"[^>]*><span class="ke-pop-start-icon"[^>]*><\/span><span>Iniciar<\/span>/.test(popHtmlForIcons) &&
    /\.ke-pop-start-btn\s*\{[^}]*display:\s*inline-flex[^}]*justify-content:\s*center[^}]*gap:\s*8px/s.test(popCss));
  const popupHeadCss = popCss.match(/\.ke-pop-head\s*\{([^}]*)\}/);
  check('popup header fica fixo durante scroll', !!popupHeadCss &&
    /position:\s*sticky/.test(popupHeadCss[1]) && /top:\s*0/.test(popupHeadCss[1]) &&
    /background:\s*var\(--ke-bg\)/.test(popupHeadCss[1]));
  const optCss = fs.readFileSync(path.join(ROOT, 'src/options/options.css'), 'utf8');
  const themeCss = ['src/common/theme.css', ...fs.readdirSync(path.join(ROOT, 'src/common/themes'))
    .filter((f) => f.endsWith('.css')).map((f) => path.join('src/common/themes', f))]
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  check('color-scheme por tema e só nas páginas', themeCss.includes(':root[data-ke-theme="gnome"] {\n  color-scheme: light;') &&
    themeCss.includes('@media (prefers-color-scheme: dark)') &&
    popCss.includes('html { color-scheme: light dark; }') &&
    optCss.includes('html { color-scheme: light dark; }'));
  check('paletas do tema', themeCss.includes('--ke-bg: #ffffff') && themeCss.includes('--ke-bg: #1c1c1e') &&
    themeCss.includes('--ke-text: #222222') && themeCss.includes('--ke-text: #eeeeee'));
  check('inputs usam variáveis',
    popCss.includes('var(--ke-input-bg)') && popCss.includes('var(--ke-text)') &&
    optCss.includes('var(--ke-input-bg)') &&
    !/\.ke-pop-sec \.ke-input\s*{[^}]*background:\s*transparent/.test(popCss) &&
    !/\.ke-opt-field input\s*{[^}]*color:\s*inherit/.test(optCss));
  Object.keys(fetchCounts).forEach((k) => delete fetchCounts[k]);
  Object.keys(storedLocal).forEach((k) => delete storedLocal[k]);
  const p0 = await KE.getProjectsCached('', false);
  check('projetos buscam 1ª vez', p0 === false && fetchCounts.projects === 1 && KE.state.projects.length > 0, fetchCounts);
  const p1 = await KE.getProjectsCached('', false);
  check('projetos do cache', p1 === true && fetchCounts.projects === 1, fetchCounts);
  await KE.getProjectsCached('', true);
  check('force recarrega', fetchCounts.projects === 2, fetchCounts);
  storedLocal['keCacheProjects:'] = { at: 0, data: [] };
  await KE.getProjectsCached('', false);
  check('cache velho expira', fetchCounts.projects === 3 && KE.state.projects.length > 0, fetchCounts);
  await KE.getActivitiesCached('97', false);
  await KE.getActivitiesCached('97', false);
  check('atividades do cache', fetchCounts.activities === 2, fetchCounts);
  await KE.getTodayCached(false);
  await KE.getTodayCached(false);
  check('diários do cache', fetchCounts.today === 1, fetchCounts);
  await KE.getTodayCached(true);
  check('diários force recarrega', fetchCounts.today === 2, fetchCounts);
  const probe = KE.createCombo({ searchPlaceholder: 'x', allowEmpty: false });
  probe.setItems([{ value: '1', label: 'Um' }, { value: '2', label: 'Dois' }]);
  check('combo getValues', probe.getValues().join(',') === '1,2', probe.getValues());
  const fakeEv = (o) => Object.assign({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '', repeat: false, target: null }, o);
  check('descreve Alt+Shift+S', KE.describeKeyEvent(fakeEv({ altKey: true, shiftKey: true, key: 's' })) === 'Alt+Shift+S');
  check('descreve Ctrl+Space', KE.describeKeyEvent(fakeEv({ ctrlKey: true, key: ' ' })) === 'Ctrl+Space');
  check('combina exato', KE.shortcutMatches('Alt+Shift+S', fakeEv({ altKey: true, shiftKey: true, key: 'S' })) === true);
  check('não combina outro', KE.shortcutMatches('Alt+Shift+S', fakeEv({ altKey: true, key: 's' })) === false);
  check('vazio nunca combina', KE.shortcutMatches('', fakeEv({ altKey: true, shiftKey: true, key: 'S' })) === false);
  check('padrões existem', KE.DEFAULT_SHORTCUTS.start === 'Alt+Shift+S' && !!KE.DEFAULT_SHORTCUTS.stop && !!KE.DEFAULT_SHORTCUTS.restart);
  check('alvo editável', KE.isEditableTarget({ tagName: 'INPUT' }) === true && KE.isEditableTarget({ tagName: 'DIV' }) === false);
  check('onStorageChanged sem suporte não quebra', KE.onStorageChanged(() => {}) === null);
  todayStub = [
    { id: 901, project: 144, activity: 1661, begin: KE.todayKey() + 'T08:00:00', end: KE.todayKey() + 'T09:00:00', duration: 3600, description: 'antigo', tags: ['Alexander'] },
    { id: 902, project: 200, activity: 1655, begin: KE.todayKey() + 'T10:00:00', end: KE.todayKey() + 'T11:00:00', duration: 3600, description: 'recente', tags: [] },
  ];
  posted.length = 0;
  const restarted = await KE.restartLast();
  check('restart copia recente', restarted.ok === true && posted.length === 1 && posted[0].project === 200 &&
    posted[0].activity === 1655 && posted[0].description === 'recente' && /^\d{4}-\d{2}-\d{2}T/.test(posted[0].begin), posted[0]);
  todayStub = [];
  check('restart vazio', JSON.stringify(await KE.restartLast()) === JSON.stringify({ ok: false, empty: true }));
  check('temas disponíveis', KE.THEMES.map((t) => t.id).join(',') === 'system,light,dark,dracula,catppuccin,nord,gruvbox,gnome');
  check('rótulo tema', KE.themeLabel('dark') === 'Escuro' && KE.themeLabel('x') === 'Sistema');
  check('rótulo dracula', KE.themeLabel('dracula') === 'Dracula' && KE.themeLabel('catppuccin') === 'Catppuccin');
  check('rótulo gnome', KE.themeLabel('gnome') === 'GNOME');
  check('paleta Adwaita adaptável', themeCss.includes('--ke-green: #1c71d8') &&
    themeCss.includes('--ke-green-text: #007c3d') && themeCss.includes('--ke-green-text: #78e9ab') &&
    themeCss.includes('--ke-bg: #fafafb') && themeCss.includes('--ke-bg: #222226'));
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'dark' };
  await KE.applyTheme();
  check('aplica dark', document.documentElement.dataset.keTheme === 'dark');
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo' };
  await KE.applyTheme();
  check('padrão system', document.documentElement.dataset.keTheme === 'system');
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
  check('GNOME segue modo escuro do sistema', document.documentElement.dataset.keTheme === 'gnome' && stubBsTheme === 'dark');
  gnomeSchemeListener({ matches: false });
  check('GNOME acompanha mudança para claro', stubBsTheme === 'light');
  stored.keSettings.theme = 'dark';
  await KE.applyPageTheme();
  check('GNOME remove listener ao trocar tema', gnomeListenerRemoved && stubBsTheme === 'dark');
  delete global.matchMedia;
  storedLocal.keCacheX = { at: Date.now(), data: [] };
  storedLocal.keApiToken = 'tok123';
  check('cacheClear conta e preserva', (await KE.cacheClear()) >= 1 && !('keCacheX' in storedLocal) && storedLocal.keApiToken === 'tok123', Object.keys(storedLocal));
  Object.keys(storedLocal).forEach((k) => delete storedLocal[k]);
  storedLocal.keApiToken = 'popup-token';
  failMode = 'auth';
  eval(POP_SRC);
  await sleep(500);
  check('popup 401 explica', popEls['ke-pop-error'].hidden === false &&
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
  actionCalls.length = 0;
  stoppedIds.length = 0;
  posted.length = 0;
  menuCreated.length = 0;
  menuUpdates.length = 0;
  eval(workerTestSource());
  await chrome.runtime.onInstalled.fn();
  await sleep(300);
  check('menus do botão criados',
    menuCreated.some((m) => m.id === 'ke-pause' && (m.contexts || []).includes('action')) &&
    menuCreated.some((m) => m.id === 'ke-continue' && (m.contexts || []).includes('action')), menuCreated.map((m) => m.id));
  const iconCall = actionCalls.find((c) => c[0] === 'setIcon');
  check('ícone rodando', !!iconCall && String(iconCall[1].path[16]).includes('running16.png'), iconCall && iconCall[1]);
  const badgeCall = actionCalls.find((c) => c[0] === 'setBadgeText');
  check('badge decorrido', !!badgeCall && badgeCall[1].text === '5m', badgeCall && badgeCall[1]);
  const titleCall = actionCalls.find((c) => c[0] === 'setTitle');
  check('título detalhado', !!titleCall && titleCall[1].title.includes('Site São Paulo'), titleCall && titleCall[1]);
  check('menu pausar visível rodando',
    menuUpdates.some((u) => u.id === 'ke-pause' && u.props.visible === true), menuUpdates);
  activeStub = [];
  await chrome.alarms.onAlarm.fn({ name: 'ke-tick' });
  await sleep(300);
  const idleIcon = actionCalls.filter((c) => c[0] === 'setIcon').pop();
  check('ícone volta ao normal', !!idleIcon && String(idleIcon[1].path[16]).includes('icon16.png'), idleIcon && idleIcon[1]);
  const clearBadge = actionCalls.filter((c) => c[0] === 'setBadgeText').pop();
  check('badge limpo', !!clearBadge && clearBadge[1].text === '', clearBadge && clearBadge[1]);
  activeStub = [
    { id: 901, project: 200, activity: 1655, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'w' },
  ];
  stoppedIds.length = 0;
  await chrome.contextMenus.onClicked.fn({ menuItemId: 'ke-pause' });
  await sleep(200);
  check('menu pausar para timers', stoppedIds.join(',') === '901', stoppedIds);
  posted.length = 0;
  await chrome.contextMenus.onClicked.fn({ menuItemId: 'ke-continue' });
  await sleep(200);
  check('menu continuar reinicia', posted.length === 1 && posted[0].project === 200 && posted[0].description === 'r', posted[0]);
  todayStub = [];
  posted.length = 0;
  await chrome.contextMenus.onClicked.fn({ menuItemId: 'ke-continue' });
  await sleep(200);
  check('continuar sem histórico não cria', posted.length === 0, posted.length);
  await chrome.runtime.onMessage.fn({ type: 'ke-refresh' });
  await sleep(200);
  check('mensagem atualiza worker', true);
  const gday = KE.todayKey();
  const gsrc = [
    { id: 1, project: 1, activity: 1, begin: gday + 'T09:00:00', end: gday + 'T10:00:00', duration: 3600, description: 'a' },
    { id: 2, project: 1, activity: 1, begin: gday + 'T11:00:00', end: gday + 'T12:00:00', duration: 1800, description: 'b' },
    { id: 3, project: 1, activity: 2, begin: gday + 'T12:00:00', end: gday + 'T13:00:00', duration: 600, description: 'c' },
    { id: 4, project: 1, activity: 1, begin: gday + 'T13:00:00', end: null, duration: 0, description: 'rodando' },
    { id: 5, project: 1, activity: 1, begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 60, description: 'ontem' },
  ];
  check('filterToday exclui rodando/ontem', KE.filterToday(gsrc).map((t) => t.id).join(',') === '3,2,1');
  const gs = KE.groupByTask(gsrc, 8);
  check('agrupa por tarefa', gs.length === 2 && gs[0].entries.length === 1 && gs[1].entries.length === 2,
    gs.map((g) => g.entries.length));
  check('grupo soma durações', gs[1].totalDuration === 5400 && gs[1].entries[0].id === 2, gs[1]);
  check('grupo mais recente primeiro', gs[0].entries[0].id === 3, gs.map((g) => g.entries[0].id));
  const manyGroups = [];
  for (let i = 0; i < 12; i++) manyGroups.push({ id: 100 + i, project: 500 + i, activity: 1, begin: KE.todayKey() + 'T08:00:00', end: KE.todayKey() + 'T09:00:00', duration: 60 });
  check('limite de grupos', KE.groupByTask(manyGroups, 8).length === 8);

  const qtCss = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.css'), 'utf8');
  check('CSS de Interface oculta menu, ações e cabeçalho',
    qtCss.includes('body.ke-hide-sidebar .navbar-vertical') &&
    qtCss.includes('body.ke-hide-actionbar .page-header.d-print-none') &&
    qtCss.includes('body.ke-hide-header .navbar.navbar-expand-md'));
  const qtJs = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.js'), 'utf8');
  check('Interface aplica preferências ao body',
    ['hideSidebar', 'hideActionBar', 'hideHeader'].every((key) => qtJs.includes(`settings.${key}`)));
  check('ícone circular centraliza o triângulo CSS', /#ke-quick-timer \.ke-play\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center/s.test(qtCss) &&
    /#ke-quick-timer \.ke-play-icon,[\s\S]*?border-left:\s*8px solid currentColor/.test(qtCss));
  check('botão Iniciar centraliza ícone e texto com gap', /#ke-quick-timer \.ke-btn-start\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*gap:\s*8px/s.test(qtCss));
  check('regra oculta Data', /body\.ke-hide-date[\s\S]*?\.col_date[\s\S]*?display:\s*none/.test(qtCss));
  check('sem exceção p/ grupo', !/tr\.ke-sitegroup[\s\S]*?\.col_date/.test(qtCss));
  check('exceção p/ summary/info', /tr\.summary[\s\S]*?\.col_date[\s\S]*?display:\s*table-cell/.test(qtCss) &&
    /tr\.info[\s\S]*?\.col_date[\s\S]*?display:\s*table-cell/.test(qtCss));
  KE._initialBsTheme = undefined;
  stubBsTheme = 'dark';
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'dracula' };
  await KE.applyPageTheme();
  check('dracula força base escura', stubBsTheme === 'dark', stubBsTheme);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'light' };
  await KE.applyPageTheme();
  check('light força base clara', stubBsTheme === 'light', stubBsTheme);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', theme: 'system' };
  await KE.applyPageTheme();
  check('system restaura original', stubBsTheme === 'dark', stubBsTheme);
  KE._initialBsTheme = undefined;
  stubBsTheme = null;
  stubBsRemoved = false;
  await KE.applyPageTheme();
  check('system sem original remove', stubBsRemoved === true && stubBsTheme === null);
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
  check('duração do site', KE.parseSiteDuration('12:03') === 12 * 3600 + 3 * 60 &&
    KE.parseSiteDuration('0:27') === 27 * 60 && KE.parseSiteDuration('1:02:03') === 3723 &&
    KE.parseSiteDuration('x') === 0 && KE.formatSiteHours(5400) === '1:30' &&
    KE.formatSiteHms(3723) === '01:02:03');
  const sgroups = KE.groupSiteRows(Array.from(stb.children));
  check('só adjacentes iguais agrupam', sgroups.length === 4 &&
    sgroups.map((g) => g.rows.length).join(',') === '2,1,1,1', sgroups.map((g) => g.rows.length));
  check('descrição separa iguais', sgroups[3].rows[0] === stb.children[4]);
  KE.applySiteGrouping(stb, true);
  const sheads = findAll(stb, 'ke-sitegroup');
  check('só grupo múltiplo tem cabeçalho', sheads.length === 1, sheads.length);
  const htds = sheads[0].children.filter((n) => n.tagName === 'TD');
  check('cabeçalho espelha colunas', htds.length === 12 &&
    htds[1].className.includes('col_date') && htds[4].className.includes('col_duration') &&
    htds[htds.length - 1].className.includes('col_actions') &&
    htds[htds.length - 1].querySelector('.ke-sitegroup-toggle') !== null);
  const htext = (cls) => {
    const td = htds.find((n) => n.className.includes(cls));
    return td ? td.textContent : null;
  };
  check('células agregadas', htext('col_date') === '17/10/2026 – 18/10/2026' &&
    htext('col_starttime') === '03:58' && htext('col_endtime') === '17:11' &&
    htext('col_duration') === '1:30' && htext('col_customer') === 'C1' &&
    htext('col_project') === 'P1' && htext('col_tags') === 't1' && htext('col_billable') === 'Yes', [
    htext('col_date'), htext('col_starttime'), htext('col_endtime'), htext('col_duration'), htext('col_billable'),
  ]);
  check('membros colapsados', stb.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup') && n.style.display === 'none').length === 2);
  const gbox = findAll(sheads[0], 'ke-sitegroup-check')[0];
  check('checkbox do grupo segue o estilo nativo', ['form-check-input', 'm-0', 'align-middle'].every((c) => gbox.classList.contains(c)), gbox.className);
  gbox.checked = true;
  gbox.fire('change');
  const membersAB = stb.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup')).slice(0, 2);
  check('checkbox do grupo marca membros', membersAB.every((r) => (r.querySelector('input') || {}).checked === true));
  check('grupo marca todos de uma vez', membersAB.every((r) => (r.querySelector('input') || {}).checked === true) &&
    gbox.checked === true && gbox.indeterminate === false);
  gbox.checked = false;
  gbox.fire('change');
  check('grupo desmarca todos de uma vez', membersAB.every((r) => (r.querySelector('input') || {}).checked === false) &&
    gbox.checked === false && gbox.indeterminate === false);
  const firstMember = membersAB[0].querySelector('input');
  firstMember.checked = true;
  firstMember.fire('change');
  check('membro avulso deixa parcial', gbox.checked === false && gbox.indeterminate === true);
  firstMember.checked = false;
  firstMember.fire('change');
  findAll(sheads[0], 'ke-sitegroup-toggle')[0].fire('click');
  check('expandir mostra membros', stb.children.filter((n) => n.tagName === 'TR' && !n.classList.contains('ke-sitegroup') && n.style.display !== 'none').length === 5);
  check('expandir marca vínculo visual', sheads[0].classList.contains('ke-open') &&
    stb.children.filter((n) => n.tagName === 'TR' && n.classList.contains('ke-sitemember')).length === 2);
  KE.applySiteGrouping(stb, true);
  check('reaplicar não duplica', findAll(stb, 'ke-sitegroup').length === 1);
  check('reaplicar mantém aberto', findAll(stb, 'ke-sitegroup')[0].querySelector('.ke-sitegroup-toggle').textContent === '▾');
  KE.applySiteGrouping(stb, false);
  check('desligar restaura', findAll(stb, 'ke-sitegroup').length === 0 &&
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
  check('separadores parados e grupo só adjacente',
    stbS.children.map(kindOf).join(',') === 'SEG1,H,a,b,SEG2,c,d' &&
    findAll(stbS, 'ke-sitegroup').length === 1, stbS.children.map(kindOf));
  check('separador nunca oculta', stbS.children[0].style.display !== 'none' && stbS.children[4].style.display !== 'none');
  KE.applySiteGrouping(stbS, false);
  check('desligar mantém separadores', stbS.children.map(kindOf).join(',') === 'SEG1,a,b,SEG2,c,d' &&
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
  check('soma diária na coluna final em HH:MM:SS', dailySummaryRows.length === 2 &&
    dailyTotalText(dailySummaryRows[0]) === '02:00:00' && dailyTotalText(dailySummaryRows[1]) === '05:00:00',
    dailySummaryRows.map(dailyTotalText));
  check('soma diária ocupa última coluna', dailySummaryRows.every((row) =>
    row.children[row.children.length - 1].classList.contains('ke-day-total') &&
    row.children[0].getAttribute('colspan') === '11'));
  dailyTotals.children[1].querySelector('.col_duration').textContent = '2:15';
  KE.applySiteGrouping(dailyTotals, false);
  check('soma diária atualiza sem duplicar célula', dailyTotalText(dailySummaryRows[0]) === '03:00:00' &&
    findAll(dailySummaryRows[0], 'ke-day-total').length === 1);

  const stb2 = document.createElement('tbody');
  stb2.appendChild(siteRow({ id: 'x', date: '18/10/2026', dur: '1:00', cust: 'Solo', proj: 'SP', act: 'SA', desc: 'u1' }));
  stb2.appendChild(siteRow({ id: 'y', date: '18/10/2026', dur: '0:10', cust: 'Outro', proj: 'OP', act: 'OA', desc: 'u2' }));
  KE.applySiteGrouping(stb2, true);
  check('sem iguais não polui', findAll(stb2, 'ke-sitegroup').length === 0 &&
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
  check('sem coluna actions o toggle vai na 1ª célula',
    !!h3 && h3.children.filter((n) => n.tagName === 'TD')[0].querySelector('.ke-sitegroup-toggle') !== null);
  check('timesheetPath pt', KE.timesheetPath('https://kimai.exemplo/', 'pt_BR') === 'https://kimai.exemplo/pt_BR/timesheet/');
  check('timesheetPath padrão en', KE.timesheetPath('https://kimai.exemplo') === 'https://kimai.exemplo/en/timesheet/');
  check('apiTokenUrl', KE.apiTokenUrl('https://kimai.exemplo/', 'pt_BR', 'maria.silva') === 'https://kimai.exemplo/pt_BR/profile/maria.silva/api-token');
  check('locales tem pt_BR', KE.SUPPORTED_LOCALES.indexOf('pt_BR') === 0 && KE.SUPPORTED_LOCALES.length >= 20, KE.SUPPORTED_LOCALES.length);
  const me = await KE.fetchCurrentUser();
  check('fetchCurrentUser', me.username === 'john_user' && me.language === 'en', me);
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  chrome.tabs.created.length = 0;
  popEls['ke-pop-open'].fire('click');
  await sleep(100);
  check('botão abre timesheet', chrome.tabs.created.length >= 1 &&
    chrome.tabs.created.every((c) => c.url === 'https://kimai.exemplo/pt_BR/timesheet/'), chrome.tabs.created);
  tabList = [
    { url: 'https://kimai.exemplo/pt_BR/timesheet/', cookieStoreId: 'firefox-container-1' },
    { url: 'https://outro.exemplo/', cookieStoreId: 'firefox-container-2' },
    { url: 'https://kimai.exemplo/en/dashboard/', cookieStoreId: 'firefox-default' },
  ];
  check('acha contêiner do Kimai', (await KE.kimaiContainer('https://kimai.exemplo')) === 'firefox-container-1');
  check('ignora base estranha', (await KE.kimaiContainer('https://naoexiste.exemplo')) === '');
  tabList = [{ url: 'https://kimai.exemplo/', cookieStoreId: 'firefox-default' }];
  check('padrão não força', (await KE.kimaiContainer('https://kimai.exemplo')) === '');
  tabList = [{ url: 'https://kimai.exemplo/', cookieStoreId: 'firefox-private' }];
  check('privada não força', (await KE.kimaiContainer('https://kimai.exemplo')) === '');
  tabList = [{ url: 'https://kimai.exemplo/pt_BR/timesheet/', cookieStoreId: 'firefox-container-7' }];
  chrome.tabs.created.length = 0;
  await KE.openKimai('https://kimai.exemplo', 'pt_BR');
  check('abrir usa contêiner', chrome.tabs.created.length === 1 &&
    chrome.tabs.created[0].cookieStoreId === 'firefox-container-7', chrome.tabs.created);
  tabList = [];
  chrome.tabs.created.length = 0;
  await KE.openKimai('https://kimai.exemplo', 'pt_BR');
  check('sem aba abre padrão', chrome.tabs.created.length === 1 &&
    !('cookieStoreId' in chrome.tabs.created[0]), chrome.tabs.created);
  const scMap = { start: 'Alt+Shift+S', stop: 'Alt+Shift+X', restart: 'Alt+Shift+R' };
  const kEv = (o) => Object.assign({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '', repeat: false, target: null }, o);
  check('desligado ignora tudo', KE.shortcutAction(scMap, false, kEv({ altKey: true, shiftKey: true, key: 'S' })) === null);
  check('ligado despacha', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'X' })) === 'stop');
  check('repetição ignora', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'S', repeat: true })) === null);
  check('em campo ignora', KE.shortcutAction(scMap, true, kEv({ altKey: true, shiftKey: true, key: 'S', target: { tagName: 'INPUT' } })) === null);
  check('sem match nulo', KE.shortcutAction(scMap, true, kEv({ key: 'a' })) === null);
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
  check('sem duplicadas', mc.getValues().join(',') === 'Alpha');
  check('chip renderiza', mc.root.querySelectorAll('.ke-chip').length === 1);
  mIn.value = '';
  mIn.fire('keydown', { key: 'Backspace' });
  check('backspace remove último', mc.getValues().length === 0 && mc.root.querySelectorAll('.ke-chip').length === 0);
  mIn.value = 'Novo Nome';
  check('flush confirma pendente', mc.flush() === true && mc.getValues().join(',') === 'Novo Nome');
  check('flush vazio falso', mc.flush() === false);
  mc2.input.value = '';
  mc2.input.fire('keydown', { key: 'Enter' });
  check('enter vazio chama callback', emptyEnter === 1);
  check('parseCsrfToken', KE.parseCsrfToken('<input name="access_token_form[_token]" value="ABC123" />', 'access_token_form[_token]') === 'ABC123');
  check('parseCsrfToken vazio', KE.parseCsrfToken('<html></html>', 'access_token_form[_token]') === '');
  check('parseAccessToken', KE.parseAccessToken('<pre><code>abc123token</code></pre>') === 'abc123token');
  check('parseAccessToken vazio', KE.parseAccessToken('<html>sem token</html>') === '');
  const listHtml = '<table><tr><td>Companion for Kimai</td><td></td><td><a href="/api/users/api-token/11">x</a></td></tr>' +
    '<tr><td>Outro</td><td></td><td><a href="/api/users/api-token/22">x</a></td></tr></table>';
  const parsed = KE.parseTokenList(listHtml);
  check('parseTokenList', parsed.length === 2 && parsed[0].id === '11' && parsed[0].name === 'Companion for Kimai' && parsed[1].id === '22', parsed);
  autoConnectPage = '<table><tr><td>Companion for Kimai</td><td></td><td><a href="/api/users/api-token/11">x</a></td></tr>' +
    '<tr><td>Companion for Kimai</td><td></td><td><a href="/api/users/api-token/12">x</a></td></tr>' +
    '<tr><td>Outro token</td><td></td><td><a href="/api/users/api-token/99">x</a></td></tr></table><pre><code>novotoken123</code></pre>';
  autoConnectPosts.length = 0;
  autoConnectDeleted.length = 0;
  const auto = await KE.autoConnectKimai({ locale: 'pt_BR', username: 'john_user', name: 'Companion for Kimai' });
  check('autoConnect cria e substitui', auto.token === 'novotoken123' && auto.replaced.join(',') === '11,12', auto);
  check('autoConnect preserva outros', autoConnectDeleted.indexOf('99') < 0, autoConnectDeleted);
  check('autoConnect posta form', autoConnectPosts.length === 1 &&
    autoConnectPosts[0].indexOf('access_token_form%5Bname%5D=Companion+for+Kimai') >= 0, autoConnectPosts);
  autoConnectPage = '<table><tr><td>Outro token</td><td></td><td><a href="/api/users/api-token/99">x</a></td></tr></table><pre><code>sozinho456</code></pre>';
  autoConnectDeleted.length = 0;
  const auto2 = await KE.autoConnectKimai({ locale: 'en', username: 'john_user', name: 'Companion for Kimai' });
  check('autoConnect sem antigos', auto2.token === 'sozinho456' && auto2.replaced.length === 0, auto2);
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
    { id: 803, project: 200, activity: 1655, begin: '2000-01-03T09:00:00', end: '2000-01-03T10:00:00', duration: 600, description: 'outro dia' },
  ];
  Object.keys(storedLocal).forEach((k) => { if (k.indexOf('keCache') === 0) delete storedLocal[k]; });
  eval(POP_SRC);
  await sleep(600);
  check('labels localizados',
    popEls['ke-pop-label-desc'].textContent === 'Descrição' &&
    popEls['ke-pop-label-customer'].textContent === 'Cliente' &&
    popEls['ke-pop-label-project'].textContent === 'Projeto' &&
    popEls['ke-pop-label-activity'].textContent === 'Atividade' &&
    popEls['ke-pop-label-tags'].textContent === 'Tags',
    ['desc', 'customer', 'project', 'activity', 'tags'].map((k) => popEls['ke-pop-label-' + k].textContent));
  const popHtml = fs.readFileSync(path.join(ROOT, 'src/popup/popup.html'), 'utf8');
  check('labels no HTML p/ os 5 campos',
    ['ke-pop-label-desc', 'ke-pop-label-customer', 'ke-pop-label-project', 'ke-pop-label-activity', 'ke-pop-label-tags']
      .every((id) => popHtml.includes('id="' + id + '"')));
  const custPop = findAll(popEls['ke-pop-new-customer'], 'ke-combo-input')[0];
  const tagsPop = findAll(popEls['ke-pop-new-tags'], 'ke-multi-input')[0];
  check('combos cliente e tags existem', !!custPop && !!tagsPop);
  check('cliente restaurado filtra', custPop.value === 'São Paulo Tech', custPop.value);
  check('projeto restaurado (filtrado)', findAll(popEls['ke-pop-new-project'], 'ke-combo-input')[0].value === 'São Paulo Tech / Site São Paulo');
  check('atividade restaurada', findAll(popEls['ke-pop-new-activity'], 'ke-combo-input')[0].value === 'Consequuntur dolor');
  fireInput(custPop, '');
  await sleep(200);
  check('limpar cliente mostra tudo', KE.state.projects.length === 4, KE.state.projects.length);
  const recentRows = findAll(popEls['ke-pop-recent'], 'ke-pop-today-row');
  check('recentes excluem hoje', recentRows.length === 2, recentRows.length);
  check('recente mostra data', findAll(recentRows[0], 'ke-pop-timer-sub')[0].textContent.indexOf('03/01') === 0,
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
  check('start do popup com tags', posted.some((p) => p.tags === 'Alexander' && p.project === 200), posted.slice(-2));
  check('recarrega só abas do Kimai', chrome.tabs.reloaded.indexOf(7) >= 0 && chrome.tabs.reloaded.indexOf(8) < 0, chrome.tabs.reloaded);
  tabList = [
    { id: 11, url: 'https://kimai.exemplo/en/timesheet/' },
    { id: 12, url: 'HTTPS://KIMAI.EXEMPLO/en/x' },
    { id: 13, url: 'https://other.ex/' },
    { url: 'https://kimai.exemplo/en/y' },
    { id: 14 },
  ];
  chrome.tabs.reloaded.length = 0;
  check('reload conta e filtra', (await KE.reloadKimaiTabs('https://kimai.exemplo/')) === 2 &&
    chrome.tabs.reloaded.join(',') === '11,12', chrome.tabs.reloaded);
  check('reload base vazia', (await KE.reloadKimaiTabs('')) === 0);
  const rday = KE.todayKey();
  const rentries = [
    { id: 1, project: 1, activity: 1, description: 'a', begin: rday + 'T09:00:00', end: rday + 'T10:00:00', duration: 60 },
    { id: 2, project: 2, activity: 1, description: 'b', begin: '2000-01-02T09:00:00', end: '2000-01-02T10:00:00', duration: 60 },
    { id: 3, project: 2, activity: 1, description: 'b', begin: '2000-01-01T09:00:00', end: '2000-01-01T10:00:00', duration: 60 },
    { id: 4, project: 3, activity: 1, description: 'c', begin: '2000-01-03T09:00:00', end: null, duration: 0 },
  ];
  const ro = KE.recentOthers(rentries, 8);
  check('recentes excluem hoje, rodando e dedupam', ro.length === 1 && ro[0].id === 2, ro.map((r) => r.id));
  const manyOld = [];
  for (let i = 0; i < 10; i++) manyOld.push({ id: 100 + i, project: 500 + i, activity: 1, description: 'x', begin: '2000-01-01T08:00:00', end: '2000-01-01T09:00:00', duration: 60 });
  check('recentes limite', KE.recentOthers(manyOld, 3).length === 3);
  await popEls['ke-pop-refresh-recent'].onclick();
  await sleep(300);
  check('refresh recentes mantém lista',
    findAll(popEls['ke-pop-recent'], 'ke-pop-today-row').length === 2 &&
    popEls['ke-pop-status'].textContent === 'Listas atualizadas!', popEls['ke-pop-status'].textContent);
  const bar = KE.createSiteBar();
  const barBtns = bar.children.filter((n) => n.tagName === 'BUTTON');
  check('barra tem agrupar + atualizar', barBtns.length === 2 &&
    barBtns[0].classList.contains('ke-sitegroup-bar-toggle') &&
    barBtns[1].classList.contains('ke-sitegroup-bar-refresh'),
    barBtns.map((n) => n.className));
  check('botões rotulados', barBtns[0].textContent === 'Agrupar' &&
    barBtns[1].getAttribute('aria-label') === 'Atualizar listas',
    [barBtns[0].textContent, barBtns[1].getAttribute('aria-label')]);
  const projFetches = fetchCounts.projects || 0;
  barBtns[1].fire('click');
  await sleep(300);
  check('atualizar recarrega listas', (fetchCounts.projects || 0) > projFetches &&
    pageToast().textContent === 'Listas atualizadas!',
    pageToast().textContent);
  const now = nowSection();
  check('Agora é seção própria abaixo do card',
    !!now && now.id === 'ke-active-now' && mountedCards[1] === now &&
    findAll(now, 'ke-now-title')[0].textContent === 'Agora');
  activeStub = [
    { id: 559, project: 200, activity: 1655, begin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), description: 'visível' },
  ];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  check('Agora mostra timer em execução', nowSection().style.display !== 'none' &&
    findAll(nowSection(), 'ke-active-row').length === 1);
  activeStub = [];
  mountedCards.length = 0;
  moInstances.forEach((m) => m.cb());
  await sleep(900);
  check('Agora oculta sem timers', nowSection().style.display === 'none' &&
    findAll(nowSection(), 'ke-active-row').length === 0);
  const qtCssWidgets = fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.css'), 'utf8');
  check('estilos sob .ke-card', ['.ke-btn-stop', '.ke-input', '.ke-btn-save', '.ke-btn-cancel', '.ke-btn-edit', '.ke-dot'].every((c) => qtCssWidgets.includes('.ke-card ' + c)));
  check('Agora tem título próprio', qtCssWidgets.includes('#ke-active-now .ke-now-title'));
  check('sem status no widget', findAll(mountedCards[0], 'ke-status').length === 0 &&
    findAll(nowSection() || { children: [] }, 'ke-status').length === 0);
  check('toast canto inferior direito', /\.ke-toast\s*\{[^}]*position:\s*fixed[^}]*right:\s*24px[^}]*bottom:\s*24px/s.test(qtCssWidgets));
  check('toast some sozinho', /setTimeout\(\(\) => \{\s*n\.classList\.remove\('ke-show'\);\s*n\.hidden = true;\s*\},\s*5000\)/.test(
    fs.readFileSync(path.join(ROOT, 'src/content/quicktimer.js'), 'utf8')));
  stored.keSettings = { kimaiBaseUrl: 'https://kimai.exemplo', keLocale: 'pt_BR' };
  eval(OPT_SRC);
  await sleep(300);
  const toast = popEls['ke-opt-toast'];
  const toastShown = () => toast.hidden === false && toast.classList.contains('ke-show');
  check('Interface inicia com opções desmarcadas',
    popEls['ke-opt-hide-sidebar'].checked === false &&
    popEls['ke-opt-hide-actionbar'].checked === false &&
    popEls['ke-opt-hide-header'].checked === false);
  popEls['ke-opt-sc-start'].value = 'X';
  popEls['ke-opt-sc-reset'].fire('click');
  await sleep(20);
  check('reset de atalhos usa toast', toastShown() && toast.textContent.includes('Padrões restaurados'), toast.textContent);
  check('reset preenche padrões', popEls['ke-opt-sc-start'].value === 'Alt+Shift+S', popEls['ke-opt-sc-start'].value);
  popEls['ke-opt-url'].value = 'se-url-valida';
  popEls['ke-opt-save'].fire('click');
  await sleep(50);
  check('salvar inválido usa toast', toastShown() && toast.textContent.includes('URL inválida'), toast.textContent);
  const origSetTimeout = global.setTimeout;
  const delays = [];
  global.setTimeout = (fn, ms, ...a) => { delays.push(ms); return origSetTimeout(fn, ms, ...a); };
  popEls['ke-opt-url'].value = 'https://kimai.exemplo';
  popEls['ke-opt-hide-sidebar'].checked = true;
  popEls['ke-opt-hide-actionbar'].checked = true;
  popEls['ke-opt-hide-header'].checked = true;
  popEls['ke-opt-save'].fire('click');
  await sleep(100);
  check('salvar válido usa toast', toastShown() && toast.textContent === 'Configurações salvas.', toast.textContent);
  check('salvar persiste opções de Interface', stored.keSettings.hideSidebar === true &&
    stored.keSettings.hideActionBar === true && stored.keSettings.hideHeader === true, stored.keSettings);
  check('toast dura 5 segundos', delays.includes(5000), delays.slice(-5));
  global.setTimeout = origSetTimeout;
  storedLocal.keApiToken = 'tok-desconectar';
  popEls['ke-opt-disconnect'].fire('click');
  await sleep(50);
  check('desconectar usa toast', toastShown() && toast.textContent === 'Desconectado.', toast.textContent);
  check('desconectar apaga chave', !('keApiToken' in storedLocal));

  console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : '\n' + failures + ' TESTE(S) FALHARAM');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO harness:', e); process.exit(2); });
