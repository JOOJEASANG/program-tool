/* Design Review geometry bridge — A4 defaults and remembered print size. */
'use strict';

(() => {
  if (window.__designReviewStep1V2) return;
  window.__designReviewStep1V2 = true;

  const GEOMETRY_KEY = 'programStudio.designReview.geometry.v1';
  const DEFAULT_GEOMETRY = Object.freeze({ trimW: 210, trimH: 297, spine: 0, bleed: 3 });
  let initialized = false;
  let documentCardObserver = null;

  const $ = (id) => document.getElementById(id);
  const numberOr = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, numberOr(value, fallback)));

  function isDocumentReviewActive() {
    return Boolean(
      document.body?.classList.contains('book-review-active') ||
      new URLSearchParams(location.search).get('product') === 'book-review'
    );
  }

  function readRememberedGeometry() {
    try {
      const raw = localStorage.getItem(GEOMETRY_KEY);
      if (!raw) return { ...DEFAULT_GEOMETRY };
      const parsed = JSON.parse(raw);
      return {
        trimW: clamp(parsed.trimW, 50, 1000, DEFAULT_GEOMETRY.trimW),
        trimH: clamp(parsed.trimH, 50, 1000, DEFAULT_GEOMETRY.trimH),
        spine: clamp(parsed.spine, 0, 100, DEFAULT_GEOMETRY.spine),
        bleed: clamp(parsed.bleed, 0, 20, DEFAULT_GEOMETRY.bleed),
      };
    } catch (_) {
      return { ...DEFAULT_GEOMETRY };
    }
  }

  function currentGeometry(source = document) {
    const remembered = readRememberedGeometry();
    return {
      trimW: clamp(source.querySelector?.('#trimW')?.value, 50, 1000, remembered.trimW),
      trimH: clamp(source.querySelector?.('#trimH')?.value, 50, 1000, remembered.trimH),
      spine: clamp(source.querySelector?.('#spine')?.value, 0, 100, remembered.spine),
      bleed: clamp(source.querySelector?.('#bleed')?.value, 0, 20, remembered.bleed),
    };
  }

  function saveGeometry(source = document) {
    if (isDocumentReviewActive()) return readRememberedGeometry();
    const geometry = currentGeometry(source);
    try {
      localStorage.setItem(GEOMETRY_KEY, JSON.stringify(geometry));
    } catch (_) {}
    return geometry;
  }

  function dispatchInput(node) {
    if (!node) return;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyGeometry({ force = false } = {}) {
    if (isDocumentReviewActive()) return;
    const trimW = $('trimW');
    const trimH = $('trimH');
    if (!trimW || !trimH) return;

    const geometry = readRememberedGeometry();
    const assignments = [
      [trimW, geometry.trimW],
      [trimH, geometry.trimH],
      [$('spine'), geometry.spine],
      [$('bleed'), geometry.bleed],
    ];

    assignments.forEach(([node, value]) => {
      if (!node) return;
      const hasValue = String(node.value ?? '').trim() !== '';
      if (!force && hasValue) return;
      if (Number(node.value) === Number(value)) return;
      node.value = String(value);
      if (node.id === 'spine' && value > 0) node.dataset.manual = '1';
      dispatchInput(node);
    });

    saveGeometry();
  }

  function bindGeometryMemory() {
    const form = $('specForm');
    if (!form) return;

    const remember = (event) => {
      if (isDocumentReviewActive()) return;
      if (['trimW', 'trimH', 'spine', 'bleed'].includes(event.target?.id)) saveGeometry();
    };
    form.addEventListener('input', remember);
    form.addEventListener('change', remember);

    const observer = new MutationObserver(() => {
      if (isDocumentReviewActive()) return;
      queueMicrotask(() => applyGeometry({ force: false }));
    });
    observer.observe(form, { childList: true, subtree: true });

    if (!initialized) {
      initialized = true;
      applyGeometry({ force: true });
    } else {
      applyGeometry({ force: false });
    }
  }

  function ensureDocumentFileCard() {
    const grid = $('productGrid');
    if (!grid) return null;

    let card = grid.querySelector('[data-product="book-review"]');
    if (!card) {
      card = document.createElement('button');
      card.type = 'button';
      card.className = 'product-card book-review-card';
      card.dataset.product = 'book-review';
      card.innerHTML = '<span class="pc-icon">📑</span><strong class="pc-label">문서파일</strong><small class="pc-desc">PDF 문서·재단선·안전영역</small>';
      grid.appendChild(card);
    }

    if (card.dataset.documentFileBound !== '1') {
      card.dataset.documentFileBound = '1';
      card.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.PrintCheckerBookReview?.activate?.();
      });
    }
    return card;
  }

  function bindDocumentFileCard() {
    const grid = $('productGrid');
    if (!grid) return;
    ensureDocumentFileCard();
    documentCardObserver?.disconnect();
    documentCardObserver = new MutationObserver(() => {
      if (!grid.querySelector('[data-product="book-review"]')) queueMicrotask(ensureDocumentFileCard);
    });
    documentCardObserver.observe(grid, { childList: true });
  }

  function boot() {
    bindGeometryMemory();
    bindDocumentFileCard();
    window.DesignReviewGeometry = Object.freeze({
      get: readRememberedGeometry,
      save: saveGeometry,
      apply: applyGeometry,
      defaults: { ...DEFAULT_GEOMETRY },
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
