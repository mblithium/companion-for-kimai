/* Date and timesheet formatting utilities. */
(function () {
  'use strict';
  KE.formatDuration = function (totalSeconds) {
    let s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
    return m + ':' + pad(s);
  };
  KE.todayKey = function (now) {
    const d = now || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  KE.beginDayKey = function (beginStr) {
    return String(beginStr || '').slice(0, 10);
  };
  KE.shortElapsed = function (beginStr, nowMs) {
    const t = new Date(beginStr).getTime();
    if (Number.isNaN(t)) return '•';
    const mins = Math.max(0, Math.floor(((nowMs || Date.now()) - t) / 60000));
    if (mins < 60) return mins + 'm';
    return Math.floor(mins / 60) + 'h';
  };
  KE.filterToday = function (entries) {
    const today = KE.todayKey();
    return (entries || [])
      .filter((t) => t && KE.beginDayKey(t.begin) === today && t.end !== null)
      .slice()
      .sort((a, b) => String(b.begin || '').localeCompare(String(a.begin || '')));
  };
  KE.todayRecents = function (entries, limit) {
    const list = KE.filterToday(entries);
    const seen = new Set();
    const out = [];
    for (const t of list) {
      const key = KE.entityId(t.project) + '|' + KE.entityId(t.activity) + '|' + String(t.description || '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= (limit || 8)) break;
    }
    return out;
  };
  KE.recentOthers = function (entries, limit) {
    const today = KE.todayKey();
    const list = (entries || [])
      .filter((t) => t && KE.beginDayKey(t.begin) !== today && t.end !== null)
      .slice()
      .sort((a, b) => String(b.begin || '').localeCompare(String(a.begin || '')));
    const seen = new Set();
    const out = [];
    for (const t of list) {
      const key = KE.entityId(t.project) + '|' + KE.entityId(t.activity) + '|' + String(t.description || '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= (limit || 8)) break;
    }
    return out;
  };
  KE.groupByTask = function (entries, maxGroups) {
    const map = new Map();
    const order = [];
    for (const t of KE.filterToday(entries)) {
      const key = KE.entityId(t.project) + '|' + KE.entityId(t.activity);
      if (!map.has(key)) {
        map.set(key, { key: key, project: t.project, activity: t.activity, entries: [], totalDuration: 0 });
        order.push(key);
      }
      const g = map.get(key);
      g.entries.push(t);
      g.totalDuration += Number(t.duration) || 0;
    }
    const groups = order.map((k) => map.get(k));
    groups.forEach((g) => {
      g.entries.sort((a, b) => String(b.begin || '').localeCompare(String(a.begin || '')));
    });
    groups.sort((a, b) => String(b.entries[0].begin || '').localeCompare(String(a.entries[0].begin || '')));
    return groups.slice(0, maxGroups || 8);
  };
})();
