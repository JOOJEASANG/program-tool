// Auth-aware global AI feature toggle helper.
(function () {
  if (window.__programToolAiFeatureToggleV2) return;
  window.__programToolAiFeatureToggleV2 = true;

  const AI_NAMES = ['글쓰기 도우미'];
  const AI_HREFS = ['tools/writing.html', '/tools/writing.html'];

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function waitForFirebase(fn, tries = 0) {
    if (window.firebase && window.auth && window.db) { fn(); return; }
    if (tries > 100) return;
    setTimeout(() => waitForFirebase(fn, tries + 1), 100);
  }

  function enabledFrom(data) {
    return !(data && data.aiEnabled === false);
  }

  function addStyle() {
    if (document.getElementById('aiFeatureToggleStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiFeatureToggleStyle';
    style.textContent = `
      .ai-feature-hidden{display:none!important}
      .ai-global-toggle-card{border:1.5px solid #dbeafe;background:linear-gradient(180deg,#fff,#f8fbff)}
      .ai-global-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border:1.5px solid #e2e8f0;border-radius:12px;background:#f8fafc}
      .ai-global-toggle-title{font-size:13px;font-weight:900;color:#0f172a;margin-bottom:3px}
      .ai-global-toggle-desc{font-size:12px;color:#64748b;line-height:1.45}
      .ai-global-switch{position:relative;width:48px;height:27px;flex:0 0 auto}.ai-global-switch input{opacity:0;width:0;height:0}
      .ai-global-slider{position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:999px;transition:.18s}.ai-global-slider:before{content:'';position:absolute;width:21px;height:21px;left:3px;top:3px;background:#fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:.18s}
      .ai-global-switch input:checked+.ai-global-slider{background:#12396d}.ai-global-switch input:checked+.ai-global-slider:before{transform:translateX(21px)}
      .ai-global-status{margin-top:10px;font-size:12px;font-weight:800;display:none}.ai-global-status.show{display:block}
      .ai-disabled-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;background:#f8fafc;font-family:Pretendard,'Noto Sans KR',sans-serif}.ai-disabled-box{width:min(430px,100%);background:#fff;border:1.5px solid #e2e8f0;border-radius:18px;padding:30px 26px;text-align:center;box-shadow:0 10px 34px rgba(15,23,42,.08)}.ai-disabled-box .icon{font-size:46px;margin-bottom:10px}.ai-disabled-box h1{font-size:20px;margin:0 0 8px;color:#0f172a}.ai-disabled-box p{font-size:14px;line-height:1.6;color:#64748b;margin:0 0 18px}.ai-disabled-box a{display:inline-flex;padding:10px 22px;border-radius:10px;background:#12396d;color:#fff;text-decoration:none;font-weight:900;font-size:13px}
    `;
    document.head.appendChild(style);
  }

  function applyHome(aiEnabled) {
    const path = location.pathname || '/';
    if (!(path === '/' || path.endsWith('/index.html'))) return;
    const slider = document.getElementById('slider');
    if (!slider) return;
    const update = () => {
      const cards = Array.from(slider.querySelectorAll('.prog-card'));
      cards.forEach(card => {
        const href = card.getAttribute('href') || '';
        const name = (card.querySelector('.prog-name')?.textContent || '').trim();
        const isAi = AI_HREFS.some(h => href.endsWith(h) || href.includes(h)) || AI_NAMES.includes(name);
        card.classList.toggle('ai-feature-hidden', !aiEnabled && isAi);
      });
      const count = document.getElementById('progCount');
      if (count && !aiEnabled) {
        const visible = cards.filter(c => !c.classList.contains('ai-feature-hidden')).length;
        count.textContent = `사용 가능 ${visible}개 · AI 기능 비활성화`;
      }
    };
    update();
    if (!slider.__aiToggleObserverV2) {
      slider.__aiToggleObserverV2 = new MutationObserver(update);
      slider.__aiToggleObserverV2.observe(slider, { childList: true });
    }
  }

  function applyDesign(aiEnabled) {
    if (!location.pathname.endsWith('/tools/design-studio.html')) return;
    const run = () => {
      const btn = document.getElementById('generateBgBtn');
      const section = btn?.closest('.section');
      if (section) section.classList.toggle('ai-feature-hidden', !aiEnabled);
      if (btn) btn.disabled = !aiEnabled;
      const status = document.getElementById('aiStatus');
      if (status && !aiEnabled) {
        status.className = 'ai-status error';
        status.textContent = '관리자 설정에서 AI 기능이 비활성화되어 있습니다.';
      }
    };
    run(); setTimeout(run, 400); setTimeout(run, 1200);
  }

  function applyWriting(aiEnabled) {
    if (!location.pathname.endsWith('/tools/writing.html') || aiEnabled) return;
    document.body.innerHTML = '<div class="ai-disabled-page"><div class="ai-disabled-box"><div class="icon">🔒</div><h1>AI 기능이 비활성화되어 있습니다</h1><p>관리자 설정에서 AI 기능 사용이 꺼져 있어 글쓰기 도우미를 사용할 수 없습니다.</p><a href="../index.html">도구 목록으로 이동</a></div></div>';
  }

  function status(type, msg) {
    const el = document.getElementById('aiGlobalToggleStatus');
    if (!el) return;
    el.className = 'ai-global-status show';
    el.style.color = type === 'error' ? '#dc2626' : type === 'success' ? '#166534' : '#1d4ed8';
    el.textContent = msg;
    setTimeout(() => { el.className = 'ai-global-status'; el.textContent = ''; }, 3500);
  }

  function installAdmin(aiEnabled) {
    if (!location.pathname.endsWith('/admin.html')) return;
    if (document.getElementById('aiGlobalToggleCard')) return;
    const left = document.querySelector('.admin-col-left');
    if (!left) return;
    const first = left.querySelector('.card');
    const card = document.createElement('div');
    card.className = 'card ai-global-toggle-card';
    card.id = 'aiGlobalToggleCard';
    card.innerHTML = `<div class="card-title">🤖 AI 기능 활성화</div><div class="card-sub">끄면 홈에서 글쓰기 도우미가 숨겨지고, 디자인 스튜디오의 AI 배경 생성과 AI API 호출이 차단됩니다.</div><div class="ai-global-toggle-row"><div><div class="ai-global-toggle-title">AI 기능 사용</div><div class="ai-global-toggle-desc">글쓰기 도우미 · 디자인 스튜디오 AI 배경 생성</div></div><label class="ai-global-switch"><input type="checkbox" id="aiGlobalEnabledToggle" ${aiEnabled ? 'checked' : ''}><span class="ai-global-slider"></span></label></div><div class="ai-global-status" id="aiGlobalToggleStatus"></div>`;
    if (first) first.insertAdjacentElement('afterend', card); else left.prepend(card);
    const toggle = document.getElementById('aiGlobalEnabledToggle');
    toggle.addEventListener('change', async () => {
      const next = toggle.checked;
      toggle.disabled = true;
      status('info', '저장 중...');
      try {
        await db.collection('settings').doc('programs').set({ aiEnabled: next }, { merge: true });
        applyAll(next);
        status('success', next ? 'AI 기능이 활성화되었습니다.' : 'AI 기능이 비활성화되었습니다.');
      } catch (e) {
        toggle.checked = !next;
        status('error', '저장 실패: ' + (e.message || e));
      } finally {
        toggle.disabled = false;
      }
    });
  }

  function applyAll(aiEnabled) {
    addStyle();
    applyHome(aiEnabled);
    applyDesign(aiEnabled);
    applyWriting(aiEnabled);
    installAdmin(aiEnabled);
    window.__programToolAiEnabled = aiEnabled;
  }

  async function loadAndApply() {
    try {
      const snap = await db.collection('settings').doc('programs').get();
      applyAll(enabledFrom(snap.exists ? snap.data() : {}));
      db.collection('settings').doc('programs').onSnapshot(s => applyAll(enabledFrom(s.exists ? s.data() : {})));
    } catch (e) {
      console.warn('[ai-toggle] load failed', e);
      applyAll(true);
    }
  }

  onReady(() => waitForFirebase(() => {
    addStyle();
    auth.onAuthStateChanged(() => loadAndApply());
  }));
})();
