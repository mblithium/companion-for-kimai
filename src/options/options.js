/* Extension settings interface. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let toastTimer = null;
  function setStatus(msg, kind) {
    const n = $('ke-opt-toast');
    clearTimeout(toastTimer);
    if (!msg) {
      n.hidden = true;
      n.classList.remove('ke-show');
      return;
    }
    n.textContent = msg;
    n.dataset.kind = kind || '';
    n.hidden = false;
    requestAnimationFrame(() => n.classList.add('ke-show'));
    toastTimer = setTimeout(() => {
      n.classList.remove('ke-show');
      n.hidden = true;
    }, 5000);
  }

  async function refreshAccess(base) {
    const state = $('ke-opt-access-state');
    const grantBtn = $('ke-opt-grant');
    const revokeBtn = $('ke-opt-revoke');
    if (!KE.normalizeBaseUrl(base)) {
      state.textContent = KE.uiText('ui.validUrlRequired');
      state.dataset.kind = '';
      grantBtn.disabled = true;
      revokeBtn.disabled = true;
      return false;
    }
    grantBtn.disabled = false;
    const ok = await KE.hasOriginAccess(base);
    state.textContent = KE.uiText(ok ? 'ui.accessAuthorized' : 'ui.accessMissing', { origin: KE.originOf(base) });
    state.dataset.kind = ok ? 'ok' : 'warn';
    revokeBtn.disabled = !ok;
    return ok;
  }

  function readShortcuts() {
    return {
      start: $('ke-opt-sc-start').value.trim(),
      stop: $('ke-opt-sc-stop').value.trim(),
      restart: $('ke-opt-sc-restart').value.trim(),
    };
  }

  function fillShortcuts(map) {
    const eff = Object.assign({}, KE.DEFAULT_SHORTCUTS, map || {});
    $('ke-opt-sc-start').value = eff.start || '';
    $('ke-opt-sc-stop').value = eff.stop || '';
    $('ke-opt-sc-restart').value = eff.restart || '';
  }

  function armShortcutCapture(input) {
    input.addEventListener('focus', () => {
      input.value = '';
      input.placeholder = '…';
    });
    input.addEventListener('blur', () => {
      input.placeholder = KE.uiText('ui.shortcutCaptureHint');
      if (!input.value && input.dataset.prev !== undefined) input.value = input.dataset.prev;
    });
    input.addEventListener('keydown', (ev) => {
      ev.preventDefault();
      if (ev.key === 'Escape') {
        input.value = input.dataset.prev || '';
        input.blur();
        return;
      }
      if (ev.key === 'Backspace' || ev.key === 'Delete') {
        input.dataset.prev = '';
        input.value = '';
        input.blur();
        return;
      }
      if (!(ev.ctrlKey || ev.altKey || ev.shiftKey || ev.metaKey)) return;
      input.dataset.prev = KE.describeKeyEvent(ev);
      input.value = input.dataset.prev;
      input.blur();
    });
  }

  async function refreshTokenState() {
    const s = await KE.localGet(['keApiToken']);
    const has = !!(s && s.keApiToken);
    $('ke-opt-token-state').textContent = KE.uiText(has ? 'ui.savedApiKey' : 'ui.noApiKey');
    $('ke-opt-token-state').dataset.kind = has ? 'ok' : 'warn';
    $('ke-opt-token').placeholder = has ? '••••••••••' : KE.uiText('ui.apiKeyPlaceholder');
    $('ke-opt-test').textContent = KE.uiText(has ? 'ui.testConnection' : 'ui.connect');
    $('ke-opt-disconnect').hidden = !has;
    await refreshTokenLink();
  }

  async function refreshTokenLink() {
    const link = $('ke-opt-token-url');
    const base = KE.normalizeBaseUrl($('ke-opt-url').value);
    const settings = await KE.getSettings();
    if (base && settings.keUsername) {
      const url = KE.apiTokenUrl(base, $('ke-opt-locale').value, settings.keUsername);
      link.textContent = url;
      link.href = url;
    } else {
      link.textContent = KE.uiText('ui.tokenLinkHint');
      link.href = '#';
    }
  }

  async function refreshCacheState() {
    const all = await KE.localGet(null);
    const keys = Object.keys(all || {}).filter((k) => k.indexOf('keCache') === 0);
    $('ke-opt-cache-state').textContent = keys.length
      ? KE.uiText('ui.cacheCount', { count: keys.length })
      : KE.uiText('ui.cacheEmpty');
    $('ke-opt-cache-state').dataset.kind = '';
  }

  function renderExtensionInfo() {
    let info = {};
    try {
      const runtime = KE.ext().runtime;
      if (runtime && typeof runtime.getManifest === 'function') info = runtime.getManifest() || {};
    } catch (e) {}
    const github = info.homepage_url || 'https://github.com/mblithium/companion-for-kimai';
    $('ke-opt-about-name').textContent = info.name || 'Companion for Kimai';
    $('ke-opt-about-version').textContent = info.version ? 'v' + info.version : '—';
    $('ke-opt-about-author').textContent = info.author || '—';
    $('ke-opt-about-description').textContent = KE.uiText('ui.aboutDescription');
    $('ke-opt-about-github').href = github;
    $('ke-opt-about-github').textContent = github.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }
  async function effectiveConfig() {
    const base = KE.normalizeBaseUrl($('ke-opt-url').value);
    const typed = $('ke-opt-token').value.trim();
    let token = typed;
    if (!token) {
      const s = await KE.localGet(['keApiToken']);
      token = (s && s.keApiToken) || '';
    }
    return { base, token };
  }

  function openUrl(url) {
    try {
      const t = KE.ext().tabs;
      if (t && typeof t.create === 'function') {
        const p = t.create({ url: url });
        if (p && typeof p.catch === 'function') p.catch(() => {});
        return;
      }
    } catch (e) {}
    try {
      window.open(url, '_blank', 'noopener');
    } catch (e) {}
  }

  function applyConfig(cfg) {
    KE.apiBaseUrl = cfg.base;
    KE.authToken = cfg.token || '';
    KE.apiCredentials = 'omit';
  }

  async function boot() {
    await KE.applyLocale();
    KE.translatePage(document);
    await KE.applyTheme();
    renderExtensionInfo();
    $('ke-opt-toast').addEventListener('click', () => setStatus('', ''));
    const settings = await KE.getSettings();
    let persistedUiLocale = settings.uiLocale || KE.uiLocale;
    $('ke-opt-url').value = settings.kimaiBaseUrl || '';
    const themeSel = $('ke-opt-theme');
    themeSel.replaceChildren();
    KE.THEMES.forEach((t) => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = KE.themeLabel(t.id);
      themeSel.appendChild(o);
    });
    themeSel.value = await KE.currentTheme();
    const refreshThemeLabels = () => {
      const selectedTheme = themeSel.value;
      themeSel.replaceChildren();
      KE.THEMES.forEach((theme) => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = KE.themeLabel(theme.id);
        themeSel.appendChild(option);
      });
      themeSel.value = selectedTheme;
    };
    const localeSel = $('ke-opt-locale');
    const fillLocales = (current) => {
      localeSel.replaceChildren();
      const vals = KE.SUPPORTED_LOCALES.slice();
      if (current && vals.indexOf(current) < 0) vals.unshift(current);
      vals.forEach((v) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        localeSel.appendChild(o);
      });
      localeSel.value = current || 'en';
    };
    fillLocales(settings.keLocale);
    const draftEnabledBox = $('ke-opt-draft-enabled');
    const draftForm = $('ke-opt-draft-form');
    draftEnabledBox.checked = settings.draftEnabled === true;
    draftForm.hidden = !draftEnabledBox.checked;
    draftEnabledBox.addEventListener('change', () => {
      draftForm.hidden = !draftEnabledBox.checked;
    });
    const defCustomer = KE.createCombo({ searchPlaceholder: KE.T.searchCustomer, emptyLabel: KE.T.allCustomers, allowEmpty: true });
    const defProject = KE.createCombo({ searchPlaceholder: KE.T.searchProject, allowEmpty: false });
    const defActivity = KE.createCombo({ searchPlaceholder: KE.T.searchActivity, allowEmpty: false });
    const defTags = KE.createMultiCombo({ searchPlaceholder: KE.T.tagsPh });
    $('ke-opt-def-customer').replaceChildren();
    $('ke-opt-def-project').replaceChildren();
    $('ke-opt-def-activity').replaceChildren();
    $('ke-opt-def-tags').replaceChildren();
    $('ke-opt-def-customer').appendChild(defCustomer.root);
    $('ke-opt-def-project').appendChild(defProject.root);
    $('ke-opt-def-activity').appendChild(defActivity.root);
    $('ke-opt-def-tags').appendChild(defTags.root);
    const savedDefault = settings.defaultTimer || {};
    defCustomer.onSelect = () => { loadDefaultProjects(defCustomer.getValue()); };
    defProject.onSelect = () => { loadDefaultActivities(defProject.getValue()); };
    let catalogCfg = null;
    async function catalogGet(path) {
      if (catalogCfg) applyConfig(catalogCfg);
      return KE.apiGet(path);
    }
    async function loadDefaultProjects(customerId, selectedProject) {
      defProject.setLoading(true);
      try {
        let url = '/api/projects?visible=1&ignoreDates=1&size=1000';
        if (customerId) url += '&customers%5B%5D=' + encodeURIComponent(customerId);
        KE.applyProjects(await catalogGet(url));
        defProject.setLoading(false);
        defProject.setItems(KE.state.projects.map((p) => ({ value: String(p.id), label: KE.projectLabel(p) })), selectedProject || '');
      } catch (e) {
        defProject.setLoading(false);
      }
    }
    async function loadDefaultActivities(projectId, selectedActivity) {
      defActivity.setLoading(true);
      try {
        let list = [];
        if (projectId) {
          const filtered = KE.asArray(await catalogGet('/api/activities?visible=1&size=1000&projects%5B%5D=' + encodeURIComponent(projectId)));
          const globals = KE.asArray(await catalogGet('/api/activities?visible=1&size=1000&globals=true'));
          const seen = new Set();
          list = filtered.concat(globals).filter((a) => {
            const k = String(a.id);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        } else {
          list = KE.asArray(await catalogGet('/api/activities?visible=1&size=1000&globals=true'));
        }
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        KE.applyActivities(list);
        defActivity.setLoading(false);
        defActivity.setItems(KE.state.activities.map((a) => ({ value: String(a.id), label: a.name || ('#' + a.id) })), selectedActivity || '');
      } catch (e) {
        defActivity.setLoading(false);
      }
    }
    async function loadDefaultCatalogs() {
      const cfg = await effectiveConfig();
      if (!cfg.base || !cfg.token || !(await KE.hasOriginAccess(cfg.base))) {
        $('ke-opt-def-state').textContent = KE.uiText('ui.catalogUnavailable');
        return false;
      }
      catalogCfg = cfg;
      applyConfig(cfg);
      try {
        KE.applyCustomers(await catalogGet('/api/customers?visible=1&size=1000'));
        defCustomer.setLoading(false);
        defCustomer.setItems(KE.state.customers.map((c) => ({ value: String(c.id), label: c.name || ('#' + c.id) })), savedDefault.customer || '');
        await loadDefaultProjects(defCustomer.getValue() || savedDefault.customer || '', savedDefault.project || '');
        await loadDefaultActivities(defProject.getValue() || savedDefault.project || '', savedDefault.activity || '');
        const rawTags = KE.asArray(await catalogGet('/api/tags?visible=1&size=1000'));
        KE.state.tags = rawTags.map((t) => {
          if (typeof t === 'string') return { value: t, label: t };
          return { value: String((t && (t.name || t.id)) || ''), label: (t && t.name) || String((t && t.id) || '') };
        }).filter((t) => t.value);
        KE.state.tags.sort((a, b) => a.label.localeCompare(b.label));
        defTags.setLoading(false);
        defTags.setItems(KE.state.tags);
        defTags.setValues(savedDefault.tags || []);
        $('ke-opt-def-state').textContent = '';
        return true;
      } catch (e) {
        $('ke-opt-def-state').textContent = KE.uiText('ui.catalogUnavailable');
        return false;
      } finally {
        KE.apiBaseUrl = '';
        KE.authToken = '';
        KE.apiCredentials = 'same-origin';
      }
    }
    loadDefaultCatalogs().catch(() => {});
    const readDefaultTimer = () => ({
      customer: defCustomer.getValue() || '',
      project: defProject.getValue() || '',
      activity: defActivity.getValue() || '',
      tags: defTags.getValues(),
    });
    const uiLocaleSel = $('ke-opt-ui-locale');
    uiLocaleSel.value = KE.uiLocale;
    uiLocaleSel.addEventListener('change', async () => {
      KE.setLocale(uiLocaleSel.value);
      KE.translatePage(document);
      refreshThemeLabels();
      await refreshAccess($('ke-opt-url').value);
      await refreshTokenState();
      await refreshCacheState();
    });
    localeSel.addEventListener('change', () => syncOpen());
    (async () => {
      try {
        const cfg = await effectiveConfig();
        if (!cfg.base || !cfg.token) return;
        if (!(await KE.hasOriginAccess(cfg.base))) return;
        applyConfig(cfg);
        const me = await KE.fetchCurrentUser();
        if (me.language) {
          fillLocales(me.language);
          await KE.saveSettings({ keLocale: me.language });
        }
        if (me.username) await KE.saveSettings({ keUsername: me.username });
      } catch (e) {}
      finally {
        KE.apiBaseUrl = '';
        KE.authToken = '';
        KE.apiCredentials = 'same-origin';
      }
      syncOpen();
      await refreshTokenState();
    })();
    $('ke-opt-hide-navigation').checked = !!(settings.hideNavigation || settings.hideSidebar || settings.hideHeader);
    $('ke-opt-hide-actionbar').checked = !!settings.hideActionBar;
    $('ke-opt-hide-recent').checked = !!settings.hideRecents;
    $('ke-opt-hide-continue').checked = !!settings.hideContinueToday;
    fillShortcuts(settings.shortcuts);
    $('ke-opt-sc-enabled').checked = !settings || settings.shortcutsEnabled !== false;
    ['ke-opt-sc-start', 'ke-opt-sc-stop', 'ke-opt-sc-restart'].forEach((id) => {
      const inp = $(id);
      inp.dataset.prev = inp.value;
      armShortcutCapture(inp);
    });
    $('ke-opt-sc-reset').addEventListener('click', () => {
      fillShortcuts(KE.DEFAULT_SHORTCUTS);
      ['ke-opt-sc-start', 'ke-opt-sc-stop', 'ke-opt-sc-restart'].forEach((id) => { $(id).dataset.prev = $(id).value; });
      setStatus(KE.uiText('ui.restoreShortcutsMessage'), '');
    });
    const open = $('ke-opt-open');
    const syncOpen = () => {
      const base = KE.normalizeBaseUrl($('ke-opt-url').value);
      open.href = base ? KE.timesheetPath(base, $('ke-opt-locale').value) : '#';
      open.style.opacity = base ? '' : '0.4';
    };
    syncOpen();
    await refreshAccess($('ke-opt-url').value);

    $('ke-opt-url').addEventListener('input', () => {
      syncOpen();
      refreshAccess($('ke-opt-url').value);
      refreshTokenLink();
    });
    localeSel.addEventListener('change', () => {
      syncOpen();
      refreshTokenLink();
    });

    $('ke-opt-test').addEventListener('click', async () => {
      const cfg = await effectiveConfig();
      if (!cfg.base) {
        setStatus(KE.uiText('ui.invalidUrl'), 'err');
        return;
      }
      const saved = await KE.localGet(['keApiToken']);
      if (!(saved && saved.keApiToken) && !cfg.token) {
        const settings = await KE.getSettings();
        if (settings.keUsername) {
          openUrl(KE.apiTokenUrl(cfg.base, $('ke-opt-locale').value, settings.keUsername));
        } else {
          setStatus(KE.uiText('ui.fillUrlGrantSave'), 'err');
          $('ke-opt-url').focus();
        }
        return;
      }
      applyConfig(cfg);
      setStatus(KE.uiText('ui.connecting'), '');
      try {
        const active = KE.asArray(await KE.apiGet('/api/timesheets/active'));
        setStatus(KE.uiText('ui.connectionOk', { count: active.length }), 'ok');
      } catch (e) {
        const detail = String((e && e.serverMessage) || '').trim();
        setStatus(KE.uiText('ui.connectionFailed') + (e && e.status ? ' (HTTP ' + e.status + ')' : '') +
          (detail ? ': ' + detail.slice(0, 160) : KE.uiText('ui.connectionFallback')), 'err');
      } finally {
        KE.apiBaseUrl = '';
        KE.authToken = '';
        KE.apiCredentials = 'same-origin';
      }
    });
    themeSel.addEventListener('change', () => {
    document.documentElement.dataset.keTheme = themeSel.value;
  });

  $('ke-opt-save').onclick = async () => {
    const base = KE.normalizeBaseUrl($('ke-opt-url').value);
    if (!base) {
      setStatus(KE.uiText('ui.invalidUrl'), 'err');
      return;
    }
    const localeChanged = persistedUiLocale !== uiLocaleSel.value;
    const typed = $('ke-opt-token').value.trim();
    if (typed) {
      await KE.localSet({ keApiToken: typed });
      $('ke-opt-token').value = '';
    }
    const defaultTimer = readDefaultTimer();
    const draftEnabled = draftEnabledBox.checked;
    if (draftEnabled && !(defaultTimer.project && defaultTimer.activity)) {
      setStatus(KE.uiText('ui.needDefaultTimer'), 'err');
      return;
    }
    await KE.saveSettings({
      kimaiBaseUrl: base,
      theme: themeSel.value,
      uiLocale: uiLocaleSel.value,
      draftEnabled,
      defaultTimer,
      shortcuts: readShortcuts(),
      shortcutsEnabled: $('ke-opt-sc-enabled').checked,
      hideNavigation: $('ke-opt-hide-navigation').checked,
      hideSidebar: false,
      hideActionBar: $('ke-opt-hide-actionbar').checked,
      hideHeader: false,
      hideRecents: $('ke-opt-hide-recent').checked,
      hideContinueToday: $('ke-opt-hide-continue').checked,
      keLocale: localeSel.value,
    });
    KE.setLocale(uiLocaleSel.value);
    KE.translatePage(document);
    persistedUiLocale = uiLocaleSel.value;
    document.documentElement.dataset.keTheme = themeSel.value;
    $('ke-opt-url').value = base;
    syncOpen();
    await refreshAccess(base);
    await refreshTokenState();
    await refreshCacheState();
    setStatus(KE.uiText('ui.settingsSaved'), 'ok');
    if (localeChanged) await KE.reloadKimaiTabs(base);
  };

    open.addEventListener('click', (ev) => {
      if (open.href === '#' || open.getAttribute('href') === '#') ev.preventDefault();
    });

    $('ke-opt-grant').addEventListener('click', async () => {
      const base = KE.normalizeBaseUrl($('ke-opt-url').value);
      if (!base) {
        setStatus(KE.uiText('ui.validUrlRequired'), 'err');
        return;
      }
      if (await KE.requestOriginAccess(base)) {
        await refreshAccess(base);
        setStatus(KE.uiText('ui.accessGranted'), 'ok');
      } else {
        setStatus(KE.uiText('ui.accessDenied'), 'err');
      }
    });

    $('ke-opt-revoke').addEventListener('click', async () => {
      const base = KE.normalizeBaseUrl($('ke-opt-url').value);
      if (!base) {
        setStatus(KE.uiText('ui.removeAccessUrlRequired'), 'err');
        return;
      }
      const removed = await KE.removeOriginAccess(base);
      const stillThere = await KE.hasOriginAccess(base);
      await refreshAccess($('ke-opt-url').value);
      if (!stillThere) {
        setStatus(KE.uiText('ui.accessRemoved', { origin: KE.originOf(base) }), 'ok');
      } else {
        setStatus(KE.uiText('ui.removeAccessFailed', { result: removed }), 'err');
      }
    });

    $('ke-opt-cache-refresh').addEventListener('click', async () => {
      const btn = $('ke-opt-cache-refresh');
      btn.disabled = true;
      setStatus(KE.uiText('ui.updatingCache'), '');
      try {
        const cfg = await effectiveConfig();
        if (!cfg.base) {
          setStatus(KE.uiText('ui.invalidUrl'), 'err');
          return;
        }
        if (!cfg.token) {
          setStatus(KE.uiText('ui.tokenRequired'), 'err');
          return;
        }
        applyConfig(cfg);
        await KE.getCustomersCached(true);
        await KE.getProjectsCached('', true);
        await refreshCacheState();
        setStatus(KE.uiText('ui.cacheUpdated'), 'ok');
      } catch (e) {
        setStatus(KE.uiText('ui.cacheUpdateFailed'), 'err');
      } finally {
        btn.disabled = false;
      }
    });

    $('ke-opt-cache-clear').addEventListener('click', async () => {
      const n = await KE.cacheClear();
      await refreshCacheState();
      setStatus(n ? KE.uiText('ui.cacheCleared', { count: n }) : KE.uiText('ui.cacheAlreadyEmpty'), 'ok');
    });

    await refreshCacheState();

    $('ke-opt-disconnect').addEventListener('click', async () => {
      const saved = await KE.localGet(['keApiToken']);
      if (!(saved && saved.keApiToken)) {
        setStatus(KE.uiText('ui.nothingToDisconnect'), '');
        return;
      }
      if (!confirm(KE.uiText('ui.confirmDisconnect'))) return;
      await KE.localRemove(['keApiToken']);
      $('ke-opt-token').value = '';
      await refreshTokenState();
      setStatus(KE.uiText('ui.disconnected'), 'ok');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
