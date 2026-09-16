(() => {
  'use strict';

  const POLICY_UPDATED = '2026-09-16';
  const ACCESS_POLICY_NOTICE = '이 프로그램은 로그인 후 관리자가 승인한 회원만 사용할 수 있습니다. 현재 승인된 회원에게는 일일·월간·프로그램별 사용횟수 제한을 적용하지 않습니다.';
  const SIMPLE_HELP_NOTICE = '프로그램 화면의 “사용법” 버튼을 누르면 핵심 사용 순서를 30초 안내로 바로 확인할 수 있습니다. 화면에서는 쉬운 표현을 먼저 사용하고 필요한 곳에만 인쇄 전문용어를 함께 표시합니다.';
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
    const before = Array.isArray(manual.before) ? [...manual.before] : [];
    if (!before.includes(SIMPLE_HELP_NOTICE)) before.unshift(SIMPLE_HELP_NOTICE);
    if (!before.includes(ACCESS_POLICY_NOTICE)) before.unshift(ACCESS_POLICY_NOTICE);
    const updated = String(manual.updated || '').trim();
    registry.set(id, Object.freeze({
      ...manual,
      id,
      before: Object.freeze(before),
      updated: updated && updated > POLICY_UPDATED ? updated : POLICY_UPDATED,
      accessPolicy: 'approved-members-only',
    }));
  }

  function get(id) {
    return registry.get(String(id || '')) || null;
  }

  function all() {
    const listed = order.map(id => registry.get(id)).filter(Boolean);
    const extras = [...registry.values()].filter(item => !order.includes(item.id));
    return [...listed, ...extras];
  }

  window.ProgramManuals = Object.freeze({
    order,
    register,
    get,
    all,
    version: POLICY_UPDATED,
    simpleHelpNotice: SIMPLE_HELP_NOTICE,
    accessPolicy: Object.freeze({
      mode: 'approved-members-only',
      usageLimit: null,
      updated: POLICY_UPDATED,
      notice: ACCESS_POLICY_NOTICE,
    }),
  });
})();
