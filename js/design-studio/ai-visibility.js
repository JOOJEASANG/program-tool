// Hide Design Studio AI background controls when settings/programs.aiEnabled is false.
(function () {
  if (window.__designStudioAiVisibilityV1) return;
  window.__designStudioAiVisibilityV1 = true;

  function addStyle() {
    if (document.getElementById('designStudioAiVisibilityStyle')) return;
    const style = document.createElement('style');
    style.id = 'designStudioAiVisibilityStyle';
    style.textContent = '.ds-ai-disabled-hide{display:none!important}.ds-ai-disabled-note{padding:10px 12px;border:1.5px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:10px;font-size:12px;font-weight:800;line-height:1.5;margin:10px 0}';
    document.head.appendChild(style);
  }

  function byText(root, text) {
    return Array.from(root.querySelectorAll('div,span,label,h2,button')).find(el => (el.textContent || '').includes(text));
  }

  function getAiControls() {
    const btn = document.getElementById('generateBgBtn');
    const controls = document.getElementById('bgControls');
    const aiHeader = controls ? byText(controls, '방법 ① AI 자동 생성') : null;
    const uploadHeader = controls ? byText(controls, '방법 ② 직접 이미지 업로드') : null;
    const items = [];

    if (aiHeader) items.push(aiHeader);
    ['coverType', 'aiDesc'].forEach(id => {
      const el = document.getElementById(id);
      const field = el ? el.closest('.field') : null;
      if (field) items.push(field);
    });
    const gemini = document.getElementById('aiProviderGemini');
    const providerRow = gemini ? gemini.closest('div[style*="display:flex"]') : null;
    if (providerRow) items.push(providerRow);
    if (btn) items.push(btn);
    const status = document.getElementById('aiStatus');
    if (status) items.push(status);

    // Fallback: hide everything between the AI header and the direct-upload header.
    if (controls && aiHeader && uploadHeader) {
      let node = aiHeader;
      while (node && node !== uploadHeader) {
        if (node.nodeType === 1) items.push(node);
        node = node.nextElementSibling;
      }
    }

    return Array.from(new Set(items.filter(Boolean)));
  }

  function ensureNote() {
    const controls = document.getElementById('bgControls');
    if (!controls) return null;
    let note = document.getElementById('dsAiDisabledNote');
    if (!note) {
      note = document.createElement('div');
      note.id = 'dsAiDisabledNote';
      note.className = 'ds-ai-disabled-note';
      note.textContent = '관리자 설정에서 AI 기능이 비활성화되어 AI 배경 생성은 숨김 처리되었습니다.';
      const uploadHeader = byText(controls, '방법 ② 직접 이미지 업로드');
      if (uploadHeader) uploadHeader.insertAdjacentElement('beforebegin', note);
      else controls.prepend(note);
    }
    return note;
  }

  function apply(aiEnabled) {
    addStyle();
    const disabled = aiEnabled === false;
    getAiControls().forEach(el => el.classList.toggle('ds-ai-disabled-hide', disabled));
    const btn = document.getElementById('generateBgBtn');
    if (btn) btn.disabled = disabled;
    const note = ensureNote();
    if (note) note.style.display = disabled ? 'block' : 'none';
  }

  async function readSetting() {
    try {
      if (!window.db) return true;
      const snap = await db.collection('settings').doc('programs').get();
      const data = snap.exists ? (snap.data() || {}) : {};
      return data.aiEnabled !== false;
    } catch (e) {
      console.warn('[design-studio-ai-visibility] read failed', e);
      return true;
    }
  }

  function boot() {
    if (!location.pathname.endsWith('/tools/design-studio.html')) return;
    addStyle();
    const run = async () => apply(await readSetting());
    run();
    setTimeout(run, 300);
    setTimeout(run, 1000);
    setTimeout(run, 2500);
    if (window.auth && window.db) {
      auth.onAuthStateChanged(() => {
        run();
        try {
          db.collection('settings').doc('programs').onSnapshot(snap => {
            const data = snap.exists ? (snap.data() || {}) : {};
            apply(data.aiEnabled !== false);
          });
        } catch (e) {}
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
