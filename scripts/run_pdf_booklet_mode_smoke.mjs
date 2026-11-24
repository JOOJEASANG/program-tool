/* Browser regression for the PDF배치 mode switch: genuine DOM events and CSS. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executablePath=process.env.CHROME_BIN ||
  ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
const mimetype=filename=>filename.endsWith('.js')?'text/javascript':
  filename.endsWith('.css')?'text/css':'text/html';
const server=http.createServer((req,res)=>{
  const requested=decodeURIComponent(req.url.split('?')[0]);
  const filename=path.resolve(root,'.'+requested);
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try {
    res.setHeader('Content-Type',mimetype(filename));
    res.end(fs.readFileSync(filename));
  }catch(_){res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({
    executablePath,headless:true,args:['--no-sandbox','--disable-gpu']
  });
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+
    '/tests/browser/pdf-editor-booklet-mode-smoke.html');
  await page.waitForFunction(
    ()=>document.body.dataset.status!=='running',null,{timeout:20000}
  );
  const message=await page.locator('#result').innerText();
  console.log(message);
  if(await page.locator('body').getAttribute('data-status')!=='pass')
    throw new Error('PDF normal/booklet UI browser regression failed: '+message);
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}