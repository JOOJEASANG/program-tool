// Design studio helper loader.
// New design-studio features should be added as separate modules in this folder.
(function () {
  if (window.__designStudioHelperLoaderV2) return;
  window.__designStudioHelperLoaderV2 = true;

  const modules = [
    '/js/design-studio/cover-upload-only.js?v=20260518-2'
  ];

  function load(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((s) => s.src && s.src.includes(clean))) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  modules.forEach(load);
})();
