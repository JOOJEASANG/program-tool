// Delegate to the auth-aware AI feature toggle helper.
(function () {
  if (window.__programToolAiFeatureToggleDelegateV1) return;
  window.__programToolAiFeatureToggleDelegateV1 = true;

  function add(src, id) {
    if (document.getElementById(id)) return;
    var s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  add('/js/ai-feature-toggle-v2.js?v=20260707-1', 'aiFeatureToggleV2Script');
  if (location.pathname.endsWith('/admin.html')) {
    add('/js/admin-writing-key.js?v=20260707-1', 'adminWritingKeyScript');
  }
})();
