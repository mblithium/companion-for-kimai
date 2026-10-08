/* Searchable combobox components. */
(function () {
  'use strict';

  let openCombo = null;

  KE.createCombo = function (opts) {
    const root = KE.el('div', 'ke-combo');
    const box = KE.el('div', 'ke-combo-box');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ke-input ke-combo-input';
    input.placeholder = opts.searchPlaceholder || '';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    if (opts.inputId) input.id = opts.inputId;
    const toggle = KE.el('button', 'ke-combo-toggle', '▾');
    toggle.type = 'button';
    toggle.tabIndex = -1;
    toggle.setAttribute('aria-label', opts.toggleLabel || KE.uiText('ui.expandOptions'));
    box.appendChild(input);
    box.appendChild(toggle);
    const list = KE.el('div', 'ke-combo-list');
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    root.appendChild(box);
    root.appendChild(list);

    const combo = {
      root: root, input: input,
      items: [], value: '',
      onSelect: opts.onSelect || null,
      emptyLabel: opts.emptyLabel || '',
      allowEmpty: !!opts.allowEmpty,
      _filter: '', _active: -1, _rendered: [],
    };

    function labelOf(v) {
      if (v === '' || v == null) return '';
      const it = combo.items.find((i) => i.value === String(v));
      return it ? it.label : '';
    }

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      if (openCombo === combo) openCombo = null;
    }
    function open() {
      if (openCombo && openCombo !== combo) openCombo.close();
      openCombo = combo;
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    combo.close = close;

    function render() {
      const q = KE.norm(combo._filter);
      const out = [];
      if (combo.allowEmpty && combo.emptyLabel && (!q || KE.norm(combo.emptyLabel).includes(q))) {
        out.push({ value: '', label: combo.emptyLabel, empty: true });
      }
      for (const it of combo.items) {
        if (out.length >= 150) break;
        if (!q || KE.norm(it.label).includes(q)) out.push(it);
      }
      combo._rendered = out;
      if (combo._active >= out.length) combo._active = out.length - 1;
      list.replaceChildren();
      if (!out.length) {
        const d = KE.el('div', 'ke-combo-empty', KE.T.noResults);
        list.appendChild(d);
        return;
      }
      out.forEach((it, idx) => {
        const o = KE.el('div', 'ke-combo-opt' + (it.empty ? ' ke-combo-opt-empty' : '') + (it.value === combo.value && !it.empty ? ' ke-selected' : ''));
        o.setAttribute('role', 'option');
        o.dataset.idx = String(idx);
        o.textContent = it.label;
        if (idx === combo._active) o.classList.add('ke-active');
        o.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          commit(idx);
        });
        list.appendChild(o);
      });
    }

    function paintActive() {
      list.querySelectorAll('.ke-combo-opt').forEach((n) => {
        n.classList.toggle('ke-active', Number(n.dataset.idx) === combo._active);
      });
      const act = list.querySelector('.ke-combo-opt.ke-active');
      if (act && typeof act.scrollIntoView === 'function') act.scrollIntoView({ block: 'nearest' });
    }

    function commit(idx) {
      const it = combo._rendered[idx];
      if (!it) return;
      combo.value = it.value;
      input.value = it.empty ? '' : it.label;
      input.placeholder = it.empty ? combo.emptyLabel : (opts.searchPlaceholder || '');
      combo._filter = '';
      combo._active = -1;
      close();
      render();
      if (combo.onSelect) combo.onSelect(combo.value);
    }

    function syncFromValue() {
      if (combo.value === '') {
        input.value = '';
        input.placeholder = combo.allowEmpty ? combo.emptyLabel : (opts.searchPlaceholder || '');
      } else {
        input.value = labelOf(combo.value);
      }
    }

    combo.getValue = () => combo.value;
    combo.getValues = () => combo.items.map((i) => i.value);
    combo.getValues = () => combo.items.map((i) => i.value);
    combo.setItems = (items, selectedValue) => {
      combo.items = (items || []).map((i) => ({ value: String(i.value), label: String(i.label) }));
      if (selectedValue !== undefined) combo.value = String(selectedValue || '');
      else if (combo.value && !combo.items.some((i) => i.value === combo.value)) combo.value = '';
      combo._filter = '';
      combo._active = -1;
      syncFromValue();
      render();
    };
    combo.setLoading = (isLoading) => {
      input.disabled = !!isLoading;
      if (isLoading) { combo.items = []; combo.value = ''; input.value = ''; input.placeholder = KE.T.loading; list.hidden = true; }
      else { input.placeholder = opts.searchPlaceholder || ''; render(); }
    };
    combo.focus = () => input.focus();
    combo.setEnabled = (enabled) => {
      input.disabled = !enabled;
      toggle.disabled = !enabled;
    };
    combo.flush = (silent) => {
      const fire = (v) => { if (!silent && combo.onSelect) combo.onSelect(v); };
      if (input.value === '') {
        if (combo.value !== '') {
          combo.value = '';
          render();
          fire('');
          return true;
        }
        return false;
      }
      const exact = combo.items.find((i) => KE.norm(i.label) === KE.norm(input.value));
      if (exact) {
        if (combo.value !== exact.value) {
          combo.value = exact.value;
          render();
          fire(combo.value);
          return true;
        }
        return false;
      }
      syncFromValue();
      close();
      return false;
    };

    input.addEventListener('focus', () => {
      input.select();
      combo._filter = '';
      combo._active = -1;
      render();
      open();
    });
    input.addEventListener('input', () => {
      combo._filter = input.value;
      if (input.value === '') {
        const had = combo.value;
        combo.value = '';
        combo._active = -1;
        render();
        if (had !== '' && combo.onSelect) combo.onSelect('');
        return;
      }
      const exact = combo.items.find((i) => KE.norm(i.label) === KE.norm(input.value));
      if (exact) {
        combo.value = exact.value;
        combo._active = -1;
        render();
        if (combo.onSelect) combo.onSelect(combo.value);
        return;
      }
      combo._active = -1;
      render();
      open();
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        open();
        const n = combo._rendered.length;
        if (!n) return;
        combo._active = ev.key === 'ArrowDown'
          ? (combo._active + 1) % n
          : (combo._active - 1 + n) % n;
        paintActive();
      } else if (ev.key === 'Enter') {
        if (!list.hidden && combo._rendered.length) {
          ev.preventDefault();
          commit(combo._active >= 0 ? combo._active : 0);
        }
      } else if (ev.key === 'Escape') {
        if (!list.hidden) { ev.preventDefault(); syncFromValue(); close(); }
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!combo.items.length && !combo.allowEmpty) { close(); return; }
        if (input.value === '') {
          if (combo.value !== '') {
            combo.value = '';
            if (combo.onSelect) combo.onSelect('');
          }
        } else {
          const exact = combo.items.find((i) => KE.norm(i.label) === KE.norm(input.value));
          if (exact) {
            if (combo.value !== exact.value) {
              combo.value = exact.value;
              render();
              if (combo.onSelect) combo.onSelect(combo.value);
            } else syncFromValue();
          } else syncFromValue();
        }
        close();
      }, 120);
    });
    toggle.addEventListener('click', () => {
      if (list.hidden) { input.focus(); }
      else { syncFromValue(); close(); input.blur(); }
    });

    render();
    return combo;
  };

  if (!document.__keComboOutside__) {
    document.__keComboOutside__ = true;
    document.addEventListener('click', (ev) => {
      if (openCombo && !ev.target.closest('.ke-combo')) openCombo.close();
    });
  }
  KE.createMultiCombo = function (opts) {
    opts = opts || {};
    const root = KE.el('div', 'ke-combo ke-multi');
    const box = KE.el('div', 'ke-multi-box');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ke-multi-input';
    input.placeholder = opts.searchPlaceholder || '';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    const toggle = KE.el('button', 'ke-combo-toggle', '\u25be');
    toggle.type = 'button';
    toggle.tabIndex = -1;
    toggle.setAttribute('aria-label', KE.uiText('ui.expandOptions'));
    box.appendChild(input);
    box.appendChild(toggle);
    const list = KE.el('div', 'ke-combo-list');
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    root.appendChild(box);
    root.appendChild(list);

    const combo = {
      root: root, input: input,
      items: [], selected: [],
      _filter: '', _active: -1, _rendered: [],
    };

    function isSelected(value) {
      return combo.selected.some((s) => KE.norm(s.value) === KE.norm(value));
    }

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }

    function open() {
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function renderChips() {
      box.querySelectorAll('.ke-chip').forEach((c) => c.remove());
      combo.selected.forEach((sel) => {
        const chip = KE.el('span', 'ke-chip', sel.label);
        const x = KE.el('button', 'ke-chip-x', '\u00d7');
        x.type = 'button';
        x.setAttribute('aria-label', KE.uiText('ui.removeItem') + ' ' + sel.label);
        x.addEventListener('mousedown', (ev) => ev.preventDefault());
        x.addEventListener('click', () => removeValue(sel.value));
        chip.appendChild(x);
        box.insertBefore(chip, input);
      });
    }

    function render() {
      const q = KE.norm(combo._filter).trim();
      const out = [];
      combo.items.forEach((it) => {
        if (out.length >= 150) return;
        if (isSelected(it.value)) return;
        if (!q || KE.norm(it.label).includes(q)) out.push(it);
      });
      if (q && !combo.items.some((it) => KE.norm(it.label) === q) && !isSelected(combo._filter.trim())) {
        const name = combo._filter.trim();
        out.unshift({ value: name, label: KE.uiText('ui.newTagOption', { name }), isNew: true });
      }
      combo._rendered = out;
      if (combo._active >= out.length) combo._active = out.length - 1;
      list.replaceChildren();
      if (!out.length) {
        list.appendChild(KE.el('div', 'ke-combo-empty', KE.T.noResults));
        return;
      }
      out.forEach((it, idx) => {
        const o = KE.el('div', 'ke-combo-opt' + (it.isNew ? ' ke-combo-new' : ''));
        o.setAttribute('role', 'option');
        o.dataset.idx = String(idx);
        o.textContent = it.label;
        if (idx === combo._active) o.classList.add('ke-active');
        o.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          commit(idx);
        });
        list.appendChild(o);
      });
    }

    function paintActive() {
      list.querySelectorAll('.ke-combo-opt').forEach((n) => {
        n.classList.toggle('ke-active', Number(n.dataset.idx) === combo._active);
      });
      const act = list.querySelector('.ke-combo-opt.ke-active');
      if (act && typeof act.scrollIntoView === 'function') act.scrollIntoView({ block: 'nearest' });
    }

    function commit(idx) {
      const it = combo._rendered[idx];
      if (!it) return;
      if (!isSelected(it.value)) combo.selected.push({ value: it.value, label: it.isNew ? it.value : it.label });
      input.value = '';
      combo._filter = '';
      combo._active = -1;
      renderChips();
      render();
      open();
      input.focus();
    }

    function removeValue(value) {
      combo.selected = combo.selected.filter((s) => KE.norm(s.value) !== KE.norm(value));
      renderChips();
      render();
    }

    combo.getValues = () => combo.selected.map((s) => s.value);
    combo.setValues = (values) => {
      const wanted = new Set((values || []).map((v) => String(v)));
      combo.selected = combo.items.filter((it) => wanted.has(String(it.value)));
      renderChips();
    };
    combo.setItems = (items) => {
      combo.items = (items || []).map((i) => ({ value: String(i.value), label: String(i.label) }));
      combo._filter = '';
      combo._active = -1;
      render();
    };
    combo.setLoading = (isLoading) => {
      input.disabled = !!isLoading;
      toggle.disabled = !!isLoading;
      if (isLoading) {
        input.value = '';
        input.placeholder = KE.T.loading;
        list.hidden = true;
      } else {
        input.placeholder = opts.searchPlaceholder || '';
        render();
      }
    };
    combo.flush = () => {
      const text = input.value.trim();
      if (!text || isSelected(text)) {
        input.value = '';
        combo._filter = '';
        render();
        return false;
      }
      combo.selected.push({ value: text, label: text });
      input.value = '';
      combo._filter = '';
      combo._active = -1;
      renderChips();
      render();
      return true;
    };
    combo.focus = () => input.focus();
    combo.setEnabled = (enabled) => {
      input.disabled = !enabled;
      toggle.disabled = !enabled;
    };

    input.addEventListener('focus', () => {
      combo._filter = '';
      combo._active = -1;
      render();
      open();
    });
    input.addEventListener('input', () => {
      combo._filter = input.value;
      combo._active = -1;
      render();
      open();
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        open();
        const n = combo._rendered.length;
        if (!n) return;
        combo._active = ev.key === 'ArrowDown'
          ? (combo._active + 1) % n
          : (combo._active - 1 + n) % n;
        paintActive();
      } else if (ev.key === 'Enter') {
        if (!list.hidden && combo._rendered.length) {
          ev.preventDefault();
          commit(combo._active >= 0 ? combo._active : 0);
        } else if (input.value.trim() === '' && typeof opts.onEnterEmpty === 'function') {
          ev.preventDefault();
          opts.onEnterEmpty();
        } else if (input.value.trim() !== '') {
          ev.preventDefault();
          combo.flush();
        }
      } else if (ev.key === 'Escape') {
        if (!list.hidden) {
          ev.preventDefault();
          input.value = '';
          combo._filter = '';
          close();
        }
      } else if (ev.key === 'Backspace' && input.value === '' && combo.selected.length) {
        ev.preventDefault();
        removeValue(combo.selected[combo.selected.length - 1].value);
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        input.value = '';
        combo._filter = '';
        close();
      }, 120);
    });
    toggle.addEventListener('click', () => {
      if (list.hidden) input.focus();
      else close();
    });
    box.addEventListener('mousedown', (ev) => {
      if (ev.target === box) {
        ev.preventDefault();
        input.focus();
      }
    });

    renderChips();
    render();
    return combo;
  };
})();
