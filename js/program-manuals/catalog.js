(() => {
  'use strict';

  const order = [
    'print-checker',
    'smart-print-layout',
    'pdf-editor',
    'pdf-editor-advanced',
    'pdf-suite',
  ];
  const registry = new Map();

  function register(manual) {
    if (!manual || typeof manual !== 'object') throw new TypeError('사용설명서 데이터가 올바르지 않습니다.');
    const id = String(manual.id || '').trim();
    if (!id) throw new TypeError('사용설명서 id가 필요합니다.');
    registry.set(id, Object.freeze({ ...manual, id }));
  }

  function get(id) {
    return registry.get(String(id || '')) || null;
  }

  function all() {
    const listed = order.map(id => registry.get(id)).filter(Boolean);
    const extras = [...registry.values()].filter(item => !order.includes(item.id));
    return [...listed, ...extras];
  }

  window.ProgramManuals = Object.freeze({ order, register, get, all, version: '2026-09-10' });
})();
