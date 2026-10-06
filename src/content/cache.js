/* Local API cache. */
(function () {
  'use strict';

  KE.CACHE_TTL = {
    catalog: 24 * 3600 * 1000,
    today: 3600 * 1000,
  };

  KE.cacheGet = async function (key) {
    const s = await KE.localGet([key]);
    return (s && s[key]) || null;
  };

  KE.cacheSet = async function (key, data) {
    try {
      await KE.localSet({ [key]: { at: Date.now(), data: data } });
    } catch (e) {}
  };

  KE.cacheFresh = function (entry, ttl) {
    return !!entry && (Date.now() - (entry.at || 0)) < ttl;
  };
  KE.cacheClear = async function () {
    try {
      const all = await KE.localGet(null);
      const keys = Object.keys(all || {}).filter((k) => k.indexOf('keCache') === 0);
      if (keys.length) await KE.localRemove(keys);
      return keys.length;
    } catch (e) {
      return 0;
    }
  };

  KE.getCustomersCached = async function (force) {
    if (!force) {
      const hit = await KE.cacheGet('keCacheCustomers');
      if (KE.cacheFresh(hit, KE.CACHE_TTL.catalog)) {
        KE.applyCustomers(hit.data);
        return true;
      }
    }
    await KE.loadCustomers();
    await KE.cacheSet('keCacheCustomers', KE.state.customers);
    return false;
  };

  KE.getProjectsCached = async function (customerId, force) {
    const key = 'keCacheProjects:' + (customerId || '');
    if (!force) {
      const hit = await KE.cacheGet(key);
      if (KE.cacheFresh(hit, KE.CACHE_TTL.catalog)) {
        KE.applyProjects(hit.data);
        return true;
      }
    }
    await KE.loadProjects(customerId);
    await KE.cacheSet(key, KE.state.projects);
    return false;
  };

  KE.getActivitiesCached = async function (projectId, force) {
    const key = 'keCacheActivities:' + (projectId || 'all');
    if (!force) {
      const hit = await KE.cacheGet(key);
      if (KE.cacheFresh(hit, KE.CACHE_TTL.catalog)) {
        KE.applyActivities(hit.data);
        return true;
      }
    }
    await KE.loadActivities(projectId);
    await KE.cacheSet(key, KE.state.activities);
    return false;
  };

  KE.getTodayCached = async function (force) {
    if (!force) {
      const hit = await KE.cacheGet('keCacheToday');
      if (KE.cacheFresh(hit, KE.CACHE_TTL.today)) return { entries: hit.data, fromCache: true };
    }
    const entries = KE.asArray(await KE.apiGet('/api/timesheets?size=60'));
    await KE.cacheSet('keCacheToday', entries);
    return { entries: entries, fromCache: false };
  };
  KE.getRecentCached = async function (force) {
    if (!force) {
      const hit = await KE.cacheGet('keCacheRecent');
      if (KE.cacheFresh(hit, KE.CACHE_TTL.today)) return { entries: hit.data, fromCache: true };
    }
    const entries = KE.asArray(await KE.apiGet('/api/timesheets?size=100'));
    await KE.cacheSet('keCacheRecent', entries);
    return { entries: entries, fromCache: false };
  };
})();
