/* Extension storage utilities. */
(function () {
  'use strict';

  const store = (() => {
    try {
      if (typeof browser !== 'undefined' && browser.storage) return browser.storage;
    } catch (e) {}
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) return chrome.storage;
    } catch (e) {}
    return null;
  })();

  async function areaGet(area, keys) {
    if (!store || !store[area]) return {};
    try { return await store[area].get(keys); } catch (e) { return {}; }
  }

  async function areaSet(area, obj) {
    if (!store || !store[area]) return;
    try { await store[area].set(obj); } catch (e) {}
  }

  async function areaRemove(area, keys) {
    if (!store || !store[area] || typeof store[area].remove !== 'function') return;
    try { await store[area].remove(keys); } catch (e) {}
  }

  KE.storageGet = (keys) => areaGet('sync', keys);
  KE.storageSet = (obj) => areaSet('sync', obj);
  KE.localGet = (keys) => areaGet('local', keys);
  KE.localSet = (obj) => areaSet('local', obj);
  KE.localRemove = (keys) => areaRemove('local', keys);
  KE.onStorageChanged = function (cb) {
    try {
      if (store && store.onChanged && typeof store.onChanged.addListener === 'function') {
        store.onChanged.addListener(cb);
        return () => { try { store.onChanged.removeListener(cb); } catch (e) {} };
      }
    } catch (e) {}
    return null;
  };
})();
