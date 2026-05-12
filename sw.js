// Program Tool service worker: cache refresh + AI prompt patch + HTML helper patches
const APP_VERSION = '2026-05-12-pdf-hf-margin-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('message', (event) => { if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION }));
  })());
});

function isAiBgRequest(req) {
  const url = new URL(req.url);
  return req.method === 'POST' && url.origin === location.origin && url.pathname === '/api/ai/generate-bg';
}
function isDesignRelated(text) {
  const s = String(text || '').toLowerCase();
  return ['표지','책등','앞표지','뒷표지','앞면','뒷면','cover','spine','book cover','포스터','poster','전단','flyer','메뉴','menu','리플렛','leaflet','브로슈어','brochure','초대','invitation'].some((word) => s.includes(word));
}
function buildDesignPrompt(prompt, body) {
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
async function patchAiBgRequest(req) {
  try {
    const body = await req.clone().json();
    const prompt = body.prompt || '';
    if (!body.cover_spread && !isDesignRelated(prompt)) return fetch(req);
    body.prompt = buildDesignPrompt(prompt, body);
    body.aspect = body.aspect || 'wide';
    body.cover_spread = true;
    const headers = new Headers(req.headers);
    headers.set('content-type', 'application/json');
    return fetch(new Request(req.url, { method: req.method, headers, body: JSON.stringify(body), mode: req.mode, credentials: req.credentials, cache: 'no-store', redirect: req.redirect, referrer: req.referrer, referrerPolicy: req.referrerPolicy, integrity: req.integrity, keepalive: req.keepalive }));
  } catch (_) { return fetch(req); }
}

const DESIGN_CLOUD_SCRIPT = `
<script>
(function(){
 if(window.__cloudDesignSavePatch)return; window.__cloudDesignSavePatch=true;
 const LIMIT=900000;
 function safeKey(k){return /design|studio|cover|programTool|template|canvas/i.test(k)&&!/firebase|auth|token|api|key/i.test(k);}
 function collectLocal(){const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k&&safeKey(k)) o[k]=localStorage.getItem(k);} return o;}
 function installUi(){ if(document.getElementById('cloudSaveSection'))return; const aside=document.querySelector('aside'); if(!aside)return; const sec=document.createElement('div'); sec.id='cloudSaveSection'; sec.className='section'; sec.innerHTML='<h2>☁️ 클라우드 저장</h2><div class="btns"><button type="button" id="cloudSaveBtn" class="green">Firebase 저장</button><button type="button" id="cloudLoadBtn" class="secondary">불러오기</button></div><div id="cloudProjectList" style="display:none;margin-top:8px;"></div>'; aside.insertBefore(sec,aside.children[1]||null); document.getElementById('cloudSaveBtn').onclick=saveCloud; document.getElementById('cloudLoadBtn').onclick=loadList; }
 async function saveCloud(){ try{ if(!window.auth||!window.db||!window.firebase)return alert('Firebase 연결을 확인할 수 없습니다.'); const user=auth.currentUser; if(!user)return alert('로그인이 필요합니다.'); const title=prompt('저장할 작업 이름을 입력하세요','내 디자인 작업'); if(title===null)return; const data={title:title||'제목 없는 디자인',url:location.pathname+location.search,template:new URLSearchParams(location.search).get('template')||'',localStorage:collectLocal(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),appVersion:'cloud-save'}; if(new Blob([JSON.stringify(data)]).size>LIMIT)return alert('작업 데이터가 너무 큽니다. 이미지가 포함된 경우 JSON 파일 저장 또는 Storage 분리 저장이 필요합니다.'); await db.collection('design_projects').doc(user.uid).collection('projects').add(Object.assign(data,{createdAt:firebase.firestore.FieldValue.serverTimestamp()})); alert('Firebase에 저장되었습니다.'); }catch(e){console.error(e); alert('저장 실패: '+(e.message||e));}}
 async function loadList(){ try{ if(!window.auth||!window.db)return alert('Firebase 연결을 확인할 수 없습니다.'); const user=auth.currentUser; if(!user)return alert('로그인이 필요합니다.'); const box=document.getElementById('cloudProjectList'); box.innerHTML='불러오는 중...'; box.style.display='block'; const snap=await db.collection('design_projects').doc(user.uid).collection('projects').orderBy('updatedAt','desc').limit(20).get(); if(snap.empty){box.innerHTML='<div style="font-size:12px;color:#64748b;padding:8px;">저장된 작업이 없습니다.</div>';return;} box.innerHTML=''; snap.forEach(doc=>{const d=doc.data(); const b=document.createElement('button'); b.type='button'; b.className='secondary'; b.style.cssText='width:100%;margin-top:5px;text-align:left;font-size:12px;padding:8px;'; b.textContent=d.title||'제목 없는 디자인'; b.onclick=()=>loadCloud(doc.id); box.appendChild(b);}); }catch(e){console.error(e); alert('목록 불러오기 실패: '+(e.message||e));}}
 async function loadCloud(id){ try{ const user=auth.currentUser; const doc=await db.collection('design_projects').doc(user.uid).collection('projects').doc(id).get(); if(!doc.exists)return alert('저장된 작업을 찾을 수 없습니다.'); const ls=(doc.data()||{}).localStorage||{}; Object.keys(ls).forEach(k=>localStorage.setItem(k,ls[k])); alert('작업을 불러왔습니다. 화면을 새로고침합니다.'); location.reload(); }catch(e){console.error(e); alert('불러오기 실패: '+(e.message||e));}}
 document.addEventListener('DOMContentLoaded',installUi); setInterval(installUi,1000);
})();
</script>`;

const PDF_EDITOR_SCRIPT = `
<script>
(function(){
 if(window.__pdfHfMarginPatch)return; window.__pdfHfMarginPatch=true;
 function n(id,def){const el=document.getElementById(id); const v=Number(el&&el.value); return Number.isFinite(v)?Math.max(0,Math.min(50,v)):def;}
 function installUi(){
   if(document.getElementById('hfHeaderMarginMm'))return;
   const labels=[...document.querySelectorAll('label,.sec-title,.subsec')];
   const anchor=labels.find(el=>(el.textContent||'').includes('머리말')||(el.textContent||'').includes('꼬리말'));
   const target=anchor?anchor.closest('.sec-body,.sec,aside'):document.querySelector('aside');
   if(!target)return;
   const box=document.createElement('div');
   box.id='hfMarginPatchBox'; box.className='field';
   box.innerHTML='<label>머리말/꼬리말 여백 (mm)</label><div class="grid2"><div><input id="hfHeaderMarginMm" type="number" min="0" max="50" step="0.5" value="8"><div class="fh-meta">머리말 상단</div></div><div><input id="hfFooterMarginMm" type="number" min="0" max="50" step="0.5" value="8"><div class="fh-meta">꼬리말 하단</div></div></div><div class="fh-meta" style="margin-top:4px;">PDF 출력 시 여백값이 적용됩니다.</div>';
   target.appendChild(box);
 }
 const origFetch=window.fetch.bind(window);
 window.fetch=function(input,init){
   try{
     const url=typeof input==='string'?input:(input&&input.url)||'';
     if(url.includes('/api/pdf/process')&&init&&init.body instanceof FormData){
       const fd=init.body; const raw=fd.get('settings');
       if(raw){const s=JSON.parse(raw); s.header_footer=s.header_footer||{}; s.header_footer.header_margin_mm=n('hfHeaderMarginMm',8); s.header_footer.footer_margin_mm=n('hfFooterMarginMm',8); fd.set('settings',JSON.stringify(s));}
     }
   }catch(e){console.warn('PDF margin patch skipped',e);}
   return origFetch(input,init);
 };
 document.addEventListener('DOMContentLoaded',installUi); setInterval(installUi,1000);
})();
</script>`;

async function injectHtml(req, script, mark) {
  const res = await fetch(req, { cache: 'no-store' });
  const text = await res.text();
  if (text.includes(mark)) return res;
  const html = text.replace('</body>', script + '\n</body>');
  return new Response(html, { status: res.status, statusText: res.statusText, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin === location.origin && req.method === 'GET' && url.pathname.endsWith('/tools/design-studio.html')) {
    event.respondWith(injectHtml(req, DESIGN_CLOUD_SCRIPT, '__cloudDesignSavePatch'));
    return;
  }
  if (url.origin === location.origin && req.method === 'GET' && url.pathname.endsWith('/tools/pdf-editor.html')) {
    event.respondWith(injectHtml(req, PDF_EDITOR_SCRIPT, '__pdfHfMarginPatch'));
    return;
  }
  if (isAiBgRequest(req)) { event.respondWith(patchAiBgRequest(req)); return; }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');
  if (isHtml) event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
});
