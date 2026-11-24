(() => {
  'use strict';
  if (window.__smartPrintPaperPresets) return;
  window.__smartPrintPaperPresets = true;

  const STORAGE_KEY = 'program-studio.smart-print.paper-presets.v1';
  const MAX_PRESETS = 30;
  const $ = id => document.getElementById(id);
  const finiteSize = value => Number.isFinite(Number(value)) && Number(value) >= 50 && Number(value) <= 2000;
  const round1 = value => Math.round(Number(value) * 10) / 10;
  let paperPresets = [];

  function message(text, isError = false) {
    const node = $('paperPresetMessage');
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? '#b91c1c' : '#64748b';
  }

  function load() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      const names = new Set();
      return stored.filter(item => {
        if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(item.id)
            || typeof item.name !== 'string' || !item.name.trim()
            || item.name.length > 32 || !finiteSize(item.width) || !finiteSize(item.height)) return false;
        const name = item.name.trim().toLowerCase();
        if (names.has(name)) return false;
        names.add(name);
        return true;
      }).slice(0, MAX_PRESETS);
    } catch (_) {
      return [];
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paperPresets));
      return true;
    } catch (_) {
      message('브라우저 저장소를 사용할 수 없습니다. 용지 규격을 저장하지 못했습니다.', true);
      return false;
    }
  }

  function currentSaved() {
    const value = $('paperPreset')?.value || '';
    return value.startsWith('saved:') ? paperPresets.find(preset => 'saved:' + preset.id === value) : undefined;
  }

  function updateControls() {
    const preset = currentSaved();
    const deleteButton = $('paperDeletePreset');
    if (deleteButton) deleteButton.disabled = !preset;
    if (preset && $('paperPresetName')) $('paperPresetName').value = preset.name;
  }

  function renderOptions(preferred) {
    const select = $('paperPreset');
    if (!select) return;
    const selected = preferred || select.value;
    select.querySelectorAll('option[data-saved-paper]').forEach(option => option.remove());
    const customOption = select.querySelector('option[value="custom"]');
    for (const item of paperPresets) {
      const option = document.createElement('option');
      option.value = 'saved:' + item.id;
      option.dataset.savedPaper = 'true';
      option.textContent = item.name + ' · ' + round1(item.width) + ' × ' + round1(item.height) + 'mm';
      select.insertBefore(option, customOption);
    }
    if (Array.from(select.options).some(option => option.value === selected)) select.value = selected;
    updateControls();
  }

  function applySavedPreset() {
    const item = currentSaved();
    updateControls();
    if (!item) return;
    $('paperWidth').value = round1(item.width);
    $('paperHeight').value = round1(item.height);
    $('paperWidth').readOnly = true;
    $('paperHeight').readOnly = true;
    const orientation = $('paperOrientation');
    if (orientation) orientation.value = item.width > item.height ? 'landscape' : 'portrait';
    $('paperWidth').dispatchEvent(new Event('input', { bubbles: true }));
    $('paperHeight').dispatchEvent(new Event('input', { bubbles: true }));
    message('저장된 용지 규격을 불러왔습니다.');
  }

  function savePreset() {
    // Another program/tab may have changed the shared favorites after boot.
    paperPresets = load();
    const name = String($('paperPresetName')?.value || '').trim();
    const width = Number($('paperWidth')?.value);
    const height = Number($('paperHeight')?.value);
    if (!name || name.length > 32) return message('규격 이름을 1~32자로 입력해 주세요.', true);
    if (!finiteSize(width) || !finiteSize(height)) return message('용지 가로·세로는 각각 50~2,000mm로 입력해 주세요.', true);
    const previous = paperPresets.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (!previous && paperPresets.length >= MAX_PRESETS) return message('용지 규격은 최대 30개까지 저장할 수 있습니다.', true);
    const next = previous
      ? { ...previous, name, width: round1(width), height: round1(height) }
      : { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9),
          name, width: round1(width), height: round1(height) };
    const candidate = previous
      ? paperPresets.map(item => item.id === previous.id ? next : item)
      : [...paperPresets, next];
    const before = paperPresets;
    paperPresets = candidate;
    if (!persist()) {
      paperPresets = before;
      return;
    }
    renderOptions('saved:' + next.id);
    $('paperPreset').value = 'saved:' + next.id;
    $('paperPreset').dispatchEvent(new Event('change', { bubbles: true }));
    message((previous ? '기존 규격을 업데이트했습니다: ' : '용지 규격을 저장했습니다: ') + name);
  }

  function removePreset() {
    paperPresets = load();
    const item = currentSaved();
    if (!item || !window.confirm('저장한 용지 규격 "' + item.name + '"을 삭제할까요?')) return;
    const previous = paperPresets;
    paperPresets = paperPresets.filter(preset => preset.id !== item.id);
    if (!persist()) {
      paperPresets = previous;
      return;
    }
    renderOptions('custom');
    $('paperPreset').value = 'custom';
    $('paperPreset').dispatchEvent(new Event('change', { bubbles: true }));
    $('paperPresetName').value = '';
    message('저장 규격을 삭제했습니다. 현재 입력한 용지 가로·세로는 유지됩니다.');
  }

  function installStyles() {
    if ($('smartPaperPresetStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartPaperPresetStyles';
    style.textContent = '.smart-paper-presets{margin:2px 0 10px;padding:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px}'
      + '.smart-paper-presets .field{margin-bottom:7px}.smart-paper-presets input{width:100%;font-size:11px;border:1px solid #cfd9e3;border-radius:8px;padding:7px 9px}'
      + '.smart-paper-preset-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}'
      + '.smart-paper-preset-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:7px 5px;color:#334155;font-size:10px;font-weight:800;cursor:pointer}'
      + '.smart-paper-preset-actions button:first-child{background:#0f766e;color:#fff;border-color:#0f766e}'
      + '.smart-paper-preset-actions button:disabled{opacity:.45;cursor:not-allowed}'
      + '#paperPresetMessage{margin:7px 0 0;line-height:1.4}.smart-fit-mode{margin:10px 0 8px}';
    document.head.appendChild(style);
  }

  function refreshSharedPaper() {
    paperPresets = load();
    const selected = $('paperPreset')?.value || 'custom';
    renderOptions(selected);
    if (selected.startsWith('saved:') && !paperPresets.some(item => 'saved:' + item.id === selected)) {
      $('paperPreset').value = 'custom';
      $('paperPreset').dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function boot() {
    paperPresets = load();
    installStyles();
    renderOptions();
    $('paperPreset')?.addEventListener('change', applySavedPreset);
    $('paperSavePreset')?.addEventListener('click', savePreset);
    $('paperDeletePreset')?.addEventListener('click', removePreset);
    $('paperPresetName')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        savePreset();
      }
    });
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY) refreshSharedPaper();
    });
    window.addEventListener('shared-paper-favorites-change', refreshSharedPaper);
    window.SmartPrintPaperPresets = { load, currentSaved };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();