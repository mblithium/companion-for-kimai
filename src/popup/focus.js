/* Floating active timer tracker. */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const PAUSED_TIMER_KEY = 'kePausedTimer';
  let kimaiBase = '';
  let currentTimer = null;
  let currentMode = 'idle';
  let actionPending = false;

  const ui = {
    title: $('ke-focus-title'),
    status: $('ke-focus-status'),
    row: $('ke-focus-row'),
    task: $('ke-focus-task'),
    meta: $('ke-focus-meta'),
    duration: $('ke-focus-duration'),
    action: $('ke-focus-action'),
    empty: $('ke-focus-empty'),
    settings: $('ke-focus-settings'),
  };

  function setStatus(message, kind) {
    ui.status.textContent = message || '';
    ui.status.dataset.kind = kind || '';
    ui.status.hidden = !message;
  }

  function renderEmpty(message, showSettings) {
    currentTimer = null;
    currentMode = 'idle';
    ui.row.hidden = true;
    ui.empty.textContent = message || KE.T.noActive;
    ui.empty.hidden = false;
    ui.settings.textContent = '⚙ ' + KE.T.openSettings;
    ui.settings.hidden = !showSettings;
  }

  function renderTimer(timer, paused) {
    currentTimer = timer;
    currentMode = paused ? 'paused' : 'running';
    const project = paused ? timer.projectLabel : KE.describeProjectRef(timer.project);
    const activity = paused ? timer.activityLabel : KE.describeActivityRef(timer.activity);
    const details = [];
    if (timer.description) details.push(timer.description);
    const tags = paused ? (timer.tags || []) : KE.tagNames(timer.tags);
    if (tags.length) details.push(tags.join(', '));
    if (paused) details.push(KE.T.trackerPaused);
    else if (!details.length) details.push(KE.T.activeNow);

    ui.task.textContent = project + (activity ? ' · ' + activity : '');
    ui.meta.textContent = details.join(' · ');
    ui.duration.dataset.begin = paused ? '' : (timer.begin || '');
    ui.duration.textContent = paused
      ? KE.formatDuration(timer.elapsedSeconds)
      : KE.elapsedSince(timer.begin);
    ui.action.textContent = paused ? '▶ ' + KE.T.trackerResume : '⏸ ' + KE.T.trackerPause;
    ui.action.dataset.mode = currentMode;
    ui.action.hidden = false;
    ui.action.disabled = actionPending;
    ui.row.hidden = false;
    ui.empty.hidden = true;
    ui.settings.hidden = true;
  }

  async function loadTimer() {
    if (actionPending) return;
    const [activePayload, local] = await Promise.all([
      KE.apiGet('/api/timesheets/active'),
      KE.localGet([PAUSED_TIMER_KEY]),
    ]);
    const active = KE.asArray(activePayload)
      .slice()
      .sort((a, b) => String(a.begin || '').localeCompare(String(b.begin || '')));
    const paused = local && local[PAUSED_TIMER_KEY];
    if (active.length) renderTimer(active[0], false);
    else if (paused) renderTimer(paused, true);
    else renderEmpty(KE.T.noActive, false);
  }

  function updateDuration() {
    if (currentMode === 'running' && currentTimer && currentTimer.begin) {
      ui.duration.textContent = KE.elapsedSince(currentTimer.begin);
    }
  }

  async function pauseTimer(timer) {
    const projectId = KE.entityId(timer.project);
    const activityId = KE.entityId(timer.activity);
    if (!timer.id || !projectId || !activityId) throw new Error(KE.T.needProject);
    const beginMs = new Date(timer.begin).getTime();
    const snapshot = {
      projectId,
      activityId,
      projectLabel: KE.describeProjectRef(timer.project),
      activityLabel: KE.describeActivityRef(timer.activity),
      description: timer.description || '',
      tags: KE.tagNames(timer.tags),
      elapsedSeconds: Number.isNaN(beginMs) ? 0 : Math.max(0, Math.floor((Date.now() - beginMs) / 1000)),
    };
    await KE.localSet({ [PAUSED_TIMER_KEY]: snapshot });
    try {
      await KE.apiPatch('/api/timesheets/' + encodeURIComponent(timer.id) + '/stop');
    } catch (error) {
      await KE.localRemove([PAUSED_TIMER_KEY]);
      throw error;
    }
    setStatus(KE.T.stoppedOk, 'ok');
  }

  async function resumeTimer(timer) {
    if (!timer.projectId || !timer.activityId) throw new Error(KE.T.needProject);
    const tags = await KE.ensureTags(timer.tags || []);
    const payload = {
      begin: KE.nowLocal(),
      project: Number(timer.projectId),
      activity: Number(timer.activityId),
    };
    if (timer.description) payload.description = timer.description;
    if (tags.length) payload.tags = tags.join(',');
    await KE.apiPost('/api/timesheets', payload);
    await KE.storageSet({ keProject: String(payload.project), keActivity: String(payload.activity) });
    await KE.localRemove([PAUSED_TIMER_KEY]);
    setStatus(KE.T.startedOk, 'ok');
  }

  async function toggleTimer() {
    if (actionPending || !currentTimer) return;
    actionPending = true;
    ui.action.disabled = true;
    setStatus('', '');
    try {
      if (currentMode === 'running') await pauseTimer(currentTimer);
      else if (currentMode === 'paused') await resumeTimer(currentTimer);
      await KE.reloadKimaiTabs(kimaiBase);
      KE.notifyBackground();
    } catch (error) {
      const detail = String((error && error.serverMessage) || '').trim();
      setStatus(detail ? detail.slice(0, 160) : (error && error.message) || KE.T.stopFail, 'err');
    } finally {
      actionPending = false;
      ui.action.disabled = false;
      try { await loadTimer(); } catch (error) {
        setStatus(KE.T.trackerLoadFail, 'err');
      }
    }
  }

  async function boot() {
    ui.title.textContent = KE.T.trackerTitle;
    ui.action.onclick = toggleTimer;
    ui.settings.onclick = () => KE.openOptions();
    await KE.applyTheme();
    try {
      const settings = await KE.getSettings();
      kimaiBase = KE.normalizeBaseUrl(settings.kimaiBaseUrl || '');
      const saved = await KE.localGet(['keApiToken']);
      const token = (saved && saved.keApiToken) || '';
      if (!kimaiBase || !token || !(await KE.hasOriginAccess(kimaiBase))) {
        renderEmpty(KE.T.trackerSetup, true);
        return;
      }
      KE.apiBaseUrl = kimaiBase;
      KE.authToken = token;
      KE.apiCredentials = 'omit';
      await loadTimer();
      setInterval(updateDuration, 1000);
      setInterval(() => {
        loadTimer().catch(() => setStatus(KE.T.trackerLoadFail, 'err'));
      }, 5000);
    } catch (error) {
      renderEmpty(KE.T.trackerSetup, true);
      setStatus(KE.T.trackerLoadFail, 'err');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
