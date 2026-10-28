const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/pdf-suite/single-page-shell.js','utf8');
const ctx={window:{},document:{readyState:'loading',addEventListener() {}}};
vm.runInNewContext(source,ctx);
const render=ctx.window.ProgramStudioPdfUtilityIcons?.markup;
assert.equal(typeof render,'function');
for(const code of ['IMG','PDF','OCR','TXT','KEY','OPEN','FIX','＋','−','⇣','✓','▦']){
  const html=render(code);
  assert.match(html,/^<svg /);
  assert.match(html,/viewBox="0 0 24 24"/);
  assert.match(html,/width="20" height="20"/);
  assert.match(html,/aria-hidden="true"/);
  assert.doesNotMatch(html,/>IMG<|>PDF<|>TXT<|>KEY<|>OPEN<|>FIX</);
}
assert.match(render('<img src=x>'),/&lt;img src=x&gt;/);
console.log('pdf utility vector icons behavior passed');
