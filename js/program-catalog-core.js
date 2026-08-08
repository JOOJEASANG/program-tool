// Shared model and validation for the public home program catalog.
(function (root) {
  'use strict';

  const MAX_CATEGORIES = 30;
  const MAX_PROGRAMS_PER_CATEGORY = 60;
  const DEFAULT_CATEGORY_ACCENT = '#1769e0';
  const DEFAULT_PROGRAM_ACCENT = '#1769e0';
  const DEFAULT_PROGRAM_BG = '#eef7ff';

  const DEFAULT_CATALOG = {
    version: 1,
    categories: [
      {
        id: 'print', name: 'PDF·인쇄', visible: true, accent: '#18a7bd',
        sectionTitle: 'PDF와 인쇄 실무', badge: 'PDF 편집 · 인쇄 검수 · 표지 제작',
        heroTitle: 'PDF', heroAccent: '& 인쇄', lead: '실제 출력 업무에 필요한 기능만.',
        copy: 'PDF 편집, 인쇄 전 검수, 책표지제작까지.\n출력 현장에서 바로 쓰는 핵심 도구만 제공합니다.',
        visualIcon: '🖨️', visualTitle: '인쇄 작업 준비', visualText: '파일 규격과 출력 조건을 빠르게 점검합니다.',
        programs: [
          { id: 'pdf-editor', name: 'PDF 편집기', icon: '📄', accent: '#f08b32', bg: '#fff3e7', desc: '페이지 편집, N-up, 소책자, 간지, 워터마크와 페이지 번호를 한 번에 처리합니다.', url: 'pdf-editor/', tags: ['페이지 편집','N-up','소책자'], status: 'active', visible: true },
          { id: 'pdf-preflight', name: 'PDF 인쇄 검수', icon: '🔍', accent: '#18a47a', bg: '#eafaf3', desc: '출력 전 문서 상태와 암호를 확인하고 인쇄 문제를 미리 점검합니다.', url: 'pdf-preflight/', tags: ['검수','암호','출력 준비'], status: 'active', visible: true },
          { id: 'perfect-binding-cover', name: '책표지제작', icon: '📚', accent: '#5969dc', bg: '#edf1ff', desc: '책등 폭과 재단 여백을 계산해 앞표지·책등·뒤표지가 연결된 전체 표지를 만듭니다.', url: 'perfect-binding-cover/', tags: ['책등 계산','재단 여백','전체 표지'], status: 'active', visible: true },
          { id: 'label-layout', name: '라벨·스티커 배치', icon: '🏷️', accent: '#38a376', bg: '#eefaf4', desc: '라벨 용지 규격에 맞춰 여러 개의 라벨을 자동 배치합니다.', url: '', tags: ['라벨','자동 배치'], status: 'coming', visible: true }
        ]
      },
      {
        id: 'group', name: '단체·행사', visible: true, accent: '#d65f83',
        sectionTitle: '단체와 행사 제작', badge: '명단 일괄 제작 · 행사 출력물',
        heroTitle: '단체', heroAccent: '& 행사', lead: '명단 기반 반복 제작을 한 번에.',
        copy: '상장, 수료증, 명찰과 행사 배너처럼\n학교·기관·회사·동호회 등 다양한 단체에서 활용할 수 있습니다.',
        visualIcon: '🎪', visualTitle: '행사 제작 준비', visualText: '명단과 행사 정보를 불러와 결과물을 일괄 생성합니다.',
        programs: [
          { id: 'certificate-batch', name: '상장·수료증 일괄 제작', icon: '🏆', accent: '#c79b27', bg: '#fff8e2', desc: '참여자 명단을 불러와 상장과 수료증을 한 번에 생성합니다.', url: '', tags: ['상장','수료증','일괄 생성'], status: 'coming', visible: true },
          { id: 'name-badge', name: '명찰·이름표 제작기', icon: '🪪', accent: '#5c9d58', bg: '#f1f8ee', desc: '단체 또는 행사 참여자 명단으로 명찰과 이름표를 자동 배치합니다.', url: '', tags: ['명찰','이름표','명단'], status: 'coming', visible: true },
          { id: 'event-banner', name: '행사 배너·현수막 제작', icon: '🎪', accent: '#d65f83', bg: '#fff0f4', desc: '학교, 기관, 회사와 각종 행사에 필요한 배너와 현수막을 제작합니다.', url: '', tags: ['배너','현수막','행사'], status: 'coming', visible: true }
        ]
      },
      {
        id: 'office', name: '사무 자동화', visible: true, accent: '#4e7fb8',
        sectionTitle: '반복 사무 업무 자동화', badge: '문서 작성 · 파일 정리 · 병합',
        heroTitle: '사무', heroAccent: '자동화', lead: '매일 반복되는 업무를 줄입니다.',
        copy: '견적서 작성, 회의록 정리, 파일명 변경과 문서 병합처럼\n반복 빈도가 높은 업무만 자동화합니다.',
        visualIcon: '🗂️', visualTitle: '업무 문서 정리', visualText: '자주 반복되는 문서 작업을 표준화합니다.',
        programs: [
          { id: 'estimate-invoice', name: '견적서·청구서 제작', icon: '🧾', accent: '#367cd5', bg: '#eef7ff', desc: '거래처별 견적서와 청구서를 작성하고 PDF로 저장합니다.', url: '', tags: ['견적서','청구서','PDF'], status: 'coming', visible: true },
          { id: 'meeting-notes', name: '회의록 정리기', icon: '📝', accent: '#d78a2c', bg: '#fff6e9', desc: '회의 내용을 핵심 중심으로 정리해 표준 회의록 형식으로 만듭니다.', url: '', tags: ['회의록','요약','문서화'], status: 'coming', visible: true },
          { id: 'rename-files', name: '파일명 일괄 변경', icon: '📁', accent: '#3d8793', bg: '#eef6f8', desc: '여러 파일의 이름을 정한 규칙에 따라 한 번에 변경합니다.', url: '', tags: ['파일명','일괄 변경'], status: 'coming', visible: true },
          { id: 'document-merge', name: '문서 병합·분할', icon: '🧩', accent: '#d65f83', bg: '#fff0f4', desc: 'PDF와 문서를 원하는 순서로 병합하거나 필요한 부분만 분할합니다.', url: '', tags: ['병합','분할','문서'], status: 'coming', visible: true }
        ]
      },
      {
        id: 'ai', name: 'AI 도우미', visible: true, accent: '#6d5bd0',
        sectionTitle: '실무형 AI 도우미', badge: '요약 · 교정 · 양식 생성',
        heroTitle: 'AI', heroAccent: '도우미', lead: '실무 문서를 더 빠르고 정확하게.',
        copy: '긴 문서 요약, 문장 교정, 업무 양식 생성처럼\n반복성과 활용도가 높은 AI 기능만 제공합니다.',
        visualIcon: '✨', visualTitle: 'AI 작업 준비', visualText: '문서를 분석해 필요한 결과물로 정리합니다.',
        programs: [
          { id: 'document-summary-ai', name: '문서 요약 AI', icon: '🧠', accent: '#606edb', bg: '#f1f3ff', desc: '긴 문서에서 핵심 내용과 주요 항목을 빠르게 추출합니다.', url: '', tags: ['요약','핵심 정리'], status: 'coming', visible: true },
          { id: 'document-proof-ai', name: '문서 교정 AI', icon: '✍️', accent: '#367cd5', bg: '#eef7ff', desc: '맞춤법, 문장 흐름과 표현을 자연스럽게 교정합니다.', url: '', tags: ['교정','맞춤법','문장'], status: 'coming', visible: true },
          { id: 'business-form-ai', name: '업무 양식 생성 AI', icon: '⚙️', accent: '#38a376', bg: '#eefaf4', desc: '필요한 업무 내용을 입력하면 알맞은 문서 양식을 자동 생성합니다.', url: '', tags: ['양식','자동 생성'], status: 'coming', visible: true }
        ]
      }
    ]
  };

  const text = (value, max = 200) => String(value == null ? '' : value).trim().slice(0, max);
  const bool = (value, fallback = true) => typeof value === 'boolean' ? value : fallback;
  const slug = (value, prefix) => {
    const cleaned = text(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned || `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  };
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function safeUrl(value) {
    const raw = text(value, 300);
    if (!raw) return '';
    if (/^(?:https:\/\/|\/|\.\.\/|\.\/|[a-z0-9_-]+\/)/i.test(raw) && !/^javascript:/i.test(raw)) return raw;
    return '';
  }

  function normalizeProgram(raw, usedIds) {
    const item = raw && typeof raw === 'object' ? raw : {};
    let id = slug(item.id || item.name, 'program');
    while (usedIds.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    usedIds.add(id);
    return {
      id,
      name: text(item.name, 80) || '새 프로그램',
      icon: text(item.icon, 12) || '🧰',
      accent: color(item.accent, DEFAULT_PROGRAM_ACCENT),
      bg: color(item.bg, DEFAULT_PROGRAM_BG),
      desc: text(item.desc, 500),
      url: safeUrl(item.url),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => text(tag, 30)).filter(Boolean).slice(0, 8) : [],
      status: item.status === 'active' ? 'active' : 'coming',
      visible: bool(item.visible, true)
    };
  }

  function normalizeCategory(raw, usedIds, programIds) {
    const item = raw && typeof raw === 'object' ? raw : {};
    let id = slug(item.id || item.name, 'category');
    while (usedIds.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    usedIds.add(id);
    const name = text(item.name, 60) || '새 카테고리';
    const programs = Array.isArray(item.programs)
      ? item.programs.slice(0, MAX_PROGRAMS_PER_CATEGORY).map((program) => normalizeProgram(program, programIds))
      : [];
    return {
      id,
      name,
      visible: bool(item.visible, true),
      accent: color(item.accent, DEFAULT_CATEGORY_ACCENT),
      sectionTitle: text(item.sectionTitle, 100) || name,
      badge: text(item.badge, 140),
      heroTitle: text(item.heroTitle, 70) || name,
      heroAccent: text(item.heroAccent, 70),
      lead: text(item.lead, 180),
      copy: text(item.copy, 700),
      visualIcon: text(item.visualIcon, 12) || '🧰',
      visualTitle: text(item.visualTitle, 100) || name,
      visualText: text(item.visualText, 240),
      programs
    };
  }

  function normalizeCatalog(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    const categories = Array.isArray(input.categories) ? input.categories : [];
    const usedCategoryIds = new Set();
    const usedProgramIds = new Set();
    const normalized = categories.slice(0, MAX_CATEGORIES).map((category) => normalizeCategory(category, usedCategoryIds, usedProgramIds));
    return { version: 1, categories: normalized };
  }

  function publicCatalog(raw) {
    const normalized = normalizeCatalog(raw);
    return {
      version: 1,
      categories: normalized.categories
        .filter((category) => category.visible)
        .map((category) => ({ ...category, programs: category.programs.filter((program) => program.visible) }))
        .filter((category) => category.programs.length || category.visible)
    };
  }

  function defaultCatalog() { return clone(DEFAULT_CATALOG); }
  function categoryCount(catalog) { return normalizeCatalog(catalog).categories.length; }
  function programCount(catalog) { return normalizeCatalog(catalog).categories.reduce((sum, category) => sum + category.programs.length, 0); }

  const api = {
    DEFAULT_CATALOG,
    MAX_CATEGORIES,
    MAX_PROGRAMS_PER_CATEGORY,
    normalizeCatalog,
    publicCatalog,
    defaultCatalog,
    safeUrl,
    categoryCount,
    programCount,
    stage: 'public-home-program-catalog-model'
  };

  root.ProgramCatalogCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
