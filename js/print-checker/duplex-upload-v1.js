/* duplex-upload-v1.js — leaflet/invitation single/duplex file slots */
'use strict';

(() => {
  if (window.__printCheckerDuplexUploadV1) return;
  window.__printCheckerDuplexUploadV1 = true;

  const SUPPORTED_PRODUCTS = new Set(['leaflet', 'invitation']);
  const ACCEPT = '.pdf,application/pdf,image/png,image/jpeg,image/webp';
  const DEFAULT_MODE = Object.freeze({ leaflet: 'duplex', invitation: 'duplex' });
  const modes = { ...DEFAULT_MODE };
  const files = { front: null, back: null };

  let activeProduct = '';
  let activeSide = 'front';
  let autoPdfDuplex = false;
  let detectionSerial = 0;
  let busy = false;

  const $ = (id) => document.getElementById(id);

  function checker() {
    try {
      if (typeof PrintChecker !== 'undefined') return PrintChecker;
    } catch (_) {}
    return window.PrintChecker || null;
  }

  function currentProduct() {
    const stateProduct = checker()?.getState?.()?.product;
    if (stateProduct) return stateProduct;
    return document.querySelector('.product-card.selected')?.dataset?.product
      || new URL(location.href).searchParams.get('product')
      || '';
  }

  function isSupportedProduct(product = currentProduct()) {
    return SUPPORTED_PRODUCTS.has(product);
  }

  function currentMode(product = currentProduct()) {
    return modes[product] || DEFAULT_MODE[product] || 'single';
  }

  function isPdf(file) {
    return Boolean(file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')));
  }

  function isImage(file) {
    return Boolean(file && (/^image\/(png|jpeg|webp)$/i.test(file.type || '') || /\.(png|jpe?g|webp)$/i.test(file.name || '')));
  }

  function validFile(file) {
    return isPdf(file) || isImage(file);
  }

  function installStyles() {
    if ($('duplexUploadStyle')) return;
    const style = document.createElement('style');
    style.id = 'duplexUploadStyle';
    style.textContent = `
      .pc-duplex-upload-panel{display:none;margin-top:9px}
      html[data-pc-duplex-upload="active"] .pc-duplex-upload-panel{display:block}
      html[data-pc-duplex-upload="active"] #uploadZone{display:none!important}
      html[data-pc-duplex-upload="active"] #sideSelectRow{display:none!important}
      html[data-pc-duplex-source="separate"] #invitationDuplexReportCard{display:none!important}
      .pc-duplex-mode{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}
      .pc-duplex-mode button{border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569;padding:8px 7px;font-size:11px;font-weight:800;cursor:pointer}
      .pc-duplex-mode button[aria-pressed="true"]{border-color:#2563eb;background:#eff6ff;color:#1d4ed8;box-shadow:inset 0 0 0 1px #2563eb}
      .pc-duplex-slots{display:grid;gap:7px}
      .pc-duplex-slot{position:relative;display:block;border:1px dashed #94a3b8;border-radius:10px;background:#f8fafc;padding:10px 10px 9px;cursor:pointer;transition:.15s ease}
      .pc-duplex-slot:hover,.pc-duplex-slot.is-drag{border-color:#2563eb;background:#eff6ff}
      .pc-duplex-slot.is-filled{border-style:solid;border-color:#93c5fd;background:#f8fbff}
      .pc-duplex-slot.is-active{box-shadow:0 0 0 2px rgba(37,99,235,.18);border-color:#2563eb}
      .pc-duplex-slot.is-auto{cursor:default;border-style:solid;border-color:#86efac;background:#f0fdf4}
      .pc-duplex-slot[hidden]{display:none!important}
      .pc-duplex-slot input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
      .pc-duplex-slot-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .pc-duplex-slot-side{font-size:11px;font-weight:900;color:#0f172a}
      .pc-duplex-slot-state{font-size:9px;font-weight:800;color:#64748b}
      .pc-duplex-slot-name{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:750;color:#334155}
      .pc-duplex-slot-help{display:block;margin-top:4px;font-size:9px;line-height:1.45;color:#64748b}
      .pc-duplex-view-tabs{display:none;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
      .pc-duplex-view-tabs.is-visible{display:grid}
      .pc-duplex-view-tabs button{border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:7px 6px;font-size:10px;font-weight:850;color:#475569;cursor:pointer}
      .pc-duplex-view-tabs button.is-active{border-color:#2563eb;background:#2563eb;color:#fff}
      .pc-duplex-message{margin-top:7px;border-radius:8px;padding:7px 8px;background:#f8fafc;color:#475569;font-size:9.5px;font-weight:700;line-height:1.5}
      .pc-duplex-message.is-error{background:#fef2f2;color:#b91c1c}
      .pc-duplex-message.is-ok{background:#f0fdf4;color:#166534}
      .pc-managed-side-badge{display:inline-flex;align-items:center;margin-right:5px;padding:2px 6px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:9px;font-weight:900;vertical-align:1px}
      @media(max-width:520px){.pc-duplex-mode,.pc-duplex-view-tabs{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = $('duplexUploadPanel');
    if (panel) return panel;
    const zone = $('uploadZone');
    if (!zone?.parentElement) return null;

    panel = document.createElement('div');
    panel.id = 'duplexUploadPanel';
    panel.className = 'pc-duplex-upload-panel';
    panel.innerHTML = `
      <div class="pc-duplex-mode" role="group" aria-label="인쇄 면 선택">
        <button type="button" data-mode="single" aria-pressed="false">단면 파일</button>
        <button type="button" data-mode="duplex" aria-pressed="true">양면 파일</button>
      </div>
      <div class="pc-duplex-slots">
        <label class="pc-duplex-slot" id="duplexFrontSlot" data-upload-side="front">
          <input type="file" id="duplexFrontInput" accept="${ACCEPT}">
          <span class="pc-duplex-slot-head"><strong class="pc-duplex-slot-side">앞면</strong><span class="pc-duplex-slot-state">파일 선택</span></span>
          <span class="pc-duplex-slot-name">PDF · PNG · JPEG · WEBP</span>
          <span class="pc-duplex-slot-help">2페이지 PDF를 올리면 1p 앞면 · 2p 뒷면으로 자동 인식합니다.</span>
        </label>
        <label class="pc-duplex-slot" id="duplexBackSlot" data-upload-side="back">
          <input type="file" id="duplexBackInput" accept="${ACCEPT}">
          <span class="pc-duplex-slot-head"><strong class="pc-duplex-slot-side">뒷면</strong><span class="pc-duplex-slot-state">파일 선택</span></span>
          <span class="pc-duplex-slot-name">PDF · PNG · JPEG · WEBP</span>
          <span class="pc-duplex-slot-help">이미지 또는 1페이지 PDF라면 뒷면 파일을 따로 올려주세요.</span>
        </label>
      </div>
      <div class="pc-duplex-view-tabs" id="duplexViewTabs" role="group" aria-label="미리보기 면 전환">
        <button type="button" data-view-side="front" class="is-active">앞면 보기</button>
        <button type="button" data-view-side="back">뒷면 보기</button>
      </div>
      <div class="pc-duplex-message" id="duplexUploadMessage">양면은 2페이지 PDF 1개 또는 앞·뒷면 파일 2개를 사용할 수 있습니다.</div>`;
    zone.insertAdjacentElement('beforebegin', panel);

    panel.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.mode));
    });
    $('duplexFrontInput')?.addEventListener('change', (event) => void receiveFile('front', event.target.files?.[0]));
    $('duplexBackInput')?.addEventListener('change', (event) => void receiveFile('back', event.target.files?.[0]));
    panel.querySelectorAll('[data-view-side]').forEach((button) => {
      button.addEventListener('click', () => void activateSide(button.dataset.viewSide));
    });
    panel.querySelectorAll('[data-upload-side]').forEach(bindDropSlot);
    return panel;
  }

  function bindDropSlot(slot) {
    if (!slot || slot.dataset.dropBound === '1') return;
    slot.dataset.dropBound = '1';
    ['dragenter', 'dragover'].forEach((type) => slot.addEventListener(type, (event) => {
      if (slot.classList.contains('is-auto')) return;
      event.preventDefault();
      slot.classList.add('is-drag');
    }));
    ['dragleave', 'drop'].forEach((type) => slot.addEventListener(type, () => slot.classList.remove('is-drag')));
    slot.addEventListener('drop', (event) => {
      if (slot.classList.contains('is-auto')) return;
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) void receiveFile(slot.dataset.uploadSide, file);
    });
  }

  function setMode(mode) {
    if (!['single', 'duplex'].includes(mode) || !isSupportedProduct()) return;
    modes[currentProduct()] = mode;
    activeSide = 'front';
    detectionSerial += 1;
    if (mode === 'single') autoPdfDuplex = false;
    syncUi();
    if (files.front) void activateSide('front', { redetect: mode === 'duplex' });
  }

  function setMessage(text, tone = '') {
    const node = $('duplexUploadMessage');
    if (!node) return;
    node.textContent = text;
    node.className = `pc-duplex-message${tone ? ` is-${tone}` : ''}`;
  }

  function resetSideInput(side) {
    const input = side === 'back' ? $('duplexBackInput') : $('duplexFrontInput');
    if (input) input.value = '';
  }

  async function receiveFile(side, file) {
    if (!file) return;
    if (!validFile(file)) {
      resetSideInput(side);
      setMessage('PDF 또는 이미지(PNG·JPEG·WEBP)만 사용할 수 있습니다.', 'error');
      return;
    }
    if (side === 'back' && autoPdfDuplex) return;

    files[side] = file;
    if (side === 'front') {
      autoPdfDuplex = false;
      activeSide = 'front';
      setMessage('앞면 파일을 확인하고 있습니다.');
      syncUi();
      await activateProcessingFile(file);
      if (currentMode() === 'duplex') void detectPdfDuplex(file);
      return;
    }

    activeSide = 'back';
    setMessage('뒷면 파일을 확인하고 있습니다.');
    syncUi();
    await activateProcessingFile(file);
    setMessage('앞면과 뒷면 파일이 준비되었습니다.', 'ok');
    announceSideChange('back', 'separate');
  }

  function assignMainInput(file) {
    const input = $('fileInput');
    if (!input || !file) return false;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (error) {
      console.warn('[print-checker duplex] DataTransfer fallback', error);
      return false;
    }
  }

  async function activateProcessingFile(file) {
    if (!file) return false;
    if (assignMainInput(file)) return true;
    try {
      return Boolean(await checker()?.inspectFile?.(file));
    } catch (error) {
      console.error('[print-checker duplex] file activation failed', error);
      setMessage('파일 미리보기를 준비하지 못했습니다.', 'error');
      return false;
    }
  }

  async function detectPdfDuplex(file) {
    const serial = ++detectionSerial;
    if (!isPdf(file) || file !== files.front || currentMode() !== 'duplex') {
      autoPdfDuplex = false;
      syncUi();
      return false;
    }
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (serial !== detectionSerial || file !== files.front || currentMode() !== 'duplex') return false;
      const state = checker()?.getState?.() || {};
      if (state.fileKind !== 'pdf') continue;
      const pages = Number(state.pdfPageCount || 0);
      if (!pages) continue;
      autoPdfDuplex = pages >= 2 && !files.back;
      if (autoPdfDuplex) {
        activeSide = 'front';
        setMessage(pages === 2
          ? '2페이지 PDF를 감지했습니다. 1p 앞면 · 2p 뒷면으로 자동 적용합니다.'
          : `${pages}페이지 PDF를 감지했습니다. 양면 미리보기는 1p 앞면 · 2p 뒷면을 사용합니다.`, 'ok');
      } else if (!files.back) {
        setMessage('1페이지 PDF입니다. 양면 검토를 위해 뒷면 파일을 추가해 주세요.');
      }
      syncUi();
      return autoPdfDuplex;
    }
    return false;
  }

  async function activateSide(side, options = {}) {
    if (!['front', 'back'].includes(side) || !isSupportedProduct()) return false;
    const mode = currentMode();
    if (mode === 'single') side = 'front';

    if (side === 'back' && autoPdfDuplex) {
      activeSide = 'back';
      syncUi();
      try {
        await checker()?.setFileSide?.('back');
        announceSideChange('back', 'pdf-2p');
        return true;
      } catch (error) {
        console.error('[print-checker duplex] PDF back side failed', error);
        setMessage('PDF 2페이지 미리보기를 전환하지 못했습니다.', 'error');
        return false;
      }
    }

    const file = files[side];
    if (!file) {
      setMessage(side === 'back' ? '뒷면 파일을 먼저 올려주세요.' : '앞면 파일을 먼저 올려주세요.', 'error');
      return false;
    }
    activeSide = side;
    autoPdfDuplex = false;
    syncUi();
    const ok = await activateProcessingFile(file);
    if (ok && options.redetect && side === 'front' && mode === 'duplex') void detectPdfDuplex(file);
    if (ok) {
      setMessage(`${side === 'front' ? '앞면' : '뒷면'} 미리보기를 표시하고 있습니다.`, 'ok');
      announceSideChange(side, 'separate');
    }
    return ok;
  }

  function announceSideChange(side, source) {
    try {
      window.dispatchEvent(new CustomEvent('programstudio:print-checker-duplex-side-changed', {
        detail: { side, source, product: currentProduct() },
      }));
    } catch (_) {}
  }

  function syncSlot(side) {
    const slot = side === 'back' ? $('duplexBackSlot') : $('duplexFrontSlot');
    if (!slot) return;
    const file = files[side];
    const duplex = currentMode() === 'duplex';
    const automaticBack = side === 'back' && duplex && autoPdfDuplex;
    slot.hidden = side === 'back' && !duplex;
    slot.classList.toggle('is-filled', Boolean(file) || automaticBack);
    slot.classList.toggle('is-active', activeSide === side && (Boolean(file) || automaticBack));
    slot.classList.toggle('is-auto', automaticBack);

    const input = slot.querySelector('input');
    if (input) input.disabled = automaticBack;
    const state = slot.querySelector('.pc-duplex-slot-state');
    const name = slot.querySelector('.pc-duplex-slot-name');
    const help = slot.querySelector('.pc-duplex-slot-help');

    if (automaticBack) {
      if (state) state.textContent = '자동 적용';
      if (name) name.textContent = '앞면 PDF의 2페이지';
      if (help) help.textContent = '1p 앞면 · 2p 뒷면으로 자동 연결되었습니다.';
      return;
    }
    if (file) {
      if (state) state.textContent = '선택됨';
      if (name) name.textContent = file.name || `${side === 'front' ? '앞면' : '뒷면'} 파일`;
      if (help) help.textContent = `${isPdf(file) ? 'PDF' : '이미지'} · 클릭하면 다른 파일로 교체할 수 있습니다.`;
      return;
    }
    if (state) state.textContent = '파일 선택';
    if (name) name.textContent = 'PDF · PNG · JPEG · WEBP';
    if (help) help.textContent = side === 'front'
      ? '2페이지 PDF를 올리면 1p 앞면 · 2p 뒷면으로 자동 인식합니다.'
      : '이미지 또는 1페이지 PDF라면 뒷면 파일을 따로 올려주세요.';
  }

  function syncUi() {
    const product = currentProduct();
    activeProduct = product;
    const supported = isSupportedProduct(product);
    const root = document.documentElement;
    root.dataset.pcDuplexUpload = supported ? 'active' : 'inactive';
    root.dataset.pcDuplexMode = supported ? currentMode(product) : '';
    root.dataset.pcDuplexSource = supported && currentMode(product) === 'duplex'
      ? (autoPdfDuplex ? 'pdf-2p' : (files.back ? 'separate' : 'pending'))
      : 'single';

    const panel = ensurePanel();
    if (panel) panel.hidden = !supported;
    if (!supported) return;

    panel.querySelectorAll('[data-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === currentMode(product)));
    });
    syncSlot('front');
    syncSlot('back');

    const tabs = $('duplexViewTabs');
    const canBack = currentMode(product) === 'duplex' && (autoPdfDuplex || Boolean(files.back));
    tabs?.classList.toggle('is-visible', Boolean(files.front) && canBack);
    tabs?.querySelectorAll('[data-view-side]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.viewSide === activeSide);
      button.disabled = button.dataset.viewSide === 'back' && !canBack;
    });

    const leafletDesc = document.querySelector('.product-card[data-product="leaflet"] .pc-desc');
    if (leafletDesc) leafletDesc.textContent = '앞면·뒷면 · 2단·3단·4단 접지';
    const invitationDesc = document.querySelector('.product-card[data-product="invitation"] .pc-desc');
    if (invitationDesc) invitationDesc.textContent = '단면·양면 · 접지 위치 확인';
  }

  function fileRelated(item) {
    const label = String(item?.label || '');
    return /^(PDF|이미지|업로드 파일)/.test(label);
  }

  function fileItemsForSide(items, side) {
    return (items || []).filter((item) => {
      const label = String(item?.label || '');
      if (label === 'PDF 페이지 수') return false;
      if (!fileRelated(item)) return false;
      if (side === 'front' && /\(2p\)/.test(label)) return false;
      return true;
    }).map((item) => ({ ...item, label: `${side === 'front' ? '앞면' : '뒷면'} · ${item.label.replace(/\s*\(1p\)$/, '')}` }));
  }

  function singleItems(items) {
    const output = [];
    for (const item of items || []) {
      const label = String(item?.label || '');
      if (label === 'PDF 페이지 수') continue;
      if (/PDF 실제 규격 \(2p\)/.test(label)) continue;
      output.push({ ...item, label: label.replace(/PDF 실제 규격 \(1p\)/, 'PDF 실제 규격') });
    }
    if (files.front) {
      output.push({
        label: '파일 구성', status: 'pass', detail: '단면',
        guide: `${files.front.name || '앞면 파일'}의 첫 면을 기준으로 검토합니다.`,
      });
    }
    return output;
  }

  function autoPdfItems(items) {
    const output = (items || []).filter((item) => String(item?.label || '') !== 'PDF 페이지 수');
    output.push({
      label: '양면 파일 구성', status: 'pass', detail: '2페이지 PDF',
      guide: 'PDF 1페이지를 앞면, 2페이지를 뒷면으로 자동 연결해 두 면을 모두 검토합니다.',
    });
    return output;
  }

  function renderManagedReport(items) {
    const section = $('reportSection');
    const grid = $('reportGrid');
    const summary = $('reportSummary');
    if (!section || !grid || !summary) return;
    grid.replaceChildren();
    const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
    (items || []).forEach((item) => {
      const status = ['pass', 'warn', 'fail', 'info'].includes(item.status) ? item.status : 'info';
      counts[status] += 1;
      const card = document.createElement('div');
      card.className = `report-card status-${status}`;
      const icon = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' }[status];
      const match = /^(앞면|뒷면) · (.*)$/.exec(String(item.label || ''));
      const labelHtml = match
        ? `<span class="pc-managed-side-badge">${match[1]}</span>${escapeHtml(match[2])}`
        : escapeHtml(item.label || '검토 항목');
      card.innerHTML = `<div class="rc-head"><span class="rc-icon">${icon}</span><strong class="rc-label">${labelHtml}</strong></div><div class="rc-detail">${escapeHtml(item.detail || '')}</div><div class="rc-guide">${escapeHtml(item.guide || '')}</div>`;
      grid.appendChild(card);
    });
    const overall = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
    summary.className = `report-summary status-${overall}`;
    summary.innerHTML = `<strong>${{ pass: '이상 없음', warn: '주의 필요', fail: '조치 필요' }[overall]}</strong> — 통과 ${counts.pass}, 주의 ${counts.warn}, 오류 ${counts.fail}`;
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (document.documentElement.dataset.pcDuplexSource === 'separate') $('invitationDuplexReportCard')?.remove();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[char]);
  }

  async function runManagedCheck() {
    if (busy || !isSupportedProduct()) return;
    const core = checker();
    if (!core?.runCheck) return;
    busy = true;
    const runButton = $('runBtn');
    if (runButton) runButton.disabled = true;
    try {
      const mode = currentMode();
      if (mode === 'single') {
        if (files.front && activeSide !== 'front') await activateSide('front');
        core.runCheck();
        renderManagedReport(singleItems(core.getState?.().reportItems || []));
        return;
      }

      if (!files.front) {
        setMessage('양면 검토를 시작하려면 앞면 파일을 먼저 올려주세요.', 'error');
        return;
      }

      const currentState = core.getState?.() || {};
      if (!autoPdfDuplex && isPdf(files.front) && !files.back && activeSide === 'front' && Number(currentState.pdfPageCount || 0) >= 2) {
        autoPdfDuplex = true;
        syncUi();
      }

      if (autoPdfDuplex) {
        if (activeSide !== 'front') await activateSide('front');
        core.runCheck();
        renderManagedReport(autoPdfItems(core.getState?.().reportItems || []));
        setMessage('2페이지 PDF의 앞면과 뒷면 검토가 완료되었습니다.', 'ok');
        return;
      }

      if (!files.back) {
        setMessage('양면 검토에는 뒷면 파일이 필요합니다. 뒷면 이미지 또는 PDF를 추가해 주세요.', 'error');
        renderManagedReport([{ label: '양면 파일 구성', status: 'warn', detail: '뒷면 누락', guide: '뒷면 파일을 추가한 뒤 다시 검토해 주세요.' }]);
        return;
      }

      const restoreSide = activeSide;
      await core.inspectFile(files.front);
      core.runCheck();
      const frontItems = core.getState?.().reportItems || [];
      const commonItems = frontItems.filter((item) => !fileRelated(item));
      const frontFileItems = fileItemsForSide(frontItems, 'front');

      await core.inspectFile(files.back);
      core.runCheck();
      const backItems = core.getState?.().reportItems || [];
      const backFileItems = fileItemsForSide(backItems, 'back');

      const combined = [
        ...commonItems,
        {
          label: '양면 파일 구성', status: 'pass', detail: '앞면 + 뒷면',
          guide: `${files.front.name || '앞면'} / ${files.back.name || '뒷면'} 두 파일을 각각 확인했습니다.`,
        },
        ...frontFileItems,
        ...backFileItems,
      ];
      renderManagedReport(combined);
      setMessage('앞면과 뒷면 파일을 각각 검토했습니다.', 'ok');

      const restoreFile = files[restoreSide] || files.front;
      activeSide = files[restoreSide] ? restoreSide : 'front';
      if (restoreFile) await core.inspectFile(restoreFile);
      syncUi();
      announceSideChange(activeSide, 'separate');
    } finally {
      busy = false;
      if (runButton) runButton.disabled = false;
    }
  }

  function resetManaged() {
    files.front = null;
    files.back = null;
    activeSide = 'front';
    autoPdfDuplex = false;
    detectionSerial += 1;
    Object.assign(modes, DEFAULT_MODE);
    resetSideInput('front');
    resetSideInput('back');
    setMessage('양면은 2페이지 PDF 1개 또는 앞·뒷면 파일 2개를 사용할 수 있습니다.');
    syncUi();
  }

  function bindGlobalEvents() {
    $('runBtn')?.addEventListener('click', (event) => {
      if (!isSupportedProduct()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void runManagedCheck();
    }, true);

    $('resetBtn')?.addEventListener('click', () => setTimeout(resetManaged, 0));
    window.addEventListener('programstudio:print-checker-product-stable', () => setTimeout(syncProduct, 0));
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('.product-card')) setTimeout(syncProduct, 0);
    }, true);
  }

  function syncProduct() {
    const product = currentProduct();
    if (product !== activeProduct) {
      activeProduct = product;
      activeSide = 'front';
      autoPdfDuplex = false;
      detectionSerial += 1;
    }
    syncUi();
  }

  function boot() {
    installStyles();
    ensurePanel();
    bindGlobalEvents();
    syncProduct();
  }

  window.PrintCheckerDuplexUpload = Object.freeze({
    sync: syncUi,
    activateSide,
    getState: () => ({
      product: currentProduct(), mode: currentMode(), activeSide, autoPdfDuplex,
      frontFile: files.front?.name || '', backFile: files.back?.name || '',
    }),
    stage: 'v1-duplex-file-slots',
    __test: { isSupportedProduct, isPdf, isImage, fileRelated, singleItems, autoPdfItems },
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
