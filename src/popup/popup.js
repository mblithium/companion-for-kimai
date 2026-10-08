/* Toolbar popup interface. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let ui = {};
  let tick = null;
  let tickToday = null;

  function setStatus(msg, kind) {
    ui.status.textContent = msg || '';
    ui.status.dataset.kind = kind || '';
  }
  function popError(e, fallback) {
    const detail = String((e && e.serverMessage) || '').trim();
    if (detail) return fallback + ' ' + detail.slice(0, 160);
    return fallback + (e && e.status ? ' (HTTP ' + e.status + ')' : '');
  }

  function isAuthError(e) {
    return !!e && (e.status === 401 || e.status === 403);
  }

  function show(view) {
    ui.setup.hidden = view !== 'setup';
    ui.error.hidden = view !== 'error';
    ui.main.hidden = view !== 'main';
  }

  function showError(msg) {
    ui.errorMsg.textContent = msg;
    show('error');
  }

  async function openFocusWindow() {
    const extension = KE.ext();
    const url = extension.runtime.getURL('src/popup/focus.html');
    if (extension.windows && typeof extension.windows.create === 'function') {
      return extension.windows.create({ url, type: 'popup', width: 430, height: 190, focused: true });
    }
    if (extension.tabs && typeof extension.tabs.create === 'function') return extension.tabs.create({ url });
    throw new Error('Floating windows are not supported by this browser.');
  }

  async function openDraftSettings() {
    const extension = KE.ext();
    try {
      const url = extension.runtime.getURL('src/options/options.html') + '#ke-opt-draft-card';
      if (extension.tabs && typeof extension.tabs.create === 'function') {
        await extension.tabs.create({ url });
        return;
      }
    } catch (e) {}
    KE.openOptions();
  }

  function connectionMessage(base, e) {
    if (isAuthError(e)) return KE.T.authDenied + ' ' + KE.uiText('ui.popupConnectionAuth');
    const detail = String((e && e.serverMessage) || '').trim();
    const why = detail ? detail.slice(0, 160) + '. ' : (e && e.status ? '(HTTP ' + e.status + ') ' : '');
    return KE.uiText('ui.popupConnectionStart', { origin: KE.originOf(base), why });
  }

  function elapsed(beginStr) {
    return KE.elapsedSince(beginStr);
  }

  function tickDurations() {
    document.querySelectorAll('[data-begin]').forEach((n) => {
      if (n.dataset.begin) n.textContent = elapsed(n.dataset.begin);
    });
  }

  function customerItems() {
    return KE.state.customers.map((c) => ({ value: String(c.id), label: c.name || ('#' + c.id) }));
  }

  function projectItems() {
    return KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) }));
  }

  function activityItems() {
    return KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) }));
  }

  async function refreshActive() {
    KE.state.active = await KE.fetchActiveTimesheets();
    setNewTimerCollapsed(KE.state.active.length > 0);
    ui.active.replaceChildren();
    if (!KE.state.active.length) {
      const empty = document.createElement('div');
      empty.className = 'ke-pop-empty';
      empty.textContent = KE.T.noActive;
      ui.active.appendChild(empty);
      return;
    }
    KE.state.active.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'ke-pop-timer';
      const dot = document.createElement('span');
      dot.className = 'ke-pop-dot';
      const info = document.createElement('div');
      info.className = 'ke-pop-timer-info';
      const title = document.createElement('div');
      title.className = 'ke-pop-timer-title';
      title.textContent = KE.describeProjectRef(t.project);
      const act = KE.describeActivityRef(t.activity);
      if (act) title.textContent += ' · ' + act;
      const sub = document.createElement('div');
      sub.className = 'ke-pop-timer-sub';
      const dur = document.createElement('span');
      dur.className = 'ke-pop-dur';
      dur.dataset.begin = t.begin;
      dur.textContent = elapsed(t.begin);
      sub.appendChild(dur);
      sub.appendChild(document.createTextNode(t.description ? ' — ' + t.description : ' — ' + KE.T.activeNow));
      info.appendChild(title);
      info.appendChild(sub);
      const stop = document.createElement('button');
      stop.className = 'ke-pop-btn ke-pop-btn-stop';
      stop.type = 'button';
      stop.textContent = KE.T.stop;
      stop.addEventListener('click', async () => {
        stop.disabled = true;
        try {
          await KE.apiPatch('/api/timesheets/' + encodeURIComponent(t.id) + '/stop');
          setStatus(KE.T.stoppedOk, 'ok');
          await refresh();
        } catch (e) {
          setStatus(popError(e, KE.T.stopFail), 'err');
        }
      });
      const edit = document.createElement('button');
      edit.className = 'ke-pop-btn ke-pop-btn-edit';
      edit.type = 'button';
      edit.textContent = '✎';
      edit.title = KE.T.edit;
      edit.setAttribute('aria-label', KE.T.edit);
      edit.addEventListener('click', () => { openActiveEdit(row, t.id).catch(() => {}); });
      row.appendChild(dot);
      row.appendChild(info);
      row.appendChild(edit);
      row.appendChild(stop);
      ui.active.appendChild(row);
    });
  }

  async function openActiveEdit(row, timerId) {
    const t = KE.state.active.find((x) => String(x.id) === String(timerId));
    if (!t) return;
    const projId = KE.entityId(t.project);
    const actId = KE.entityId(t.activity);
    row.replaceChildren();
    const form = document.createElement('div');
    form.className = 'ke-pop-edit-form';
    const projectCombo = KE.createCombo({ searchPlaceholder: KE.T.searchProject, allowEmpty: false });
    const actCombo = KE.createCombo({ searchPlaceholder: KE.T.searchActivity, allowEmpty: false });
    const descInput = document.createElement('input');
    descInput.className = 'ke-pop-input';
    descInput.type = 'text';
    descInput.placeholder = KE.T.descriptionPh;
    descInput.setAttribute('maxlength', '255');
    descInput.value = t.description || '';
    const tagsCombo = KE.createMultiCombo({ searchPlaceholder: KE.T.tagsPh });
    const errBox = document.createElement('div');
    errBox.className = 'ke-pop-edit-error';
    errBox.hidden = true;
    const actions = document.createElement('div');
    actions.className = 'ke-pop-edit-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'ke-pop-btn ke-pop-btn-primary ke-pop-edit-save';
    saveBtn.type = 'button';
    saveBtn.textContent = KE.T.save;
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ke-pop-btn ke-pop-edit-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = KE.T.cancel;
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);
    row.appendChild(form);
    const labeled = (labelText, node) => {
      const wrap = document.createElement('div');
      wrap.className = 'ke-pop-edit-field';
      const lab = document.createElement('span');
      lab.className = 'ke-pop-label';
      lab.textContent = labelText;
      wrap.appendChild(lab);
      wrap.appendChild(node);
      return wrap;
    };
    form.replaceChildren();
    form.appendChild(labeled(KE.T.project, projectCombo.root));
    form.appendChild(labeled(KE.T.activity, actCombo.root));
    form.appendChild(labeled(KE.T.description, descInput));
    form.appendChild(labeled(KE.T.tags, tagsCombo.root));
    form.appendChild(errBox);
    form.appendChild(actions);
    const showError = (msg) => {
      errBox.textContent = msg;
      errBox.hidden = false;
    };

    const doSave = async () => {
      projectCombo.flush(true);
      actCombo.flush(true);
      const project = projectCombo.getValue();
      const activity = actCombo.getValue();
      if (!project || !activity) {
        showError(KE.T.needProject);
        return;
      }
      tagsCombo.flush();
      const tagNames = await KE.ensureTags(tagsCombo.getValues());
      const payload = {
        project: Number(project),
        activity: Number(activity),
        description: descInput.value.trim(),
        tags: tagNames.join(','),
      };
      saveBtn.disabled = true;
      try {
        await KE.apiPatch('/api/timesheets/' + encodeURIComponent(t.id), payload);
        setStatus(KE.T.updatedOk, 'ok');
        await refresh();
      } catch (e) {
        saveBtn.disabled = false;
        showError(popError(e, KE.T.updateFail));
      }
    };
    saveBtn.addEventListener('click', () => { doSave().catch(() => {}); });
    cancelBtn.addEventListener('click', () => { refreshActive().catch(() => {}); });
    descInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); doSave().catch(() => {}); }
      else if (ev.key === 'Escape') refreshActive().catch(() => {});
    });

    projectCombo.setLoading(true);
    actCombo.setLoading(true);
    tagsCombo.setLoading(true);
    try {
      await KE.getProjectsCached('', false);
      projectCombo.setLoading(false);
      projectCombo.setItems(KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) })), projId);
      await KE.getActivitiesCached(projId, false);
      actCombo.setLoading(false);
      actCombo.setItems(activityItems(), actId);
      await KE.loadTags();
      tagsCombo.setLoading(false);
      tagsCombo.setItems(KE.state.tags);
      tagsCombo.setValues(KE.tagNames(t.tags));
    } catch (e) {
      projectCombo.setLoading(false);
      actCombo.setLoading(false);
      tagsCombo.setLoading(false);
      showError(KE.T.refreshFail);
      return;
    }
    projectCombo.onSelect = async (v) => {
      actCombo.setLoading(true);
      try {
        await KE.getActivitiesCached(v || '', false);
        actCombo.setLoading(false);
        actCombo.setItems(activityItems());
      } catch (e) {
        actCombo.setLoading(false);
        showError(KE.T.refreshFail);
      }
    };
  }

  function setNewTimerCollapsed(collapsed) {
    if (!ui || !ui.newTimerBody || !ui.newTimerToggle) return;
    ui.newTimerBody.hidden = collapsed;
    ui.newTimerToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function setSectionCollapsed(toggle, body, collapsed) {
    if (!toggle || !body) return;
    body.hidden = collapsed;
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function toggleSection(toggle, body) {
    if (!toggle || !body) return;
    setSectionCollapsed(toggle, body, !body.hidden);
  }

  let groupMode = true;

  function paintGroupToggle() {
    ui.groupToggle.textContent = KE.T.groupTasks;
    ui.groupToggle.classList.toggle('ke-on', groupMode);
    ui.groupToggle.setAttribute('aria-pressed', groupMode ? 'true' : 'false');
  }

  async function loadGroupMode() {
    try {
      const s = await KE.getSettings();
      groupMode = !s || s.groupTasks !== false;
    } catch (e) {
      groupMode = true;
    }
    paintGroupToggle();
  }

  function buildTodayRow(t, opts) {
    const row = document.createElement('div');
    row.className = 'ke-pop-today-row';
    const info = document.createElement('div');
    info.className = 'ke-pop-timer-info';
    const title = document.createElement('div');
    title.className = 'ke-pop-timer-title';
    title.textContent = KE.describeProjectRef(t.project);
    const act = KE.describeActivityRef(t.activity);
    if (act) title.textContent += ' · ' + act;
    const sub = document.createElement('div');
    sub.className = 'ke-pop-timer-sub';
    const begin = String(t.begin || '');
    const hm = begin.slice(11, 16);
    const when = (opts && opts.date)
      ? (begin.slice(8, 10) + '/' + begin.slice(5, 7) + (hm ? ' ' + hm : ''))
      : hm;
    sub.textContent = (when ? when + ' · ' : '') + KE.formatDuration(t.duration) + (t.description ? ' — ' + t.description : '');
    info.appendChild(title);
    info.appendChild(sub);
    const go = document.createElement('button');
    go.className = 'ke-pop-btn ke-pop-btn-go';
    go.type = 'button';
    go.textContent = '▶';
    go.title = KE.T.start;
    go.addEventListener('click', () => continueTimer(t, go));
    row.appendChild(info);
    row.appendChild(go);
    return row;
  }

  function renderGroups(list) {
    const groups = KE.groupByTask(list, 8);
    groups.forEach((g) => {
      const box = document.createElement('div');
      box.className = 'ke-pop-group';
      const head = document.createElement('div');
      head.className = 'ke-pop-group-head';
      const exp = document.createElement('button');
      exp.className = 'ke-pop-expand';
      exp.type = 'button';
      exp.textContent = '▸';
      exp.setAttribute('aria-expanded', 'false');
      const info = document.createElement('div');
      info.className = 'ke-pop-timer-info';
      const title = document.createElement('div');
      title.className = 'ke-pop-timer-title';
      title.textContent = KE.describeProjectRef(g.project);
      const act = KE.describeActivityRef(g.activity);
      if (act) title.textContent += ' · ' + act;
      const sub = document.createElement('div');
      sub.className = 'ke-pop-timer-sub';
      sub.textContent = KE.nRecords(g.entries.length) + ' · ' + KE.formatDuration(g.totalDuration);
      info.appendChild(title);
      info.appendChild(sub);
      const go = document.createElement('button');
      go.className = 'ke-pop-btn ke-pop-btn-go';
      go.type = 'button';
      go.textContent = '▶';
      go.title = KE.T.start;
      go.addEventListener('click', () => continueTimer(g.entries[0], go));
      const kids = document.createElement('div');
      kids.className = 'ke-pop-group-kids';
      kids.hidden = true;
      g.entries.forEach((t) => kids.appendChild(buildTodayRow(t)));
      const toggle = () => {
        kids.hidden = !kids.hidden;
        exp.textContent = kids.hidden ? '▸' : '▾';
        exp.setAttribute('aria-expanded', kids.hidden ? 'false' : 'true');
      };
      exp.addEventListener('click', toggle);
      head.appendChild(exp);
      head.appendChild(info);
      head.appendChild(go);
      box.appendChild(head);
      box.appendChild(kids);
      ui.today.appendChild(box);
    });
  }

  async function refreshToday(force, silent) {
    if (ui.todaySec && ui.todaySec.hidden) return true;
    ui.today.replaceChildren();
    let entries = [];
    try {
      entries = (await KE.getTodayCached(force)).entries;
    } catch (e) {
      if (silent) return false;
      const err = document.createElement('div');
      err.className = 'ke-pop-empty';
      err.textContent = isAuthError(e) ? KE.T.authDenied : KE.T.refreshFail;
      ui.today.appendChild(err);
      return false;
    }
    if (groupMode) {
      const list = KE.filterToday(entries);
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'ke-pop-empty';
        empty.textContent = KE.T.noToday;
        ui.today.appendChild(empty);
        return true;
      }
      renderGroups(list);
      return true;
    }
    const recents = KE.todayRecents(entries, 8);
    if (!recents.length) {
      const empty = document.createElement('div');
      empty.className = 'ke-pop-empty';
      empty.textContent = KE.T.noToday;
      ui.today.appendChild(empty);
      return true;
    }
    recents.forEach((t) => ui.today.appendChild(buildTodayRow(t)));
    return true;
  }

  async function refreshRecent(force, silent) {
    if (ui.recentSec && ui.recentSec.hidden) return true;
    ui.recent.replaceChildren();
    let entries = [];
    try {
      entries = (await KE.getRecentCached(force)).entries;
    } catch (e) {
      if (silent) return false;
      const err = document.createElement('div');
      err.className = 'ke-pop-empty';
      err.textContent = isAuthError(e) ? KE.T.authDenied : KE.T.refreshFail;
      ui.recent.appendChild(err);
      return false;
    }
    const recents = KE.recentOthers(entries, 8);
    if (!recents.length) {
      const empty = document.createElement('div');
      empty.className = 'ke-pop-empty';
      empty.textContent = KE.T.noRecent;
      ui.recent.appendChild(empty);
      return true;
    }
    recents.forEach((t) => ui.recent.appendChild(buildTodayRow(t, { date: true })));
    return true;
  }

  async function continueTimer(t, btn) {
    btn.disabled = true;
    try {
      const projectId = KE.entityId(t.project);
      const activityId = KE.entityId(t.activity);
      if (!projectId || !activityId) {
        setStatus(KE.T.needProject, 'err');
        return;
      }
      const tagNames = await KE.ensureTags(KE.tagNames(t.tags));
      const payload = {
        begin: KE.nowLocal(),
        project: Number(projectId),
        activity: Number(activityId),
      };
      if (t.description) payload.description = t.description;
      if (tagNames.length) payload.tags = tagNames.join(',');
      await KE.apiPost('/api/timesheets', payload);
      await KE.storageSet({
        keProject: String(payload.project),
        keActivity: String(payload.activity),
      });
      setStatus(KE.T.startedOk, 'ok');
      await refresh();
      await KE.reloadKimaiTabs(kimaiBase);
    } catch (e) {
      setStatus(popError(e, KE.T.startFail), 'err');
    } finally {
      btn.disabled = false;
    }
  }

  let kimaiBase = '';

  async function startNew() {
    ui.project.flush(true);
    ui.activity.flush(true);
    ui.tags.flush();
    const projectId = ui.project.getValue();
    const activityId = ui.activity.getValue();
    if (!projectId || !activityId) {
      setStatus(KE.T.needProject, 'err');
      return;
    }
    const description = ui.desc.value.trim();
    ui.start.disabled = true;
    try {
      const tagNames = await KE.ensureTags(ui.tags.getValues());
      const payload = { begin: KE.nowLocal(), project: Number(projectId), activity: Number(activityId) };
      if (description) payload.description = description;
      if (tagNames.length) payload.tags = tagNames.join(',');
      await KE.apiPost('/api/timesheets', payload);
      await KE.storageSet({ keCustomer: ui.customer.getValue() || '', keProject: projectId, keActivity: activityId });
      ui.desc.value = '';
      setStatus(KE.T.startedOk, 'ok');
      await refresh();
      await KE.reloadKimaiTabs(kimaiBase);
    } catch (e) {
      setStatus(popError(e, KE.T.startFail), 'err');
    } finally {
      ui.start.disabled = false;
    }
  }
  function projectsForCustomer(customerId) {
    const all = KE.state.projects;
    if (!customerId) return all;
    const cust = KE.state.customers.find((c) => String(c.id) === String(customerId));
    const cname = cust ? cust.name : '';
    return all.filter((p) =>
      String(p.customer) === String(customerId) ||
      (cname !== '' && p.parentTitle === cname));
  }

  function projectItemsFiltered() {
    return projectsForCustomer(ui.customer ? ui.customer.getValue() : '').map((p) => ({ value: String(p.id), label: KE.projectLabel(p) }));
  }

  async function handleCustomerChange() {
    ui.project.setLoading(true);
    ui.activity.setLoading(true);
    try {
      await KE.getProjectsCached('', false);
      ui.project.setLoading(false);
      ui.project.setItems(projectItemsFiltered());
      const saved = await KE.storageGet(['keProject']);
      const keep = saved.keProject && projectsForCustomer(ui.customer.getValue()).some((p) => String(p.id) === String(saved.keProject))
        ? String(saved.keProject) : '';
      if (keep) ui.project.setItems(projectItemsFiltered(), keep);
      await handleProjectChange();
    } catch (e) {
      ui.project.setLoading(false);
      ui.activity.setLoading(false);
    }
  }

  async function handleProjectChange() {
    ui.activity.setLoading(true);
    try {
      await KE.getActivitiesCached(ui.project.getValue() || '', false);
      ui.activity.setLoading(false);
      ui.activity.setItems(activityItems());
      const saved = await KE.storageGet(['keActivity']);
      if (saved.keActivity && KE.state.activityById.has(String(saved.keActivity))) {
        ui.activity.setItems(activityItems(), String(saved.keActivity));
      }
    } catch (e) {
      ui.activity.setLoading(false);
    }
  }

  async function loadNewForm(force) {
    ui.customer.setLoading(true);
    ui.project.setLoading(true);
    ui.activity.setLoading(true);
    ui.tags.setLoading(true);
    try {
      await KE.getCustomersCached(force);
      ui.customer.setLoading(false);
      ui.customer.setItems(customerItems());
      const saved = await KE.storageGet(['keCustomer', 'keProject', 'keActivity']);
      if (saved.keCustomer && KE.state.customers.some((c) => String(c.id) === String(saved.keCustomer))) {
        ui.customer.setItems(customerItems(), String(saved.keCustomer));
      }
      await KE.getProjectsCached('', force);
      ui.project.setLoading(false);
      ui.project.setItems(projectItemsFiltered());
      if (saved.keProject && projectsForCustomer(ui.customer.getValue()).some((p) => String(p.id) === String(saved.keProject))) {
        ui.project.setItems(projectItemsFiltered(), String(saved.keProject));
      }
      await KE.getActivitiesCached(ui.project.getValue() || '', force);
      ui.activity.setLoading(false);
      ui.activity.setItems(activityItems());
      if (saved.keActivity && KE.state.activityById.has(String(saved.keActivity))) {
        ui.activity.setItems(activityItems(), String(saved.keActivity));
      }
      await KE.loadTags();
      ui.tags.setLoading(false);
      ui.tags.setItems(KE.state.tags);
      return null;
    } catch (e) {
      ui.customer.setLoading(false);
      ui.project.setLoading(false);
      ui.activity.setLoading(false);
      ui.tags.setLoading(false);
      return e;
    }
  }

  let draftSnapshot = null;

  function setDraftLocked(locked) {
    [ui.customer, ui.project, ui.activity, ui.tags].forEach((combo) => {
      if (combo && typeof combo.setEnabled === 'function') combo.setEnabled(!locked);
    });
    ui.newTimerBody.classList.toggle('ke-draft-locked', locked);
  }

  async function toggleDraftMode(checked) {
    if (!checked) {
      ui.draftCheck.checked = false;
      if (draftSnapshot) {
        ui.customer.setItems(customerItems(), draftSnapshot.customer);
        await KE.getProjectsCached('', false);
        ui.project.setItems(projectItemsFiltered(), draftSnapshot.project);
        await KE.getActivitiesCached(draftSnapshot.project, false);
        ui.activity.setItems(activityItems(), draftSnapshot.activity);
        await KE.loadTags();
        ui.tags.setItems(KE.state.tags);
        ui.tags.setValues(draftSnapshot.tags);
        draftSnapshot = null;
      }
      setDraftLocked(false);
      return;
    }
    const settings = await KE.getSettings();
    const def = (settings && settings.defaultTimer) || {};
    if (!def.project || !def.activity) {
      ui.draftCheck.checked = false;
      setStatus(KE.uiText('ui.needDefaultTimer'), 'err');
      return;
    }
    draftSnapshot = {
      customer: ui.customer.getValue(),
      project: ui.project.getValue(),
      activity: ui.activity.getValue(),
      tags: ui.tags.getValues(),
    };
    ui.customer.setItems(customerItems(), def.customer || '');
    await KE.getProjectsCached('', false);
    ui.project.setItems(projectItemsFiltered(), def.project || '');
    await KE.getActivitiesCached(def.project || '', false);
    ui.activity.setItems(activityItems(), def.activity || '');
    await KE.loadTags();
    ui.tags.setItems(KE.state.tags);
    ui.tags.setValues(def.tags || []);
    setDraftLocked(true);
  }

  async function refresh() {
    await refreshActive();
    await refreshToday();
    await refreshRecent();
  }

  async function boot() {
    ui = {
      setup: $('ke-pop-setup'), setupMsg: $('ke-pop-setup-msg'), setupBtn: $('ke-pop-setup-btn'),
      error: $('ke-pop-error'), errorMsg: $('ke-pop-error-msg'),
      main: $('ke-pop-main'), active: $('ke-pop-active'), today: $('ke-pop-today'),
      newTimerToggle: $('ke-pop-new-toggle'), newTimerBody: $('ke-pop-new-body'),
      recent: $('ke-pop-recent'),
      todayToggle: $('ke-pop-today-toggle'), recentToggle: $('ke-pop-recent-toggle'),
      todaySec: $('ke-pop-today-sec'), recentSec: $('ke-pop-recent-sec'),
      desc: $('ke-pop-new-desc'), start: $('ke-pop-start'), status: $('ke-pop-status'),
      groupToggle: $('ke-pop-group-toggle'),
      draftRow: $('ke-pop-draft-row'), draftCheck: $('ke-pop-draft'),
    };
    await KE.applyLocale();
    KE.translatePage(document);
    await KE.applyTheme();
    $('ke-pop-label-desc').textContent = KE.T.description;
    $('ke-pop-label-customer').textContent = KE.T.customer;
    $('ke-pop-label-project').textContent = KE.T.project;
    $('ke-pop-label-activity').textContent = KE.T.activity;
    $('ke-pop-label-tags').textContent = KE.T.tags;
    $('ke-pop-settings').onclick = () => KE.openOptions();
    $('ke-pop-focus').onclick = async () => {
      try {
        await openFocusWindow();
      } catch (e) {
        setStatus(KE.uiText('ui.popupOpenTrackerFailed'), 'err');
      }
    };
    ui.newTimerToggle.onclick = () => setNewTimerCollapsed(!ui.newTimerBody.hidden);
    ui.todayToggle.onclick = () => toggleSection(ui.todayToggle, ui.today);
    ui.recentToggle.onclick = () => toggleSection(ui.recentToggle, ui.recent);
    ui.draftCheck.onchange = () => { toggleDraftMode(ui.draftCheck.checked).catch(() => {}); };
    $('ke-pop-draft-config').onclick = () => { openDraftSettings().catch(() => {}); };
    $('ke-pop-open').onclick = async () => {
      const s = await KE.getSettings();
      KE.openKimai(s.kimaiBaseUrl, s.keLocale);
    };
    ui.setupBtn.onclick = () => KE.openOptions();
    $('ke-pop-error-settings').onclick = () => KE.openOptions();
    $('ke-pop-error-retry').onclick = () => boot();
    $('ke-pop-new-customer').replaceChildren();
    $('ke-pop-new-project').replaceChildren();
    $('ke-pop-new-activity').replaceChildren();
    $('ke-pop-new-tags').replaceChildren();
    setStatus('', '');

    try {
      const settings = await KE.getSettings();
      const base = KE.normalizeBaseUrl(settings.kimaiBaseUrl || '');
      if (!base) {
        ui.setupMsg.textContent = KE.uiText('ui.popupSetupNoBase');
        show('setup');
        return;
      }
      const saved = await KE.localGet(['keApiToken']);
      const token = (saved && saved.keApiToken) || '';
      if (!token) {
        ui.setupMsg.textContent = KE.uiText('ui.popupSetupNoToken');
        show('setup');
        return;
      }
      if (!(await KE.hasOriginAccess(base))) {
        ui.setupMsg.textContent = KE.uiText('ui.accessMissing', { origin: KE.originOf(base) });
        ui.setupBtn.textContent = KE.uiText('ui.popupAuthorize');
        ui.setupBtn.onclick = async () => {
          if (await KE.requestOriginAccess(base)) boot();
          else setStatus(KE.uiText('ui.accessDenied'), 'err');
        };
        show('setup');
        return;
      }

      KE.apiBaseUrl = base;
      KE.authToken = token;
      KE.apiCredentials = 'omit';
      kimaiBase = base;

      ui.customer = KE.createCombo({ searchPlaceholder: KE.T.searchCustomer, emptyLabel: KE.T.allCustomers, allowEmpty: true });
      ui.project = KE.createCombo({ searchPlaceholder: KE.T.searchProject, allowEmpty: false });
      ui.activity = KE.createCombo({ searchPlaceholder: KE.T.searchActivity, allowEmpty: false });
      ui.tags = KE.createMultiCombo({
        searchPlaceholder: KE.T.tagsPh,
        onEnterEmpty: () => startNew(),
      });
      $('ke-pop-new-customer').appendChild(ui.customer.root);
      $('ke-pop-new-project').appendChild(ui.project.root);
      $('ke-pop-new-activity').appendChild(ui.activity.root);
      $('ke-pop-new-tags').appendChild(ui.tags.root);
      ui.customer.onSelect = () => { handleCustomerChange(); };
      ui.project.onSelect = () => { handleProjectChange(); };
      ui.start.onclick = () => { startNew().catch(() => {}); };
      ui.desc.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); startNew(); }
      };
      ui.groupToggle.onclick = async () => {
        groupMode = !groupMode;
        paintGroupToggle();
        try {
          await KE.saveSettings({ groupTasks: groupMode });
        } catch (e) {}
        await refreshToday(false, true);
      };
      $('ke-pop-refresh-catalog').onclick = async () => {
        const btn = $('ke-pop-refresh-catalog');
        btn.disabled = true;
        try {
          const err = await loadNewForm(true);
          setStatus(err ? popError(err, KE.T.refreshFail) : KE.T.listsUpdated, err ? 'err' : 'ok');
        } finally {
          btn.disabled = false;
        }
      };
      $('ke-pop-refresh-today').onclick = async () => {
        const btn = $('ke-pop-refresh-today');
        btn.disabled = true;
        try {
          const ok = await refreshToday(true, false);
          setStatus(ok ? KE.T.listsUpdated : KE.T.refreshFail, ok ? 'ok' : 'err');
        } catch (e) {
          setStatus(popError(e, KE.T.refreshFail), 'err');
        } finally {
          btn.disabled = false;
        }
      };
      $('ke-pop-refresh-recent').onclick = async () => {
        const btn = $('ke-pop-refresh-recent');
        btn.disabled = true;
        try {
          const ok = await refreshRecent(true, false);
          setStatus(ok ? KE.T.listsUpdated : KE.T.refreshFail, ok ? 'ok' : 'err');
        } catch (e) {
          setStatus(popError(e, KE.T.refreshFail), 'err');
        } finally {
          btn.disabled = false;
        }
      };

      show('main');
      ui.draftRow.hidden = settings.draftEnabled !== true;
      setSectionCollapsed(ui.todayToggle, ui.today, true);
      setSectionCollapsed(ui.recentToggle, ui.recent, true);
      ui.todaySec.hidden = settings.hideContinueToday === true;
      ui.recentSec.hidden = settings.hideRecents === true;
      await loadGroupMode();
      const formError = await loadNewForm(false);
      if (formError) {
        showError(connectionMessage(base, formError));
        return;
      }
      await refresh();
      tick = setInterval(tickDurations, 1000);
      if (tickToday) clearInterval(tickToday);
      tickToday = setInterval(() => { refreshToday(false, true); refreshRecent(false, true); }, KE.CACHE_TTL.today);
    } catch (e) {
      try { console.error('[Companion] popup falhou', e); } catch (ce) {}
      ui.setupMsg.textContent = KE.uiText('ui.popupLoadFailed', { error: (e && e.message) || e });
      show('setup');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
