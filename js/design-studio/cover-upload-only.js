// Design studio free-mode module.
// Hides paid AI generation controls and guides users to upload background files instead.
(function () {
  if (window.__designStudioFreeModeV2) return;
  window.__designStudioFreeModeV2 = true;

  function isAiText(text) {
    return /AI|GPT|Gemini|제미나이|OpenAI|자동\s*생성|배경\s*생성/i.test(text || '');
  }

  function hideAiControls() {
    const selectors = [
      'button', 'label', 'textarea', 'select', 'input',
      '[id*="ai" i]', '[class*="ai" i]',
      '[id*="gpt" i]', '[class*="gpt" i]',
      '[id*="gemini" i]', '[class*="gemini" i]'
    ].join(',');

    document.querySelectorAll(selectors).forEach((el) => {
      if (el.id === 'freeModeNotice') return;
      const text = (el.textContent || '').trim();
      const id = el.id || '';
      const cls = String(el.className || '');
      if (!isAiText(text) && !isAiText(id) && !isAiText(cls)) return;

      const block = el.closest('.field,.control-group,.form-row,.option-row') || el;
      if (block && block.id !== 'freeModeNotice') {
        block.style.display = 'none';
      }
    });
  }

  function installNotice() {
    if (document.getElementById('freeModeNotice')) return;
    const aside = document.querySelector('aside') || document.querySelector('.sidebar') || document.body;
    const box = document.createElement('div');
    box.id = 'freeModeNotice';
    box.style.cssText = 'padding:10px;border:1.5px dashed #16a34a;border-radius:10px;background:#f0fdf4;color:#166534;font-size:12px;font-weight:800;line-height:1.5;margin:8px 0;';
    box.textContent = '무료 모드: AI 유료 생성은 비활성화되었습니다. 배경 이미지는 직접 업로드해서 사용하세요.';
    aside.insertBefore(box, aside.firstChild);
  }

  function blockAiFetch() {
    if (window.__designAiFetchBlocked) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function freeModeFetch(input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.includes('/api/ai/')) {
        return Promise.resolve(new Response(JSON.stringify({
          detail: 'AI 유료 API 기능은 현재 비활성화되어 있습니다. 배경 이미지를 직접 업로드해서 사용하세요.',
          ai_disabled: true
        }), { status: 402, headers: { 'content-type': 'application/json; charset=utf-8' } }));
      }
      return originalFetch(input, init);
    };
    window.__designAiFetchBlocked = true;
  }

  function boot() {
    installNotice();
    hideAiControls();
    blockAiFetch();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1500);
})();
