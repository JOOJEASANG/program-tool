/* Explicit PDF renderer for AI cover artwork. No runtime canvas patches. */
'use strict';
(() => {
  const scripts=new Map(), fonts=new Map();
  const load=(url,globalName)=>{
    if(window[globalName])return Promise.resolve(window[globalName]);
    if(!scripts.has(url))scripts.set(url,new Promise((resolve,reject)=>{
      const node=document.createElement('script');let timer;
      const fail=()=>{clearTimeout(timer);node.remove();scripts.delete(url);reject(new Error('PDF 출력 구성요소를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'));};
      node.src=url;node.onload=()=>{clearTimeout(timer);window[globalName]?resolve(window[globalName]):fail();};node.onerror=fail;
      timer=setTimeout(fail,30000);document.head.appendChild(node);
    }));
    return scripts.get(url);
  };
  async function fontBytes(weight){
    const names={100:'Thin',200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};
    const key=Math.max(100,Math.min(900,Math.ceil(weight/100)*100));
    if(!fonts.has(key))fonts.set(key,(async()=>{
      const response=await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff/Pretendard-'+names[key]+'.woff',{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error('PDF용 Pretendard 글꼴을 불러오지 못했습니다.');
      const bytes=await response.arrayBuffer();
      // Use the same bytes for measurement and PDF embedding, even with a local font installed.
      const family='ProgramStudioPdf'+key,face=new FontFace(family,bytes,{weight:String(key)});
      await face.load();document.fonts.add(face);
      return {bytes,family,key};
    })().catch(error=>{fonts.delete(key);throw error;}));
    return fonts.get(key);
  }
  function color(value,lib){
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=value;
    const hex=ctx.fillStyle;
    if(/^#[0-9a-f]{6}$/i.test(hex))return lib.rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
    const rgb=hex.match(/[\d.]+/g)||[0,0,0];return lib.rgb(+rgb[0]/255,+rgb[1]/255,+rgb[2]/255);
  }
  function shapeContext(page,height,lib){
    let path='',stack=[];
    const ctx={globalAlpha:1,fillStyle:'#000000',strokeStyle:'#000000',lineWidth:1,
      save(){stack.push([this.globalAlpha,this.fillStyle,this.strokeStyle,this.lineWidth]);},
      restore(){[this.globalAlpha,this.fillStyle,this.strokeStyle,this.lineWidth]=stack.pop();},
      beginPath(){path='';},moveTo(x,y){path+=`M${x} ${y} `;},lineTo(x,y){path+=`L${x} ${y} `;},
      quadraticCurveTo(a,b,c,d){path+=`Q${a} ${b} ${c} ${d} `;},closePath(){path+='Z ';},
      rect(x,y,w,h){path+=`M${x} ${y} h${w} v${h} h${-w} Z `;},
      ellipse(x,y,rx,ry){path+=`M${x-rx} ${y} A${rx} ${ry} 0 1 0 ${x+rx} ${y} A${rx} ${ry} 0 1 0 ${x-rx} ${y} Z `;},
      fill(){page.drawSvgPath(path,{x:0,y:height,color:color(this.fillStyle,lib),opacity:this.globalAlpha,borderWidth:0});},
      stroke(){page.drawSvgPath(path,{x:0,y:height,borderColor:color(this.strokeStyle,lib),borderWidth:this.lineWidth,borderOpacity:this.globalAlpha});},
      setLineDash(){}
    };return ctx;
  }
  async function imagePng(image,ratio){
    let w=image.naturalWidth,h=image.naturalHeight;
    if(w*h>60000000)throw new Error('이미지가 6,000만 픽셀을 초과합니다. 출력 전 원본 크기를 줄여 주세요.');
    if(ratio){if(w/h>ratio)w=Math.round(h*ratio);else h=Math.round(w/ratio);}
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,(image.naturalWidth-w)/2,(image.naturalHeight-h)/2,w,h,0,0,w,h);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error('원본 이미지 변환 실패')),'image/png'));
    canvas.width=canvas.height=1;return blob.arrayBuffer();
  }
  async function create(options){
    const {spec,background,logo,logoRect,shapes,drawShape,textItems,wrappedLayout,drawCropMarks,cropMarks,textColor}=options;
    const items=textItems.filter(item=>String(item.text||'').trim());
    if(items.some(item=>item.fontFamily&&item.fontFamily!=='Pretendard'))throw new Error('벡터 PDF는 Pretendard 글꼴을 지원합니다. 다른 글꼴은 300dpi 이미지 PDF로 저장하거나 Pretendard로 변경해 주세요.');
    const [lib,kit]=await Promise.all([
      load('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js','PDFLib'),
      load('https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js','fontkit')
    ]);
    const doc=await lib.PDFDocument.create();
    const scale=72/25.4,width=spec.workW*scale,height=spec.workH*scale,page=doc.addPage([width,height]);
    doc.setTitle('Program Studio 인쇄 디자인');doc.setCreator('Program Studio');
    if(spec.bleed>0)page.setTrimBox(spec.bleed*scale,spec.bleed*scale,(spec.workW-2*spec.bleed)*scale,(spec.workH-2*spec.bleed)*scale);
    page.setBleedBox(0,0,width,height);
    const bg=await doc.embedPng(await imagePng(background,width/height));
    page.drawImage(bg,{x:0,y:0,width,height});
    const shape=shapeContext(page,height,lib);shapes.forEach(item=>drawShape(shape,item,scale,0));
    if(logo&&logoRect){const im=await doc.embedPng(await imagePng(logo));page.drawImage(im,{x:logoRect.x,y:height-logoRect.y-logoRect.h,width:logoRect.w,height:logoRect.h});}
    const parsedFonts=new Map(),ctx=document.createElement('canvas').getContext('2d');
    for(const item of items){
      const font=await fontBytes(item.weight||700);
      if(!parsedFonts.has(font.key))parsedFonts.set(font.key,kit.create(new Uint8Array(font.bytes)));
      const parsed=parsedFonts.get(font.key);
      if([...item.text].some(char=>!/[\s]/.test(char)&&!parsed.hasGlyphForCodePoint(char.codePointAt(0))))throw new Error('벡터 글꼴에 없는 문자가 있습니다. 해당 문자를 바꾸거나 이미지 PDF를 선택해 주세요.');
      const size=item.fontPt,lineHeight=size*Math.max(.8,Math.min(2.2,item.lineHeight||1.2));
      ctx.font=font.key+' '+size+'px '+font.family;
      ctx.textBaseline='alphabetic';const alphabetic=ctx.measureText('Hg한');
      ctx.textBaseline='top';const top=ctx.measureText('Hg한');
      const baseline=alphabetic.actualBoundingBoxAscent-top.actualBoundingBoxAscent;
      const rows=item.vertical?[...String(item.text).replace(/\s+/g,'')].map((text,index)=>({text,y:index*lineHeight})).filter(row=>row.y+lineHeight<=item.h):wrappedLayout(ctx,item.text,item.w,lineHeight,item.h).rows;
      for(const row of rows){
        const run=parsed.layout(row.text),factor=size/parsed.unitsPerEm;
        const align=item.vertical?'center':(item.align||'left'),rowWidth=run.positions.reduce((sum,pos)=>sum+pos.xAdvance*factor,0);
        let x=item.x+(align==='center'?(item.w-rowWidth)/2:align==='right'?item.w-rowWidth:0),y=item.y+row.y+baseline;
        const angle=(item.rotate||0)*Math.PI/180;
        if(angle){const cx=item.x+item.w/2,cy=item.y+item.h/2,dx=x-cx,dy=y-cy;x=cx+dx*Math.cos(angle)-dy*Math.sin(angle);y=cy+dx*Math.sin(angle)+dy*Math.cos(angle);}
        let cursor=0;
        run.glyphs.forEach((glyph,index)=>{
          const pos=run.positions[index];
          const path=glyph.path.scale(factor,-factor).translate(cursor+pos.xOffset*factor,-pos.yOffset*factor).toSVG();
          if(path)page.drawSvgPath(path,{x,y:height-y,color:color(item.color||textColor,lib),rotate:lib.degrees(-(item.rotate||0))});
          cursor+=pos.xAdvance*factor;
        });
      }
    }
    if(cropMarks)drawCropMarks(shape,spec,scale);
    return new Blob([await doc.save()],{type:'application/pdf'});
  }
  window.ProgramStudioPrintExport={create};
})();
