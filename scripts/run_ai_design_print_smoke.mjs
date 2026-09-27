import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,'browser-smoke-artifacts');fs.mkdirSync(out,{recursive:true});
const executablePath=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>fs.existsSync(x));
const server=http.createServer((req,res)=>{
  const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!name.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(name));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  // Optional local copies of pinned CDN assets allow offline engine verification.
  if(process.env.PRINT_VENDOR_DIR){
    for(const [pattern,file,type] of [['**/pdf-lib@*/**','pdf-lib.js','text/javascript'],['**/@pdf-lib/fontkit@*/**','fontkit.js','text/javascript'],['**/Pretendard-Bold.woff','Pretendard-Bold.woff','font/woff']]){
      await page.route(pattern,route=>route.fulfill({path:path.join(process.env.PRINT_VENDOR_DIR,file),contentType:type,headers:{'access-control-allow-origin':'*'}}));
    }
  }
  await page.goto('http://127.0.0.1:'+server.address().port+'/tests/browser/ai-design-print-quality-smoke.html');
  await page.waitForFunction(()=>document.body.dataset.status!=='running',null,{timeout:90000});
  const html=path.join(out,'ai-print.html');fs.writeFileSync(html,await page.content());
  console.log(await page.locator('#result').innerText());
  if(await page.locator('body').getAttribute('data-status')!=='pass')throw new Error('Print browser regression failed');
  execFileSync(process.env.PYTHON||'python',[path.join(root,'scripts/verify_ai_design_print_smoke.py'),html],{stdio:'inherit'});
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
