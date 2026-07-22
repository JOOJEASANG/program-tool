(()=>{
'use strict';
if(!location.pathname.includes('perfect-binding-cover'))return;
function cleanup(){document.getElementById('coverMultiPanel')?.remove()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(cleanup,150));else setTimeout(cleanup,150);
})();