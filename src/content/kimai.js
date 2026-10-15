/* Kimai data access and state. */
(function () {
  'use strict';

  KE.state = {
    customers: [],
    projects: [],
    activities: [],
    projectById: new Map(),
    activityById: new Map(),
    active: [],
    tags: [],
    timer: null,
  };

  KE.projectLabel = function (p) {
    if (p.parentTitle) return p.parentTitle + ' / ' + p.name;
    if (p.customerName) return p.customerName + ' / ' + p.name;
    return p.name || ('#' + p.id);
  };

  KE.loadCustomers = async function () {
    try {
      KE.applyCustomers(await KE.apiGet('/api/customers?visible=1&size=1000'));
    } catch (e) {
      KE.state.customers = [];
      throw e;
    }
  };

  KE.applyCustomers = function (arr) {
    KE.state.customers = KE.asArray(arr).filter((c) => c.visible !== false);
    KE.state.customers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  };

  KE.loadProjects = async function (customerId) {
    let url = '/api/projects?visible=1&ignoreDates=1&size=1000';
    if (customerId) url = '/api/projects?visible=1&ignoreDates=1&size=1000&customers%5B%5D=' + encodeURIComponent(customerId);
    KE.applyProjects(await KE.apiGet(url));
  };

  KE.applyProjects = function (arr) {
    KE.state.projects = KE.asArray(arr);
    KE.state.projects.sort((a, b) => KE.projectLabel(a).localeCompare(KE.projectLabel(b)));
    KE.state.projectById = new Map(KE.state.projects.map((p) => [String(p.id), p]));
  };

  KE.loadActivities = async function (projectId) {
    let list = [];
    if (projectId) {
      const filtered = KE.asArray(await KE.apiGet('/api/activities?visible=1&size=1000&projects%5B%5D=' + encodeURIComponent(projectId)));
      const globals = KE.asArray(await KE.apiGet('/api/activities?visible=1&size=1000&globals=true'));
      const seen = new Set();
      list = filtered.concat(globals).filter((a) => {
        const k = String(a.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } else {
      list = KE.asArray(await KE.apiGet('/api/activities?visible=1&size=1000&globals=true'));
    }
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    KE.applyActivities(list);
  };

  KE.applyActivities = function (list) {
    KE.state.activities = KE.asArray(list);
    KE.state.activities.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    KE.state.activityById = new Map(KE.state.activities.map((a) => [String(a.id), a]));
  };
  KE.loadTags = async function () {
    try {
      const raw = KE.asArray(await KE.apiGet('/api/tags?visible=1&size=1000'));
      KE.state.tags = raw.map((t) => {
        if (typeof t === 'string') return { value: t, label: t };
        return { value: String((t && (t.name || t.id)) || ''), label: (t && t.name) || String((t && t.id) || '') };
      }).filter((t) => t.value);
      KE.state.tags.sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
      KE.state.tags = [];
    }
  };

  KE.fetchActiveTimesheets = async function () {
    try {
      return KE.asArray(await KE.apiGet('/api/timesheets/active'));
    } catch (e) {
      return [];
    }
  };
  KE.fetchCurrentUser = async function () {
    const me = await KE.apiGet('/api/users/me');
    return {
      username: (me && (me.username || me.alias)) || '',
      language: (me && (me.language || me.locale)) || '',
    };
  };
  function loginRedirected(res) {
    try {
      return String((res && res.url) || '').indexOf('/login') >= 0;
    } catch (e) {
      return false;
    }
  }
  function authRequiredError() {
    const err = new Error('login');
    err.status = 401;
    return err;
  }
  KE.parseCsrfToken = function (html, fieldName) {
    const src = String(html || '');
    const esc = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp('name="' + esc + '"[^>]*value="([^"]+)"'),
      new RegExp("name='" + esc + "'[^>]*value='([^']+)'"),
      new RegExp('value="([^"]+)"[^>]*name="' + esc + '"'),
      new RegExp("value='([^']+)'[^>]*name='" + esc + "'"),
    ];
    for (const re of patterns) {
      const m = src.match(re);
      if (m) return m[1];
    }
    return '';
  };
  KE.parseAccessToken = function (html) {
    const m = String(html || '').match(/<pre[^>]*>\s*<code[^>]*>([^<]+)<\/code>\s*<\/pre>/);
    return m ? m[1].trim() : '';
  };
  KE.parseTokenList = function (html) {
    const out = [];
    const rows = String(html || '').match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
    rows.forEach((row) => {
      const name = (row.match(/<td[^>]*>([^<]*)<\/td>/) || [])[1];
      const hrefs = [...row.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const deleteHref = hrefs.filter((h) => /api-token/i.test(h)).pop() || hrefs[hrefs.length - 1] || '';
      const id = (deleteHref.match(/(\d+)/) || [])[1] ||
        (row.match(/\/api\/users\/api-token\/(\d+)/) || [])[1];
      if (name && String(name).trim() && id) {
        out.push({ id: id, name: String(name).trim(), deleteUrl: deleteHref });
      }
    });
    return out;
  };
  KE.autoCreateToken = async function (opts) {
    const locale = (opts && opts.locale) || 'en';
    const username = opts && opts.username;
    const name = (opts && opts.name) || 'Companion for Kimai';
    const root = (opts && opts.baseUrl) ? String(opts.baseUrl).replace(/\/+$/, '') : '';
    const cred = (opts && opts.credentials) || 'same-origin';
    const base = root + '/' + locale + '/profile/' + encodeURIComponent(username);
    const formRes = await fetch(base + '/create-access-token', { credentials: cred });
    if (loginRedirected(formRes)) throw authRequiredError();
    const formHtml = await formRes.text();
    const csrf = KE.parseCsrfToken(formHtml, 'access_token_form[_token]');
    if (!csrf) {
      const err = new Error('form');
      err.status = 0;
      throw err;
    }
    const body = new URLSearchParams();
    body.set('access_token_form[name]', name);
    body.set('access_token_form[_token]', csrf);
    const postRes = await fetch(base + '/create-access-token', {
      method: 'POST',
      credentials: cred,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (loginRedirected(postRes)) throw authRequiredError();
    let token = '';
    try {
      token = KE.parseAccessToken(await postRes.text());
    } catch (e) {}
    if (!token) {
      const overRes = await fetch(base + '/api-token', { credentials: cred });
      if (loginRedirected(overRes)) throw authRequiredError();
      token = KE.parseAccessToken(await overRes.text());
    }
    if (!token) {
      const err = new Error('token');
      err.status = 0;
      throw err;
    }
    return { token: token };
  };

  KE.deleteAccessToken = async function (id, opts) {
    const root = (opts && opts.baseUrl) ? String(opts.baseUrl).replace(/\/+$/, '') : '';
    let url = root + '/api/users/api-token/' + encodeURIComponent(id);
    if (opts && opts.url) {
      const u = String(opts.url);
      url = /^[a-z]+:\/\//i.test(u) ? u : root + (u.charAt(0) === '/' ? u : '/' + u);
    }
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: (opts && opts.credentials) || 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return true;
  };
  KE.autoConnectKimai = async function (opts) {
    const baseName = (opts && opts.name) || 'Companion for Kimai';
    const name = baseName + ' ' + KE.shortHash();
    const root = (opts && opts.baseUrl) ? String(opts.baseUrl).replace(/\/+$/, '') : '';
    const cred = (opts && opts.credentials) || 'same-origin';
    const listRes = await fetch(
      root + '/' + ((opts && opts.locale) || 'en') + '/profile/' + encodeURIComponent(opts.username) + '/api-token',
      { credentials: cred }
    );
    if (loginRedirected(listRes)) throw authRequiredError();
    const page = await listRes.text();
    const replaced = [];
    for (const t of KE.parseTokenList(page)) {
      if (t.name === baseName || t.name.indexOf(baseName + ' ') === 0) {
        try {
          await KE.deleteAccessToken(t.id, { baseUrl: root, credentials: cred, url: t.deleteUrl });
          replaced.push(t.id);
        } catch (e) {}
      }
    }
    const created = await KE.autoCreateToken(Object.assign({}, opts, { name: name }));
    return { token: created.token, replaced: replaced, name: name };
  };
  KE.describeProjectRef = function (ref) {
    const id = KE.entityId(ref);
    const cached = KE.state.projectById.get(id);
    if (cached) return KE.projectLabel(cached);
    if (ref && typeof ref === 'object') {
      const cust = ref.parentTitle
        || (ref.customer && typeof ref.customer === 'object' ? ref.customer.name : ref.customerName)
        || '';
      const name = ref.name || ('#' + (id || '?'));
      return cust ? cust + ' / ' + name : name;
    }
    return 'Projeto #' + (id || '?');
  };

  KE.describeActivityRef = function (ref) {
    const id = KE.entityId(ref);
    const cached = KE.state.activityById.get(id);
    if (cached) return cached.name || ('#' + id);
    if (ref && typeof ref === 'object') return ref.name || ('#' + (id || '?'));
    return id ? '#' + id : '';
  };
  KE.ensureTags = async function (names) {
    const wanted = (names || []).map((n) => String(n).trim()).filter(Boolean);
    if (!wanted.length) return [];
    try {
      const existing = KE.asArray(await KE.apiGet('/api/tags?visible=1&size=1000'));
      const have = new Set(existing.map((t) => KE.norm(typeof t === 'string' ? t : (t && t.name))));
      for (const name of wanted) {
        if (have.has(KE.norm(name))) continue;
        try {
          await KE.apiPost('/api/tags', { name: name });
          have.add(KE.norm(name));
        } catch (e) {}
      }
    } catch (e) {}
    return wanted;
  };
})();
