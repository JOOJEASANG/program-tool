// Local UI regression check. External services and protected engines are not exercised.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 const executablePath=process.env.CHROMIUM_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
 browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.fulfill({body:'',contentType:'text/javascript'});
   if(route.request().resourceType()==='script')return route.fulfill({body:'',contentType:'text/javascript'});
   return route.continue();
 });
 const ui=await readFile(new URL('../js/program-studio-ui-v2.js',import.meta.url),'utf8');
 await page.goto(origin+'/');
 await page.addScriptTag({content:ui});
 assert.equal(await page.locator('.prog-card').count(),6);
 await page.getByRole('button',{name:'AI 디자인 제작 즐겨찾기',exact:true}).click();
 await page.locator('#favoriteFilter').click();
 assert.equal(await page.locator('.prog-card').count(),1);
 await page.reload();
 await page.addScriptTag({content:ui});
 assert.equal(await page.getByRole('button',{name:'AI 디자인 제작 즐겨찾기',exact:true}).getAttribute('aria-pressed'),'true');
 await page.locator('#search').fill('존재하지 않는 도구');
 assert.equal(await page.locator('.prog-card').count(),0);
 await page.getByRole('button',{name:'전체 도구 보기',exact:true}).click();
 assert.equal(await page.locator('.prog-card').count(),6);
 await page.locator('[data-cat="pdf"]').click();
 assert.equal(await page.locator('.prog-card').count(),3);
 assert.equal(await page.locator('.prog-card').last().getAttribute('href'),'pdf-suite/');
 await page.locator('[data-cat="all"]').click();
 await page.locator('.ps-command-trigger').click();
 assert.equal(await page.locator('.ps-command-item').count(),7);
 await page.locator('.ps-command-input').fill('명함');
 assert.equal(await page.locator('.ps-command-item').count(),1);
 await page.keyboard.press('Escape');
 assert(await page.locator('.ps-command-trigger').evaluate(el=>el===document.activeElement));
 if(process.env.WORKSPACE_SCREENSHOT)await page.screenshot({path:process.env.WORKSPACE_SCREENSHOT,fullPage:true});
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Home overflow at ${width}`);
 }
 // Use real tool markup with scripts blocked: no authentication bypass is shipped.
 await page.goto(origin+'/smart-print-layout/');
 await page.evaluate(()=>document.documentElement.style.visibility='visible');
 await page.addScriptTag({content:ui});
 assert.equal(await page.locator('.ps-workflow').count(),1);
 await page.getByText('자주 쓰는 완성 크기',{exact:true}).click();
 await page.locator('#marginMm').fill('7');
 await page.getByRole('button',{name:'명함 90×50',exact:true}).click();
 assert.equal(await page.locator('#trimGuideWidth').inputValue(),'90');
 assert.equal(await page.locator('#trimGuideHeight').inputValue(),'50');
 assert.equal(await page.locator('#marginMm').inputValue(),'7');
 assert.equal(await page.locator('#paperPreset').inputValue(),'a4');
 await page.goto(origin+'/');
 assert(await page.locator('#quickRow').innerText().then(text=>text.includes('스마트 인쇄배치')));
 // Malformed preferences and unavailable storage must not break navigation.
 await page.evaluate(()=>localStorage.setItem('ps-favorite-tools','{invalid'));
 await page.reload();assert.equal(await page.locator('.prog-card').count(),6);
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('blocked');};});
 await page.reload();
 await page.getByRole('button',{name:'AI 디자인 제작 즐겨찾기',exact:true}).click();
 assert((await page.locator('#preferenceStatus').innerText()).includes('저장할 수 없습니다'));
 console.log('PASS: favorites, filters, canonical routes, palette focus, responsive widths, print presets, recent visits, storage recovery');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
