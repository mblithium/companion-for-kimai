/* Interface language: detection, locale file loading and string lookup.
 *
 * Translated strings live in _locales/<lang>/messages.json (one flat file
 * per language, shared with translators and the web stores). This module
 * fetches the file for the selected language, converts it to the nested
 * KE.T shape (ui_* keys nest under ui, $PLACEHOLDER$ becomes
 * {{placeholder}}) and serves it through KE.uiText/KE.translatePage.
 * Missing keys always resolve from English.
 */
(function () {
  'use strict';

  KE.DEFAULT_LOCALE = 'en';

  // _locales directory for a language code (pt ships as pt_BR).
  KE.localeDir = function (language) {
    return language === 'pt' ? 'pt_BR' : language;
  };

  KE.detectLang = function () {
    let h = '';
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        h = document.documentElement.getAttribute('lang') || '';
      }
    } catch (e) { h = ''; }
    if (!h) {
      try {
        h = (typeof navigator !== 'undefined' && navigator.language) || '';
      } catch (e) { h = ''; }
    }
    h = String(h || 'en').toLowerCase();
    if (h.startsWith('pt')) return 'pt';
    if (h.startsWith('fr')) return 'fr';
    if (h.startsWith('ro')) return 'ro';
    return 'en';
  };

  // Fetch a flat messages.json table. Returns null when unavailable so
  // callers can fall back to English.
  KE.fetchLocaleTable = async function (lang) {
    try {
      const url = KE.ext().runtime.getURL('_locales/' + lang + '/messages.json');
      const res = await fetch(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data && typeof data === 'object' ? data : null;
    } catch (e) {
      return null;
    }
  };

  // Convert a flat messages.json table to the nested KE.T shape.
  KE.nestLocaleTable = function (table) {
    const out = {};
    Object.keys(table || {}).forEach((name) => {
      const entry = table[name];
      if (!entry || entry.message == null) return;
      const message = String(entry.message).replace(/\$([A-Za-z0-9_]+)\$/g, (m, varName) => '{{' + varName.toLowerCase() + '}}');
      if (name.startsWith('ui_')) {
        out.ui = out.ui || {};
        out.ui[name.slice(3)] = message;
      } else {
        out[name] = message;
      }
    });
    return out;
  };

  // Load the nested string table for a language with English baked in as
  // fallback for every missing key.
  KE.loadStrings = async function (language) {
    const dir = KE.localeDir(language);
    const [enTable, langTable] = await Promise.all([
      KE.fetchLocaleTable('en'),
      dir === 'en' ? null : KE.fetchLocaleTable(dir),
    ]);
    const base = KE.nestLocaleTable(enTable);
    const over = KE.nestLocaleTable(langTable);
    const merged = Object.assign({}, base);
    Object.keys(over).forEach((key) => {
      if (key === 'ui' && base.ui) merged.ui = Object.assign({}, base.ui, over.ui);
      else merged[key] = over[key];
    });
    return merged;
  };

  KE.T = {};

  KE.setLocale = async function (locale) {
    const h = String(locale || '').toLowerCase();
    const language = h.startsWith('pt') ? 'pt' : h.startsWith('fr') ? 'fr' : h.startsWith('ro') ? 'ro' : 'en';
    KE.uiLocale = language === 'pt' ? 'pt-BR' : language;
    KE.T = await KE.loadStrings(language);
    try {
      if (document.documentElement && /^(?:chrome-extension|moz-extension):$/.test(location.protocol)) {
        document.documentElement.lang = KE.uiLocale;
      }
    } catch (e) {}
    return KE.uiLocale;
  };

  KE.applyLocale = async function () {
    let locale = '';
    try {
      const settings = await KE.storageGet(['keSettings']);
      locale = settings && settings.keSettings && settings.keSettings.uiLocale;
    } catch (e) {}
    return KE.setLocale(locale || KE.detectLang());
  };

  KE.uiText = function (key, values) {
    const text = String(key || '').split('.').reduce((value, part) => value && value[part], KE.T);
    return String(text == null ? key : text).replace(/\{\{(\w+)\}\}/g, (_match, name) =>
      values && values[name] != null ? String(values[name]) : '');
  };

  KE.translatePage = function (root) {
    const scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-ke-i18n]').forEach((node) => {
      node.textContent = KE.uiText(node.dataset.keI18n);
    });
    scope.querySelectorAll('[data-ke-i18n-placeholder]').forEach((node) => {
      node.placeholder = KE.uiText(node.dataset.keI18nPlaceholder);
    });
    scope.querySelectorAll('[data-ke-i18n-title]').forEach((node) => {
      node.title = KE.uiText(node.dataset.keI18nTitle);
    });
    scope.querySelectorAll('[data-ke-i18n-aria-label]').forEach((node) => {
      node.setAttribute('aria-label', KE.uiText(node.dataset.keI18nAriaLabel));
    });
  };
})();
