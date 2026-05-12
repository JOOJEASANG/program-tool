// Program Tool — auto-updating service worker + AI prompt patch + cloud save patch
const APP_VERSION = '2026-05-12-cloud-save-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
  })());
});

function shouldPatchCoverAiRequest(req) {
  const url = new URL(req.url);
  return req.method === 'POST' && url.origin === location.origin && url.pathname === '/api/ai/generate-bg';
}
function looksCoverRelated(text) {
  const s = String(text || '').toLowerCase();
  return ['표지', '책등', '앞표지', '뒷표지', '앞면', '뒷면', 'cover', 'spine', 'book cover', '포스터', 'poster', '전단', 'flyer', '메뉴', 'menu', '리플렛', 'leaflet', '브로슈어', 'brochure', '초대', 'invitation'].some((word) => s.includes(word));
}
function buildCoverSpreadPrompt(prompt, body) {
  const metrics = body.cover_metrics || {};
  const paperW = metrics.paperW || metrics.paper_width || 'front/back cover width';
  const paperH = metrics.paperH || metrics.paper_height || 'cover height';
  const spine = metrics.spine || metrics.spineWidth || metrics.spine_width || 'spine width';
  const bleed = metrics.bleed || metrics.bleedMm || metrics.bleed_mm || 'bleed';
  return [
    'Create a premium professional print design background with refined composition, elegant color harmony, balanced spacing, sophisticated visual rhythm, and high-end commercial design quality.',
    'Create one continuous full book-cover spread background image when this is a cover design.',
    'For posters, flyers, menus, leaflets, brochures, and invitation cards, create a polished expert-level background suitable for the selected design purpose.',
    'The layout must be: back cover on the left, spine in the center, front cover on the right when this is a cover design.',
    'The back cover, spine, front cover, and bleed area must feel like one seamless connected scene, not separate panels.',
    'Generate background only. Do not include text, letters, logos, watermarks, labels, mockups, or page guides.',
    'Make the design visually focused, modern, refined, premium, and suitable for real print production.',
    'For Gemini generation, fill the whole canvas edge-to-edge with no weak empty border areas.',
    'Keep important subjects and faces away from the spine area so they are not split by the book spine.',
    'Include enough bleed-safe continuation around the edges for trimming.',
    `Size context: front/back width ${paperW}, cover height ${paperH}, spine ${spine}, bleed ${bleed}.`,
    'Original user request:',
    String(prompt || '')
  ].join('\n');
}
async function patchCoverAiRequest(req) {
  try {
    const body = await req.clone().json();
    const prompt = body.prompt || '';
    if (!body.cover_spread && !looksCoverRelated(prompt)) return fetch(req);
    body.prompt = buildCoverSpreadPrompt(prompt, body);
    body.aspect = body.aspect || 'wide';
    body.cover_spread = true;
    const headers = new Headers(req.headers);
    headers.set('content-type', 'application/json');
    return fetch(new Request(req.url, { method: req.method, headers, body: JSON.stringify(body), mode: req.mode, credentials: req.credentials, cache: 'no-store', redirect: req.redirect, referrer: req.referrer, referrerPolicy: req.referrerPolicy, integrity: req.integrity, keepalive: req.keepalive }));
  } catch (_) { return fetch(req); }
}

