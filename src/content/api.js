/* Kimai API client. */
(function () {
  'use strict';

  KE.apiBaseUrl = '';
  KE.apiCredentials = 'same-origin';
  KE.authToken = '';

  KE.buildApiUrl = function (path) { return KE.apiBaseUrl + path; };

  KE.api = async function (path, opts) {
    const baseHeaders = { Accept: 'application/json' };
    if (KE.authToken) baseHeaders.Authorization = 'Bearer ' + KE.authToken;
    const merged = Object.assign({ headers: {}, credentials: KE.apiCredentials }, opts || {});
    merged.headers = Object.assign({}, baseHeaders, (opts && opts.headers) || {});
    const res = await fetch(KE.buildApiUrl(path), merged);
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      let text = '';
      try { text = await res.text(); } catch (e) {}
      err.body = text;
      err.serverMessage = '';
      try {
        const j = JSON.parse(text);
        if (j) {
          err.serverMessage = j.message || j.detail || j.error || j.title || '';
          if (!err.serverMessage && Array.isArray(j.violations)) {
            err.serverMessage = j.violations.map((v) => v.message || v.title).filter(Boolean).join('; ');
          }
          if (!err.serverMessage && j.errors) {
            err.serverMessage = typeof j.errors === 'string' ? j.errors : JSON.stringify(j.errors).slice(0, 200);
          }
        }
      } catch (e) {}
      throw err;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) return res.json();
    const txt = await res.text();
    try { return JSON.parse(txt); } catch (e) { return txt; }
  };

  KE.apiGet = (p) => KE.api(p, { method: 'GET' });

  KE.apiPost = (p, data) =>
    KE.api(p, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  KE.apiPatch = (p, data) =>
    KE.api(p, { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
})();
