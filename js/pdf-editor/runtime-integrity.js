// Runtime safety for status/error messages and saved-session list rendering.
(function () {
  'use strict';
  if (window.__pdfRuntimeIntegrityV1) return;
  window.__pdfRuntimeIntegrityV1 = true;

  const byId = (id) => document.getElementById(id);
  let attempts = 0;

  function safeShowStatus(message, type = 'info') {
    const element = byId('statusBar');
    if (!element) return;
    element.style.display = 'flex';
    element.className = 'status-bar' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    element.replaceChildren();
    if (type === 'info') {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      element.appendChild(spinner);
    }
    const text = document.createElement('span');
    text.textContent = `${type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : ''}${String(message ?? '')}`;
    element.appendChild(text);
  }

  function safeShowPreviewError(stage, error) {
    const message = error?.message || String(error || '알 수 없는 오류');
    console.error('[preview] failed at', stage, error);
    const scroll = byId('previewScroll');
    if (scroll) {
      scroll.replaceChildren();
      const card = document.createElement('div');
      card.style.cssText = 'margin:auto;max-width:420px;padding:20px;text-align:center;color:#991b1b;';
      const icon = document.createElement('div');
      icon.style.fontSize = '32px';
      icon.textContent = '⚠️';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:900;font-size:14px;margin:8px 0;';
      title.textContent = '미리보기 생성 실패';
      const stageLine = document.createElement('div');
      stageLine.style.cssText = 'font-size:12px;color:#374151;';
      stageLine.textContent = `단계: ${String(stage || 'unknown')}`;
      const detail = document.createElement('div');
      detail.style.cssText = 'font-size:12px;color:#374151;margin-top:6px;word-break:break-word;';
      detail.textContent = message;
      card.append(icon, title, stageLine, detail);
      scroll.appendChild(card);
    }
    safeShowStatus(`미리보기 오류(${String(stage || 'unknown')}): ${message}`, 'error');
  }

  function textBlock(className, text) {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    return element;
  }

  async function safeOpenSessionList() {
    const user = window.auth?.currentUser;
    if (!user || !window.db) return;
    const modal = byId('sessionListModal');
    const body = byId('sessionListBody');
    if (!modal || !body) return;
    modal.style.display = 'flex';
    body.replaceChildren(textBlock('fh-loading', '불러오는 중...'));
    try {
      const snapshot = await db.collection('users').doc(user.uid)
        .collection('pdf_sessions')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      body.replaceChildren();
      if (snapshot.empty) {
        body.appendChild(textBlock('fh-empty', '📂 저장된 편집이 없습니다.'));
        return;
      }
      snapshot.forEach((documentSnapshot) => {
        const data = documentSnapshot.data() || {};
        const dateText = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString('ko-KR') : '-';
        const item = document.createElement('div');
        item.className = 'fh-item';

        item.appendChild(textBlock('fh-icon', '🗂'));
        const info = document.createElement('div');
        info.className = 'fh-info';
        info.appendChild(textBlock('fh-name', String(data.name || '편집 세션')));
        info.appendChild(textBlock('fh-meta', `${dateText} · ${Number(data.pageCount || 0)}p · 파일 ${Number(data.fileCount || 0)}개`));
        item.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'fh-actions';
        const load = document.createElement('button');
        load.className = 'fh-btn';
        load.type = 'button';
        load.textContent = '📂 불러오기';
        load.addEventListener('click', () => {
          try { loadEditorSession(data, documentSnapshot.id); } catch (error) { safeShowStatus(error.message || error, 'error'); }
        });
        const remove = document.createElement('button');
        remove.className = 'fh-btn del';
        remove.type = 'button';
        remove.textContent = '🗑';
        remove.addEventListener('click', async () => {
          if (!confirm(`"${String(data.name || '편집 세션')}" 세션을 삭제할까요?`)) return;
          try {
            for (const path of (Array.isArray(data.storagePaths) ? data.storagePaths : [])) {
              await window.storage?.ref(path).delete().catch(() => {});
            }
            await db.collection('users').doc(user.uid).collection('pdf_sessions').doc(documentSnapshot.id).delete();
            item.remove();
            if (!body.querySelector('.fh-item')) body.replaceChildren(textBlock('fh-empty', '📂 저장된 편집이 없습니다.'));
          } catch (error) {
            safeShowStatus(`삭제 오류: ${error.message || error}`, 'error');
          }
        });
        actions.append(load, remove);
        item.appendChild(actions);
        body.appendChild(item);
      });
    } catch (error) {
      body.replaceChildren(textBlock('fh-empty', `오류: ${error.message || error}`));
    }
  }

  function patchGlobals() {
    let ready = true;
    try {
      showStatus = safeShowStatus;
      window.showStatus = safeShowStatus;
    } catch (_) { ready = false; }
    try {
      showPreviewError = safeShowPreviewError;
      window.showPreviewError = safeShowPreviewError;
    } catch (_) { ready = false; }
    return ready;
  }

  function installSessionGuard() {
    const button = byId('navSessionLoadBtn');
    if (!button) return false;
    if (button.dataset.safeSessionListBound) return true;
    button.dataset.safeSessionListBound = '1';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      safeOpenSessionList();
    }, true);
    return true;
  }

  function boot() {
    const globalsReady = patchGlobals();
    const sessionReady = installSessionGuard();
    if ((!globalsReady || !sessionReady) && attempts < 12) {
      attempts += 1;
      setTimeout(boot, 150 + attempts * 60);
    }
  }

  window.PdfRuntimeIntegrity = { safeShowStatus, safeShowPreviewError, safeOpenSessionList };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();