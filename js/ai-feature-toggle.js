// Global AI feature toggle helper.
// Reads settings/programs.aiEnabled and keeps AI-only UI hidden when disabled.
(function () {
  if (window.__programToolAiFeatureToggleV1) return;
  window.__programToolAiFeatureToggleV1 = true;

  const AI_ONLY_PROGRAM_NAMES = ['글쓰기 도우미'];
  const AI_ONLY_HREFS = ['tools/writing.html', '/tools/writing.html'];
  const DEFAULT_ENABLED = true;
  let cachedAiEnabled = DEFAULT_ENABLED;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function waitForFirebase(fn, tries = 0) {
    if (window.firebase && window.db) {
      fn();
      return;
    }
    if (tries > 80) return;
    setTimeout(() => waitForFirebase(fn, tries + 1), 100);
  }

  function isAiEnabled(data) {
    return !(data && data.aiEnabled === false);
  }

  async function readProgramsData() {
    try {
      const snap = await db.collection('settings').doc('programs').get();
      return snap.exists ? (snap.data() || {}) : {};
    } catch (e) {
      console.warn('[ai-toggle] settings/programs read failed', e);
      return {};
    }
  }

  async function setAiEnabled(enabled) {
    await db.collection('settings').doc('programs').set({ aiEnabled: !!enabled }, { merge: true });
    cachedAiEnabled = !!enabled;
    applyAll(cachedAiEnabled);
  }

  function ensureStyle() {
    if (document.getElementById('aiFeatureToggleStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiFeatureToggleStyle';
    style.textContent = `
      .ai-feature-hidden { display: none !important; }
      .ai-global-toggle-card {
        border: 1.5px solid #dbeafe;
        background: linear-gradient(180deg, #ffffff, #f8fbff);
      }
      .ai-global-toggle-row {
        display:flex;align-items:center;justify-content:space-between;gap:14px;
        padding:14px 16px;border:1.5px solid #e2e8f0;border-radius:12px;background:#f8fafc;
      }
      .ai-global-toggle-title { font-size:13px;font-weight:900;color:#0f172a;margin-bottom:3px; }
      .ai-global-toggle-desc { font-size:12px;color:#64748b;line-height:1.45; }
      .ai-global-switch { position:relative;width:48px;height:27px;flex:0 0 auto; }
      .ai-global-switch input { opacity:0;width:0;height:0; }
      .ai-global-slider { position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:999px;transition:.18s; }
      .ai-global-slider:before { content:'';position:absolute;width:21px;height:21px;left:3px;top:3px;background:white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:.18s; }
      .ai-global-switch input:checked + .ai-global-slider { background:#12396d; }
      .ai-global-switch input:checked + .ai-global-slider:before { transform:translateX(21px); }
      .ai-global-status { margin-top:10px;font-size:12px;font-weight:800;display:none; }
      .ai-global-status.show { display:block; }
      .ai-disabled-page {
        min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;background:#f8fafc;font-family:Pretendard,'Noto Sans KR',sans-serif;
      }
      .ai-disabled-box {
        width:min(430px,100%);background:#fff;border:1.5px solid #e2e8f0;border-radius:18px;padding:30px 26px;text-align:center;box-shadow:0 10px 34px rgba(15,23,42,.08);
      }
      .ai-disabled-box .icon { font-size:46px;margin-bottom:10px; }
      .ai-disabled-box h1 { font-size:20px;margin:0 0 8px;color:#0f172a; }
      .ai-disabled-box p { font-size:14px;line-height:1.6;color:#64748b;margin:0 0 18px; }
      .ai-disabled-box a { display:inline-flex;padding:10px 22px;border-radius:10px;background:#12396d;color:#fff;text-decoration:none;font-weight:900;font-size:13px; }
    `;
    document.head.appendChild(style);
  }

  function applyHome(aiEnabled) {
    const path = location.pathname || '/';
    const isHome = path === '/' || path.endsWith('/index.html');
    if (!isHome) return;

    const slider = document.getElementById('slider');
    if (!slider) return;

    const updateCards = () => {
      const cards = Array.from(slider.querySelectorAll('.prog-card'));
      cards.forEach(card => {
        const href = card.getAttribute('href') || '';
        const name = (card.querySelector('.prog-name')?.textContent || '').trim();
        const isAiOnly = AI_ONLY_HREFS.some(h => href.endsWith(h) || href.includes(h))
          || AI_ONLY_PROGRAM_NAMES.includes(name);
        card.classList.toggle('ai-feature-hidden', !aiEnabled && isAiOnly);
      });
      const count = document.getElementById('progCount');
      if (count && !aiEnabled) {
        const visible = cards.filter(card => !card.classList.contains('ai-feature-hidden')).length;
        count.textContent = `사용 가능 ${visible}개 · AI 기능 비활성화`;
      }
    };

    updateCards();
    if (!slider.__aiToggleObserver) {
      slider.__aiToggleObserver = new MutationObserver(updateCards);
      slider.__aiToggleObserver.observe(slider, { childList: true, subtree: false });
    }
  }

  function applyDesignStudio(aiEnabled) {
    if (!location.pathname.endsWith('/tools/design-studio.html')) return;
    const apply = () => {
      const btn = document.getElementById('generateBgBtn');
      const section = btn ? btn.closest('.section') : null;
      if (section) section.classList.toggle('ai-feature-hidden', !aiEnabled);
      if (btn) btn.disabled = !aiEnabled;

      const status = document.getElementById('aiStatus');
      if (status && !aiEnabled) {
        status.className = 'ai-status error';
        status.textContent = '관리자 설정에서 AI 기능이 비활성화되어 있습니다.';
      }
    };
    apply();
    setTimeout(apply, 400);
    setTimeout(apply, 1200);
  }

  function applyWritingPage(aiEnabled) {
    if (!location.pathname.endsWith('/tools/writing.html')) return;
    if (aiEnabled) return;
    document.body.innerHTML = `
      <div class="ai-disabled-page">
        <div class="ai-disabled-box">
          <div class="icon">🔒</div>
          <h1>AI 기능이 비활성화되어 있습니다</h1>
          <p>관리자 설정에서 AI 기능 사용이 꺼져 있어 글쓰기 도우미를 사용할 수 없습니다.</p>
          <a href="../index.html">도구 목록으로 이동</a>
        </div>
      </div>`;
  }

  function showAdminStatus(type, msg) {
    const el = document.getElementById('aiGlobalToggleStatus');
    if (!el) return;
    el.className = 'ai-global-status show';
    el.style.color = type === 'error' ? '#dc2626' : type === 'success' ? '#166534' : '#1d4ed8';
    el.textContent = msg;
    setTimeout(() => { el.className = 'ai-global-status'; el.textContent = ''; }, 3500);
  }

  function installAdminToggle(aiEnabled) {
    if (!location.pathname.endsWith('/admin.html')) return;
    if (document.getElementById('aiGlobalToggleCard')) return;

    const leftCol = document.querySelector('.admin-col-left');
    if (!leftCol) return;
    const firstCard = leftCol.querySelector('.card');

    const card = document.createElement('div');
    card.className = 'card ai-global-toggle-card';
    card.id = 'aiGlobalToggleCard';
    card.innerHTML = `
      <div class="card-title">🤖 AI 기능 활성화</div>
      <div class="card-sub">끄면 홈의 AI 글쓰기 도우미가 숨겨지고, 디자인 스튜디오의 AI 배경 생성 버튼과 AI API 호출이 차단됩니다.</div>
      <div class="ai-global-toggle-row">
        <div>
          <div class="ai-global-toggle-title">AI 기능 사용</div>
          <div class="ai-global-toggle-desc">글쓰기 도우미 · 디자인 스튜디오 AI 배경 생성</div>
        </div>
        <label class="ai-global-switch" title="AI 기능 사용 여부">
          <input type="checkbox" id="aiGlobalEnabledToggle" ${aiEnabled ? 'checked' : ''}>
          <span class="ai-global-slider"></span>
        </label>
      </div>
      <div class="ai-global-status" id="aiGlobalToggleStatus"></div>
    `;
    if (firstCard) firstCard.insertAdjacentElement('afterend', card);
    else leftCol.prepend(card);

    const toggle = document.getElementById('aiGlobalEnabledToggle');
    toggle.addEventListener('change', async () => {
      const next = toggle.checked;
      toggle.disabled = true;
      showAdminStatus('info', '저장 중...');
      try {
        await setAiEnabled(next);
        showAdminStatus('success', next ? 'AI 기능이 활성화되었습니다.' : 'AI 기능이 비활성화되었습니다.');
      } catch (e) {
        toggle.checked = !next;
        showAdminStatus('error', '저장 실패: ' + (e.message || e));
      } finally {
        toggle.disabled = false;
      }
    });
  }

  function setSegActive(feature, value) {
    document.querySelectorAll(`.seg-group[data-feature="${feature}"] .seg-btn`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function getSegValue(group) {
    const active = group.querySelector('.seg-btn.active');
    return active ? active.dataset.value : 'google';
  }

  function installWritingProviderRow() {
    if (!location.pathname.endsWith('/admin.html')) return;
    if (document.querySelector('.seg-group[data-feature="writing"]')) return;
    const imageGroup = document.querySelector('.seg-group[data-feature="image"]');
    const wrap = imageGroup?.closest('div')?.parentElement;
    if (!wrap) return;

    const row = document.createElement('div');
    row.innerHTML = `
      <div class="ai-feature-label"><span class="ai-feature-ico">✍️</span> 글쓰기 <span style="color:#94a3b8;font-weight:600;font-size:11px;">(AI 글쓰기 도우미)</span></div>
      <div class="seg-group" data-feature="writing">
        <button type="button" class="seg-btn" data-value="google">
          <span class="seg-name">Google</span><span class="seg-model">Gemini</span>
        </button>
        <button type="button" class="seg-btn" data-value="openai">
          <span class="seg-name">OpenAI</span><span class="seg-model">GPT</span>
        </button>
      </div>`;
    wrap.appendChild(row);
  }

  function patchAiProviderSaveLoad() {
    if (!location.pathname.endsWith('/admin.html')) return;
    if (window.__aiProviderPatchV1) return;
    window.__aiProviderPatchV1 = true;

    const originalLoad = window.loadAiProviders;
    window.loadAiProviders = async function patchedLoadAiProviders() {
      if (typeof originalLoad === 'function') await originalLoad.apply(this, arguments);
      installWritingProviderRow();
      try {
        const doc = await db.collection('settings').doc('config').get();
        const providers = (doc.exists && doc.data().aiProviders) || {};
        setSegActive('writing', providers.writing || providers.text || 'google');
      } catch (e) { console.warn('[ai-toggle] writing provider load failed', e); }
    };

    window.saveAiProviders = async function patchedSaveAiProviders() {
      const aiProviders = {};
      document.querySelectorAll('.seg-group[data-feature]').forEach(group => {
        aiProviders[group.dataset.feature] = getSegValue(group);
      });
      try {
        await db.collection('settings').doc('config').set({ aiProviders }, { merge: true });
        if (typeof window.showStatus === 'function') window.showStatus('aiProviderStatus', 'success', '✓ AI 제공자 설정이 저장되었습니다.');
      } catch (e) {
        if (typeof window.showStatus === 'function') window.showStatus('aiProviderStatus', 'error', '저장 실패: ' + e.message);
        else alert('저장 실패: ' + e.message);
      }
    };

    installWritingProviderRow();
    window.loadAiProviders().catch(() => {});
  }

  function applyAll(aiEnabled) {
    ensureStyle();
    applyHome(aiEnabled);
    applyDesignStudio(aiEnabled);
    applyWritingPage(aiEnabled);
    installAdminToggle(aiEnabled);
    patchAiProviderSaveLoad();
  }

  ready(() => waitForFirebase(async () => {
    ensureStyle();
    const data = await readProgramsData();
    cachedAiEnabled = isAiEnabled(data);
    window.__programToolAiEnabled = cachedAiEnabled;
    applyAll(cachedAiEnabled);

    try {
      db.collection('settings').doc('programs').onSnapshot(snap => {
        cachedAiEnabled = isAiEnabled(snap.exists ? snap.data() : {});
        window.__programToolAiEnabled = cachedAiEnabled;
        applyAll(cachedAiEnabled);
      });
    } catch (e) {
      console.warn('[ai-toggle] realtime listener failed', e);
    }
  }));
})();
