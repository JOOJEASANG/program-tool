// Full-width, full-height layouts for every PDF Utility tool modal.
// Presentation only: the tool workflows, upload handling, and export actions are unchanged.
(() => {
  'use strict';
  if (window.__programStudioPdfUtilityModalFullWorkspaceV1) return;
  window.__programStudioPdfUtilityModalFullWorkspaceV1 = true;

  const install = () => {
    if (document.getElementById('pdfUtilityModalFullWorkspaceStyle')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityModalFullWorkspaceStyle';
    style.textContent = `
      /* Make the modal almost viewport-sized without hiding its close button. */
      .pdfuc-modal.open{padding:8px!important}
      .pdfuc-modal.open .pdfuc-dialog{
        box-sizing:border-box!important;
        width:min(1680px,calc(100vw - 16px))!important;
        max-width:none!important;
        height:calc(100vh - 16px)!important;
        height:calc(100dvh - 16px)!important;
        max-height:none!important;
        margin:auto!important;
      }
      .pdfuc-modal.open .pdfuc-dialog>.pdfu-stage{display:flex!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important}
      .pdfuc-modal.open .pdfuc-dialog .pdfu-stage-body{
        box-sizing:border-box!important;
        flex:1 1 auto!important;
        min-height:0!important;
        min-width:0!important;
        padding:12px!important;
        overflow:auto!important;
        scrollbar-gutter:stable;
      }
      .pdfuc-modal.open .pdfu-stage-body>:is(
        .pdfud-card,.pdfuc-server-card,#local-tools,#pdf-primary-workspace,
        .pdfadv-overlay,.pdfocr-overlay,.pdfu-frame-shell,.pdfu-stage-card
      ){width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important}
      .pdfuc-modal.open .pdfu-stage-body>.pdfud-card,
      .pdfuc-modal.open .pdfu-stage-body>.pdfuc-server-card,
      .pdfuc-modal.open .pdfu-stage-body>#local-tools,
      .pdfuc-modal.open .pdfu-stage-body>#pdf-primary-workspace{min-height:100%!important}

      /* Direct operations: one edge-to-edge upload/setup area before run,
         then proportional upload/setup + status/result panels. */
      .pdfuc-modal.open .pdfud-card .pdfud-grid{
        box-sizing:border-box!important;width:100%!important;
        grid-template-columns:minmax(0,1fr)!important;
        justify-content:stretch!important;
        align-items:stretch!important;min-height:100%!important;gap:12px!important;
      }
      .pdfuc-modal.open .pdfud-card[data-pdfud-modal-flow="active"] .pdfud-grid{
        grid-template-columns:minmax(0,44fr) minmax(0,56fr)!important;
      }
      .pdfuc-modal.open .pdfud-card .pdfud-panel{
        width:100%!important;max-width:none!important;
        min-width:0!important;min-height:100%!important;
        box-sizing:border-box!important;padding:clamp(15px,1.8vw,26px)!important;
      }
      .pdfuc-modal.open .pdfud-card .pdfud-file{
        flex:1 1 190px!important;min-height:200px!important;max-height:none!important;
        width:100%!important;box-sizing:border-box!important;
      }
      .pdfuc-modal.open .pdfud-card .pdfud-run{width:100%!important}
      .pdfuc-modal.open .pdfud-card .pdfud-result{min-width:0!important;min-height:100%!important}
      .pdfuc-modal.open .pdfud-card .pdfud-empty{flex:1 1 auto!important;min-height:220px!important}

      /* Server-based merge/extract: remove the 760/1040px centered caps. */
      .pdfuc-modal.open .pdfuc-server-card[data-pdfuc-modal-flow]{
        display:grid!important;width:100%!important;max-width:none!important;
        grid-template-columns:minmax(0,1fr)!important;
        justify-content:stretch!important;align-items:stretch!important;
        min-height:100%!important;gap:12px!important;
        box-sizing:border-box!important;
      }
      .pdfuc-modal.open .pdfuc-server-card[data-pdfuc-modal-flow="active"]{
        grid-template-columns:minmax(0,44fr) minmax(0,56fr)!important;
      }
      .pdfuc-modal.open .pdfuc-flow-primary{
        display:flex!important;flex-direction:column!important;
        min-width:0!important;width:100%!important;min-height:100%!important;
      }
      .pdfuc-modal.open .pdfuc-flow-primary .pdfuc-tool-upload{
        flex:1 1 190px!important;width:100%!important;min-height:200px!important;
        max-height:none!important;box-sizing:border-box!important;
      }
      .pdfuc-modal.open .pdfuc-flow-feedback{width:100%!important;min-width:0!important;min-height:100%!important;box-sizing:border-box!important}
      .pdfuc-modal.open .pdfuc-server-card .pdfuc-server-run{width:100%!important}
      .pdfuc-modal.open .pdfuc-server-files{overflow-wrap:anywhere!important;max-height:34vh!important;overflow-y:auto!important}

      /* Browser-local actions, shared advanced tools, OCR and frame-based tools. */
      .pdfuc-modal.open .pdfu-local-workgrid{
        width:100%!important;min-height:100%!important;
        grid-template-columns:minmax(0,44fr) minmax(0,56fr)!important;
        align-items:stretch!important;gap:12px!important;
      }
      .pdfuc-modal.open .pdfu-local-controls{align-self:stretch!important;display:flex!important;flex-direction:column!important;min-width:0!important}
      .pdfuc-modal.open .pdfu-local-controls .drop{
        flex:1 1 180px!important;width:100%!important;min-height:200px!important;
      }
      .pdfuc-modal.open .pdfu-local-result{min-width:0!important;min-height:100%!important}
      .pdfuc-modal.open .pdfu-stage-body.pdfu-shared-advanced-stage{
        grid-template-columns:minmax(0,44fr) minmax(0,56fr)!important;gap:12px!important;
      }
      .pdfuc-modal.open .pdfu-stage-body.pdfu-shared-advanced-stage #local-tools .pdfu-local-workgrid{
        display:block!important;min-height:0!important;
      }
      .pdfuc-modal.open .pdfadv-overlay.pdfu-stable-inline,
      .pdfuc-modal.open .pdfocr-overlay.pdfu-stable-inline{min-width:0!important;min-height:100%!important}
      .pdfuc-modal.open .pdfadv-overlay.pdfu-stable-inline .pdfadv-dialog,
      .pdfuc-modal.open .pdfocr-overlay.pdfu-stable-inline .pdfocr-dialog{
        width:100%!important;max-width:none!important;min-width:0!important;
        min-height:100%!important;max-height:none!important;box-sizing:border-box!important;
      }
      .pdfuc-modal.open .pdfu-frame,.pdfuc-modal.open .pdfu-frame-shell{
        width:100%!important;min-height:calc(100dvh - 190px)!important;
      }
      @media(max-width:900px){
        .pdfuc-modal.open .pdfud-card[data-pdfud-modal-flow="active"] .pdfud-grid,
        .pdfuc-modal.open .pdfuc-server-card[data-pdfuc-modal-flow="active"],
        .pdfuc-modal.open .pdfu-local-workgrid,
        .pdfuc-modal.open .pdfu-stage-body.pdfu-shared-advanced-stage{
          grid-template-columns:minmax(0,1fr)!important;
        }
        .pdfuc-modal.open .pdfud-card .pdfud-panel,
        .pdfuc-modal.open .pdfuc-flow-primary,
        .pdfuc-modal.open .pdfu-local-controls{min-height:0!important}
        .pdfuc-modal.open .pdfud-card .pdfud-file,
        .pdfuc-modal.open .pdfuc-flow-primary .pdfuc-tool-upload,
        .pdfuc-modal.open .pdfu-local-controls .drop{flex:0 0 auto!important;min-height:200px!important}
        .pdfuc-modal.open .pdfuc-flow-feedback,
        .pdfuc-modal.open .pdfu-local-result{min-height:250px!important}
        .pdfuc-modal.open .pdfuc-dialog .pdfu-stage-body{scrollbar-gutter:auto}
      }
      @media(max-width:600px){
        .pdfuc-modal.open{padding:4px!important}
        .pdfuc-modal.open .pdfuc-dialog{
          width:calc(100vw - 8px)!important;
          height:calc(100dvh - 8px)!important;
          border-radius:14px!important;
        }
        .pdfuc-modal.open .pdfuc-dialog .pdfu-stage-body{padding:8px!important}
        .pdfuc-modal.open .pdfud-card .pdfud-panel,
        .pdfuc-modal.open .pdfuc-server-card{padding:13px!important}
        .pdfuc-modal.open .pdfud-card .pdfud-file,
        .pdfuc-modal.open .pdfuc-flow-primary .pdfuc-tool-upload,
        .pdfuc-modal.open .pdfu-local-controls .drop{min-height:165px!important}
      }
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.pdfUtilityModalFullWorkspace = 'ready';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.ProgramStudioPdfUtilityModalFullWorkspace=Object.freeze({stage:'full-modal-workspace-v1'});
})();
