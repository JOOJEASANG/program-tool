// Adds Anthropic writing API key management to the admin page without changing the large admin.html file.
(function () {
  if (window.__adminWritingKeyHelperV1) return;
  window.__adminWritingKeyHelperV1 = true;
  if (!location.pathname.endsWith('/admin.html')) return;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function waitForFirebase(fn, tries = 0) {
    if (window.firebase && window.db) { fn(); return; }
    if (tries > 100) return;
    setTimeout(() => waitForFirebase(fn, tries + 1), 100);
  }

  function showStatus(type, msg) {
    const el = document.getElementById('anthropicKeyStatus');
    if (!el) return;
    el.className = 'status-msg ' + type;
    el.textContent = msg;
    if (type !== 'info') setTimeout(() => { el.className = 'status-msg'; el.textContent = ''; }, 4000);
  }

  function toggleInput() {
    const input = document.getElementById('anthropicKeyInput');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  async function loadKey() {
    try {
      const doc = await db.collection('settings').doc('config').get();
      const key = doc.exists ? (doc.data().anthropicApiKey || '') : '';
      const wrap = document.getElementById('anthropicKeyCurrentWrap');
      const preview = document.getElementById('anthropicKeyPreview');
      if (!wrap || !preview) return;
      if (key) {
        wrap.style.display = 'block';
        preview.textContent = key.slice(0, 8) + '••••••••••••' + key.slice(-4);
      } else {
        wrap.style.display = 'none';
      }
    } catch (e) {
      console.warn('[admin-writing-key] load failed', e);
    }
  }

  async function saveKey() {
    const input = document.getElementById('anthropicKeyInput');
    const key = (input?.value || '').trim();
    if (!key) return showStatus('error', 'API 키를 입력해주세요.');
    try {
      await db.collection('settings').doc('config').set({ anthropicApiKey: key }, { merge: true });
      input.value = '';
      showStatus('success', '✓ 글쓰기 API 키가 저장되었습니다.');
      await loadKey();
    } catch (e) {
      showStatus('error', '저장 실패: ' + (e.message || e));
    }
  }

  async function deleteKey() {
    if (!confirm('글쓰기 API 키를 삭제할까요?')) return;
    try {
      await db.collection('settings').doc('config').update({ anthropicApiKey: firebase.firestore.FieldValue.delete() });
      showStatus('info', '글쓰기 API 키가 삭제되었습니다.');
      await loadKey();
    } catch (e) {
      showStatus('error', '삭제 실패: ' + (e.message || e));
    }
  }

  function installCard() {
    if (document.getElementById('anthropicWritingKeyCard')) return;
    const openaiCard = document.getElementById('openaiKeyInput')?.closest('.card');
    const leftCol = document.querySelector('.admin-col-left');
    if (!leftCol) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'anthropicWritingKeyCard';
    card.innerHTML = `
      <div class="card-title">✍️ 글쓰기 AI API 키</div>
      <div class="card-sub">AI 글쓰기 도우미에서 사용하는 Anthropic API 키입니다. 환경변수 ANTHROPIC_API_KEY가 있으면 백업으로 사용됩니다.</div>
      <div id="anthropicKeyCurrentWrap" style="display:none; margin-bottom:16px;">
        <label>현재 저장된 키</label>
        <div class="key-display">
          <span class="key-val" id="anthropicKeyPreview">-</span>
          <button class="btn btn-danger btn-sm" id="anthropicDeleteBtn" style="padding:6px 12px;font-size:12px;">삭제</button>
        </div>
      </div>
      <div>
        <label for="anthropicKeyInput">새 API 키 입력</label>
        <div class="input-wrap">
          <input type="password" id="anthropicKeyInput" placeholder="sk-ant-..." autocomplete="off" />
          <button class="input-toggle" id="anthropicToggleBtn" type="button">보기</button>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="anthropicSaveBtn" type="button">저장</button>
      </div>
      <div class="status-msg" id="anthropicKeyStatus"></div>`;

    if (openaiCard) openaiCard.insertAdjacentElement('afterend', card);
    else leftCol.appendChild(card);

    document.getElementById('anthropicSaveBtn').addEventListener('click', saveKey);
    document.getElementById('anthropicDeleteBtn').addEventListener('click', deleteKey);
    document.getElementById('anthropicToggleBtn').addEventListener('click', toggleInput);
    document.getElementById('anthropicKeyInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });
    loadKey();
  }

  ready(() => waitForFirebase(() => setTimeout(installCard, 600)));
})();
