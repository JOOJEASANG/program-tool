// Professional visual system for the unified print design workspace.
(function(){
  'use strict';
  if(window.__designEditorProfessionalUiV1)return;
  window.__designEditorProfessionalUiV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;
  if(document.getElementById('designProfessionalUiStyles'))return;

  const style=document.createElement('style');
  style.id='designProfessionalUiStyles';
  style.textContent=`
    :root{
      --ps-workspace:#e5eaef;
      --ps-panel:#ffffff;
      --ps-line:#d9e2ea;
      --ps-text:#243244;
      --ps-muted:#6b788a;
      --ps-primary:#173f70;
      --ps-accent:#167f98;
      --ps-focus:rgba(31,116,180,.18);
    }

    /* Workspace proportions */
    .editor-shell{grid-template-columns:304px minmax(0,1fr)!important;background:var(--ps-workspace)!important}
    .sidebar{padding:12px!important;gap:10px!important;background:#f8fafc!important;border-right:1px solid var(--ps-line)!important;scrollbar-gutter:stable}
    .side-card,.design-mode-card{border-color:var(--ps-line)!important;border-radius:11px!important;background:var(--ps-panel)!important;box-shadow:0 1px 2px rgba(15,23,42,.025)!important}
    .side-card{padding:12px!important}

    /* Typography: no production control should feel microscopic */
    .document-title{font-size:14px!important;letter-spacing:-.15px}
    .document-meta{font-size:10px!important;line-height:1.45!important;margin-top:4px!important}
    .side-label{font-size:10.5px!important;letter-spacing:.01em!important;margin-bottom:8px!important}
    .inspector-title{font-size:13px!important;letter-spacing:-.1px}
    .inspector-note{font-size:10px!important;line-height:1.55!important;margin:5px 0 12px!important}
    .field label{font-size:10px!important;line-height:1.35!important;margin-bottom:5px!important}
    .check-row{font-size:10px!important;line-height:1.4!important}
    .readonly-value{font-size:10.5px!important;line-height:1.45!important}
    .layer-name{font-size:10px!important}
    .layer-state{font-size:8.5px!important}
    .layer-empty{font-size:9.5px!important;line-height:1.45!important}

    /* Controls */
    .field{margin-bottom:10px!important}
    .field input,.field select,.field textarea{min-height:34px!important;border-radius:8px!important;padding:7px 9px!important;font-size:11px!important;border-color:#cfd9e3!important;color:var(--ps-text)!important}
    .field textarea{min-height:70px!important}
    .field input:focus,.field select:focus,.field textarea:focus{border-color:#6ca6c5!important;box-shadow:0 0 0 3px var(--ps-focus)!important}
    .mini-action{min-height:30px!important;padding:6px 9px!important;font-size:9.5px!important}
    .add-grid button,.wide-btn,.action-grid button{min-height:34px!important;padding:8px!important;font-size:10px!important;border-radius:8px!important}
    .segmented button{min-height:31px!important;font-size:9.5px!important;padding:6px 4px!important}
    .layer-row{min-height:38px!important;padding:7px 8px!important}

    /* Embedded document settings */
    #designEmbeddedModeCard{padding:12px!important}
    #designEmbeddedModeCard .design-mode-head{gap:9px!important;margin-bottom:10px!important}
    #designEmbeddedModeCard .design-mode-home{width:30px!important;height:30px!important;border-radius:8px!important;font-size:12px!important}
    #designEmbeddedModeCard .design-mode-title{font-size:12px!important;color:var(--ps-primary)!important}
    #designEmbeddedModeCard .design-mode-sub{font-size:9px!important;line-height:1.45!important;color:var(--ps-muted)!important;margin-top:2px!important}
    #designEmbeddedModeCard .design-mode-options{margin-top:10px!important;padding-top:10px!important;border-color:#e1e7ed!important}
    #designEmbeddedModeCard .design-mode-note{font-size:9.5px!important;line-height:1.5!important}
    #designEmbeddedModeCard .design-mode-field{margin-bottom:7px!important}
    #designEmbeddedModeCard .design-mode-field label{font-size:9.5px!important;margin-bottom:4px!important}
    #designEmbeddedModeCard .design-mode-field select,
    #designEmbeddedModeCard .design-mode-field input{min-height:34px!important;padding:7px 8px!important;font-size:10.5px!important;border-radius:8px!important}
    #designEmbeddedModeCard .design-mode-apply{min-height:34px!important;font-size:10px!important;border-radius:8px!important}
    #designEmbeddedModeCard .design-mode-size-note{font-size:8.7px!important;line-height:1.45!important;margin-top:5px!important}

    /* Top command bar */
    .editor-toolbar{height:58px!important;flex-basis:58px!important;padding:0 12px!important;border-bottom-color:var(--ps-line)!important;box-shadow:0 2px 8px rgba(15,39,72,.045)!important}
    #designPrintProductTopbar .design-product-topbar-label,.design-surface-topbar-label{font-size:9.5px!important}
    #designPrintProductTopbar .design-product-topbar-btn{height:34px!important;border-radius:8px!important;padding:0 11px!important;font-size:10px!important;font-weight:850!important}
    #designSurfaceTopbarGroup .surface-tab{height:32px!important;padding:0 10px!important;font-size:9.5px!important}
    .design-top-command{height:34px!important;min-width:34px!important;padding:0 9px!important;font-size:9.5px!important;border-radius:8px!important}
    .design-top-command svg{width:16px!important;height:16px!important}
    .design-top-popover{border-radius:11px!important;padding:10px!important}
    .design-popover-title{font-size:10.5px!important}
    .design-insert-grid button{min-height:36px!important;font-size:9.5px!important}
    .design-help-list li{font-size:9.5px!important}
    .design-help-list kbd{font-size:8px!important}
    .editor-toolbar>.save-state,.save-state{font-size:9.5px!important;padding:5px 9px!important}

    /* Canvas and preview */
    .editor-main{background:var(--ps-workspace)!important}
    .artboard-viewport{
      padding:44px!important;
      background-color:var(--ps-workspace)!important;
      background-image:linear-gradient(rgba(255,255,255,.28) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.28) 1px,transparent 1px)!important;
      background-size:24px 24px!important;
    }
    .artboard{box-shadow:0 20px 52px rgba(26,39,56,.20),0 0 0 1px rgba(85,101,119,.12)!important}
    .panel-guide-label{font-size:8.5px!important;padding:4px 7px!important}
    .object-lock{font-size:8px!important;padding:2px 5px!important}
    .editor-footer{height:38px!important;flex-basis:38px!important;padding:0 13px!important;border-top-color:var(--ps-line)!important}
    .editor-status{font-size:9.5px!important;line-height:1.4!important}

    /* Accessible interaction states */
    button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #3d8fb4!important;outline-offset:2px!important}
    button{transition:border-color .12s ease,background-color .12s ease,color .12s ease,box-shadow .12s ease}

    @media(max-width:1280px){
      .editor-shell{grid-template-columns:288px minmax(0,1fr)!important}
      #designPrintProductTopbar .design-product-topbar-btn{padding:0 9px!important;font-size:9.5px!important}
    }
    @media(max-width:980px){
      .editor-shell{grid-template-columns:1fr!important}
      .sidebar{padding:10px!important}
      .artboard-viewport{padding:32px 16px!important}
    }
    @media(max-width:620px){
      .editor-toolbar{padding:7px 8px!important}
      #designPrintProductTopbar .design-product-topbar-btn{height:32px!important;font-size:9px!important}
      .artboard-viewport{padding:26px 10px!important}
    }
  `;
  document.head.appendChild(style);
  document.documentElement.dataset.professionalUi='1';

  window.DesignEditorProfessionalUi={stage:'professional-workspace-visual-system-v1'};
})();
