/* spine-calculator-v2.js — paper-option-only automatic perfect-binding spine calculation */
(function () {
  'use strict';
  if (window.__printCheckerSpineCalculatorV2) return;
  window.__printCheckerSpineCalculatorV2 = true;

  // Reference profile: Fastbooks/Sodaprint published sheet calipers (mm/sheet).
  // Perfect binding receives a fixed 0.5 mm adhesive/process allowance, the lower
  // edge of the published 0.5–1.0 mm recommendation. Final production should still
  // be checked against the printer's actual paper lot and binding equipment.
  const BINDING_ALLOWANCE_MM = 0.5;
  const PAPER_PROFILES = Object.freeze({
    mojo80:  { label: '모조지 80g', family: '모조지', gsm: 80,  caliper: 0.090 },
    mojo100: { label: '모조지 100g', family: '모조지', gsm: 100, caliper: 0.114 },
    mojo150: { label: '모조지 150g', family: '모조지', gsm: 150, caliper: 0.167 },
    art100:  { label: '아트지 100g', family: '아트지', gsm: 100, caliper: 0.081 },
    art120:  { label: '아트지 120g', family: '아트지', gsm: 120, caliper: 0.097 },
    art150:  { label: '아트지 150g', family: '아트지', gsm: 150, caliper: 0.123 },
    snow100: { label: '스노우지 100g', family: '스노우지', gsm: 100, caliper: 0.081 },
    snow120: { label: '스노우지 120g', family: '스노우지', gsm: 120, caliper: 0.097 },
    snow150: { label: '스노우지 150g', family: '스노우지', gsm: 150, caliper: 0.123 },
  });

  const byId = (id) => document.getElementById(id);
  let observer = null;
  let installQueued = false;

  function roundUpTenth(value) {
    return Math.ceil((Number(value) || 0) * 10 - 1e-8) / 10;
  }

  function profileFor(value) {
    return PAPER_PROFILES[String(value || '')] || PAPER_PROFILES.mojo80;
  }

  function formulaValues() {
    const pages = Math.max(0, parseInt(byId('pageCount')?.value, 10) || 0);
    const profile = profileFor(byId('paperType')?.value);
    const sheets = Math.ceil(pages / 2);
    const body = sheets * profile.caliper;
    const total = pages >= 2 ? roundUpTenth(body + BINDING_ALLOWANCE_MM) : 0;
    return {
      pages,
      sheets,
      body,
      total,
      allowance: BINDING_ALLOWANCE_MM,
      profile,
    };
  }

  function syncPaperOptions() {
    const select = byId('paperType');
    if (!select) return false;
    const current = PAPER_PROFILES[select.value] ? select.value : 'mojo80';
    const signature = Object.keys(PAPER_PROFILES).join('|');
    if (select.dataset.autoPaperProfiles !== signature) {
      select.replaceChildren(...Object.entries(PAPER_PROFILES).map(([value, profile]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = profile.label;
        return option;
      }));
      select.dataset.autoPaperProfiles = signature;
    }
    select.value = current;
    return true;
  }

  function updateNote(values) {
    const note = byId('spineAutoResult');
    if (!note) return;
    if (!values.pages) {
      note.innerHTML = '<strong>책등 자동 계산</strong><br><span>본문 페이지 수와 종이 옵션을 선택하면 자동으로 계산됩니다.</span>';
      return;
    }
    note.innerHTML = `<strong>자동 책등 ${values.total.toFixed(1)}mm</strong><br><span>${values.profile.label} · ${values.pages}p = ${values.sheets}장 × ${values.profile.caliper.toFixed(3)}mm + 제본 여유 ${values.allowance.toFixed(1)}mm</span><br><span>실제 종이 로트·제본 장비에 따라 오차가 생길 수 있으므로 최종 제작 수치는 인쇄소 사양을 우선하세요.</span>`;
  }

  function calculate() {
    const spine = byId('spine');
    if (!spine) return false;
    syncPaperOptions();
    const values = formulaValues();
    if (!values.pages || values.pages < 2) {
      spine.value = '';
      updateNote(values);
      return false;
    }
    const next = values.total.toFixed(1);
    const changed = spine.value !== next;
    spine.value = next;
    spine.readOnly = true;
    spine.setAttribute('aria-readonly', 'true');
    spine.dataset.automaticSpine = '1';
    const hint = byId('spineHint');
    if (hint) hint.textContent = '본문 페이지 수와 종이 옵션으로 자동 계산';
    updateNote(values);
    if (changed) spine.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function install() {
    const form = byId('specForm');
    const paper = byId('paperType');
    const pages = byId('pageCount');
    const spine = byId('spine');
    if (!form || !paper || !pages || !spine) return false;

    syncPaperOptions();
    spine.readOnly = true;
    spine.setAttribute('aria-readonly', 'true');
    spine.removeAttribute('data-manual');

    let note = byId('spineAutoResult');
    if (!note) {
      note = document.createElement('div');
      note.id = 'spineAutoResult';
      note.className = 'spine-auto-result';
      spine.closest('.spec-field')?.insertAdjacentElement('afterend', note);
    }
    form.dataset.spineCalculatorV2 = 'automatic-paper-profile';
    document.documentElement.dataset.printCheckerSpineCalculator = 'v2-automatic-paper-profile';
    calculate();
    return true;
  }

  function queueInstall() {
    if (installQueued) return;
    installQueued = true;
    queueMicrotask(() => {
      installQueued = false;
      install();
    });
  }

  document.addEventListener('change', (event) => {
    if (['paperType', 'pageCount'].includes(event.target?.id)) calculate();
  }, false);

  document.addEventListener('input', (event) => {
    if (event.target?.id === 'pageCount') calculate();
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
    profileFor,
    profiles: PAPER_PROFILES,
    bindingAllowanceMm: BINDING_ALLOWANCE_MM,
    stage: 'v2-automatic-paper-profile',
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
