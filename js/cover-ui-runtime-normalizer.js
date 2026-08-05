// Normalize duplicate cover-editor UI helpers and keep the mobile action dock keyboard-safe.
(function () {
  'use strict';
  if (window.__coverUiRuntimeNormalizerV1) return;
  window.__coverUiRuntimeNormalizerV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [0, 250, 650, 1100, 1800, 2800];
  const PALETTE_CLASSES = ['visual-color-palette', 'cover-color-palette'];
  let keyboardListenersInstalled = false;

  function isPalette(element) {
    return Boolean(element && PALETTE_CLASSES.some((name) => element.classList?.contains(name)));
  }

  function directPalettes(input) {
    const parent = input?.parentElement;
    if (!parent) return [];
    return [...parent.children].filter((child) => child !== input && isPalette(child));
  }

  function normalizeColorPalettes(root = document) {
    const inputs = root.querySelectorAll?.('input[type="color"]') || [];
    let removed = 0;
    for (const input of inputs) {
      const palettes = directPalettes(input);
      if (palettes.length <= 1) {
        if (palettes[0]) {
          input.dataset.coverPaletteOwner = palettes[0].classList.contains('visual-color-palette')
            ? 'visual'
            : 'cover';
        }
        continue;
      }

      const keep = palettes.find((palette) => palette.classList.contains('visual-color-palette')) || palettes[0];
      for (const palette of palettes) {
        if (palette === keep) continue;
        palette.remove();
        removed += 1;
      }
      input.dataset.coverPaletteOwner = keep.classList.contains('visual-color-palette') ? 'visual' : 'cover';
    }
    return removed;
  }

  function installKeyboardStyle() {
    if (document.getElementById('coverKeyboardDockSafetyStyle')) return;
    const style = document.createElement('style');
    style.id = 'coverKeyboardDockSafetyStyle';
    style.textContent = `
      @media (max-width:760px) {
        html.cover-virtual-keyboard-open #coverSidebarActions {
          position: static !important;
          bottom: auto !important;
        }
        html.cover-virtual-keyboard-open .cover-floating-dock {
          position: static !important;
          left: auto !important;
          right: auto !important;
          bottom: auto !important;
          width: 100% !important;
          max-height: none !important;
          margin-top: 8px !important;
          transform: none !important;
        }
        html.cover-virtual-keyboard-open .settings {
          padding-bottom: 12px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isEditable(element) {
    return Boolean(element?.matches?.('input, textarea, select, [contenteditable="true"]'));
  }

  function updateKeyboardState() {
    const narrow = window.matchMedia?.('(max-width:760px)')?.matches === true;
    const viewport = window.visualViewport;
    const viewportReduced = Boolean(
      viewport
      && Number.isFinite(viewport.height)
      && window.innerHeight > 0
      && viewport.height < window.innerHeight * 0.78
    );
    const keyboardOpen = narrow && viewportReduced && isEditable(document.activeElement);
    document.documentElement.classList.toggle('cover-virtual-keyboard-open', keyboardOpen);
    return keyboardOpen;
  }

  function installKeyboardListeners() {
    if (keyboardListenersInstalled) return;
    keyboardListenersInstalled = true;
    installKeyboardStyle();
    window.visualViewport?.addEventListener('resize', updateKeyboardState, { passive: true });
    window.addEventListener('resize', updateKeyboardState, { passive: true });
    document.addEventListener('focusin', updateKeyboardState, true);
    document.addEventListener('focusout', () => setTimeout(updateKeyboardState, 80), true);
    updateKeyboardState();
  }

  function improveOutputStatusAccessibility() {
    const status = document.getElementById('status');
    if (!status) return;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
  }

  function install() {
    normalizeColorPalettes();
    installKeyboardListeners();
    improveOutputStatusAccessibility();
  }

  window.CoverUiRuntimeNormalizer = {
    normalizeColorPalettes,
    updateKeyboardState,
    directPalettes,
    stage: 'palette-mobile-dock-runtime-normalization',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
