/* spine-calculator-v2.js — 평량·종이 두께·제본 여유를 반영한 표지 책등 계산 */
(function () {
  'use strict';
  if (window.__printCheckerSpineCalculatorV2) return;
  window.__printCheckerSpineCalculatorV2 = true;

  const DEFAULT_ALLOWANCE_MM = 0.5;
  const PROFILE = Object.freeze({
    mojo80:  { family: '모조지', gsm: 80,  bulk: 1.250 },
    mojo100: { family: '모조지', gsm: 100, bulk: 1.300 },
    snow80:  { family: '스노우지', gsm: 80,  bulk: 1.125 },
    snow100: { family: '스노우지', gsm: 100, bulk: 1.100 },
    snow120: { family: '스노우지', gsm: 120, bulk: 1.125 },
    art80:   { family: '아트지', gsm: 80,  bulk: 1.125 },
    art100:  { family: '아트지', gsm: 100, bulk: 1.050 },
    art130:  { family: '아트지', gsm: 130, bulk: 1.077 },
    custom:  { family: '직접 입력', gsm: 0, bulk: null },
  });

  const byId = (id) => document.getElementById(id);
  let observer = null;
  let installQueued = false;

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function roundSpine(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function field(id, label, hint, value, unit, step, min, max) {
    const wrap = document.createElement('div');
    wrap.className = 'spec-field spine-calc-v2-field';
    wrap.dataset.spineCalcV2 = id;
    wrap.innerHTML = `<label class="spec-label" for="${id}">${label}<small class="spec-hint">${hint}</small></label><div class="spec-input-row"><input class="spec-input" id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"><span class="spec-unit">${unit}</span></div>`;
    return wrap;
  }

  function currentProfile() {
    return PROFILE[byId('paperType')?.value] || null;
  }

  function sheetThicknessMm() {
    const profile = currentProfile();
    if (!profile) return 0;
    if (profile.bulk == null) return Math.max(0, Number(byId('paperCaliperV2')?.value) || 0);
    const gsm = Math.max(0, Number(byId('paperGsmV2')?.value) || profile.gsm || 0);
    return round(gsm * profile.bulk / 1000, 4);
  }

  function formulaValues() {
    const pages = Math.max(0, parseInt(byId('pageCount')?.value, 10) || 0);
    const sheets = Math.ceil(pages / 2);
    const thickness = sheetThicknessMm();
    const allowance = Math.max(0, Number(byId('spineAllowanceV2')?.value) || 0);
    const body = round(sheets * thickness, 3);
    const total = roundSpine(body + allowance);
    return { pages, sheets, thickness, allowance, body, total };
  }

  function updateFormulaNote(values, manual = false) {
    const note = byId('spineFormulaV2');
    if (!note) return;
    if (manual) {
      note.innerHTML = '<strong>책등 직접 입력 중</strong><br><span>자동 계산을 다시 사용하려면 책등 값을 지운 뒤 평량·페이지 수·제본 여유를 변경하세요.</span>';
      return;
    }
    if (!values.pages || !values.thickness) {
      note.innerHTML = '<strong>책등 계산식</strong><br><span>본문 장수 × 종이 1장 두께 + 제본 여유</span>';
      return;
    }
    const profile = currentProfile();
    const gsm = Math.max(0, Number(byId('paperGsmV2')?.value) || profile?.gsm || 0);
    const paperText = profile?.bulk == null
      ? `직접 두께 ${values.thickness.toFixed(3)}mm/장`
      : `${profile?.family || '종이'} ${gsm}g/㎡ · 약 ${values.thickness.toFixed(3)}mm/장`;
    note.innerHTML = `<strong>자동 계산 ${values.total.toFixed(1)}mm</strong><br><span>${values.pages}p = ${values.sheets}장 × ${values.thickness.toFixed(3)}mm = ${values.body.toFixed(2)}mm + 제본 여유 ${values.allowance.toFixed(1)}mm</span><br><span>${paperText}</span>`;
  }

  function calculate(options = {}) {
    const spine = byId('spine');
    if (!spine) return false;
    const values = formulaValues();
    const manual = spine.dataset.manual === '1';
    if (manual && !options.force) {
      updateFormulaNote(values, true);
      return false;
    }
    if (!values.pages || !values.thickness) {
      updateFormulaNote(values, false);
      return false;
    }
    const next = values.total.toFixed(1);
    const changed = spine.value !== next;
    spine.dataset.manual = '';
    spine.value = next;
    const hint = byId('spineHint');
    if (hint) hint.textContent = `평량·장수·제본 여유 반영: ${next}mm`;
    updateFormulaNote(values, false);
    if (changed) spine.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function syncPaperPreset(force = false) {
    const profile = currentProfile();
    const gsm = byId('paperGsmV2');
    const caliperField = byId('paperCaliperV2')?.closest('.spec-field');
    if (!profile || !gsm) return;
    if (profile.bulk == null) {
      if (caliperField) caliperField.hidden = false;
      if (force && !gsm.value) gsm.value = '80';
    } else {
      if (caliperField) caliperField.hidden = true;
      if (force || !gsm.dataset.userEdited) gsm.value = String(profile.gsm);
    }
  }

  function injectedFieldsPresent() {
    return Boolean(byId('paperGsmV2') && byId('paperCaliperV2') && byId('spineAllowanceV2') && byId('spineFormulaV2'));
  }

  function installFields() {
    const form = byId('specForm');
    const paper = byId('paperType');
    const pages = byId('pageCount');
    const spine = byId('spine');
    if (!form || !paper || !pages || !spine) return false;
    if (form.dataset.spineCalculatorV2 === 'ready' && injectedFieldsPresent()) {
      syncPaperPreset(false);
      calculate();
      return true;
    }
    if (form.dataset.spineCalculatorV2 === 'ready') delete form.dataset.spineCalculatorV2;

    const paperField = paper.closest('.spec-field');
    const pageField = pages.closest('.spec-field');
    const spineField = spine.closest('.spec-field');
    if (!paperField || !pageField || !spineField) return false;

    const gsmField = field('paperGsmV2', '종이 평량', '선택 종이의 평량. 필요하면 직접 수정할 수 있습니다.', currentProfile()?.gsm || 80, 'g/㎡', '1', '40', '400');
    paperField.insertAdjacentElement('afterend', gsmField);

    const caliperField = field('paperCaliperV2', '종이 1장 두께', '직접 입력 종이에서만 사용합니다.', '0.100', 'mm', '0.001', '0.02', '0.8');
    gsmField.insertAdjacentElement('afterend', caliperField);

    const allowanceValue = Number.isFinite(Number(form.dataset.spineAllowanceV2))
      ? Number(form.dataset.spineAllowanceV2)
      : DEFAULT_ALLOWANCE_MM;
    const allowanceField = field('spineAllowanceV2', '제본 여유', '접착제·압착·종이 편차를 보정하는 추가 여유입니다.', allowanceValue.toFixed(1), 'mm', '0.1', '0', '10');
    pageField.insertAdjacentElement('afterend', allowanceField);

    const note = document.createElement('div');
    note.id = 'spineFormulaV2';
    note.className = 'spine-formula-v2';
    note.style.cssText = 'margin:-2px 0 10px;padding:9px 10px;border:1px solid #dbeafe;border-radius:9px;background:#f8fbff;color:#334155;font-size:10px;line-height:1.55';
    note.innerHTML = '<strong>책등 계산식</strong><br><span>본문 장수 × 종이 1장 두께 + 제본 여유</span>';
    spineField.insertAdjacentElement('afterend', note);

    form.dataset.spineCalculatorV2 = 'ready';
    syncPaperPreset(true);
    calculate();
    document.documentElement.dataset.printCheckerSpineCalculator = 'v2-gsm-allowance';
    return true;
  }

  function queueInstall() {
    if (installQueued) return;
    installQueued = true;
    queueMicrotask(() => {
      installQueued = false;
      installFields();
    });
  }

  // Bubble after the core field listeners so the enhanced formula wins over the legacy fixed-caliper calculation.
  document.addEventListener('change', (event) => {
    const id = event.target?.id;
    if (id === 'paperType') {
      byId('paperGsmV2')?.removeAttribute('data-user-edited');
      syncPaperPreset(true);
      const spine = byId('spine');
      if (spine) spine.dataset.manual = '';
      calculate({ force: true });
      return;
    }
    if (['pageCount', 'paperGsmV2', 'paperCaliperV2', 'spineAllowanceV2'].includes(id)) calculate();
  }, false);

  document.addEventListener('input', (event) => {
    const id = event.target?.id;
    if (id === 'paperGsmV2') event.target.dataset.userEdited = '1';
    if (id === 'spineAllowanceV2') {
      const form = byId('specForm');
      if (form) form.dataset.spineAllowanceV2 = String(Math.max(0, Number(event.target.value) || 0));
    }
    if (['pageCount', 'paperGsmV2', 'paperCaliperV2', 'spineAllowanceV2'].includes(id)) calculate();
    if (id === 'spine') {
      if (!event.target.value) {
        event.target.dataset.manual = '';
        calculate({ force: true });
      } else {
        updateFormulaNote(formulaValues(), true);
      }
    }
  }, false);

  function bind() {
    const form = byId('specForm');
    if (form && typeof MutationObserver === 'function') {
      observer = new MutationObserver(queueInstall);
      observer.observe(form, { childList: true, subtree: false });
    }
    queueInstall();
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card,#resetBtn')) requestAnimationFrame(queueInstall);
    });
  }

  window.PrintCheckerSpineCalculator = Object.freeze({
    calculate,
    formulaValues,
    sheetThicknessMm,
    profiles: PROFILE,
    stage: 'v2-gsm-allowance',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
