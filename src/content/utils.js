/* Shared utility functions. */
(function () {
  'use strict';

  KE.isTimesheetListPage = function () {
    const p = location.pathname || '';
    if (!/timesheet/i.test(p)) return false;
    if (/\/(create|edit|export|favorite)/i.test(p)) return false;
    return true;
  };

  KE.asArray = function (payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
  };

  KE.pad = function (n) { return String(n).padStart(2, '0'); };

  KE.nowLocal = function () {
    const d = new Date();
    return d.getFullYear() + '-' + KE.pad(d.getMonth() + 1) + '-' + KE.pad(d.getDate()) +
      'T' + KE.pad(d.getHours()) + ':' + KE.pad(d.getMinutes()) + ':' + KE.pad(d.getSeconds());
  };

  KE.elapsedSince = function (beginStr, nowMs) {
    const t = new Date(beginStr).getTime();
    if (Number.isNaN(t)) return '0:00';
    let s = Math.max(0, Math.floor(((nowMs || Date.now()) - t) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    if (h > 0) return h + ':' + KE.pad(m) + ':' + KE.pad(s);
    return m + ':' + KE.pad(s);
  };
  KE.norm = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  KE.el = function (tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  KE.sleep = function (ms) { return new Promise((r) => setTimeout(r, ms)); };
  KE.DEFAULT_SHORTCUTS = { start: 'Alt+Shift+S', stop: 'Alt+Shift+X', restart: 'Alt+Shift+R' };

  KE.describeKeyEvent = function (ev) {
    const mods = [];
    if (ev.ctrlKey) mods.push('Ctrl');
    if (ev.altKey) mods.push('Alt');
    if (ev.shiftKey) mods.push('Shift');
    if (ev.metaKey) mods.push('Meta');
    let key = ev.key || '';
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    mods.push(key);
    return mods.join('+');
  };

  KE.shortcutMatches = function (stored, ev) {
    return !!stored && KE.describeKeyEvent(ev) === stored;
  };
  KE.shortcutAction = function (map, enabled, ev) {
    if (!enabled || !ev || ev.repeat || ev.defaultPrevented) return null;
    if (KE.isEditableTarget(ev.target)) return null;
    map = map || {};
    if (KE.shortcutMatches(map.start, ev)) return 'start';
    if (KE.shortcutMatches(map.stop, ev)) return 'stop';
    if (KE.shortcutMatches(map.restart, ev)) return 'restart';
    return null;
  };

  KE.isEditableTarget = function (t) {
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || !!t.isContentEditable);
  };

  KE.nRecords = function (n) {
    return n + ' ' + (n === 1 ? KE.T.recordOne : KE.T.recordMany);
  };
  KE.tagNames = function (tags) {
    return (tags || []).map((t) => {
      if (typeof t === 'string') return t;
      if (t && typeof t === 'object') return t.name || t.tag || '';
      return '';
    }).filter(Boolean);
  };
  KE.entityId = function (ref) {
    if (ref == null) return '';
    if (typeof ref === 'object') {
      if (ref.id != null) return String(ref.id);
      return '';
    }
    const s = String(ref);
    const m = s.match(/(\d+)\s*$/);
    return m ? m[1] : s;
  };
  KE.notifyBackground = function () {
    try {
      const rt = KE.ext().runtime;
      if (rt && rt.sendMessage) {
        const p = rt.sendMessage({ type: 'ke-refresh' });
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) {}
  };
  KE.notifyKimaiUpdate = function () {
    ['kimai.timesheetUpdate', 'kimai.timesheetStop', 'kimai.timesheetCreate'].forEach((name) => {
      try { document.dispatchEvent(new CustomEvent(name, { bubbles: true })); } catch (e) {}
    });
  };
})();
