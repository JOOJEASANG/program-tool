import { advancedState, selectedPage, paperSizeMmForPage, isSheetLayoutMode } from './state.js';

const $ = id => document.getElementById(id);

function installStyles() {
  if ($('pdfAdvancedTabbedSidebarV9Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedTabbedSidebarV9Styles';
  style.textContent = `
    .advanced-app{grid-template-columns:310px minmax(0,1fr) 320px!important}
    .advanced-sidebar{overflow-y:auto!important}
    .advanced-page-sidebar{height:100vh!important;min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;padding:10px 12px 0!important;background:#fff!important}

    .advanced-sidebar .tool-section:not(.upload-section):not(#pageEditSection):not(#insertOverlaySection){display:none!important}
    .advanced-sidebar .upload-section,.advanced-sidebar #pageEditSection,.advanced-sidebar #insertOverlaySection{display:block!important}
    .advanced-sidebar #pageEditSection,.advanced-sidebar #insertOverlaySection{border-top:1px solid #e7edf3!important}

    .advanced-right-tabs{order:0;display:grid;grid-template-columns:1fr 1fr;gap:4px;flex:0 0 auto;padding:2px;margin:0 0 8px;border:1px solid #dce4ec;border-radius:10px;background:#f1f5f9}
    .advanced-right-tab{height:34px;border:0;border-radius:8px;background:transparent;color:#64748b;font-size:10px;font-weight:900;cursor:pointer}
    .advanced-right-tab[aria-selected="true"]{background:#fff;color:#12396d;box-shadow:0 1px 4px rgba(15,23,42,.12)}
    .advanced-right-tab:focus-visible{outline:2px solid #3b82f6;outline-offset:1px}

    .advanced-page-sidebar .workspace-toolbar{order:1;flex:0 0 auto!important;margin:0 0 8px!important}
    .advanced-page-sidebar .page-section{order:2!important;display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;padding:0!important;border:0!important}
    .advanced-page-sidebar .section-title-row{flex:0 0 auto!important;margin:0 2px 7px!important}
    .advanced-page-sidebar .page-section>.pair-nav{flex:0 0 auto!important;margin:0 0 9px!important}
    .advanced-page-sidebar .page-list{display:grid!important;grid-template-columns:1fr!important;align-content:start!important;gap:10px!important;flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:2px 3px 14px!important;scrollbar-gutter:stable}
    .advanced-page-sidebar .page-item{position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;width:100%!important;min-width:0!important;min-height:0!important;padding:8px!important;gap:6px!important;border:1px solid #dfe5ec!important;border-radius:11px!important;background:#fff!important}
    .advanced-page-sidebar .page-item canvas.page-sidebar-thumb{order:1!important;display:block!important;width:100%!important;height:184px!important;object-fit:contain!important;background:#fff!important;border:1px solid #e2e8f0!important;border-radius:6px!important}
    .advanced-page-sidebar .page-item-info{order:2!important;display:block!important;width:100%!important;text-align:center!important;min-width:0!important}
    .advanced-page-sidebar .page-item-info strong{display:block!important;font-size:10px!important;line-height:1.35!important;color:#334155!important;font-weight:900!important}
    .advanced-page-sidebar .page-item-info span{display:none!important}
    .advanced-page-sidebar .page-remove{position:absolute!important;right:9px!important;top:9px!important;z-index:4!important;width:24px!important;height:24px!important;padding:0!important;border:1px solid #e2e8f0!important;border-radius:999px!important;background:rgba(255,255,255,.96)!important;color:#64748b!important;box-shadow:0 1px 4px rgba(15,23,42,.13)!important}
    .advanced-page-sidebar .page-remove:hover{background:#fee2e2!important;color:#b91c1c!important;border-color:#fecaca!important}
    .advanced-page-sidebar .page-item.selected{border-color:#3b82f6!important;box-shadow:inset 0 0 0 1px #3b82f6!important;background:#eff6ff!important}

    .advanced-settings-scroller{order:3;display:none;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 3px 16px;scrollbar-gutter:stable}
    .advanced-settings-scroller .advanced-size-inspector{display:block!important;min-height:0!important;margin:0!important;padding:10px 0 12px!important;border:0!important;border-bottom:1px solid #edf1f5!important;background:transparent!important}
    .advanced-settings-scroller .advanced-trim-inputs{display:grid!important;grid-template-columns:76px minmax(0,1fr) 12px minmax(0,1fr) 26px!important;gap:5px!important;margin:0!important;align-items:center!important}
    .advanced-settings-scroller .advanced-trim-inputs label{font-size:9px!important;font-weight:900!important;color:#475569!important}
    .advanced-settings-scroller .advanced-trim-inputs input{width:100%!important;min-width:0!important}
    .advanced-settings-scroller .advanced-trim-auto{grid-column:1/-1!important;width:100%!important;margin-top:2px!important}
    .advanced-settings-title{font-size:10px;font-weight:900;color:#12396d;margin:0 0 8px}
    .advanced-settings-scroller .advanced-settings-section{display:block!important;margin:0!important;padding:12px 0!important;border-top:1px solid #edf1f5!important;background:transparent!important;position:static!important;box-shadow:none!important}
    .advanced-settings-scroller #advancedPaperSizeSection{border-top:0!important}
    .advanced-settings-scroller .advanced-settings-section .section-title{font-size:10px!important;font-weight:900!important;color:#12396d!important;margin-bottom:8px!important}
    .advanced-settings-scroller .advanced-settings-section .hint{font-size:8px!important;line-height:1.45!important;margin-bottom:0!important}
    .advanced-settings-scroller .advanced-settings-section .number-grid,.advanced-settings-scroller .advanced-settings-section .text-grid,.advanced-settings-scroller .advanced-settings-section .select-grid{gap:6px!important}
    .advanced-settings-scroller .advanced-settings-section input,.advanced-settings-scroller .advanced-settings-section select{min-width:0!important}

    .advanced-page-sidebar[data-active-tab="settings"] .workspace-toolbar,
    .advanced-page-sidebar[data-active-tab="settings"] .page-section{display:none!important}
    .advanced-page-sidebar[data-active-tab="settings"] .advanced-settings-scroller{display:block!important}
    .advanced-page-sidebar[data-active-tab="pages"] .advanced-settings-scroller{display:none!important}

    .advanced-page-sidebar .advanced-output-section{order:10;flex:0 0 auto!important;display:grid!important;position:static!important;bottom:auto!important;margin:0 -12px!important;padding:10px 12px 12px!important;border-top:1px solid #dbe4ec!important;background:#fff!important;box-shadow:0 -7px 16px rgba(15,23,42,.05)!important;z-index:12!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn{border-color:#fecaca!important;background:#fff1f2!important;color:#dc2626!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:hover:not(:disabled){background:#fee2e2!important;color:#b91c1c!important;border-color:#fca5a5!important;box-shadow:0 0 0 2px rgba(220,38,38,.08)!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:focus-visible{outline:2px solid #ef4444!important;outline-offset:2px!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn svg{width:19px!important;height:19px!important;stroke:currentColor!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:disabled{background:#f8fafc!important;color:#cbd5e1!important;border-color:#e2e8f0!important}

    .advanced-canvas-statusbar{height:36px;flex:0 0 36px;display:flex;align-items:center;gap:14px;padding:0 13px;border-top:1px solid #d6dee7;background:#fff;color:#475569;font-size:9px;overflow:hidden;white-space:nowrap}
    .advanced-canvas-statusbar .advanced-size-block{display:flex!important;align-items:center!important;gap:5px!important;white-space:nowrap!important}
    .advanced-canvas-statusbar .advanced-size-block strong{font-size:9px!important;color:#12396d!important}
    .advanced-canvas-statusbar .advanced-size-block span{font-size:9px!important;font-weight:850!important;color:#334155!important}
    .advanced-canvas-statusbar .advanced-trim-status{min-width:0!important;margin-left:auto!important;font-size:9px!important;text-align:right!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .advanced-canvas-paper{display:flex;align-items:center;gap:5px;font-size:9px;color:#334155;font-weight:850}
    .advanced-canvas-paper strong{color:#12396d}
    .advanced-workspace .busy-overlay{inset:0 0 36px!important}

    @media(max-width:1280px){.advanced-app{grid-template-columns:300px minmax(0,1fr) 310px!important}.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{height:172px!important}}
    @media(max-width:1050px){.advanced-app{grid-template-columns:290px minmax(0,1fr) 300px!important}.advanced-page-sidebar{padding-inline:9px!important}.advanced-page-sidebar .advanced-output-section{margin-inline:-9px!important;padding-inline:9px!important}}
    @media(max-width:900px){.advanced-app{grid-template-columns:280px minmax(0,1fr) 285px!important}.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{height:158px!important}.advanced-canvas-statusbar{gap:8px;padding-inline:9px}}
    @media(max-width:720px){.advanced-app{grid-template-columns:1fr!important}.advanced-page-sidebar{height:520px!important;max-height:520px!important;overflow:hidden!important;padding:9px 10px 0!important}.advanced-page-sidebar .page-list{grid-template-columns:1fr!important}.advanced-page-sidebar .page-item canvas.page-sidebar-thumb{height:190px!important}.advanced-page-sidebar .advanced-output-section{margin-inline:-10px!important;padding-inline:10px!important}.advanced-canvas-statusbar{height:auto;min-height:42px;flex:0 0 auto;flex-wrap:wrap;padding-block:6px}.advanced-workspace .busy-overlay{inset:0!important}}
  `;
  document.head.appendChild(style);
}

function sectionFor(id) {
  return $(id)?.closest('.tool-section') || null;
}

function tagSettingsSections() {
  const paper = $('advancedPaperSizeSection');
  const margin = sectionFor('marginLeft');
  const headerFooter = sectionFor('hfEnabled');
  const pageNumbers = sectionFor('pnEnabled');
  const output = sectionFor('downloadBtn');
  for (const node of [paper, margin, headerFooter, pageNumbers, output]) node?.classList.add('advanced-settings-section');
  margin?.classList.add('advanced-margin-section');
  headerFooter?.classList.add('advanced-header-footer-section');
  pageNumbers?.classList.add('advanced-page-number-section');
  output?.classList.add('advanced-output-section');
  return { paper, margin, headerFooter, pageNumbers, output };
}

function ensureTabs(sidebar) {
  let tabs = $('advancedRightTabs');
  if (!tabs) {
    tabs = document.createElement('div');
    tabs.id = 'advancedRightTabs';
    tabs.className = 'advanced-right-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '오른쪽 사이드바');
    tabs.innerHTML = `
      <button id="advancedPagesTab" class="advanced-right-tab" type="button" role="tab" aria-selected="true">페이지</button>
      <button id="advancedSettingsTab" class="advanced-right-tab" type="button" role="tab" aria-selected="false">출력 설정</button>`;
    sidebar.insertBefore(tabs, sidebar.firstChild);
    const activate = name => {
      sidebar.dataset.activeTab = name;
      $('advancedPagesTab').setAttribute('aria-selected', String(name === 'pages'));
      $('advancedSettingsTab').setAttribute('aria-selected', String(name === 'settings'));
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    };
    $('advancedPagesTab').addEventListener('click', () => activate('pages'));
    $('advancedSettingsTab').addEventListener('click', () => activate('settings'));
  }
  if (!sidebar.dataset.activeTab) sidebar.dataset.activeTab = 'pages';
  return tabs;
}

function ensureSettingsScroller(sidebar) {
  let scroller = $('advancedSettingsScroller');
  if (!scroller) {
    scroller = document.createElement('div');
    scroller.id = 'advancedSettingsScroller';
    scroller.className = 'advanced-settings-scroller';
    sidebar.appendChild(scroller);
  }
  return scroller;
}

function moveSizeSummaryToCanvas(inspector) {
  const workspace = document.querySelector('.advanced-workspace');
  const preview = $('previewScroll');
  if (!workspace || !preview || !inspector) return false;
  let bar = $('advancedCanvasStatusBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'advancedCanvasStatusBar';
    bar.className = 'advanced-canvas-statusbar';
    preview.insertAdjacentElement('afterend', bar);
  }
  for (const block of [...inspector.querySelectorAll('.advanced-size-block')]) bar.appendChild(block);
  const status = $('advancedTrimStatus');
  if (status && status.parentElement !== bar) bar.appendChild(status);
  let paper = $('advancedCanvasPaper');
  if (!paper) {
    paper = document.createElement('div');
    paper.id = 'advancedCanvasPaper';
    paper.className = 'advanced-canvas-paper';
    paper.innerHTML = '<strong>출력</strong><span id="advancedCanvasPaperText">-</span>';
    const statusNode = $('advancedTrimStatus');
    if (statusNode?.parentElement === bar) bar.insertBefore(paper, statusNode);
    else bar.appendChild(paper);
  }
  return true;
}

function prepareTrimSettings(inspector) {
  if (!inspector) return;
  if (!inspector.querySelector('.advanced-settings-title')) {
    const title = document.createElement('div');
    title.className = 'advanced-settings-title';
    title.textContent = '재단 사이즈';
    inspector.insertBefore(title, inspector.firstChild);
  }
}

function syncPaperStatus() {
  const text = $('advancedCanvasPaperText');
  if (!text) return;
  const page = selectedPage();
  if (!page) {
    text.textContent = '-';
    return;
  }
  if (!isSheetLayoutMode()) {
    text.textContent = '원본 크기';
    return;
  }
  const paper = paperSizeMmForPage(page);
  text.textContent = `${paper.width.toFixed(1)} × ${paper.height.toFixed(1)} mm`;
}

function styleResetButton() {
  const reset = $('advancedWorkspaceResetBtn');
  if (!reset) return;
  reset.setAttribute('aria-label', '편집 초기화');
  reset.title = '편집 초기화 · 원본 PDF는 유지하고 편집/출력 설정만 초기화';
  reset.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 9A8 8 0 1 1 4 14"/><path d="M4.5 4.5V9h4.5"/></svg>';
}

function applyLayout() {
  const sidebar = document.querySelector('.advanced-page-sidebar');
  const toolbar = document.querySelector('.workspace-toolbar');
  const pageSection = sidebar?.querySelector('.page-section');
  const inspector = $('advancedSizeInspector');
  if (!sidebar || !toolbar || !pageSection || !inspector) return false;

  const { paper, margin, headerFooter, pageNumbers, output } = tagSettingsSections();
  if (!paper || !margin || !headerFooter || !pageNumbers || !output) return false;

  ensureTabs(sidebar);
  const scroller = ensureSettingsScroller(sidebar);
  prepareTrimSettings(inspector);
  moveSizeSummaryToCanvas(inspector);

  for (const node of [inspector, paper, margin, headerFooter, pageNumbers]) scroller.appendChild(node);
  sidebar.appendChild(output);
  styleResetButton();
  syncPaperStatus();

  sidebar.dataset.tabbedLayout = 'right-v9';
  document.querySelector('.advanced-sidebar')?.setAttribute('data-edit-tools-only', '1');
  return true;
}

function install() {
  installStyles();
  if (!applyLayout()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (applyLayout() || tries >= 80) window.clearInterval(timer);
    }, 50);
  }
  window.addEventListener('pdf-advanced-state-change', () => {
    syncPaperStatus();
    const sidebar = document.querySelector('.advanced-page-sidebar');
    if (sidebar?.dataset.tabbedLayout !== 'right-v9') window.setTimeout(applyLayout, 0);
  });
  window.addEventListener('resize', syncPaperStatus);
  document.documentElement.dataset.pdfAdvancedSidebarRoles = 'edit-left-tabbed-right-v9';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
