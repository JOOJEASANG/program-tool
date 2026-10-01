const $ = id => document.getElementById(id);

function installStyles() {
  if ($('pdfAdvancedSettingsSidebarV8Styles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedSettingsSidebarV8Styles';
  style.textContent = `
    .advanced-app{grid-template-columns:310px minmax(0,1fr) 360px!important}
    .advanced-sidebar{overflow-y:auto!important}
    .advanced-page-sidebar{overflow-y:auto!important;overflow-x:hidden!important;padding:10px 12px 14px!important}
    .advanced-page-sidebar .workspace-toolbar{order:1}
    .advanced-page-sidebar .page-section{order:2!important;flex:0 0 auto!important;min-height:0!important;padding-bottom:10px!important;border-bottom:1px solid #e7edf3!important}
    .advanced-page-sidebar .page-list{flex:0 0 auto!important;max-height:300px!important;overflow:auto!important;padding-bottom:6px!important}
    .advanced-page-sidebar .advanced-size-inspector{order:3;margin-top:10px!important}
    .advanced-page-sidebar .advanced-settings-section{flex:0 0 auto!important;margin:0!important;border-top:1px solid #edf1f5!important;border-radius:0!important;padding:11px 2px!important;background:transparent!important}
    .advanced-page-sidebar #advancedPaperSizeSection{order:4}
    .advanced-page-sidebar .advanced-margin-section{order:5}
    .advanced-page-sidebar .advanced-header-footer-section{order:6}
    .advanced-page-sidebar .advanced-page-number-section{order:7}
    .advanced-page-sidebar .advanced-output-section{order:8;position:sticky;bottom:-14px;z-index:12;background:#fff!important;padding:12px 0 14px!important;border-top:1px solid #dbe4ec!important;box-shadow:0 -8px 16px rgba(15,23,42,.04)}
    .advanced-page-sidebar .advanced-settings-section .section-title{font-size:10px!important;font-weight:900!important;color:#12396d!important;margin-bottom:8px!important}
    .advanced-page-sidebar .advanced-settings-section .hint{font-size:8px!important;line-height:1.45!important;margin-bottom:0!important}
    .advanced-page-sidebar .advanced-settings-section .number-grid,.advanced-page-sidebar .advanced-settings-section .text-grid,.advanced-page-sidebar .advanced-settings-section .select-grid{gap:6px!important}
    .advanced-page-sidebar .advanced-settings-section input,.advanced-page-sidebar .advanced-settings-section select{min-width:0!important}

    .advanced-sidebar .tool-section:not(.upload-section):not(#pageEditSection):not(#insertOverlaySection){display:none!important}
    .advanced-sidebar .upload-section,.advanced-sidebar #pageEditSection,.advanced-sidebar #insertOverlaySection{display:block!important}
    .advanced-sidebar #pageEditSection,.advanced-sidebar #insertOverlaySection{border-top:1px solid #e7edf3!important}

    .output-section.advanced-output-grid #advancedWorkspaceResetBtn{border-color:#fecaca!important;background:#fff1f2!important;color:#dc2626!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:hover:not(:disabled){background:#fee2e2!important;color:#b91c1c!important;border-color:#fca5a5!important;box-shadow:0 0 0 2px rgba(220,38,38,.08)!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:focus-visible{outline:2px solid #ef4444!important;outline-offset:2px!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn svg{width:19px!important;height:19px!important;stroke:currentColor!important}
    .output-section.advanced-output-grid #advancedWorkspaceResetBtn:disabled{background:#f8fafc!important;color:#cbd5e1!important;border-color:#e2e8f0!important}

    @media(max-width:1280px){.advanced-app{grid-template-columns:300px minmax(0,1fr) 340px!important}}
    @media(max-width:1100px){.advanced-app{grid-template-columns:290px minmax(0,1fr) 320px!important}.advanced-page-sidebar .page-list{max-height:260px!important}}
    @media(max-width:900px){.advanced-app{grid-template-columns:280px minmax(0,1fr) 300px!important}.advanced-page-sidebar{padding-inline:9px!important}}
    @media(max-width:720px){.advanced-app{grid-template-columns:1fr!important}.advanced-sidebar .tool-section:not(.upload-section):not(#pageEditSection):not(#insertOverlaySection){display:none!important}.advanced-page-sidebar{height:auto!important;max-height:none!important;overflow:visible!important}.advanced-page-sidebar .page-list{max-height:320px!important}.advanced-page-sidebar .advanced-output-section{position:static!important;box-shadow:none!important}}
  `;
  document.head.appendChild(style);
}

function sectionFor(id) {
  return $(id)?.closest('.tool-section') || null;
}

function tagSettingsSections() {
  const margin = sectionFor('marginLeft');
  const headerFooter = sectionFor('hfEnabled');
  const pageNumbers = sectionFor('pnEnabled');
  const output = sectionFor('downloadBtn');
  const paper = $('advancedPaperSizeSection');

  paper?.classList.add('advanced-settings-section');
  margin?.classList.add('advanced-settings-section', 'advanced-margin-section');
  headerFooter?.classList.add('advanced-settings-section', 'advanced-header-footer-section');
  pageNumbers?.classList.add('advanced-settings-section', 'advanced-page-number-section');
  output?.classList.add('advanced-settings-section', 'advanced-output-section');

  return { paper, margin, headerFooter, pageNumbers, output };
}

function moveSettingsToRight() {
  const sidebar = document.querySelector('.advanced-page-sidebar');
  const toolbar = document.querySelector('.workspace-toolbar');
  const pageSection = sidebar?.querySelector('.page-section');
  const inspector = $('advancedSizeInspector');
  if (!sidebar || !toolbar || !pageSection || !inspector) return false;

  const { paper, margin, headerFooter, pageNumbers, output } = tagSettingsSections();
  if (!paper || !margin || !headerFooter || !pageNumbers || !output) return false;

  const ordered = [toolbar, pageSection, inspector, paper, margin, headerFooter, pageNumbers, output];
  for (const node of ordered) sidebar.appendChild(node);
  sidebar.dataset.settingsLayout = 'right-v8';

  const left = document.querySelector('.advanced-sidebar');
  if (left) left.dataset.editToolsOnly = '1';

  const reset = $('advancedWorkspaceResetBtn');
  if (reset) {
    reset.setAttribute('aria-label', '편집 초기화');
    reset.title = '편집 초기화 · 원본 PDF는 유지하고 편집/출력 설정만 초기화';
    reset.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 9A8 8 0 1 1 4 14"/><path d="M4.5 4.5V9h4.5"/></svg>';
  }
  return true;
}

function install() {
  installStyles();
  if (!moveSettingsToRight()) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (moveSettingsToRight() || tries >= 80) window.clearInterval(timer);
    }, 50);
  }
  window.addEventListener('pdf-advanced-state-change', () => {
    const sidebar = document.querySelector('.advanced-page-sidebar');
    if (sidebar?.dataset.settingsLayout !== 'right-v8') window.setTimeout(moveSettingsToRight, 0);
  });
  document.documentElement.dataset.pdfAdvancedSidebarRoles = 'edit-left-settings-right-v8';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
