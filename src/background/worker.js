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
        title: KE.uiText('ui.workerRunningTitle', {
          task: KE.describeProjectRef(first.project),
          elapsed: KE.elapsedSince(first.begin),
        }),
      });
    } catch (e) {}
  }

  async function setIdle() {
    try {
      await ext().action.setIcon({ path: ICONS.idle });
      await ext().action.setBadgeText({ text: '' });
      await ext().action.setTitle({ title: KE.uiText('ui.workerIdleTitle') });
    } catch (e) {}
  }

  async function refreshState() {
    try {
      const settings = await KE.getSettings();
      if (settings.uiLocale) KE.setLocale(settings.uiLocale);
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

  function scheduleTick() {
    try {
      ext().alarms.create('ke-tick', { periodInMinutes: 1 });
    } catch (e) {}
  }

  try {
    ext().runtime.onInstalled.addListener(() => {
      scheduleTick();
      refreshState();
    });
    ext().runtime.onStartup.addListener(() => {
      scheduleTick();
      refreshState();
    });
    ext().alarms.onAlarm.addListener((alarm) => {
      if (alarm && alarm.name === 'ke-tick') refreshState();
    });
    ext().runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'ke-refresh') refreshState();
    });
    KE.onStorageChanged((changes, areaName) => {
      if (areaName && areaName !== 'sync') return;
      if (changes && !('keSettings' in changes)) return;
      refreshState();
    });
  } catch (e) {}
})();
