// Wide desktop workspace for PDF Utility. Keeps existing tool behavior and only reorganizes presentation.
(function () {
  'use strict';
  if (window.__pdfUtilityWideLayoutV1) return;
  window.__pdfUtilityWideLayoutV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(
    path === '/pdf-preflight' ||
    path.endsWith('/pdf-preflight/index.html') ||
    path.endsWith('/tools/pdf-Checker.html') ||
    path.endsWith('/tools/preflight.html')
  )) return;

  const $ = (id) => document.getElementById(id);
  let attempts = 0;
  let observer = null;

  function formatMb(bytes) {
    return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)}MB`;
  }

  function installStyles() {
    if ($('pdfUtilityWideLayoutStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityWideLayoutStyles';
    style.textContent = `
      body.pdfu-wide-layout .container{
        width:min(100%,1660px)!important;
        max-width:1660px!important;
        padding:26px clamp(16px,2.1vw,34px) 80px!important;
      }
      body.pdfu-wide-layout .hero{
        padding:27px 32px 25px!important;
        margin-bottom:20px!important;
        border-radius:22px!important;
      }
      body.pdfu-wide-layout .hero h1{font-size:clamp(28px,3vw,38px)!important;margin-bottom:7px!important}
      body.pdfu-wide-layout .hero p{max-width:980px!important}
      body.pdfu-wide-layout .hero-steps{margin-top:15px!important}
      body.pdfu-wide-layout .workspace{
        display:grid!important;
        grid-template-columns:minmax(365px,430px) minmax(0,1fr)!important;
        gap:22px!important;
        align-items:start!important;
      }
      body.pdfu-wide-layout .workspace>.panel{
        height:auto!important;
        min-width:0!important;
        border-radius:20px!important;
      }
      body.pdfu-wide-layout .workspace>.panel:first-child{
        position:sticky!important;
        top:78px!important;
        max-height:calc(100vh - 96px)!important;
        overflow:auto!important;
        scrollbar-gutter:stable;
      }
      body.pdfu-wide-layout .workspace>.panel:first-child .status-stack{
        margin-top:16px!important;
        padding-top:0!important;
      }
      body.pdfu-wide-layout .upload-zone{padding:27px 18px!important}
      body.pdfu-wide-layout .upload-icon{width:56px!important;height:56px!important;font-size:27px!important}
      body.pdfu-wide-layout .pdfu-file-items{max-height:360px!important}
      body.pdfu-wide-layout .pdfu-file-row{padding:11px 12px!important}
      body.pdfu-wide-layout .pdfu-file-name{font-size:12px!important}
      body.pdfu-wide-layout .pdfu-file-meta{font-size:10px!important}
      body.pdfu-wide-layout .action-grid.pdfuw-legacy-grid{display:none!important}
      body.pdfu-wide-layout .pdfuw-tool-groups{display:grid;gap:18px}
      body.pdfu-wide-layout .pdfuw-tool-section{
        border:1px solid #dfe8f0;
        border-radius:17px;
        background:linear-gradient(180deg,#fbfdff 0%,#f8fbfd 100%);
        padding:17px;
      }
      body.pdfu-wide-layout .pdfuw-section-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        margin-bottom:13px;
      }
      body.pdfu-wide-layout .pdfuw-section-kicker{
        font-size:10px;
        font-weight:950;
        color:#1d9bb2;
        letter-spacing:.04em;
        margin-bottom:4px;
      }
      body.pdfu-wide-layout .pdfuw-section-title{font-size:16px;font-weight:950;color:#172033;letter-spacing:-.35px}
      body.pdfu-wide-layout .pdfuw-section-desc{font-size:10px;color:#64748b;line-height:1.55;margin-top:4px}
      body.pdfu-wide-layout .pdfuw-section-badge{
        flex-shrink:0;
        border-radius:999px;
        padding:6px 9px;
        background:#eaf7fa;
        color:#0e7490;
        font-size:9px;
        font-weight:900;
      }
      body.pdfu-wide-layout .pdfuw-action-grid{
        display:grid;
        gap:11px;
      }
      body.pdfu-wide-layout .pdfuw-action-grid.batch{grid-template-columns:repeat(2,minmax(0,1fr))}
      body.pdfu-wide-layout .pdfuw-action-grid.single{grid-template-columns:repeat(3,minmax(0,1fr))}
      body.pdfu-wide-layout .pdfuw-action-grid .action-btn{
        min-height:132px!important;
        width:100%;
        padding:15px!important;
      }
      body.pdfu-wide-layout .pdfuw-action-grid .action-icon{
        width:40px!important;
        height:40px!important;
        margin-bottom:10px!important;
      }
      body.pdfu-wide-layout .pdfuw-action-grid .action-name{font-size:13px!important}
      body.pdfu-wide-layout .pdfuw-action-grid .action-desc{font-size:10px!important;line-height:1.5!important}
      body.pdfu-wide-layout .pdfuw-active-file{
        display:flex;
        align-items:center;
        gap:9px;
        min-width:0;
        margin:0 0 12px;
        padding:10px 12px;
        border:1px solid #cce9ef;
        border-radius:11px;
        background:#f0fdff;
      }
      body.pdfu-wide-layout .pdfuw-active-file-label{
        flex-shrink:0;
        padding:4px 7px;
        border-radius:7px;
        background:#d7f5f9;
        color:#0e7490;
        font-size:9px;
        font-weight:950;
      }
      body.pdfu-wide-layout .pdfuw-active-file-name{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:10px;
        color:#334155;
        font-weight:850;
      }
      body.pdfu-wide-layout #inlineResetBtn{margin-top:18px!important}
      body.pdfu-wide-layout #pdfUtilityBatchResults{
        width:100%;
        margin-top:24px!important;
        padding:20px;
        border:1px solid #dbe5ee;
        border-radius:20px;
        background:rgba(255,255,255,.86);
        box-shadow:0 10px 30px rgba(15,23,42,.05);
      }
      body.pdfu-wide-layout #pdfUtilityBatchResults .pdfu-summary{margin-bottom:14px!important}
      body.pdfu-wide-layout #pdfUtilityBatchResults .pdfu-result-list{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:10px!important;
      }
      body.pdfu-wide-layout #results{
        width:100%;
        margin-top:24px!important;
        padding:20px;
        border:1px solid #dbe5ee;
        border-radius:20px;
        background:rgba(255,255,255,.86);
        box-shadow:0 10px 30px rgba(15,23,42,.05);
      }
      body.pdfu-wide-layout #results .results-header{margin-bottom:15px!important}
      body.pdfu-wide-layout #results .checks-grid{
        grid-template-columns:repeat(3,minmax(260px,1fr))!important;
        gap:12px!important;
      }
      body.pdfu-wide-layout .pdfu-modal{width:min(620px,100%)!important}

      @media(min-width:1500px){
        body.pdfu-wide-layout .workspace{grid-template-columns:minmax(390px,455px) minmax(0,1fr)!important}
        body.pdfu-wide-layout .pdfuw-action-grid.single{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
      @media(min-width:1051px) and (max-width:1299px){
        body.pdfu-wide-layout .container{max-width:1240px!important}
        body.pdfu-wide-layout .workspace{grid-template-columns:minmax(335px,385px) minmax(0,1fr)!important}
        body.pdfu-wide-layout .pdfuw-action-grid.single{grid-template-columns:repeat(2,minmax(0,1fr))}
        body.pdfu-wide-layout #results .checks-grid{grid-template-columns:repeat(2,minmax(260px,1fr))!important}
      }
      @media(max-width:1050px){
        body.pdfu-wide-layout .container{max-width:100%!important;padding:22px 16px 60px!important}
        body.pdfu-wide-layout .workspace{grid-template-columns:1fr!important}
        body.pdfu-wide-layout .workspace>.panel:first-child{position:static!important;max-height:none!important;overflow:visible!important}
        body.pdfu-wide-layout .pdfuw-action-grid.single{grid-template-columns:repeat(2,minmax(0,1fr))}
        body.pdfu-wide-layout #pdfUtilityBatchResults .pdfu-result-list{grid-template-columns:1fr!important}
        body.pdfu-wide-layout #results .checks-grid{grid-template-columns:repeat(2,minmax(240px,1fr))!important}
      }
      @media(max-width:680px){
        body.pdfu-wide-layout .container{padding:18px 12px 48px!important}
        body.pdfu-wide-layout .hero{padding:24px 20px!important}
        body.pdfu-wide-layout .pdfuw-action-grid.batch,
        body.pdfu-wide-layout .pdfuw-action-grid.single{grid-template-columns:1fr!important}
        body.pdfu-wide-layout .pdfuw-action-grid .action-btn{min-height:118px!important}
        body.pdfu-wide-layout #results .checks-grid{grid-template-columns:1fr!important}
        body.pdfu-wide-layout #pdfUtilityBatchResults,
        body.pdfu-wide-layout #results{padding:13px!important;border-radius:16px!important}
        body.pdfu-wide-layout .pdfuw-section-head{flex-direction:column}
      }
    `;
    document.head.appendChild(style);
  }

  function toolSection(id, kicker, title, desc, badge, gridClass) {
    const section = document.createElement('section');
    section.id = id;
    section.className = 'pdfuw-tool-section';
    section.innerHTML = `
      <div class="pdfuw-section-head">
        <div>
          <div class="pdfuw-section-kicker">${kicker}</div>
          <div class="pdfuw-section-title">${title}</div>
          <div class="pdfuw-section-desc">${desc}</div>
        </div>
        <span class="pdfuw-section-badge">${badge}</span>
      </div>
      <div class="pdfuw-action-grid ${gridClass}"></div>
    `;
    return section;
  }

  function activeFileStrip() {
    const bar = document.createElement('div');
    bar.id = 'pdfUtilityWideActiveFile';
    bar.className = 'pdfuw-active-file';
    bar.innerHTML = '<span class="pdfuw-active-file-label">선택 파일</span><span class="pdfuw-active-file-name" id="pdfUtilityWideActiveFileName">파일을 등록한 뒤 작업할 파일을 선택하세요.</span>';
    return bar;
  }

  function updateActiveFile() {
    const utility = window.PdfUtility;
    const state = utility?.state;
    const target = $('pdfUtilityWideActiveFileName');
    if (!target || !state) return;
    const file = state.files?.[state.activeIndex] || null;
    target.textContent = file ? `${file.name} · ${formatMb(file.size)}` : '파일을 등록한 뒤 작업할 파일을 선택하세요.';
    target.title = file?.name || '';
  }

  function reorganizeTools() {
    if ($('pdfUtilityWideToolGroups')) return true;
    const actionGrid = document.querySelector('.action-grid');
    const actionPanel = document.querySelector('.workspace>.panel:nth-child(2)');
    const panelHead = actionPanel?.querySelector('.panel-head');
    if (!actionGrid || !actionPanel || !panelHead) return false;

    const required = [
      'checkBtn', 'encryptBtn', 'decryptBtn', 'pdfUtilityMergeBtn',
      'pdfUtilityBackgroundBtn', 'pdfUtilityCompressBtn', 'pdfUtilityRepairBtn'
    ];
    if (required.some((id) => !$(id))) return false;

    const groups = document.createElement('div');
    groups.id = 'pdfUtilityWideToolGroups';
    groups.className = 'pdfuw-tool-groups';

    const batch = toolSection(
      'pdfUtilityWideBatchSection',
      'BATCH TOOLS',
      '여러 PDF 일괄 작업',
      '등록된 전체 파일을 대상으로 검사하거나 현재 순서대로 하나의 PDF로 합칩니다.',
      '최대 10개',
      'batch'
    );
    const single = toolSection(
      'pdfUtilityWideSingleSection',
      'SELECTED FILE TOOLS',
      '선택 파일 개별 작업',
      '왼쪽 파일 목록에서 선택한 PDF 한 개에만 적용됩니다. 원본은 그대로 두고 결과 파일을 새로 내려받습니다.',
      '선택 1개',
      'single'
    );
    single.querySelector('.pdfuw-section-head').insertAdjacentElement('afterend', activeFileStrip());

    const batchGrid = batch.querySelector('.pdfuw-action-grid');
    const singleGrid = single.querySelector('.pdfuw-action-grid');
    ['checkBtn', 'pdfUtilityMergeBtn'].forEach((id) => batchGrid.appendChild($(id)));
    ['pdfUtilityBackgroundBtn', 'pdfUtilityCompressBtn', 'pdfUtilityRepairBtn', 'encryptBtn', 'decryptBtn']
      .forEach((id) => singleGrid.appendChild($(id)));

    groups.append(batch, single);
    actionGrid.classList.add('pdfuw-legacy-grid');
    actionGrid.insertAdjacentElement('afterend', groups);

    const reset = $('inlineResetBtn');
    if (reset) groups.insertAdjacentElement('afterend', reset);
    updateActiveFile();
    return true;
  }

  function watchFileSelection() {
    const list = $('pdfUtilityFileItems');
    if (!list || observer) return;
    observer = new MutationObserver(updateActiveFile);
    observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    list.addEventListener('click', () => setTimeout(updateActiveFile, 0));
  }

  function install() {
    attempts += 1;
    if (!window.PdfUtility || !$('pdfUtilityFileList') || !$('pdfUtilityFinalizeScriptV1')) {
      if (attempts < 100) setTimeout(install, 75);
      return;
    }

    installStyles();
    document.body.classList.add('pdfu-wide-layout');
    if (!reorganizeTools()) {
      if (attempts < 100) setTimeout(install, 75);
      return;
    }
    watchFileSelection();
    updateActiveFile();
    document.documentElement.dataset.pdfUtilityWideLayout = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
