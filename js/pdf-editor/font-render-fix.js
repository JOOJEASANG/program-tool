// PDF.js font rendering compatibility patch.
// Keeps embedded / system fonts enabled even in large-file mode and supplies
// Korean/CJK CMap + standard font resources for canvas rendering.
(function () {
  if (window.__pdfEditorFontRenderFixV1) return;
  window.__pdfEditorFontRenderFixV1 = true;

  const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';

  function install() {
    if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') return false;
    if (window.pdfjsLib.__fontRenderFixInstalled) return true;

    const originalGetDocument = window.pdfjsLib.getDocument.bind(window.pdfjsLib);

    window.pdfjsLib.getDocument = function patchedGetDocument(source) {
      let options = source;
      const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && source instanceof ArrayBuffer;
      const isTypedArray = typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(source);

      if (source && typeof source === 'object' && !isArrayBuffer && !isTypedArray) {
        options = Object.assign({}, source, {
          // Disabling FontFace makes some embedded Korean / subset fonts disappear.
          disableFontFace: false,
          useSystemFonts: true,
          cMapUrl: source.cMapUrl || (PDFJS_BASE + 'cmaps/'),
          cMapPacked: source.cMapPacked !== false,
          standardFontDataUrl: source.standardFontDataUrl || (PDFJS_BASE + 'standard_fonts/'),
        });
      }

      return originalGetDocument(options);
    };

    window.pdfjsLib.__fontRenderFixInstalled = true;
    return true;
  }

  if (!install()) {
    document.addEventListener('DOMContentLoaded', install, { once: true });
    const timer = setInterval(() => {
      if (install()) clearInterval(timer);
    }, 150);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
