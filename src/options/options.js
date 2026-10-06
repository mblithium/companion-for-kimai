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
      state.textContent = 'Informe uma URL válida acima.';
      state.dataset.kind = '';
      grantBtn.disabled = true;
      revokeBtn.disabled = true;
      return false;
    }
    grantBtn.disabled = false;
    const ok = await KE.hasOriginAccess(base);
    state.textContent = ok
      ? 'Acesso autorizado para ' + KE.originOf(base) + '.'
      : 'Sem acesso a ' + KE.originOf(base) + '.';
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
      input.placeholder = 'pressione as teclas…';
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
    $('ke-opt-token-state').textContent = has ? 'Chave salva neste dispositivo.' : 'Nenhuma chave salva.';
    $('ke-opt-token-state').dataset.kind = has ? 'ok' : 'warn';
    $('ke-opt-token').placeholder = has ? '••••••••••' : 'cole aqui para trocar';
    $('ke-opt-test').textContent = has ? 'Testar conexão' : 'Conectar';
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
      link.textContent = 'preencha a URL e autorize o acesso para montar o link';
      link.href = '#';
    }
  }

  async function refreshCacheState() {
    const all = await KE.localGet(null);
    const keys = Object.keys(all || {}).filter((k) => k.indexOf('keCache') === 0);
    $('ke-opt-cache-state').textContent = keys.length
      ? keys.length + ' item(ns) em cache neste dispositivo.'
      : 'Cache vazio.';
    $('ke-opt-cache-state').dataset.kind = '';
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
    await KE.applyTheme();
    $('ke-opt-toast').addEventListener('click', () => setStatus('', ''));
    const settings = await KE.getSettings();
    $('ke-opt-url').value = settings.kimaiBaseUrl || '';
    const themeSel = $('ke-opt-theme');
    themeSel.innerHTML = '';
    KE.THEMES.forEach((t) => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = KE.themeLabel(t.id);
      themeSel.appendChild(o);
    });
    themeSel.value = await KE.currentTheme();
    const localeSel = $('ke-opt-locale');
    const fillLocales = (current) => {
      localeSel.innerHTML = '';
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
    $('ke-opt-hide-date').checked = !!(settings.hideDateColumn);
    $('ke-opt-hide-sidebar').checked = !!settings.hideSidebar;
    $('ke-opt-hide-actionbar').checked = !!settings.hideActionBar;
    $('ke-opt-hide-header').checked = !!settings.hideHeader;
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
      setStatus('Padrões restaurados nos campos. Salve para aplicar.', '');
    });
    $('ke-opt-hide-date').checked = !!(settings.hideDateColumn);
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
        setStatus('URL inválida. Use o formato https://seu-kimai.exemplo', 'err');
        return;
      }
      const saved = await KE.localGet(['keApiToken']);
      if (!(saved && saved.keApiToken) && !cfg.token) {
        const settings = await KE.getSettings();
        if (settings.keUsername) {
          openUrl(KE.apiTokenUrl(cfg.base, $('ke-opt-locale').value, settings.keUsername));
        } else {
          setStatus('Preencha a URL, autorize o acesso e salve para gerar o link da chave.', 'err');
          $('ke-opt-url').focus();
        }
        return;
      }
      applyConfig(cfg);
      setStatus('Testando…', '');
      try {
        const active = KE.asArray(await KE.apiGet('/api/timesheets/active'));
        setStatus('Conexão ok (' + active.length + ' timer(s) rodando).', 'ok');
      } catch (e) {
        const detail = String((e && e.serverMessage) || '').trim();
        setStatus('Falhou' + (e && e.status ? ' (HTTP ' + e.status + ')' : '') + (detail ? ': ' + detail.slice(0, 160) : '. Verifique URL, chave e acesso abaixo.'), 'err');
      } finally {
        KE.apiBaseUrl = '';
        KE.authToken = '';
        KE.apiCredentials = 'same-origin';
      }
    });
    themeSel.addEventListener('change', () => {
    document.documentElement.dataset.keTheme = themeSel.value;
  });

  $('ke-opt-save').addEventListener('click', async () => {
    const base = KE.normalizeBaseUrl($('ke-opt-url').value);
    if (!base) {
      setStatus('URL inválida. Use o formato https://seu-kimai.exemplo', 'err');
      return;
    }
    const typed = $('ke-opt-token').value.trim();
    if (typed) {
      await KE.localSet({ keApiToken: typed });
      $('ke-opt-token').value = '';
    }
    await KE.saveSettings({
      kimaiBaseUrl: base,
      theme: themeSel.value,
      shortcuts: readShortcuts(),
      shortcutsEnabled: $('ke-opt-sc-enabled').checked,
      hideDateColumn: $('ke-opt-hide-date').checked,
      hideSidebar: $('ke-opt-hide-sidebar').checked,
      hideActionBar: $('ke-opt-hide-actionbar').checked,
      hideHeader: $('ke-opt-hide-header').checked,
      keLocale: localeSel.value,
    });
    document.documentElement.dataset.keTheme = themeSel.value;
    $('ke-opt-url').value = base;
    syncOpen();
    await refreshAccess(base);
    await refreshTokenState();
    setStatus('Configurações salvas.', 'ok');
  });

    open.addEventListener('click', (ev) => {
      if (open.href === '#' || open.getAttribute('href') === '#') ev.preventDefault();
    });

    $('ke-opt-grant').addEventListener('click', async () => {
      const base = KE.normalizeBaseUrl($('ke-opt-url').value);
      if (!base) {
        setStatus('Salve uma URL válida primeiro.', 'err');
        return;
      }
      if (await KE.requestOriginAccess(base)) {
        await refreshAccess(base);
        setStatus('Acesso autorizado.', 'ok');
      } else {
        setStatus('Acesso negado.', 'err');
      }
    });

    $('ke-opt-revoke').addEventListener('click', async () => {
      const base = KE.normalizeBaseUrl($('ke-opt-url').value);
      if (!base) {
        setStatus('Informe uma URL válida para remover o acesso.', 'err');
        return;
      }
      const removed = await KE.removeOriginAccess(base);
      const stillThere = await KE.hasOriginAccess(base);
      await refreshAccess($('ke-opt-url').value);
      if (!stillThere) {
        setStatus('Acesso removido para ' + KE.originOf(base) + '.', 'ok');
      } else {
        setStatus('Não foi possível remover (retorno: ' + removed + '). Remova em chrome://extensions, nos detalhes da extensão.', 'err');
      }
    });

    $('ke-opt-cache-refresh').addEventListener('click', async () => {
      const btn = $('ke-opt-cache-refresh');
      btn.disabled = true;
      setStatus('Atualizando cache…', '');
      try {
        const cfg = await effectiveConfig();
        if (!cfg.base) {
          setStatus('URL inválida. Use o formato https://seu-kimai.exemplo', 'err');
          return;
        }
        if (!cfg.token) {
          setStatus('Informe a chave de API para atualizar.', 'err');
          return;
        }
        applyConfig(cfg);
        await KE.getCustomersCached(true);
        await KE.getProjectsCached('', true);
        await refreshCacheState();
        setStatus('Cache atualizado.', 'ok');
      } catch (e) {
        setStatus('Falha ao atualizar o cache. Verifique URL e autenticação.', 'err');
      } finally {
        btn.disabled = false;
      }
    });

    $('ke-opt-cache-clear').addEventListener('click', async () => {
      const n = await KE.cacheClear();
      await refreshCacheState();
      setStatus(n ? 'Cache limpo (' + n + ' item(ns)).' : 'Cache já estava vazio.', 'ok');
    });

    await refreshCacheState();

    $('ke-opt-disconnect').addEventListener('click', async () => {
      const saved = await KE.localGet(['keApiToken']);
      if (!(saved && saved.keApiToken)) {
        setStatus('Nada para desconectar.', '');
        return;
      }
      if (!confirm('Desconectar?\n\nIsso apaga a chave de API salva neste dispositivo.')) return;
      await KE.localRemove(['keApiToken']);
      $('ke-opt-token').value = '';
      await refreshTokenState();
      setStatus('Desconectado.', 'ok');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
