(() => {
  'use strict';
  if (window.__smartPrintNumberingUiPolishV1) return;
  window.__smartPrintNumberingUiPolishV1 = true;

  const $ = id => document.getElementById(id);

  function injectStyles() {
    if ($('smartNumberingUiPolishStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartNumberingUiPolishStyles';
    style.textContent = `
      .smart-numbering-panel > .check-row{
        min-height:38px;padding:9px 11px;border:1px solid #b8ddd8;border-radius:10px;
        background:#f0fdfa;color:#0f5132;font-size:11px;font-weight:900
      }
      .smart-numbering-panel > .check-row input{width:15px;height:15px;flex:0 0 auto}
      .smart-numbering-panel .numbering-options{gap:10px!important;margin-top:11px!important}
      .smart-numbering-panel .numbering-ui-group{
        display:grid;gap:8px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc
      }
      .smart-numbering-panel .numbering-ui-group-title{
        display:flex;align-items:center;gap:7px;margin:0 0 1px;color:#334155;font-size:10px;font-weight:950;letter-spacing:-.1px
      }
      .smart-numbering-panel .numbering-ui-group-title::before{
        content:'';width:3px;height:11px;border-radius:999px;background:#14b8a6;flex:0 0 auto
      }
      .smart-numbering-panel .numbering-ui-group .grid2{gap:8px 10px!important;align-items:end}
      .smart-numbering-panel .numbering-ui-group .field{margin-bottom:0}
      .smart-numbering-panel .numbering-ui-group .field > span{margin-bottom:5px}
      .smart-numbering-panel .numbering-ui-group .check-row{margin:0}
      .smart-numbering-panel .numbering-transparent-check,
      .smart-numbering-panel .numbering-bold-check{
        min-height:34px!important;margin:0!important;padding:7px 9px;border:1px solid #d7e0e8;border-radius:8px;background:#fff
      }
      .smart-numbering-panel .numbering-side-row > .field{grid-column:1 / -1}
      .smart-numbering-panel .numbering-side-row > div:empty{display:none}
      .smart-numbering-panel .numbering-offset-row small{
        display:block;margin-top:4px;color:#8492a6;font-size:8.5px;font-weight:700;line-height:1.25
      }
      .smart-numbering-panel .numbering-fixed-font{background:#fff}
      .smart-numbering-panel .numbering-color-field input[type="color"]{background:#fff}
      .smart-numbering-panel .numbering-estimate{margin-top:1px}
      .smart-numbering-panel .hint{margin:0;padding:0 2px}
      @media(max-width:520px){
        .smart-numbering-panel .numbering-ui-group .grid2{grid-template-columns:1fr!important}
        .smart-numbering-panel .numbering-side-row > .field{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function uniqueRows(ids) {
    const rows = [];
    ids.forEach(id => {
      const row = $(id)?.closest('.grid2');
      if (row && !rows.includes(row)) rows.push(row);
    });
    return rows;
  }

  function makeGroup(title, rows) {
    if (!rows.length) return null;
    const group = document.createElement('section');
    group.className = 'numbering-ui-group';
    group.setAttribute('aria-label', title);
    const heading = document.createElement('div');
    heading.className = 'numbering-ui-group-title';
    heading.textContent = title;
    group.appendChild(heading);
    rows[0].insertAdjacentElement('beforebegin', group);
    rows.forEach(row => group.appendChild(row));
    return group;
  }

  function polish() {
    const options = $('numberingOptions');
    const enabled = $('numberingEnabled');
    if (!options || !enabled) return false;

    const labelText = enabled.closest('.check-row')?.querySelector('span');
    if (labelText) labelText.textContent = '넘버링';

    injectStyles();

    const transparent = $('numberingTransparent')?.closest('.check-row');
    if (transparent) transparent.classList.add('numbering-transparent-check');

    if (options.querySelector('.numbering-ui-group')) return true;

    // numbering-preview-sync.js가 동적으로 추가하는 옵션까지 생성된 뒤 묶는다.
    if (!$('numberingTargetSide') || !$('numberingOffsetX') || !$('numberingBold') || !$('numberingColor')) return false;

    makeGroup('기본 설정', uniqueRows(['numberingStart', 'numberingPrefix']));
    makeGroup('표시 설정', uniqueRows(['numberingFont', 'numberingPosition', 'numberingBold']));
    makeGroup('출력 위치', uniqueRows(['numberingTargetSide', 'numberingOffsetX']));
    return true;
  }

  function start() {
    let attempts = 0;
    const tryPolish = () => {
      attempts += 1;
      if (polish() || attempts >= 30) return;
      requestAnimationFrame(tryPolish);
    };
    tryPolish();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
