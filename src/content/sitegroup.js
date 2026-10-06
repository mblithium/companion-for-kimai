/* Timesheet grouping interface. */
(function () {
  'use strict';

  let sitePref = true;
  let siteObs = null;
  let lastSig = '';
  let totalsTimer = null;
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

  KE.parseSiteDate = function (text) {
    const m = String(text || '').trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return { key: '', label: '' };
    return { key: m[3] + m[2] + m[1], label: m[1] + '/' + m[2] + '/' + m[3] };
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
    td.innerHTML = first ? first.innerHTML : '';
    stripIds(td);
  }

  function fillTags(td, rows) {
    const cells = rows.map((tr) => tr.querySelector('.col_tags'));
    const html = sameInnerHTML(cells.filter(Boolean));
    if (html !== null && cells.length) {
      td.innerHTML = html;
      stripIds(td);
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
          td.innerHTML = html;
          stripIds(td);
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
        totalsTimer = setInterval(refreshGroupTotals, 60000);
      } catch (e) {}
    }
    let pending = null;
    siteObs = new MutationObserver(() => {
      if (!sitePref) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        ensureBar();
        const tb = findSiteTbody();
        if (!tb) return;
        if (siteSig(tb) === lastSig) return;
        KE.applySiteGrouping(tb, true);
      }, 400);
    });
    siteObs.observe(document.documentElement, { childList: true, subtree: true });
  };
})();
