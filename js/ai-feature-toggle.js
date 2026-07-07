// Delegate to the auth-aware AI feature toggle helper.
(function () {
  if (window.__programToolAiFeatureToggleDelegateV1) return;
  window.__programToolAiFeatureToggleDelegateV1 = true;
  var s = document.createElement('script');
  s.src = '/js/ai-feature-toggle-v2.js?v=20260707-1';
  s.defer = true;
  document.head.appendChild(s);
})();
