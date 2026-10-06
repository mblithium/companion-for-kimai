/* Browser permissions and tab utilities. */
(function () {
  'use strict';

  KE.ext = function () {
    try {
      if (typeof browser !== 'undefined' && browser.runtime) return browser;
    } catch (e) {}
    return chrome;
  };

  KE.originOf = function (baseUrl) {
    try { return new URL(baseUrl).origin; } catch (e) { return ''; }
  };

  KE.normalizeBaseUrl = function (raw) {
    const value = String(raw || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(value)) return '';
    return value;
  };

  KE.timesheetPath = function (baseUrl, locale) {
    return String(baseUrl || '').replace(/\/+$/, '') + '/' + (locale || 'en') + '/timesheet/';
  };

  KE.apiTokenUrl = function (baseUrl, locale, username) {
    return String(baseUrl || '').replace(/\/+$/, '') + '/' + (locale || 'en') +
      '/profile/' + encodeURIComponent(username || '') + '/api-token';
  };

  KE.SUPPORTED_LOCALES = [
    'pt_BR', 'pt', 'en', 'es', 'fr', 'de', 'it', 'nl', 'ca', 'cs',
    'da', 'el', 'fi', 'he', 'hr', 'hu', 'id', 'ja', 'ko', 'nb_NO',
    'pl', 'ro', 'ru', 'sv',
  ];

  KE.openKimai = async function (baseUrl, locale) {
    const url = KE.timesheetPath(baseUrl, locale);
    try {
      const tabs = KE.ext().tabs;
      if (tabs && typeof tabs.create === 'function') {
        const properties = { url };
        try {
          const storeId = await KE.kimaiContainer(baseUrl);
          if (storeId) properties.cookieStoreId = storeId;
        } catch (e) {}
        await tabs.create(properties);
        return;
      }
    } catch (e) {}
    try { window.open(url, '_blank'); } catch (e) {}
  };

  KE.kimaiContainer = async function (baseUrl) {
    try {
      const tabs = KE.ext().tabs;
      if (!tabs || typeof tabs.query !== 'function') return '';
      const base = String(baseUrl || '').replace(/\/+$/, '').toLowerCase();
      if (!base) return '';
      const openTabs = await tabs.query({});
      const match = (openTabs || []).find((tab) =>
        tab && typeof tab.url === 'string' &&
        tab.url.toLowerCase().indexOf(base + '/') === 0 &&
        tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default' &&
        tab.cookieStoreId !== 'firefox-private');
      return match ? match.cookieStoreId : '';
    } catch (e) {
      return '';
    }
  };

  KE.hasOriginAccess = async function (baseUrl) {
    const origin = KE.originOf(baseUrl);
    if (!origin) return false;
    try {
      return await KE.ext().permissions.contains({ origins: [origin + '/*'] });
    } catch (e) {
      return false;
    }
  };

  KE.requestOriginAccess = async function (baseUrl) {
    const origin = KE.originOf(baseUrl);
    if (!origin) return false;
    try {
      return await KE.ext().permissions.request({ origins: [origin + '/*'] });
    } catch (e) {
      return false;
    }
  };

  KE.removeOriginAccess = async function (baseUrl) {
    const origin = KE.originOf(baseUrl);
    if (!origin) return false;
    try {
      return await KE.ext().permissions.remove({ origins: [origin + '/*'] });
    } catch (e) {
      return false;
    }
  };

  KE.reloadKimaiTabs = async function (baseUrl) {
    const origin = KE.originOf(baseUrl);
    if (!origin) return 0;
    try {
      const tabsApi = KE.ext().tabs;
      if (!tabsApi || typeof tabsApi.query !== 'function' || typeof tabsApi.reload !== 'function') return 0;
      const openTabs = await tabsApi.query({});
      const matches = (openTabs || []).filter((tab) =>
        tab && typeof tab.url === 'string' &&
        tab.url.toLowerCase().indexOf(origin.toLowerCase() + '/') === 0 &&
        Number.isInteger(tab.id));
      await Promise.all(matches.map(async (tab) => {
        try { await tabsApi.reload(tab.id); } catch (e) {}
      }));
      return matches.length;
    } catch (e) {
      return 0;
    }
  };

  KE.openOptions = function () {
    try { KE.ext().runtime.openOptionsPage(); } catch (e) {}
  };

  KE.getSettings = async function () {
    const settings = await KE.storageGet(['keSettings']);
    return (settings && settings.keSettings) || {};
  };

  KE.saveSettings = async function (patch) {
    const current = await KE.getSettings();
    await KE.storageSet({ keSettings: Object.assign({}, current, patch) });
    return KE.getSettings();
  };
})();
