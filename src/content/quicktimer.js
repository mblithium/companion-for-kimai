/* Quick timer interface and lifecycle. */
(function () {
  'use strict';

  let ui = null;
  let shortcuts = Object.assign({}, KE.DEFAULT_SHORTCUTS);
  let shortcutsEnabled = true;

  async function reloadShortcuts() {
    try {
      const s = await KE.storageGet(['keSettings']);
      const saved = (s && s.keSettings && s.keSettings.shortcuts) || {};
      shortcuts = Object.assign({}, KE.DEFAULT_SHORTCUTS, saved);
      shortcutsEnabled = !s || !s.keSettings || s.keSettings.shortcutsEnabled !== false;
    } catch (e) {}
  }

  async function applyDisplayPrefs() {
    try {
      const s = await KE.storageGet(['keSettings']);
      const settings = (s && s.keSettings) || {};
      if (document.body) {
        document.body.classList.toggle('ke-hide-date', !!settings.hideDateColumn);
        document.body.classList.toggle('ke-hide-sidebar', !!settings.hideSidebar);
        document.body.classList.toggle('ke-hide-actionbar', !!settings.hideActionBar);
        document.body.classList.toggle('ke-hide-header', !!settings.hideHeader);
      }
    } catch (e) {}
  }

  async function doRestart() {
    setStatus('', '');
    try {
      const r = await KE.restartLast();
      if (!r.ok && r.empty) {
        setStatus(KE.T.restartEmpty, 'err');
        return;
      }
      setStatus(KE.T.restartedOk, 'ok');
      KE.notifyKimaiUpdate();
      KE.notifyBackground();
      await loadActive();
    } catch (e) {
      const msg = apiErrorText(e, KE.T.startFail);
      setStatus(msg.text, 'err', msg.title);
    }
  }

  function onGlobalKeydown(ev) {
    if (!ui) return;
    const action = KE.shortcutAction(shortcuts, shortcutsEnabled, ev);
    if (!action) return;
    ev.preventDefault();
    if (action === 'start') startTimer();
    else if (action === 'stop') stopAllTimers();
    else if (action === 'restart') doRestart();
  }
  let toastEl = null;
  let toastTimer = null;
  function getToast() {
    if (toastEl) return toastEl;
    try {
      toastEl = document.createElement('div');
      toastEl.className = 'ke-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.hidden = true;
      toastEl.addEventListener('click', () => setStatus('', ''));
      if (document.body) document.body.appendChild(toastEl);
    } catch (e) { toastEl = null; }
    return toastEl;
  }
  function setStatus(msg, kind, title) {
    const n = getToast();
    if (!n) return;
    clearTimeout(toastTimer);
    if (!msg) {
      n.hidden = true;
      n.classList.remove('ke-show');
      return;
    }
    n.textContent = msg;
    n.dataset.kind = kind || '';
    if (title) n.title = title;
    else if (n.removeAttribute) { try { n.removeAttribute('title'); } catch (e) {} }
    n.hidden = false;
    requestAnimationFrame(() => n.classList.add('ke-show'));
    toastTimer = setTimeout(() => {
      n.classList.remove('ke-show');
      n.hidden = true;
    }, 5000);
  }

  async function loadActive() {
    KE.state.active = await KE.fetchActiveTimesheets();
    renderActive();
  }

  function renderActive() {
    if (!ui) return;
    ui.activeList.innerHTML = '';
    if (!KE.state.active.length) {
      ui.nowSection.style.display = 'none';
      return;
    }
    ui.nowSection.style.display = '';
    KE.state.active.forEach((t) => {
      const row = KE.el('div', 'ke-active-row');
      row.dataset.timerId = String(t.id);
      const dot = KE.el('span', 'ke-dot');
      const info = KE.el('div', 'ke-active-info ke-clickable');
      info.title = KE.T.edit;
      info.addEventListener('click', () => openEdit(t.id));
      const projText = KE.describeProjectRef(t.project);
      const actText = KE.describeActivityRef(t.activity);
      const title = KE.el('div', 'ke-active-title', projText + (actText ? ' · ' + actText : ''));
      const sub = KE.el('div', 'ke-active-sub');
      const dur = KE.el('span', 'ke-active-dur');
      dur.dataset.begin = t.begin;
      dur.textContent = KE.elapsedSince(t.begin);
      sub.appendChild(dur);
      if (t.description) sub.appendChild(KE.el('span', 'ke-active-desc', ' — ' + t.description));
      else sub.appendChild(KE.el('span', 'ke-active-desc', ' — ' + KE.T.activeNow));
      info.appendChild(title);
      info.appendChild(sub);
      const btn = KE.el('button', 'ke-btn ke-btn-stop', KE.T.stop);
      btn.type = 'button';
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); stopTimer(t.id, btn); });
      const editBtn = KE.el('button', 'ke-btn ke-btn-edit', '✎');
      editBtn.type = 'button';
      editBtn.title = KE.T.edit;
      editBtn.setAttribute('aria-label', KE.T.edit);
      editBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openEdit(t.id); });
      row.appendChild(dot);
      row.appendChild(info);
      row.appendChild(editBtn);
      row.appendChild(btn);
      ui.activeList.appendChild(row);
    });
  }

  function tickDurations() {
    if (!ui) return;
    ui.activeList.querySelectorAll('.ke-active-dur').forEach((n) => {
      if (n.dataset.begin) n.textContent = KE.elapsedSince(n.dataset.begin);
    });
  }

  async function stopTimer(id, btn) {
    const label = btn ? btn.textContent : '';
    try {
      if (btn) { btn.disabled = true; btn.textContent = KE.T.stopping; }
      await KE.apiPatch('/api/timesheets/' + encodeURIComponent(id) + '/stop');
      setStatus(KE.T.stoppedOk, 'ok');
      KE.notifyKimaiUpdate();
      KE.notifyBackground();
      await loadActive();
    } catch (e) {
      setStatus(KE.T.stopFail + (e.status ? ' (HTTP ' + e.status + ')' : ''), 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label || KE.T.stop; }
    }
  }
  function apiErrorText(e, fallback) {
    const detail = String((e && e.serverMessage) || '').trim();
    if (detail) return { text: fallback + ' ' + detail.slice(0, 180), title: detail.slice(0, 500) };
    return { text: fallback + (e && e.status ? ' (HTTP ' + e.status + ')' : ''), title: String((e && e.body) || '').slice(0, 500) };
  }
  async function openEdit(timerId) {
    if (!ui) return;
    renderActive();
    const row = Array.from(ui.activeList.children).find((n) => n.dataset && String(n.dataset.timerId) === String(timerId));
    const t = KE.state.active.find((x) => String(x.id) === String(timerId));
    if (!row || !t) return;
    const projId = KE.entityId(t.project);
    const actId = KE.entityId(t.activity);

    row.innerHTML = '';
    const form = KE.el('div', 'ke-edit-form');
    const projCombo = KE.createCombo({ searchPlaceholder: KE.T.searchProject, allowEmpty: false });
    const actCombo = KE.createCombo({ searchPlaceholder: KE.T.searchActivity, allowEmpty: false });
    const descInput = document.createElement('input');
    descInput.className = 'ke-input';
    descInput.type = 'text';
    descInput.placeholder = KE.T.descriptionPh;
    descInput.setAttribute('maxlength', '255');
    descInput.value = t.description || '';
    const tagsInput = document.createElement('input');
    tagsInput.className = 'ke-input';
    tagsInput.type = 'text';
    tagsInput.placeholder = KE.T.tagsPh;
    tagsInput.value = KE.tagNames(t.tags).join(', ');
    const actions = KE.el('div', 'ke-edit-actions');
    const saveBtn = KE.el('button', 'ke-btn ke-btn-save', KE.T.save);
    saveBtn.type = 'button';
    const cancelBtn = KE.el('button', 'ke-btn ke-btn-cancel', KE.T.cancel);
    cancelBtn.type = 'button';
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(projCombo.root);
    form.appendChild(actCombo.root);
    form.appendChild(descInput);
    form.appendChild(tagsInput);
    form.appendChild(actions);
    row.appendChild(form);

    const doSave = () => saveEdit(t.id, projCombo, actCombo, descInput, tagsInput, saveBtn);
    saveBtn.addEventListener('click', doSave);
    cancelBtn.addEventListener('click', () => renderActive());
    [descInput, tagsInput].forEach((inp) => inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); doSave(); }
      else if (ev.key === 'Escape') renderActive();
    }));

    projCombo.setLoading(true);
    actCombo.setLoading(true);
    try {
      await KE.loadProjects('');
      projCombo.setLoading(false);
      projCombo.setItems(
        KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) })),
        projId
      );
      await KE.loadActivities(projId);
      actCombo.setLoading(false);
      actCombo.setItems(
        KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) })),
        actId
      );
    } catch (e) {
      projCombo.setLoading(false);
      actCombo.setLoading(false);
      setStatus(KE.T.refreshFail, 'err');
    }
    projCombo.onSelect = async (v) => {
      actCombo.setLoading(true);
      try {
        await KE.loadActivities(v || '');
        actCombo.setLoading(false);
        actCombo.setItems(KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) })));
      } catch (e) {
        actCombo.setLoading(false);
        setStatus(KE.T.refreshFail, 'err');
      }
    };
  }

  async function saveEdit(id, projCombo, actCombo, descInput, tagsInput, saveBtn) {
    projCombo.flush(true);
    actCombo.flush(true);
    const projectId = projCombo.getValue();
    const activityId = actCombo.getValue();
    if (!projectId || !activityId) {
      setStatus(KE.T.needProject, 'err');
      (!projectId ? projCombo : actCombo).focus();
      return;
    }
    const description = descInput.value.trim();
    const tagNames = await KE.ensureTags(tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean));
    saveBtn.disabled = true;
    const original = saveBtn.textContent;
    saveBtn.textContent = KE.T.saving;
    try {
      const payload = { project: Number(projectId), activity: Number(activityId), description: description, tags: tagNames.join(',') };
      await KE.apiPatch('/api/timesheets/' + encodeURIComponent(id), payload);
      setStatus(KE.T.updatedOk, 'ok');
      KE.notifyKimaiUpdate();
      KE.notifyBackground();
      await loadActive();
    } catch (e) {
      const msg = apiErrorText(e, KE.T.updateFail);
      setStatus(msg.text, 'err', msg.title);
      try { console.error('[Companion] update failed', e && e.status, e && e.body); } catch (ce) {}
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  }
  async function stopAllTimers() {
    const list = KE.state.active.slice();
    if (!list.length || !ui) return;
    let ok = 0;
    let failStatus = 0;
    for (const t of list) {
      try {
        await KE.apiPatch('/api/timesheets/' + encodeURIComponent(t.id) + '/stop');
        ok++;
      } catch (e) {
        if (e && e.status) failStatus = e.status;
      }
    }
    if (ok === list.length) {
      setStatus(list.length > 1 ? KE.T.stoppedMany : KE.T.stoppedOk, 'ok');
    } else {
      setStatus(KE.T.stopFail + (failStatus ? ' (HTTP ' + failStatus + ')' : ''), 'err');
    }
    KE.notifyKimaiUpdate();
    KE.notifyBackground();
    await loadActive();
  }

  function detectLocale() {
    const m = (location.pathname || '').match(/^\/([A-Za-z]{2}(?:_[A-Za-z]{2})?)\//);
    return m ? m[1] : '';
  }

  async function refreshConnectBanner() {
    if (!ui) return;
    let has = false;
    try {
      const s = await KE.localGet(['keApiToken']);
      has = !!(s && s.keApiToken);
    } catch (e) {}
    ui.connect.hidden = has;
  }

  async function doAutoConnect(btn) {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = KE.T.connecting;
    try {
      let me = null;
      try {
        me = await KE.fetchCurrentUser();
      } catch (e) {
        if (e && (e.status === 401 || e.status === 403)) {
          setStatus(KE.T.needLogin, 'err');
          return;
        }
        throw e;
      }
      if (!me || !me.username) {
        setStatus(KE.T.needLogin, 'err');
        return;
      }
      const locale = detectLocale() || me.language || 'en';
      const created = await KE.autoConnectKimai({ locale: locale, username: me.username, name: 'Companion for Kimai' });
      const cur = await KE.storageGet(['keSettings']);
      await KE.storageSet({
        keSettings: Object.assign({}, (cur && cur.keSettings) || {}, {
          kimaiBaseUrl: location.origin,
          keLocale: locale,
          keUsername: me.username,
        }),
      });
      await KE.localSet({ keApiToken: created.token });
      await refreshConnectBanner();
      setStatus(KE.T.connectedOk, 'ok');
      KE.notifyBackground();
      await loadActive();
    } catch (e) {
      const detail = String((e && e.serverMessage) || '').trim();
      if (e && (e.status === 401 || e.status === 403)) setStatus(KE.T.needLogin, 'err');
      else if (detail) setStatus(KE.T.connectFail + ' ' + detail.slice(0, 160), 'err');
      else setStatus(KE.T.connectFail + (e && e.status ? ' (HTTP ' + e.status + ')' : ''), 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function startTimer() {
    ui.customerCombo.flush(true);
    ui.projectCombo.flush(true);
    ui.activityCombo.flush(true);
    ui.tagsCombo.flush();
    const projectId = ui.projectCombo.getValue();
    const activityId = ui.activityCombo.getValue();
    if (!projectId || !activityId) {
      setStatus(KE.T.needProject, 'err');
      (!projectId ? ui.projectCombo : ui.activityCombo).focus();
      return;
    }
    const description = ui.description.value.trim();
    const tags = ui.tagsCombo.getValues();
    ui.start.disabled = true;
    const original = ui.start.textContent;
    ui.start.textContent = KE.T.starting;
    try {
      const tagNames = await KE.ensureTags(tags);
      const payload = {
        begin: KE.nowLocal(),
        project: Number(projectId),
        activity: Number(activityId),
      };
      if (description) payload.description = description;
      if (tagNames.length) payload.tags = tagNames.join(',');
      await KE.apiPost('/api/timesheets', payload);
      await KE.storageSet({ keCustomer: ui.customerCombo.getValue() || '', keProject: projectId, keActivity: activityId });
      ui.description.value = '';
      setStatus(KE.T.startedOk, 'ok');
      KE.notifyKimaiUpdate();
      KE.notifyBackground();
      await loadActive();
    } catch (e) {
      const msg = apiErrorText(e, KE.T.startFail);
      setStatus(msg.text, 'err', msg.title);
      try { console.error('[Companion] start failed', e && e.status, e && e.body); } catch (ce) {}
    } finally {
      ui.start.disabled = false;
      ui.start.textContent = original;
    }
  }

  async function handleCustomerChange() {
    if (!ui) return;
    try {
      ui.projectCombo.setLoading(true);
      ui.activityCombo.setLoading(true);
      await KE.loadProjects(ui.customerCombo.getValue() || '');
      const items = KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) }));
      let keep = '';
      const saved = await KE.storageGet(['keProject']);
      if (saved.keProject && KE.state.projectById.has(String(saved.keProject))) keep = String(saved.keProject);
      ui.projectCombo.setLoading(false);
      ui.projectCombo.setItems(items, keep);
      await handleProjectChange();
    } catch (e) {
      ui.projectCombo.setLoading(false);
      ui.activityCombo.setLoading(false);
      setStatus(KE.T.refreshFail, 'err');
    }
  }

  async function handleProjectChange() {
    if (!ui) return;
    try {
      ui.activityCombo.setLoading(true);
      await KE.loadActivities(ui.projectCombo.getValue() || '');
      const items = KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) }));
      let keep = '';
      const saved = await KE.storageGet(['keActivity']);
      if (saved.keActivity && KE.state.activityById.has(String(saved.keActivity))) keep = String(saved.keActivity);
      ui.activityCombo.setLoading(false);
      ui.activityCombo.setItems(items, keep);
    } catch (e) {
      ui.activityCombo.setLoading(false);
      setStatus(KE.T.refreshFail, 'err');
    }
  }

  function buildUI() {
    const card = KE.el('section', 'ke-card');
    card.id = 'ke-quick-timer';

    const connect = KE.el('div', 'ke-connect');
    connect.hidden = true;
    const connectText = KE.el('span', 'ke-connect-text', KE.T.connectText);
    const connectBtn = KE.el('button', 'ke-btn ke-btn-connect', '🔌 ' + KE.T.connectBtn);
    connectBtn.type = 'button';
    connectBtn.addEventListener('click', () => doAutoConnect(connectBtn));
    connect.appendChild(connectText);
    connect.appendChild(connectBtn);
    card.appendChild(connect);

    const head = KE.el('div', 'ke-head');
    const titleWrap = KE.el('div', 'ke-titles');
    const h = KE.el('div', 'ke-title');
    const play = KE.el('span', 'ke-play');
    play.setAttribute('aria-hidden', 'true');
    play.appendChild(KE.el('span', 'ke-play-icon'));
    h.appendChild(play);
    h.appendChild(document.createTextNode(KE.T.title));
    titleWrap.appendChild(h);
    titleWrap.appendChild(KE.el('div', 'ke-sub', KE.T.subtitle));
    head.appendChild(titleWrap);

    const grid = KE.el('div', 'ke-grid');

    const customerCombo = KE.createCombo({
      searchPlaceholder: KE.T.searchCustomer, emptyLabel: KE.T.allCustomers, allowEmpty: true,
      onSelect: () => { handleCustomerChange(); },
    });
    const projectCombo = KE.createCombo({
      searchPlaceholder: KE.T.searchProject, allowEmpty: false,
      onSelect: () => { handleProjectChange(); },
    });
    const activityCombo = KE.createCombo({
      searchPlaceholder: KE.T.searchActivity, allowEmpty: false,
    });

    const fDesc = KE.el('label', 'ke-field ke-grow');
    fDesc.appendChild(KE.el('span', 'ke-label', KE.T.description));
    const description = document.createElement('textarea');
    description.className = 'ke-input';
    description.setAttribute('rows', '2');
    description.placeholder = KE.T.descriptionPh;
    description.setAttribute('maxlength', '255');
    fDesc.appendChild(description);

    const tagsCombo = KE.createMultiCombo({
      searchPlaceholder: KE.T.tagsPh,
      onEnterEmpty: () => startTimer(),
    });

    grid.appendChild(fDesc);
    grid.appendChild(comboField(KE.T.customer, customerCombo));
    grid.appendChild(comboField(KE.T.project, projectCombo));
    grid.appendChild(comboField(KE.T.activity, activityCombo));
    grid.appendChild(comboField(KE.T.tags, tagsCombo, 'ke-tags'));

    const foot = KE.el('div', 'ke-foot');
    const start = KE.el('button', 'ke-btn ke-btn-start');
    start.type = 'button';
    const startIcon = KE.el('span', 'ke-btn-start-icon');
    startIcon.setAttribute('aria-hidden', 'true');
    start.appendChild(startIcon);
    start.appendChild(KE.el('span', 'ke-btn-start-label', KE.T.start));
    const full = KE.el('a', 'ke-link', '+ ' + KE.T.openCreate);
    full.href = '#';
    full.addEventListener('click', (ev) => {
      ev.preventDefault();
      const native = document.querySelector('a.action-create, a.modal-ajax-form[href*="/timesheet/create"]');
      if (native) native.click();
      else location.href = location.pathname.replace(/\/$/, '') + '/create';
    });
    foot.appendChild(start);
    foot.appendChild(full);

    card.appendChild(head);
    card.appendChild(grid);
    card.appendChild(foot);
    const nowSection = KE.el('section', 'ke-card ke-now');
    nowSection.id = 'ke-active-now';
    nowSection.style.display = 'none';
    nowSection.appendChild(KE.el('div', 'ke-now-title', KE.T.nowTitle));
    const activeList = KE.el('div', 'ke-active-list');
    nowSection.appendChild(activeList);

    ui = {
      card: card, connect: connect, connectBtn: connectBtn,
      customerCombo: customerCombo, projectCombo: projectCombo, activityCombo: activityCombo,
      description: description, tagsCombo: tagsCombo, start: start,
      nowSection: nowSection, activeList: activeList
    };

    start.addEventListener('click', startTimer);
    description.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); startTimer(); }
    });

    return card;
  }

  function comboField(labelText, combo, extraClass) {
    const wrap = KE.el('div', 'ke-field' + (extraClass ? ' ' + extraClass : ''));
    wrap.appendChild(KE.el('span', 'ke-label', labelText));
    wrap.appendChild(combo.root);
    return wrap;
  }

  function findAnchor() {
    return document.querySelector('.card.data_table.datatable_timesheet')
      || document.querySelector('.datatable_timesheet')
      || document.querySelector('table.dataTable')
      || document.querySelector('.page-body .container-fluid .card')
      || document.querySelector('.page-body .container-fluid');
  }

  function mount(anchor) {
    if (!anchor) return false;
    const existing = document.getElementById('ke-quick-timer');
    if (existing) {
      placeNowSection(existing, anchor);
      return false;
    }
    const card = buildUI();
    if (anchor.classList && anchor.classList.contains('container-fluid')) anchor.prepend(card);
    else if (anchor.tagName === 'TABLE') anchor.closest('.card, .container-fluid, .page-body')?.prepend(card);
    else anchor.parentNode.insertBefore(card, anchor);
    placeNowSection(card, anchor);
    return true;
  }
  function placeNowSection(card, anchor) {
    if (!ui || !ui.nowSection || !card) return;
    const parent = card.parentNode || (anchor && anchor.parentNode);
    if (!parent || typeof parent.insertBefore !== 'function') return;
    try {
      if (typeof ui.nowSection.remove === 'function') ui.nowSection.remove();
    } catch (e) {}
    try {
      if (card.parentNode === parent) parent.insertBefore(ui.nowSection, card.nextSibling || null);
      else parent.insertBefore(ui.nowSection, anchor);
    } catch (e) {
      try { parent.insertBefore(ui.nowSection, anchor); } catch (e2) {}
    }
  }
  async function refreshCatalog() {
    if (!ui) return;
    await loadAll(true);
    await loadActive();
    setStatus(KE.T.listsUpdated, 'ok');
  }
  KE.refreshCatalogHandler = refreshCatalog;
  async function loadAll(force) {
    if (!ui) return;
    try {
      ui.customerCombo.setLoading(true);
      ui.projectCombo.setLoading(true);
      ui.activityCombo.setLoading(true);
      await KE.getCustomersCached(force);
      const saved = await KE.storageGet(['keCustomer', 'keProject', 'keActivity']);
      ui.customerCombo.setLoading(false);
      ui.customerCombo.setItems(
        KE.state.customers.map((c) => ({ value: String(c.id), label: c.name || ('#' + c.id) })),
        saved.keCustomer ? String(saved.keCustomer) : ''
      );
      await KE.getProjectsCached(ui.customerCombo.getValue() || '', force);
      ui.projectCombo.setLoading(false);
      ui.projectCombo.setItems(
        KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) })),
        saved.keProject && KE.state.projectById.has(String(saved.keProject)) ? String(saved.keProject) : ''
      );
      await KE.getActivitiesCached(ui.projectCombo.getValue() || '', force);
      ui.activityCombo.setLoading(false);
      ui.activityCombo.setItems(
        KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) })),
        saved.keActivity && KE.state.activityById.has(String(saved.keActivity)) ? String(saved.keActivity) : ''
      );
      ui.tagsCombo.setLoading(true);
      await KE.loadTags();
      ui.tagsCombo.setLoading(false);
      ui.tagsCombo.setItems(KE.state.tags);
      if (!force) revalidateCatalog();
    } catch (e) {
      setStatus(KE.T.refreshFail, 'err');
    }
  }

  async function revalidateCatalog() {
    try {
      if (!ui) return;
      await KE.getProjectsCached(ui.customerCombo.getValue() || '', true);
      syncComboIfChanged(ui.projectCombo,
        KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) })));
      await KE.getActivitiesCached(ui.projectCombo.getValue() || '', true);
      syncComboIfChanged(ui.activityCombo,
        KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) })));
      await KE.loadTags();
      ui.tagsCombo.setItems(KE.state.tags);
    } catch (e) {}
  }

  function syncComboIfChanged(combo, items) {
    const same = combo.getValues().join('\n') === items.map((i) => i.value).join('\n');
    if (!same) combo.setItems(items, combo.getValue());
  }
  let observerStarted = false;
  function startPersistentObserver() {
    if (observerStarted) return;
    observerStarted = true;
    let t = null;
    const obs = new MutationObserver(() => {
      if (!document.getElementById('ke-quick-timer')) {
        clearTimeout(t);
        t = setTimeout(async () => {
          const a = findAnchor();
          if (a && mount(a)) {
            await loadAll();
            await loadActive();
            await refreshConnectBanner();
          }
        }, 400);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function init() {
    if (!KE.isTimesheetListPage()) return;
    try {
      const s = await KE.storageGet(['keSettings']);
      const patch = {};
      if (!s.keSettings || !s.keSettings.kimaiBaseUrl) patch.kimaiBaseUrl = location.origin;
      const lm = (location.pathname || '').match(/^\/([A-Za-z]{2}(?:_[A-Za-z]{2})?)\//);
      if (lm && (!s.keSettings || s.keSettings.keLocale !== lm[1])) patch.keLocale = lm[1];
      if (Object.keys(patch).length) {
        await KE.storageSet({ keSettings: Object.assign({}, s.keSettings, patch) });
      }
    } catch (e) {}
    await reloadShortcuts();
    await applyDisplayPrefs();
    await KE.applyTheme();
    await KE.applyPageTheme();
    KE.onStorageChanged(async () => {
      reloadShortcuts();
      applyDisplayPrefs();
      KE.applyTheme();
      KE.applyPageTheme();
      KE.syncSiteGroupUI();
      refreshConnectBanner();
    });
    document.addEventListener('keydown', onGlobalKeydown);
    startPersistentObserver();
    if (document.getElementById('ke-quick-timer')) return;

    const anchor = findAnchor();
    if (anchor) mount(anchor);
    else {
      setTimeout(() => {
        if (!document.getElementById('ke-quick-timer')) {
          const fallback = document.querySelector('.page-body .container-fluid') || document.querySelector('.page-body');
          if (fallback && mount(fallback)) loadAll();
        }
      }, 2500);
      const t0 = Date.now();
      while (!ui && Date.now() - t0 < 16000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!ui) return;
    }

    await loadAll();
    await loadActive();
    if (!KE.state.timer) KE.state.timer = setInterval(tickDurations, 1000);
    KE.startSiteGroupObserver();
    await KE.syncSiteGroupUI();
    await refreshConnectBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
