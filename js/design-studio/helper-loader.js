(function () {
  if (window.__designStudioHelperLoaderV4) return;
  window.__designStudioHelperLoaderV4 = true;

  const modules = [
    '/js/design-studio/cover-upload-only.js?v=20260518-2',
    '/js/design-studio/defaults-ai-layout.js?v=20260623-1',
    '/js/design-studio/ai-visibility.js?v=20260707-1'
  ];

  function load(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((s) => s.src && s.src.includes(clean))) return;
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  }

  modules.forEach(load);
})();
