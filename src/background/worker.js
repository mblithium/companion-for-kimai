/* Background worker. */
importScripts(
  '../content/namespace.js',
  '../content/i18n.js',
  '../content/utils.js',
  '../content/api.js',
  '../content/storage.js',
  '../content/kimai.js',
  '../content/cache.js',
  '../common/format.js',
  '../common/permissions.js'
);

(function () {
  'use strict';

  const ext = () => KE.ext();
  const ICONS = {
    idle: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
    running: { 16: 'icons/running16.png', 32: 'icons/running32.png', 48: 'icons/running48.png', 128: 'icons/running128.png' },
  };

  try {
    const uiLang = (ext().i18n && ext().i18n.getUILanguage) ? ext().i18n.getUILanguage() : '';
    KE.T = KE.STRINGS[String(uiLang || '').toLowerCase().startsWith('en') ? 'en' : 'pt'];
  } catch (e) {}

  async function withApi() {
    const s = await KE.storageGet(['keSettings']);
    const settings = (s && s.keSettings) || {};
    const base = KE.normalizeBaseUrl(settings.kimaiBaseUrl || '');
    if (!base) return false;
    const t = await KE.localGet(['keApiToken']);
    const token = (t && t.keApiToken) || '';
    if (!token) return false;
    if (!(await KE.hasOriginAccess(base))) return false;
    KE.apiBaseUrl = base;
    KE.authToken = token;
    KE.apiCredentials = 'omit';
    return true;
  }

  function oldestFirst(active) {
    return (active || []).slice().sort((a, b) => String(a.begin || '').localeCompare(String(b.begin || '')));
  }

  async function setRunning(active) {
    const first = oldestFirst(active)[0];
    try {
      await ext().action.setIcon({ path: ICONS.running });
      await ext().action.setBadgeText({ text: KE.shortElapsed(first && first.begin) });
      await ext().action.setBadgeBackgroundColor({ color: '#2fb344' });
      await ext().action.setTitle({
        title: 'Companion for Kimai — rodando: ' + KE.describeProjectRef(first.project) +
          ' (' + KE.elapsedSince(first.begin) + ')',
      });
    } catch (e) {}
    await updateMenus(true);
  }

  async function setIdle() {
    try {
      await ext().action.setIcon({ path: ICONS.idle });
      await ext().action.setBadgeText({ text: '' });
      await ext().action.setTitle({ title: 'Companion for Kimai' });
    } catch (e) {}
    await updateMenus(false);
  }

  async function updateMenus(running) {
    try {
      await ext().contextMenus.update('ke-pause', { visible: running });
      await ext().contextMenus.update('ke-continue', { visible: !running });
    } catch (e) {}
  }

  function safeCreate(props) {
    try {
      const r = ext().contextMenus.create(props);
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (e) {}
  }

  function setupMenus() {
    const createBoth = () => {
      safeCreate({ id: 'ke-pause', title: '⏸ Pausar timer', contexts: ['action'], visible: false });
      safeCreate({ id: 'ke-continue', title: '▶ Continuar timer', contexts: ['action'], visible: false });
    };
    try {
      const p = ext().contextMenus.removeAll();
      if (p && typeof p.then === 'function') p.then(createBoth, createBoth);
      else createBoth();
    } catch (e) {
      createBoth();
    }
  }

  async function refreshState() {
    try {
      if (!(await withApi())) {
        await setIdle();
        return;
      }
      try {
        await KE.getProjectsCached('', false);
      } catch (e) {}
      const active = await KE.fetchActiveTimesheets();
      if (active.length) await setRunning(active);
      else await setIdle();
    } catch (e) {}
  }

  async function pauseAll() {
    try {
      if (!(await withApi())) return;
      const active = await KE.fetchActiveTimesheets();
      for (const t of active) {
        try {
          await KE.apiPatch('/api/timesheets/' + encodeURIComponent(t.id) + '/stop');
        } catch (e) {}
      }
    } catch (e) {}
    await refreshState();
  }

  async function continueLast() {
    try {
      if (!(await withApi())) return;
      await KE.restartLast();
    } catch (e) {}
    await refreshState();
  }

  function scheduleTick() {
    try {
      ext().alarms.create('ke-tick', { periodInMinutes: 1 });
    } catch (e) {}
  }

  try {
    ext().runtime.onInstalled.addListener(() => {
      setupMenus();
      scheduleTick();
      refreshState();
    });
    ext().runtime.onStartup.addListener(() => {
      setupMenus();
      scheduleTick();
      refreshState();
    });
    ext().alarms.onAlarm.addListener((alarm) => {
      if (alarm && alarm.name === 'ke-tick') refreshState();
    });
    ext().contextMenus.onClicked.addListener((info) => {
      if (!info) return;
      if (info.menuItemId === 'ke-pause') pauseAll();
      else if (info.menuItemId === 'ke-continue') continueLast();
    });
    ext().runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'ke-refresh') refreshState();
    });
  } catch (e) {}
})();
