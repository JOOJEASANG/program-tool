/* Regression for imported PDF orientation in normal and actual-size N-up. */
const fs=require('fs');
const path=require('path');
const assert=require('assert').strict;
const text=fs.readFileSync(path.join(__dirname,'../../pdf-editor/index.html'),'utf8');
function extract(start,end){
  const s=text.indexOf(start);
  if(s<0)throw Error('Missing '+start);
  const e=text.indexOf(end,s);
  if(e<0)throw Error('Missing '+end);
  return text.slice(s,e);
}
const drawing=extract('function drawPageInCell(', '// ── Get canvas for a page');
const getSource=extract('function getPageSrc(', '// Canonical booklet fold geometry');
function spy(){
  const calls=[];
  const ctx={drawImage(){calls.push('draw');},rotate(){calls.push('rotate');},
    save(){calls.push('save');},restore(){calls.push('restore');},
    translate(){calls.push('translate');},beginPath(){calls.push('path');},
    rect(){calls.push('rect');},clip(){calls.push('clip');},
    strokeRect(){calls.push('stroke');}};
  return {ctx,calls};
}
function makeDrawer(actual){
  return new Function('getActualPlacementSize','showBorder',drawing+'\nreturn drawPageInCell;')(()=>actual,false);
}
const noActual=makeDrawer(null);
const pdf={width:200,height:100,dataset:{pdfAutoFitRotation:'disabled'}};
const old={width:200,height:100};
{
  const a=spy();noActual(a.ctx,pdf,0,0,80,140);
  assert(a.calls.includes('draw'),'PDF not drawn');
  assert(!a.calls.includes('rotate'),'PDF source auto rotated in preview');
}
{
  const a=spy();noActual(a.ctx,old,0,0,80,140);
  assert(a.calls.includes('rotate'),'Non PDF fallback rotation unexpectedly removed');
}
{
  const actual=makeDrawer({enabled:true,widthMm:100,heightMm:80});
  const a=spy();actual(a.ctx,pdf,0,0,80,100,1);
  assert(!a.calls.includes('rotate'),'Actual size PDF source auto rotated');
  const b=spy();actual(b.ctx,old,0,0,80,100,1);
  assert(b.calls.includes('rotate'),'Actual size non-PDF rotation unexpectedly removed');
}
{
  const source=new Function('getSettings','renderDividerCanvas','document',getSource+'\nreturn getPageSrc;')(
    ()=>({pw:210,ph:297}),()=>{}, {createElement(){throw Error('Should not create canvas');}}
  );
  const page={pageType:'pdf',thumbCanvas:{width:200,height:100,dataset:{}},hiCanvas:{width:400,height:200,dataset:{}}};
  assert(source(page,1,false).dataset.pdfAutoFitRotation==='disabled');
  assert(source(page,1,true).dataset.pdfAutoFitRotation==='disabled');
}
console.log('PDF layout upload orientation behavior passed');
