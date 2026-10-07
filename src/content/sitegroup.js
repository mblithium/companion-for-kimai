/* Timesheet grouping interface. */
(function () {
  'use strict';

  let sitePref = true;
  let siteObs = null;
  let lastSig = '';
  let totalsTimer = null;
  let weekTotalEl = null;
  let bulkSyncing = false;
  const expandedKeys = new Set();
  const baseOrder = new WeakMap();

  function cellText(tr, cls) {
    const td = tr.querySelector('.' + cls);
    return td ? String(td.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  KE.parseSiteDuration = function (text) {
    const parts = String(text || '').trim().split(':').map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    return 0;
  };

  KE.formatSiteHours = function (totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s - h * 3600) / 60);
    return h + ':' + String(m).padStart(2, '0');
  };

  KE.formatSiteHms = function (totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s - h * 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((part) => String(part).padStart(2, '0')).join(':');
  };

  KE.parseSiteDate = function (text) {
    const m = String(text || '').trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return { key: '', label: '' };
    return { key: m[3] + m[2] + m[1], label: m[1] + '/' + m[2] + '/' + m[3] };
  };

  KE.siteWeekKey = function (dateKey) {
    const key = String(dateKey || '');
    if (!/^\d{8}$/.test(key)) return '';
    const thursday = new Date(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8));
    thursday.setDate(thursday.getDate() - ((thursday.getDay() + 6) % 7) + 3);
    const firstThursday = new Date(thursday.getFullYear(), 0, 4);
    firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
    const week = 1 + Math.round((thursday - firstThursday) / 604800000);
    return thursday.getFullYear() + '-W' + String(week).padStart(2, '0');
  };

  function rowKey(tr) {
    return [
      cellText(tr, 'col_customer'),
      cellText(tr, 'col_project'),
      cellText(tr, 'col_activity'),
      cellText(tr, 'col_description'),
    ].join(' | ');
  }

  function isDataRow(tr) {

    if (!tr || tr.tagName !== 'TR' || tr.classList.contains('ke-sitegroup')) return false;
    if (tr.classList.contains('summary') || tr.classList.contains('info')) return false;
    const cb = memberBox(tr);
    const v = cb ? (cb.value || cb.getAttribute('value') || '') : '';
    if (String(v).trim()) return true;
    return !!(tr.querySelector('.col_duration') && (tr.querySelector('.col_project') || tr.querySelector('.col_customer')));
  }

  function rowSig(tr) {
    const cb = tr.querySelector('input.multi_update_single, input[type="checkbox"]');
    const id = cb ? (cb.value || cb.getAttribute('value') || '') : '';
    if (id) return '#' + id;
    return '@' + String(tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  KE.groupSiteRows = function (rows) {
    const groups = [];
    let cur = null;
    const pushRow = (tr) => {
      const g = cur;
      g.rows.push(tr);
      g.totalSec += KE.parseSiteDuration(cellText(tr, 'col_duration'));
      const d = KE.parseSiteDate(cellText(tr, 'col_date'));
      if (d.key) {
        if (!g.dateMin || d.key < g.dateMin.key) g.dateMin = d;
        if (!g.dateMax || d.key > g.dateMax.key) g.dateMax = d;
      }
    };
    rows.forEach((tr) => {
      const key = rowKey(tr);
      if (cur && cur.key === key) {
        pushRow(tr);
        return;
      }
      cur = {
        key: key,
        customer: cellText(tr, 'col_customer'),
        project: cellText(tr, 'col_project'),
        activity: cellText(tr, 'col_activity'),
        rows: [],
        totalSec: 0,
        dateMin: null,
        dateMax: null,
      };
      groups.push(cur);
      pushRow(tr);
    });
    return groups;
  };

  let siteBarBtn = null;

  function findSiteCard() {
    return document.querySelector('.card.data_table.datatable_timesheet')
      || document.querySelector('.datatable_timesheet');
  }

  function makeRefreshBtn() {
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'ke-sitegroup-bar-refresh';
    refreshBtn.textContent = '⟳';
    refreshBtn.title = KE.T.refreshLists;
    refreshBtn.setAttribute('aria-label', KE.T.refreshLists);
    refreshBtn.addEventListener('click', async () => {
      if (typeof KE.refreshCatalogHandler !== 'function') return;
      refreshBtn.disabled = true;
      try {
        await KE.refreshCatalogHandler();
      } finally {
        refreshBtn.disabled = false;
      }
    });
    return refreshBtn;
  }
  KE.createSiteBar = function () {
    const bar = document.createElement('div');
    bar.className = 'ke-sitegroup-bar';
    const groupBtn = document.createElement('button');
    groupBtn.type = 'button';
    groupBtn.className = 'ke-sitegroup-bar-toggle';
    groupBtn.addEventListener('click', async () => {
      const on = !sitePref;
      try {
        const s = await KE.storageGet(['keSettings']);
        await KE.storageSet({ keSettings: Object.assign({}, (s && s.keSettings) || {}, { groupTasks: on }) });
      } catch (e) {}
      sitePref = on;
      paintBar();
      const tb = findSiteTbody();
      if (tb) KE.applySiteGrouping(tb, sitePref);
    });
    bar.appendChild(groupBtn);
    bar.appendChild(makeRefreshBtn());
    siteBarBtn = groupBtn;
    paintBar();
    return bar;
  };

  function ensureBar() {
    try {
      const card = findSiteCard();
      if (!card || !card.parentNode || typeof card.parentNode.querySelector !== 'function') return;
      const existing = card.parentNode.querySelector('.ke-sitegroup-bar-toggle');
      if (existing) {
        siteBarBtn = existing;
        paintBar();
        try {
          const bar = existing.parentNode;
          if (bar && typeof bar.querySelector === 'function' && !bar.querySelector('.ke-sitegroup-bar-refresh')) {
            bar.appendChild(makeRefreshBtn());
          }
        } catch (e) {}
        return;
      }
      const bar = KE.createSiteBar();
      card.parentNode.insertBefore(bar, card);
    } catch (e) {}
  }

  function paintBar() {
    if (!siteBarBtn) return;
    siteBarBtn.textContent = KE.T.groupTasks;
    siteBarBtn.classList.toggle('ke-on', !!sitePref);
    siteBarBtn.setAttribute('aria-pressed', sitePref ? 'true' : 'false');
  }

  function findSiteTbody() {
    return document.querySelector('.datatable_timesheet tbody');
  }
  KE.syncSiteGroupUI = async function () {
    try {
      const s = await KE.storageGet(['keSettings']);
      sitePref = !s || !s.keSettings || s.keSettings.groupTasks !== false;
    } catch (e) {}
    ensureBar();
    paintBar();
    const tb = findSiteTbody();
    if (tb) KE.applySiteGrouping(tb, sitePref);
  };

  function dateRange(g) {
    if (!g.dateMin) return '';
    if (!g.dateMax || g.dateMin.key === g.dateMax.key) return g.dateMin.label;
    return g.dateMin.label + ' – ' + g.dateMax.label;
  }

  function sameInnerHTML(cells) {
    if (!cells.length) return '';
    const first = String(cells[0].innerHTML || '');
    if (cells.every((c) => String(c.innerHTML || '') === first)) return first;
    return null;
  }

  function stripIds(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  }

  function memberBox(tr) {
    return tr.querySelector('input.multi_update_single, input[type="checkbox"]');
  }

  function minBegin(rows) {
    let best = '';
    rows.forEach((tr) => {
      const v = cellText(tr, 'col_starttime');
      if (v && (!best || v < best)) best = v;
    });
    return best;
  }

  function maxEnd(rows) {
    let best = '';
    let running = false;
    rows.forEach((tr) => {
      const v = cellText(tr, 'col_endtime');
      if (!v) running = true;
      else if (v && (!best || v > best)) best = v;
    });
    return running ? '' : best;
  }

  function copyCell(td, rows, field) {
    const first = rows[0].querySelector('.' + field);
    setClonedHTML(td, first && first.innerHTML);
  }

  // Safe innerHTML use: html always comes from cells already rendered (and
  // escaped) by Kimai itself; no network or user string is assigned here.
  function setClonedHTML(td, html) {
    td.innerHTML = html || '';
    stripIds(td);
  }

  function fillTags(td, rows) {
    const cells = rows.map((tr) => tr.querySelector('.col_tags'));
    const html = sameInnerHTML(cells.filter(Boolean));
    if (html !== null && cells.length) {
      setClonedHTML(td, html);
      return;
    }
    const uniq = [];
    cells.forEach((c) => {
      const t = c ? String(c.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (t && uniq.indexOf(t) < 0) uniq.push(t);
    });
    td.textContent = uniq.join(' · ');
  }

  function refreshGroupTotals() {
    if (!sitePref) return;
    const tb = findSiteTbody();
    if (!tb) return;
    tb.querySelectorAll('tr.ke-sitegroup').forEach((h) => {
      const rows = [];
      let n = h.nextElementSibling;
      while (n && n.tagName === 'TR' && !n.classList.contains('ke-sitegroup') && isDataRow(n)) {
        rows.push(n);
        n = n.nextElementSibling;
      }
      let total = 0;
      rows.forEach((tr) => { total += KE.parseSiteDuration(cellText(tr, 'col_duration')); });
      const dur = h.querySelector('td.col_duration');
      if (dur) dur.textContent = KE.formatSiteHours(total);
    });
  }

  function summaryDateKey(row) {
    if (!row.classList.contains('summary') || !row.classList.contains('info')) return '';
    return KE.parseSiteDate(cellText(row, 'col_date') || row.textContent).key;
  }

  function addDailyTotalCell(row, dataColumnCount) {
    const cells = Array.from(row.children || []).filter((cell) => cell.tagName === 'TD');
    if (dataColumnCount && cells.length >= dataColumnCount) {
      const last = cells[dataColumnCount - 1];
      last.classList.add('ke-day-total');
      return last;
    }

    const last = cells[cells.length - 1];
    const lastSpan = last ? Math.max(1, Number(last.getAttribute('colspan')) || 1) : 1;
    const coveredColumns = cells.reduce((sum, cell) => sum + Math.max(1, Number(cell.getAttribute('colspan')) || 1), 0);
    if (last && lastSpan > 1 && (!dataColumnCount || coveredColumns >= dataColumnCount || cells.length === 1)) {
      last.setAttribute('colspan', String(lastSpan - 1));
    }

    const total = document.createElement('td');
    total.className = 'ke-day-total';
    row.appendChild(total);
    return total;
  }

  function dailyTableInfo(tb) {
    const rows = Array.from(tb.children || tb.querySelectorAll('tr'))
      .filter((row) => row.tagName === 'TR');
    const dataRows = rows.filter(isDataRow);
    const dataRow = dataRows[0];
    return {
      rows,
      dataColumnCount: dataRow
        ? Array.from(dataRow.children || []).filter((cell) => cell.tagName === 'TD').length
        : 0,
      hasDurationColumn: dataRows.some((row) => !!row.querySelector('.col_duration')),
    };
  }

  function writeDailyCell(row, info, text) {
    let cell = row.querySelector('td.ke-day-total');
    if (!cell) {
      cell = row.querySelector('td.col_duration');
      if (cell) cell.classList.add('ke-day-total');
    }
    if (!cell && info.hasDurationColumn) cell = addDailyTotalCell(row, info.dataColumnCount);
    if (!cell) return false;
    if (cell.textContent !== text) cell.textContent = text;
    return true;
  }

  function refreshDailyTotals(tbody) {
    const tb = tbody || findSiteTbody();
    if (!tb) return;
    const info = dailyTableInfo(tb);
    const totals = new Map();
    const summaries = [];
    let currentDateKey = '';

    info.rows.forEach((row) => {
      const summaryKey = summaryDateKey(row);
      if (summaryKey) {
        currentDateKey = summaryKey;
        summaries.push({ row, dateKey: summaryKey });
        return;
      }
      if (!isDataRow(row)) return;
      const dateKey = KE.parseSiteDate(cellText(row, 'col_date')).key || currentDateKey;
      if (!dateKey) return;
      totals.set(dateKey, (totals.get(dateKey) || 0) + KE.parseSiteDuration(cellText(row, 'col_duration')));
    });

    summaries.forEach(({ row, dateKey }) => {
      writeDailyCell(row, info, KE.formatSiteHms(totals.get(dateKey) || 0));
    });
  }

  function siteWeekTotalSeconds(tbody) {
    const tb = tbody || findSiteTbody();
    if (!tb) return 0;
    const dated = [];
    Array.from(tb.children || tb.querySelectorAll('tr'))
      .filter((row) => row.tagName === 'TR')
      .forEach((row) => {
        if (!isDataRow(row)) return;
        const dateKey = KE.parseSiteDate(cellText(row, 'col_date')).key;
        if (!dateKey) return;
        dated.push({ week: KE.siteWeekKey(dateKey), sec: KE.parseSiteDuration(cellText(row, 'col_duration')) });
      });
    if (!dated.length) return 0;
    const latestWeek = dated.map((entry) => entry.week).sort().pop();
    return dated
      .filter((entry) => entry.week === latestWeek)
      .reduce((sum, entry) => sum + entry.sec, 0);
  }
  KE.siteWeekTotalSeconds = siteWeekTotalSeconds;

  function weekTotalLabel() {
    const label = KE.uiText('weekTotal');
    return label === 'weekTotal' ? 'TOTAL DA SEMANA' : label;
  }

  function dayTotalLabel() {
    const label = KE.uiText('dayTotal');
    return label === 'dayTotal' ? 'HOJE' : label;
  }

  function dateKeyFromDate(d) {
    return d.getFullYear() + KE.pad(d.getMonth() + 1) + KE.pad(d.getDate());
  }

  function todayDateKey(now) {
    return dateKeyFromDate(now || new Date());
  }

  function currentWeekRange(now) {
    const d = now || new Date();
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    sunday.setDate(monday.getDate() + 6);
    return [dateKeyFromDate(monday), dateKeyFromDate(sunday)];
  }

  function entryDayKey(t) {
    return String((t && t.begin) || '').slice(0, 10).replace(/-/g, '');
  }

  function entryLiveSeconds(t, nowMs) {
    if (!t) return 0;
    if (t.end) return Math.max(0, Math.floor(Number(t.duration) || 0));
    const beginMs = new Date(t.begin).getTime();
    if (Number.isNaN(beginMs)) return 0;
    return Math.max(0, Math.floor(((nowMs || Date.now()) - beginMs) / 1000));
  }

  KE.fetchTimesheetsBetween = async function (fromKey, toKey) {
    const stamp = (key, time) => key.slice(0, 4) + '-' + key.slice(4, 6) + '-' + key.slice(6, 8) + ' ' + time;
    const url = '/api/timesheets?size=1000' +
      '&begin=' + encodeURIComponent(stamp(fromKey, '00:00:00')) +
      '&end=' + encodeURIComponent(stamp(toKey, '23:59:59'));
    const list = KE.asArray(await KE.apiGet(url));
    return list.filter((t) => {
      const day = entryDayKey(t);
      return day >= fromKey && day <= toKey;
    });
  };

  function listingDateKeys(tb) {
    const keys = new Set();
    Array.from(tb.children || tb.querySelectorAll('tr'))
      .filter((row) => row.tagName === 'TR')
      .forEach((row) => {
        const key = summaryDateKey(row) ||
          (isDataRow(row) ? KE.parseSiteDate(cellText(row, 'col_date')).key : '');
        if (key) keys.add(key);
      });
    return [...keys].sort();
  }

  KE.refreshSiteTotals = async function (tbody, nowMs) {
    const tb = tbody || findSiteTbody();
    if (!tb) return null;
    try {
      const keys = listingDateKeys(tb);
      let from;
      let to;
      if (keys.length) {
        from = keys[0];
        to = keys[keys.length - 1];
      } else {
        [from, to] = currentWeekRange(nowMs);
      }
      const list = await KE.fetchTimesheetsBetween(from, to);
      const perDay = new Map();
      list.forEach((t) => {
        const day = entryDayKey(t);
        if (!day) return;
        perDay.set(day, (perDay.get(day) || 0) + entryLiveSeconds(t, nowMs));
      });
      if (!perDay.size) {
        refreshDailyTotals(tb);
        refreshWeekTotal(tb);
        return null;
      }
      const info = dailyTableInfo(tb);
      Array.from(tb.children || tb.querySelectorAll('tr'))
        .filter((row) => row.tagName === 'TR')
        .forEach((row) => {
          const dateKey = summaryDateKey(row);
          if (!dateKey || !perDay.has(dateKey)) return;
          writeDailyCell(row, info, KE.formatSiteHms(perDay.get(dateKey)));
        });
      const weeks = [...perDay.keys()].map((day) => KE.siteWeekKey(day)).sort();
      const latestWeek = weeks[weeks.length - 1];
      let weekSum = 0;
      perDay.forEach((sec, day) => {
        if (KE.siteWeekKey(day) === latestWeek) weekSum += sec;
      });
      const todaySum = perDay.get(todayDateKey(nowMs ? new Date(nowMs) : undefined)) || 0;
      upsertWeekTotalLine(findSiteCard(), todaySum, weekSum);
      return {
        from,
        to,
        today: todaySum,
        week: weekSum,
        days: perDay.size,
      };
    } catch (e) {
      refreshDailyTotals(tb);
      refreshWeekTotal(tb);
      return null;
    }
  };

  function siteTodayTotalSeconds(tbody, now) {
    const tb = tbody || findSiteTbody();
    if (!tb) return 0;
    const today = todayDateKey(now);
    let total = 0;
    Array.from(tb.children || tb.querySelectorAll('tr'))
      .filter((row) => row.tagName === 'TR')
      .forEach((row) => {
        if (!isDataRow(row)) return;
        if (KE.parseSiteDate(cellText(row, 'col_date')).key !== today) return;
        total += KE.parseSiteDuration(cellText(row, 'col_duration'));
      });
    return total;
  }
  KE.siteTodayTotalSeconds = siteTodayTotalSeconds;

  function upsertWeekTotalLine(card, todaySec, weekSec) {
    if (!card || !card.parentNode || typeof card.parentNode.insertBefore !== 'function') return null;
    const parent = card.parentNode;
    let line = null;
    try {
      if (weekTotalEl && weekTotalEl.parentNode === parent) line = weekTotalEl;
      else if (parent.querySelector && typeof parent.querySelector === 'function') {
        line = parent.querySelector('.ke-week-total');
      }
    } catch (e) { line = null; }
    let todayEl = line && line.querySelector ? line.querySelector('.ke-today-total') : null;
    let weekEl = line && line.querySelector ? line.querySelector('.ke-week-total-value') : null;
    if (!line || !todayEl || !weekEl) {
      if (weekTotalEl && weekTotalEl.parentNode && weekTotalEl.parentNode !== parent) {
        try { weekTotalEl.remove(); } catch (e) {}
      }
      if (line && line.parentNode === parent) {
        try { line.remove(); } catch (e) {}
      }
      line = document.createElement('div');
      line.className = 'ke-week-total';
      line.setAttribute('role', 'status');
      todayEl = document.createElement('span');
      todayEl.className = 'ke-today-total';
      weekEl = document.createElement('span');
      weekEl.className = 'ke-week-total-value';
      line.appendChild(todayEl);
      line.appendChild(weekEl);
      weekTotalEl = line;
    }
    const todayText = dayTotalLabel() + ' ' + KE.formatSiteHms(todaySec);
    const weekText = weekTotalLabel() + ': ' + KE.formatSiteHms(weekSec);
    if (todayEl.textContent !== todayText) todayEl.textContent = todayText;
    if (weekEl.textContent !== weekText) weekEl.textContent = weekText;
    try { parent.insertBefore(line, card); } catch (e) {}
    return line;
  }
  KE.renderSiteWeekTotal = upsertWeekTotalLine;

  function refreshWeekTotal(tbody) {
    const tb = tbody || findSiteTbody();
    if (!tb) return '';
    const today = siteTodayTotalSeconds(tb);
    const total = siteWeekTotalSeconds(tb);
    upsertWeekTotalLine(findSiteCard(), today, total);
    return dayTotalLabel() + ' ' + KE.formatSiteHms(today) + '  ' +
      weekTotalLabel() + ': ' + KE.formatSiteHms(total);
  }
  KE.refreshSiteWeekTotal = refreshWeekTotal;

  function paintGroupCheck(g, box) {
    if (!box) return;
    const boxes = g.rows.map(memberBox).filter(Boolean);
    const checked = boxes.filter((b) => b.checked);
    try {
      box.checked = checked.length > 0 && checked.length === boxes.length;
      box.indeterminate = checked.length > 0 && checked.length < boxes.length;
    } catch (e) {}
  }

  function fireChange(el) {
    try {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      try {
        const ev = document.createEvent('HTMLEvents');
        ev.initEvent('change', true, false);
        el.dispatchEvent(ev);
      } catch (e2) {}
    }
  }

  function buildHeader(g, colClasses) {
    const tr = document.createElement('tr');
    tr.className = 'ke-sitegroup';
    if (tr.dataset) tr.dataset.group = g.key;
    const open = expandedKeys.has(g.key);
    tr.classList.toggle('ke-open', open);
    const paintOpen = (nowOpen) => {
      tr.classList.toggle('ke-open', nowOpen);
      g.rows.forEach((r) => {
        r.style.display = nowOpen ? '' : 'none';
        r.classList.toggle('ke-sitemember', nowOpen);
      });
    };
    const toggle = () => {
      const nowOpen = !expandedKeys.has(g.key);
      if (nowOpen) expandedKeys.add(g.key);
      else expandedKeys.delete(g.key);
      tr.querySelectorAll('.ke-sitegroup-toggle').forEach((b) => {
        b.textContent = nowOpen ? '\u25be' : '\u25b8';
        b.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      });
      paintOpen(nowOpen);
    };
    let expBtn = null;
    let groupBox = null;
    colClasses.forEach((cls) => {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      const field = (String(cls || '').match(/col_([a-z]+)/) || [])[1] || '';
      if (field === 'id') {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.className = 'ke-sitegroup-check form-check-input m-0 align-middle';
        box.setAttribute('aria-label', KE.T.groupTasks);
        box.addEventListener('click', (ev) => ev.stopPropagation());
        box.addEventListener('change', () => {
          bulkSyncing = true;
          try {
            g.rows.forEach((r) => {
              const cb = memberBox(r);
              if (cb && cb.checked !== box.checked) {
                cb.checked = box.checked;
                fireChange(cb);
              }
            });
          } finally {
            bulkSyncing = false;
          }
          paintGroupCheck(g, box);
        });
        td.appendChild(box);
        groupBox = box;
      } else if (field === 'date') {
        td.textContent = dateRange(g);
      } else if (field === 'starttime') {
        td.textContent = minBegin(g.rows);
      } else if (field === 'endtime') {
        td.textContent = maxEnd(g.rows);
      } else if (field === 'duration') {
        td.textContent = KE.formatSiteHours(g.totalSec);
      } else if (field === 'customer' || field === 'project' || field === 'activity' || field === 'description') {
        copyCell(td, g.rows, 'col_' + field);
      } else if (field === 'tags') {
        fillTags(td, g.rows);
      } else if (field === 'billable' || field === 'exported') {
        const cells = g.rows.map((r) => r.querySelector('.col_' + field)).filter(Boolean);
        const html = sameInnerHTML(cells);
        if (html !== null && cells.length === g.rows.length) {
          setClonedHTML(td, html);
        }
      } else if (field === 'actions') {
        expBtn = makeToggle();
        td.appendChild(expBtn);
      }
      tr.appendChild(td);
    });
    if (!expBtn) {
      const first = tr.querySelector('td');
      expBtn = makeToggle();
      if (first && first.firstChild) first.insertBefore(expBtn, first.firstChild);
      else if (first) first.appendChild(expBtn);
      else tr.appendChild(expBtn);
    }
    function makeToggle() {
      const exp = document.createElement('button');
      exp.type = 'button';
      exp.className = 'ke-sitegroup-toggle';
      exp.textContent = open ? '\u25be' : '\u25b8';
      exp.setAttribute('aria-expanded', open ? 'true' : 'false');
      exp.setAttribute('aria-label', KE.T.groupTasks);
      exp.addEventListener('click', (ev) => { ev.stopPropagation(); toggle(); });
      return exp;
    }
    g.rows.forEach((r) => {
      const cb = memberBox(r);
      if (cb) cb.addEventListener('change', () => { if (!bulkSyncing) paintGroupCheck(g, groupBox); });
    });
    paintGroupCheck(g, groupBox);
    tr.addEventListener('click', (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest('a, button, input')) return;
      toggle();
    });
    return tr;
  }

  KE.applySiteGrouping = function (tbody, on) {
    if (!tbody) return;
    refreshDailyTotals(tbody);
    refreshWeekTotal(tbody);
    try {
      const pending = KE.refreshSiteTotals(tbody);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch (e) {}
    const headers = tbody.querySelectorAll('tr.ke-sitegroup');
    headers.forEach((h) => h.remove());
    const kids = Array.from(tbody.children || tbody.querySelectorAll('tr'))
      .filter((tr) => tr.tagName === 'TR' && !tr.classList.contains('ke-sitegroup'));
    if (!on) {
      const base = baseOrder.get(tbody);
      const target = (base && base.length === kids.length && base.every((r) => kids.includes(r))) ? base : kids;
      target.forEach((r) => {
        r.style.display = '';
        r.classList.remove('ke-sitemember');
        tbody.appendChild(r);
      });
      baseOrder.delete(tbody);
      return;
    }
    if (!baseOrder.has(tbody)) baseOrder.set(tbody, kids.slice());
    const segs = [];
    let cur = [];
    kids.forEach((tr) => {
      if (isDataRow(tr)) {
        cur.push(tr);
        return;
      }
      if (cur.length) {
        segs.push(cur);
        cur = [];
      }
      segs.push(tr);
    });
    if (cur.length) segs.push(cur);
    let anyHeader = false;
    segs.forEach((seg) => {
      if (!Array.isArray(seg)) {
        tbody.appendChild(seg);
        return;
      }
      const groups = KE.groupSiteRows(seg);
      if (!groups.some((g) => g.rows.length > 1)) {
        seg.forEach((r) => {
          r.style.display = '';
          r.classList.remove('ke-sitemember');
          tbody.appendChild(r);
        });
        return;
      }
      groups.forEach((g) => {
        if (g.rows.length < 2) {
          g.rows.forEach((r) => {
            r.style.display = '';
            r.classList.remove('ke-sitemember');
            tbody.appendChild(r);
          });
          return;
        }
        const cols = Array.from((g.rows[0].children || []))
          .filter((td) => td.tagName === 'TD')
          .map((td) => td.className);
        tbody.appendChild(buildHeader(g, cols));
        anyHeader = true;
        const open = expandedKeys.has(g.key);
        g.rows.forEach((r) => {
          r.style.display = open ? '' : 'none';
          r.classList.toggle('ke-sitemember', open);
          tbody.appendChild(r);
        });
      });
    });
    lastSig = siteSig(tbody);
  };

  function siteSig(tbody) {
    return Array.from(tbody.children || [])
      .filter((tr) => tr.tagName === 'TR' && !tr.classList.contains('ke-sitegroup'))
      .map(rowSig)
      .join('\n');
  }

  KE.startSiteGroupObserver = function () {
    if (siteObs) return;
    if (!totalsTimer) {
      try {
        totalsTimer = setInterval(() => {
          refreshGroupTotals();
          refreshDailyTotals();
          refreshWeekTotal();
          try {
            const pending = KE.refreshSiteTotals();
            if (pending && typeof pending.catch === 'function') pending.catch(() => {});
          } catch (e) {}
        }, 60000);
      } catch (e) {}
    }
    let pending = null;
    siteObs = new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const tb = findSiteTbody();
        if (!tb) return;
        refreshDailyTotals(tb);
        refreshWeekTotal(tb);
        try {
          const pending = KE.refreshSiteTotals(tb);
          if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        } catch (e) {}
        if (!sitePref) return;
        ensureBar();
        if (siteSig(tb) === lastSig) return;
        KE.applySiteGrouping(tb, true);
      }, 400);
    });
    siteObs.observe(document.documentElement, { childList: true, subtree: true });
  };
})();
