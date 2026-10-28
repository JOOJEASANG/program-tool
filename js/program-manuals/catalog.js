(() => {
  'use strict';

  const POLICY_UPDATED = '2026-10-12';
  const ACCESS_POLICY_NOTICE = '이 프로그램은 로그인 후 관리자가 승인한 회원만 사용할 수 있습니다. 현재 승인된 회원에게는 일일·월간·프로그램별 사용횟수 제한을 적용하지 않습니다.';
  const SIMPLE_HELP_NOTICE = '홈에서는 표지 디자인, 문서 편집, PDF 유틸리티로 프로그램을 나눠 볼 수 있으며 스마트 인쇄배치는 문서 편집 메뉴에 표시됩니다. 또한 각 프로그램 카드의 아이콘 오른쪽에서 프로그램명을 바로 확인할 수 있습니다. ☆ 즐겨찾기와 최근 방문한 도구도 이용할 수 있습니다. 즐겨찾기와 방문 내역은 이 브라우저에만 저장되며 작업 파일은 저장하지 않습니다. 상단 검색창에서 프로그램 이름이나 필요한 기능을 검색할 수 있습니다. 각 프로그램 내부에는 도구 전환 버튼을 표시하지 않습니다. 전환 전 편집 중인 작업을 저장하세요. 화면에서는 쉬운 표현을 먼저 사용하고 필요한 곳에만 인쇄 전문용어를 함께 표시합니다.';
  const order = [
    'print-checker',
    'ai-design-maker',
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
