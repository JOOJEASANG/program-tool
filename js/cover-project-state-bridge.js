// Stable project import/export bridge for the current cover text and image modules.
(function () {
  'use strict';
  if (window.__coverProjectStateBridgeV1) return;
  window.__coverProjectStateBridgeV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const SIDES = ['front', 'spine', 'back'];
  const ZONES = ['top', 'center', 'bottom'];
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

  function textApi() { return window.CoverTextZones || null; }
  function imageApi() { return window.coverImageEffects || null; }

  function getTextZones() {
    const api = textApi();
    return api?.data ? clone(api.data) : null;
  }

  function setTextZones(source) {
    const api = textApi();
    if (!api?.data || !source || typeof source !== 'object') return false;
    for (const side of SIDES) {
      if (!api.data[side]) api.data[side] = {};
      for (const zone of ZONES) {
        const incoming = Array.isArray(source?.[side]?.[zone]) ? source[side][zone] : [];
        api.data[side][zone] = clone(incoming);
      }
    }
    api.save?.();
    const activeTab = document.querySelector('#coverTextZonePanel .cover-text-side-tab.active');
    activeTab?.click();
    try { window.requestRender?.(); } catch (_) {}
    return true;
  }

  function getImageEffects() {
    const api = imageApi();
    return typeof api?.get === 'function' ? clone(api.get()) : null;
  }

  function setImageEffects(source) {
    const api = imageApi();
    if (typeof api?.set !== 'function' || !source) return false;
    api.set(clone(source));
    return true;
  }

  function primaryText(side) {
    const data = getTextZones();
    if (!data?.[side]) return '';
    for (const zone of ZONES) {
      const found = (data[side][zone] || []).find((entry) => String(entry?.text || '').trim());
      if (found) return String(found.text).trim();
    }
    return '';
  }

  window.CoverProjectStateBridge = {
    snapshot() {
      return {
        textZones: getTextZones(),
        imageEffects: getImageEffects(),
      };
    },
    restore(data) {
      if (!data || typeof data !== 'object') return;
      setTextZones(data.textZones);
      setImageEffects(data.imageEffects);
    },
    getTextZones,
    setTextZones,
    getImageEffects,
    setImageEffects,
    primaryText,
  };
})();
