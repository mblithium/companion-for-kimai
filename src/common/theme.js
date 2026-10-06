/* Theme catalog and application. */
(function () {
  'use strict';

  KE.THEMES = [
    { id: 'system' },
    { id: 'light' },
    { id: 'dark' },
    { id: 'dracula' },
    { id: 'catppuccin' },
    { id: 'nord' },
    { id: 'gruvbox' },
    { id: 'gnome' },
  ];

  KE.themeLabel = function (id) {
    const valid = KE.THEMES.some((t) => t.id === id) ? id : 'system';
    const key = 'theme' + valid.charAt(0).toUpperCase() + valid.slice(1);
    return KE.T[key] || valid;
  };

  KE.currentTheme = async function () {
    try {
      const s = await KE.storageGet(['keSettings']);
      const t = s && s.keSettings && s.keSettings.theme;
      return KE.THEMES.some((x) => x.id === t) ? t : 'system';
    } catch (e) {
      return 'system';
    }
  };

  KE.applyTheme = async function () {
    try {
      document.documentElement.dataset.keTheme = await KE.currentTheme();
    } catch (e) {}
  };
  KE._initialBsTheme = undefined;
  let gnomeSchemeQuery = null;
  let gnomeSchemeListener = null;

  KE.applyPageTheme = async function () {
    try {
      if (KE._initialBsTheme === undefined) {
        KE._initialBsTheme = document.documentElement.getAttribute('data-bs-theme');
      }
      const theme = await KE.currentTheme();
      const el = document.documentElement;
      if (gnomeSchemeQuery && gnomeSchemeListener) {
        if (gnomeSchemeQuery.removeEventListener) gnomeSchemeQuery.removeEventListener('change', gnomeSchemeListener);
        else if (gnomeSchemeQuery.removeListener) gnomeSchemeQuery.removeListener(gnomeSchemeListener);
        gnomeSchemeQuery = null;
        gnomeSchemeListener = null;
      }
      if (theme === 'system') {
        if (KE._initialBsTheme) el.setAttribute('data-bs-theme', KE._initialBsTheme);
        else el.removeAttribute('data-bs-theme');
      } else if (theme === 'light') {
        el.setAttribute('data-bs-theme', 'light');
      } else if (theme === 'gnome') {
        gnomeSchemeQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
        const applyGnomeScheme = (event) => el.setAttribute('data-bs-theme', event.matches ? 'dark' : 'light');
        el.setAttribute('data-bs-theme', gnomeSchemeQuery && gnomeSchemeQuery.matches ? 'dark' : 'light');
        if (gnomeSchemeQuery) {
          gnomeSchemeListener = applyGnomeScheme;
          if (gnomeSchemeQuery.addEventListener) gnomeSchemeQuery.addEventListener('change', gnomeSchemeListener);
          else if (gnomeSchemeQuery.addListener) gnomeSchemeQuery.addListener(gnomeSchemeListener);
        }
      } else {
        el.setAttribute('data-bs-theme', 'dark');
      }
    } catch (e) {}
  };
})();