const CLOUD_SAVE_SCRIPT = `
<script>
(function(){
  if (window.__cloudDesignSavePatch) return;
  window.__cloudDesignSavePatch = true;
  const PROJECT_LIMIT = 900000;
  function safeKey(k){ return /design|studio|cover|programTool|template|canvas/i.test(k) && !/firebase|auth|token|api|key/i.test(k); }
  function status(msg, ok){ const el=document.getElementById('cloudSaveStatus'); if(el){ el.textContent=msg; el.style.color=ok?'#166534':'#991b1b'; } }
  function collectLocal(){ const out={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&safeKey(k)) out[k]=localStorage.getItem(k); } return out; }
  function collectGlobals(){ const names=['state','designState','appState','currentDesign','sides']; const out={}; for(const n of names){ try{ if(window[n]) out[n]=JSON.parse(JSON.stringify(window[n], function(k,v){ if(typeof v==='function') return undefined; if(v&&v.nodeType) return undefined; return v; })); }catch(e){} } return out; }
  function snapshot(title){ return { title:title||'제목 없는 디자인', url:location.pathname+location.search, template:new URLSearchParams(location.search).get('template')||'', localStorage:collectLocal(), globals:collectGlobals(), updatedAt:firebase.firestore.FieldValue.serverTimestamp(), appVersion:'cloud-save-v1' }; }
  async function saveCloud(){ try{ if(!window.auth||!window.db||!window.firebase) return alert('Firebase 연결을 확인할 수 없습니다.'); const user=auth.currentUser; if(!user) return alert('로그인이 필요합니다.'); const title=prompt('저장할 작업 이름을 입력하세요','내 디자인 작업'); if(title===null) return; const data=snapshot(title); const size=new Blob([JSON.stringify(data)]).size; if(size>PROJECT_LIMIT) return alert('작업 데이터가 너무 큽니다. 이미지가 포함된 경우 JSON 파일 저장 또는 Firebase Storage 분리 저장이 필요합니다.'); await db.collection('design_projects').doc(user.uid).collection('projects').add(Object.assign(data,{createdAt:firebase.firestore.FieldValue.serverTimestamp()})); status('Firebase에 저장되었습니다.',true); alert('Firebase에 저장되었습니다.'); }catch(e){ console.error(e); status('저장 실패: '+(e.message||e),false); alert('저장 실패: '+(e.message||e)); } }
  async function loadList(){ try{ if(!window.auth||!window.db) return alert('Firebase 연결을 확인할 수 없습니다.'); const user=auth.currentUser; if(!user) return alert('로그인이 필요합니다.'); const box=document.getElementById('cloudProjectList'); box.innerHTML='불러오는 중...'; box.style.display='block'; const snap=await db.collection('design_projects').doc(user.uid).collection('projects').orderBy('updatedAt','desc').limit(20).get(); if(snap.empty){ box.innerHTML='<div style="font-size:12px;color:#64748b;padding:8px;">저장된 작업이 없습니다.</div>'; return; } box.innerHTML=''; snap.forEach(doc=>{ const d=doc.data(); const btn=document.createElement('button'); btn.type='button'; btn.className='secondary'; btn.style.cssText='width:100%;margin-top:5px;text-align:left;font-size:12px;padding:8px;'; btn.textContent=d.title||'제목 없는 디자인'; btn.onclick=()=>loadCloud(doc.id); box.appendChild(btn); }); }catch(e){ console.error(e); alert('목록 불러오기 실패: '+(e.message||e)); } }
  async function loadCloud(id){ try{ const user=auth.currentUser; const doc=await db.collection('design_projects').doc(user.uid).collection('projects').doc(id).get(); if(!doc.exists) return alert('저장된 작업을 찾을 수 없습니다.'); const d=doc.data(); const ls=d.localStorage||{}; Object.keys(ls).forEach(k=>localStorage.setItem(k,ls[k])); alert('작업을 불러왔습니다. 화면을 새로고침합니다.'); location.reload(); }catch(e){ console.error(e); alert('불러오기 실패: '+(e.message||e)); } }
  function installUi(){ if(document.getElementById('cloudSaveSection')) return; const aside=document.querySelector('aside'); if(!aside) return; const sec=document.createElement('div'); sec.id='cloudSaveSection'; sec.className='section'; sec.innerHTML='<h2>☁️ 클라우드 저장</h2><div class="btns"><button type="button" id="cloudSaveBtn" class="green">Firebase 저장</button><button type="button" id="cloudLoadBtn" class="secondary">불러오기</button></div><div id="cloudSaveStatus" class="smallnote">계정별로 작업 JSON을 저장합니다.</div><div id="cloudProjectList" style="display:none;margin-top:8px;"></div>'; aside.insertBefore(sec, aside.children[1]||null); document.getElementById('cloudSaveBtn').onclick=saveCloud; document.getElementById('cloudLoadBtn').onclick=loadList; }
  document.addEventListener('DOMContentLoaded',installUi); setInterval(installUi,1000);
})();
</script>`;

async function patchDesignStudioHtml(req) {
  const res = await fetch(req, { cache: 'no-store' });
  const text = await res.text();
  if (text.includes('__cloudDesignSavePatch')) return res;
  const html = text.replace('</body>', CLOUD_SAVE_SCRIPT + '\n</body>');
  return new Response(html, { status: res.status, statusText: res.statusText, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin === location.origin && req.method === 'GET' && url.pathname.endsWith('/tools/design-studio.html')) {
    event.respondWith(patchDesignStudioHtml(req));
    return;
  }
  if (shouldPatchCoverAiRequest(req)) { event.respondWith(patchCoverAiRequest(req)); return; }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');
  if (isHtml) event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
});
