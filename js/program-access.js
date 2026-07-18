// Shared client-side access guard. Server APIs independently enforce the same rule.
(function () {
  if (window.__programToolAccessGuardV2) return;
  window.__programToolAccessGuardV2 = true;

  function programForPath() {
    const path = location.pathname.replace(/\/+$/, '').toLowerCase();
    if (path.endsWith('/tools/pdf-editor') || path.endsWith('/tools/pdf-editor.html')) return 'pdf-editor';
    if (path.endsWith('/tools/preflight') || path.endsWith('/tools/preflight.html') || path.endsWith('/tools/pdf-checker') || path.endsWith('/tools/pdf-checker.html')) return 'preflight';
    if (path.endsWith('/tools/perfect-binding-cover') || path.endsWith('/tools/perfect-binding-cover.html')) return 'perfect-binding-cover';
    return null;
  }

  const programId = programForPath();
  if (!programId) return;

  function ensureOverlay() {
    let overlay = document.getElementById('programAccessOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'programAccessOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Pretendard,"Noto Sans KR",sans-serif;text-align:center;';
    const box = document.createElement('div');
    box.innerHTML = '<div style="width:38px;height:38px;margin:0 auto 12px;border:3px solid #dbe5ee;border-top-color:#12396d;border-radius:50%;animation:programAccessSpin .7s linear infinite"></div><div style="font-size:13px;font-weight:850;color:#64748b">프로그램 사용 권한 확인 중...</div>';
    const style = document.createElement('style');
    style.textContent = '@keyframes programAccessSpin{to{transform:rotate(360deg)}}';
    overlay.append(style, box);
    document.body.appendChild(overlay);
    return overlay;
  }

  function allow(access) {
    window.ProgramToolAccess = access;
    document.documentElement.dataset.programAccess = 'allowed';
    document.getElementById('programAccessOverlay')?.remove();

    const nav = document.querySelector('.nav-user,.preview-actions,.top-nav');
    if (nav && !document.getElementById('programAccessBadge')) {
      const badge = document.createElement('span');
      badge.id = 'programAccessBadge';
      badge.textContent = access.isAdmin ? '관리자' : (access.isPublic ? '전체 공개' : '승인 계정');
      badge.style.cssText = 'font-size:9px;font-weight:850;color:rgba(255,255,255,.9);background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 7px;white-space:nowrap;';
      if (nav.classList.contains('top-nav')) nav.insertBefore(badge, nav.lastElementChild);
      else nav.prepend(badge);
    }
  }

  function deny(message) {
    document.documentElement.dataset.programAccess = 'denied';
    const overlay = ensureOverlay();
    overlay.replaceChildren();
    const box = document.createElement('div');
    box.style.cssText = 'max-width:420px';
    const icon = document.createElement('div');
    icon.textContent = '🔒';
    icon.style.cssText = 'font-size:52px;margin-bottom:12px';
    const title = document.createElement('div');
    title.textContent = '접근 권한이 없습니다';
    title.style.cssText = 'font-size:21px;font-weight:950;color:#0f172a';
    const desc = document.createElement('div');
    desc.textContent = message || '관리자에게 프로그램 사용 승인을 요청해 주세요.';
    desc.style.cssText = 'font-size:13px;color:#64748b;line-height:1.7;margin-top:9px';
    const link = document.createElement('a');
    link.href = '../index.html';
    link.textContent = '← 도구 목록으로';
    link.style.cssText = 'display:inline-block;margin-top:20px;padding:10px 22px;border-radius:10px;background:#12396d;color:#fff;text-decoration:none;font-size:13px;font-weight:850';
    box.append(icon, title, desc, link);
    overlay.appendChild(box);
  }

  async function waitForCompat() {
    for (let i = 0; i < 60; i += 1) {
      if (window.ProgramToolCompat) return window.ProgramToolCompat;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('권한 확인 모듈을 불러오지 못했습니다.');
  }

  async function check() {
    const compat = await waitForCompat();
    const access = await compat.programAccess(programId);
    if (!access.allowed) throw new Error('이 프로그램을 사용할 권한이 없습니다.');
    allow(access);
  }

  function boot() {
    ensureOverlay();
    if (typeof auth === 'undefined' || !auth?.onAuthStateChanged) {
      setTimeout(boot, 80);
      return;
    }
    auth.onAuthStateChanged(user => {
      if (!user) {
        location.href = '../login.html';
        return;
      }
      check().catch(error => deny(error.message));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();