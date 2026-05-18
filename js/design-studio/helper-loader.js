// Design studio helper loader.
// New design-studio features should be added as separate modules in this folder.
(function () {
  if (window.__designStudioHelperLoaderV1) return;
  window.__designStudioHelperLoaderV1 = true;

  const modules = [
    '/js/design-studio/cloud-save.js?v=20260518-1',
    '/js/design-studio/cover-upload-only.js?v=20260518-1'
  ];

  function load(src) {
    if ([...document.scripts].some((s) => s.src && s.src.includes(src.split('?')[0]))) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  modules.forEach(load);
})();
