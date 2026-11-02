// Multi-up variable print: one PDF template per finished item, one Excel row per slot.
// Input PDFs and recipient data stay in the local browser.
(function(){
'use strict';
if(window.__printMultiVariableV1)return;
window.__printMultiVariableV1=true;
const MM=72/25.4, DPI=300, MAX_PEOPLE=300, MAX_PAGES=100;
const PAPER={A4:[210,297],A3:[297,420],SRA3:[320,450],A3PLUS:[329,483]};
const FONT={gothic:'"Pretendard","Noto Sans KR","Malgun Gothic",sans-serif',
  malgun:'"Malgun Gothic","Noto Sans KR",sans-serif',
  serif:'"Batang","Noto Serif KR",serif'};
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const defaults=[
  {label:'이름',aliases:['이름','성명','고객명','수신자'],x:.5,y:.35,size:16},
  {label:'번호',aliases:['번호','일련번호','회원번호','쿠폰번호','사번'],x:.5,y:.58,size:10},
  {label:'소속',aliases:['소속','회사','학년','부서'],x:.5,y:.72,size:10}
];
function grid(count,sourceW,sourceH,paperW,paperH,marginMm,gapMm){
  const margin=marginMm*MM,gap=gapMm*MM;
  if(![count,sourceW,sourceH,paperW,paperH,margin,gap].every(Number.isFinite)
    ||count<1||sourceW<=0||sourceH<=0||paperW<=0||paperH<=0
    ||marginMm<3||marginMm>50||gapMm<4||gapMm>30)throw Error('출력 용지·여백·간격을 확인하세요.');
  const cols=Math.floor((paperW-2*margin+gap+.0001)/(sourceW+gap));
  const rows=Math.floor((paperH-2*margin+gap+.0001)/(sourceH+gap));
  if(cols<1||rows<1)throw Error('원본 PDF가 선택 용지에 들어가지 않습니다. 용지 규격·방향·여백을 조정하세요.');
  const per=cols*rows,pages=Math.ceil(count/per);
  if(pages>MAX_PAGES)throw Error('한 번에 최대 100장까지 출력할 수 있습니다. 명단을 나누세요.');
  const left=(paperW-(cols*sourceW+(cols-1)*gap))/2;
  const top=(paperH-(rows*sourceH+(rows-1)*gap))/2;
  return {cols,rows,per,pages,paperW,paperH,left,top,gap,
    items(sheet){
      const output=[];
      for(let slot=0;slot<per;slot++){
        const index=sheet*per+slot;if(index>=count)break;
        output.push({index,x:left+(slot%cols)*(sourceW+gap),y:top+Math.floor(slot/cols)*(sourceH+gap)});
      }
      return output;
    }
  };
}
window.PrintMultiVariableLayout=Object.freeze({grid});
function csv(raw){
  let quote=false,cell='',row=[],rows=[];
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(ch==='"'&&quote&&raw[i+1]==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quote=!quote;continue;}
    if(!quote&&(ch===','||ch==='\r'||ch==='\n')){
      row.push(cell);cell='';
      if(ch!==','){
        if(ch==='\r'&&raw[i+1]==='\n')i++;
        rows.push(row);row=[];
      }
    }else cell+=ch;
  }
  if(quote)throw Error('CSV 파일의 따옴표가 닫히지 않았습니다.');
  row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);
  return rows;
}
function font(f){return (f.bold?'700 ':'400 ')+f.size+'px '+(FONT[f.face]||FONT.gothic);}
function fieldText(f,row){return f.col>=0?String(row?.[f.col]??'').trim():'';}
function install(){
  if(!window.PrintSpecialistUi)return setTimeout(install,80);
  const ui=window.PrintSpecialistUi;
  ui.register('multi-variable',{
    title:'다단 가변인쇄 · 서로 다른 명단을 한 용지에',
    description:'명찰·쿠폰·라벨·회원증 등 · PDF 템플릿 하나에 서로 다른 엑셀 행을 순서대로 배치',
    markup:[
      '<p class="ps-help">원본 PDF의 실제 크기가 완성품 크기입니다. 예: 90×50mm 명찰 PDF + 엑셀 100명 → A3 한 장에 여러 명씩 다른 내용으로 배치합니다. 배경은 벡터, 이름과 번호는 300dpi로 인쇄합니다.</p>',
      '<div class="ps-fields">',
      '<label class="wide">완성품 원본 PDF · 1페이지 / 최대 30MB<input id="mvPdf" type="file" accept=".pdf,application/pdf"></label>',
      '<label class="wide">가변 명단 엑셀·CSV · 첫 줄 열 제목 / 최대 10MB<input id="mvRoster" type="file" accept=".xlsx,.xls,.csv,text/csv"></label>',
      '<label>용지<select id="mvPaper"><option value="A4">A4 (210×297mm)</option><option value="A3" selected>A3 (297×420mm)</option><option value="SRA3">SRA3 (320×450mm)</option><option value="A3PLUS">A3+ (329×483mm)</option><option value="custom">직접 입력</option></select></label>',
      '<label>용지 방향<select id="mvDir"><option value="portrait">세로</option><option value="landscape">가로</option></select></label>',
      '<label>출력 내용<select id="mvMode"><option value="background">원본 디자인 + 가변글자</option><option value="only">가변글자만 (기성 인쇄용지)</option></select></label>',
      '<label>용지 가로 (mm)<input id="mvPaperW" type="number" min="50" max="500" step=".1" value="297" readonly></label>',
      '<label>용지 세로 (mm)<input id="mvPaperH" type="number" min="50" max="700" step=".1" value="420" readonly></label>',
      '<label>바깥 여백 (mm)<input id="mvMargin" type="number" min="3" max="50" step=".5" value="5"></label>',
      '<label>제품 간격 (mm)<input id="mvGap" type="number" min="4" max="30" step=".5" value="5"></label>',
      '<label>재단선<select id="mvMarks"><option value="no">표시 안 함</option><option value="yes">표시</option></select></label>',
      '<label>미리보기 명단<select id="mvPerson"><option value="0">명단을 올리세요</option></select></label>',
      '<label>배치할 항목<select id="mvField"></select></label>',
      '<label>연결 엑셀 열<select id="mvColumn"><option value="-1">사용 안 함</option></select></label>',
      '<label>글꼴<select id="mvFace"><option value="gothic">고딕체</option><option value="malgun">맑은 고딕</option><option value="serif">명조체</option></select></label>',
      '<label>글자 크기 (pt)<input id="mvSize" type="number" min="6" max="60" value="16"></label>',
      '<label>정렬<select id="mvAlign"><option value="center">가운데</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></label>',
      '<label>글자 X (mm)<input id="mvX" type="number" min="0" max="500" step=".5" value="45"></label>',
      '<label>글자 Y (mm)<input id="mvY" type="number" min="0" max="500" step=".5" value="18"></label>',
      '<label>최대 글자 폭 (mm)<input id="mvWidth" type="number" min="10" max="400" value="80"></label>',
      '<label>글자 굵기<select id="mvBold"><option value="yes">굵게</option><option value="no">보통</option></select></label>',
      '</div>',
      '<p id="mvSummary" class="ps-help" aria-live="polite"></p>',
      '<div class="ps-actions"><button id="mvAdd" type="button" class="ps-btn secondary">엑셀 항목 추가</button><button id="mvDelete" type="button" class="ps-btn secondary">선택 항목 삭제</button><button id="mvSave" type="button" class="ps-btn secondary">위치 설정 저장</button><button id="mvLoad" type="button" class="ps-btn secondary">위치 설정 불러오기</button></div>',
      '<p class="ps-help">좌표는 완성품 한 개의 왼쪽 위 기준입니다. 미리보기의 제품 하나를 클릭하거나 드래그하면 글자 위치를 조정합니다. 각각의 칸에는 다른 사람 데이터가 들어갑니다.</p>',
      '<div class="ps-actions"><button id="mvPreview" type="button" class="ps-btn secondary">출력용지 미리보기</button><button id="mvExport" type="button" class="ps-btn">다단 가변인쇄 PDF 만들기</button><button id="mvStop" type="button" class="ps-btn secondary" disabled>생성 중단</button></div>',
      '<p class="ps-status" role="status" aria-live="polite">원본 PDF와 엑셀 명단을 선택하세요.</p>',
      '<div class="ps-preview"><canvas id="mvCanvas" style="touch-action:none;cursor:crosshair" role="img" aria-label="다단 가변인쇄 미리보기"></canvas></div>',
      '<p class="ps-note">한 번에 최대 300건·출력 용지 100장입니다. 다단은 단면 인쇄 전용이며, PDF 출력 시 실제 크기 100%로 맞추고 첫 용지를 반드시 시험 인쇄하세요. 개인정보가 포함된 명단과 원본 PDF는 서버에 업로드하지 않습니다.</p>'
    ].join(''),
    bind(body,ctx){
      const $=id=>body.querySelector('#'+id);
      let source=null,background=null,sourceDoc=null,sw=255.118,sh=141.732;
      let sourceBox=null;
      let headers=[],records=[],fields=defaults.map((f,i)=>({
        label:f.label,aliases:f.aliases,col:-1,x:f.x,y:f.y,size:f.size,
        bold:i===0,align:'center',face:'gothic',maxWidthMm:80
      }));
      let active=0,drag=null,working=false,stop=false;
      const canvas=$('mvCanvas'),draw=canvas.getContext('2d');
      const status=(m,e=false)=>ctx.setStatus(body,m,e);
      function paper(){
        const preset=PAPER[$('mvPaper').value];
        const landscape=$('mvDir').value==='landscape';
        let w=Number($('mvPaperW').value),h=Number($('mvPaperH').value);
        if(preset){[w,h]=landscape?[preset[1],preset[0]]:preset;}
        if(![w,h].every(Number.isFinite)||w<50||w>500||h<50||h>700)throw Error('용지 크기를 확인하세요.');
        const margin=Number($('mvMargin').value),gap=Number($('mvGap').value);
        const result=grid(Math.max(records.length,1),sw,sh,w*MM,h*MM,margin,gap);
        return result;
      }
      function syncPaper(){
        const preset=PAPER[$('mvPaper').value],rot=$('mvDir').value==='landscape';
        if(preset){
          const [w,h]=rot?[preset[1],preset[0]]:preset;
          $('mvPaperW').value=String(w);$('mvPaperH').value=String(h);
        }
        $('mvPaperW').readOnly=!!preset;$('mvPaperH').readOnly=!!preset;
      }
      function syncFields(){
        $('mvField').replaceChildren();
        fields.forEach((f,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=f.label;$('mvField').appendChild(option);});
        $('mvField').value=String(active);
        $('mvColumn').replaceChildren();
        const empty=document.createElement('option');empty.value='-1';empty.textContent='사용 안 함';$('mvColumn').appendChild(empty);
        headers.forEach((v,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'열 · '+v;$('mvColumn').appendChild(option);});
        const f=fields[active];
        $('mvColumn').value=String(f.col);
        $('mvSize').value=String(f.size);$('mvAlign').value=f.align;$('mvFace').value=f.face;
        $('mvX').value=(f.x*sw/MM).toFixed(1);$('mvY').value=(f.y*sh/MM).toFixed(1);
        $('mvWidth').value=String(f.maxWidthMm);$('mvBold').value=f.bold?'yes':'no';
      }
      function drawText(c,row,scale,ox,oy,highlight){
        c.save();c.textBaseline='middle';c.fillStyle='#172033';
        fields.forEach((f,i)=>{
          const value=fieldText(f,row);
          if(!value)return;
          c.font=(f.bold?'700 ':'400 ')+(f.size*scale)+'px '+(FONT[f.face]||FONT.gothic);
          c.textAlign=f.align;
          const x=ox+f.x*sw*scale,y=oy+f.y*sh*scale;
          const max=Math.min(sw*.96,f.maxWidthMm*MM)*scale;
          c.fillText(value,x,y,max);
          if(highlight===i){
            const width=Math.min(max,c.measureText(value).width);
            const left=x-(f.align==='center'?width/2:f.align==='right'?width:0);
            c.strokeStyle='#2563eb';c.lineWidth=1.2;c.strokeRect(left-2,y-f.size*scale*.65,width+4,f.size*scale*1.3);
          }
        });
        c.restore();
      }
      function drawMarks(ctx,x,y,w,h,length){
        ctx.save();ctx.strokeStyle='#64748b';ctx.lineWidth=.7;
        for(const [cx,cy,dx,dy] of [[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]]){
          ctx.beginPath();ctx.moveTo(cx+dx*length,cy);ctx.lineTo(cx+dx*1,cy);
          ctx.moveTo(cx,cy+dy*length);ctx.lineTo(cx,cy+dy*1);ctx.stroke();
        }ctx.restore();
      }
      function preview(){
        syncPaper();
        let plan;
        try{plan=paper();}
        catch(error){$('mvSummary').textContent=error.message;canvas.width=1;canvas.height=1;return;}
        const total=records.length;
        $('mvSummary').textContent='완성품 '+(sw/MM).toFixed(1)+'×'+(sh/MM).toFixed(1)+'mm · '+plan.cols+'열 × '+plan.rows+'행 · 용지 1장당 '+plan.per+'개 · '+total+'건 → '+(total?Math.ceil(total/plan.per):0)+'장';
        const scale=Math.min(800/plan.paperW,950/plan.paperH,1.5);
        canvas.width=Math.max(1,Math.round(plan.paperW*scale));
        canvas.height=Math.max(1,Math.round(plan.paperH*scale));
        canvas.style.width='100%';canvas.style.height='auto';canvas.style.maxWidth=canvas.width+'px';
        draw.fillStyle='#fff';draw.fillRect(0,0,canvas.width,canvas.height);
        const selected=clamp(Number($('mvPerson').value)||0,0,Math.max(0,total-1));
        const sheet=Math.floor(selected/plan.per);
        const showBackground=source&&background&&$('mvMode').value==='background';
        for(const pos of plan.items(sheet)){
          const x=pos.x*scale,y=pos.y*scale,w=sw*scale,h=sh*scale;
          if(showBackground)draw.drawImage(background,x,y,w,h);
          else{draw.strokeStyle='#d1d5db';draw.strokeRect(x,y,w,h);}
          drawText(draw,records[pos.index]||[],scale,x,y,pos.index===selected?active:-1);
          if($('mvMarks').value==='yes'){
            const max=Math.min(2.3,Math.max(1,plan.gap/MM/2-.5));
            drawMarks(draw,x,y,w,h,max*MM*scale);
          }
        }
      }
      function useRoster(rows){
        headers=(rows.shift()||[]).map(v=>String(v??'').trim());
        records=rows.filter(row=>row.some(v=>String(v??'').trim()));
        if(records.length>MAX_PEOPLE)throw Error('한 번에 최대 300건입니다. 엑셀을 나누어 주세요.');
        if(!headers.length||!records.length)throw Error('첫 줄에 열 제목과 아래 명단이 있어야 합니다.');
        fields.forEach(f=>{f.col=headers.findIndex(h=>f.aliases?.some(a=>h.replace(/\s/g,'').includes(a))||h===f.label);});
        if(fields[0].col<0)fields[0].col=0;
        $('mvPerson').replaceChildren();
        records.forEach((row,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=(i+1)+' · '+String(row[fields[0].col]||'항목');$('mvPerson').appendChild(opt);});
        syncFields();preview();status(records.length+'건을 불러왔습니다. 필드 연결과 배치 위치를 확인하세요.');
      }
      $('mvRoster').addEventListener('change',async()=>{
        const file=$('mvRoster').files?.[0];records=[];headers=[];
        if(!file)return;
        try{
          if(file.size>10*1024*1024)throw Error('명단 파일은 10MB 이하로 선택하세요.');
          let rows;
          if(/\.csv$/i.test(file.name)){
            const bytes=await file.arrayBuffer();
            let decoded=new TextDecoder('utf-8').decode(bytes);
            if(decoded.includes('\uFFFD'))decoded=new TextDecoder('euc-kr').decode(bytes);
            rows=csv(decoded.replace(/^\uFEFF/,''));
          }else if(/\.xlsx?$/i.test(file.name)){
            await ctx.library('xlsx');
            const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
            rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''});
          }else throw Error('엑셀·CSV 형식만 지원합니다.');
          useRoster(rows);
        }catch(error){records=[];status(error.message,true);preview();}
      });
      $('mvPdf').addEventListener('change',async()=>{
        const file=$('mvPdf').files?.[0];source=null;background=null;
        if(sourceDoc){try{await sourceDoc.destroy();}catch(_){ }sourceDoc=null;}
        if(!file)return;
        try{
          if(file.size>30*1024*1024)throw Error('원본 PDF는 최대 30MB입니다.');
          if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')throw Error('PDF 형식만 지원합니다.');
          await ctx.library('pdfjs');
          const bytes=new Uint8Array(await file.arrayBuffer());
          const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(bytes)}).promise;
          if(doc.numPages!==1){await doc.destroy();throw Error('원본 PDF는 정확히 1페이지여야 합니다.');}
          const page=await doc.getPage(1);
          if(((page.rotate||0)%360+360)%360!==0){await doc.destroy();throw Error('원본 PDF의 회전값을 먼저 0도로 정리하세요.');}
          const viewport=page.getViewport({scale:1});
          if(viewport.width<=0||viewport.height<=0||viewport.width>2000||viewport.height>2000){
            await doc.destroy();throw Error('원본 PDF 크기를 확인하세요.');
          }
          if(Number(page.userUnit||1)!==1){await doc.destroy();throw Error('특수 UserUnit PDF는 인쇄 배치 전에 표준 크기로 변환하세요.');}
          const box=Array.isArray(page.view)&&page.view.length===4
            ?page.view:[0,0,viewport.width,viewport.height];
          if(!box.every(Number.isFinite)||box[2]<=box[0]||box[3]<=box[1]){
            await doc.destroy();throw Error('원본 PDF의 표시 영역을 확인하세요.');
          }
          sourceBox={left:box[0],bottom:box[1],right:box[2],top:box[3]};
          sw=viewport.width;sh=viewport.height;
          const factor=Math.min(800/sw,1.5);
          const scaled=page.getViewport({scale:factor});
          const bg=document.createElement('canvas');
          bg.width=Math.max(1,Math.round(scaled.width));bg.height=Math.max(1,Math.round(scaled.height));
          await page.render({canvasContext:bg.getContext('2d'),viewport:scaled}).promise;
          source=bytes;background=bg;sourceDoc=doc;
          syncFields();preview();status('완성품 원본 PDF '+(sw/MM).toFixed(1)+'×'+(sh/MM).toFixed(1)+'mm 불러왔습니다.');
        }catch(error){source=null;background=null;preview();status(error.message,true);}
      });
      $('mvField').addEventListener('change',()=>{active=Number($('mvField').value)||0;syncFields();preview();});
      $('mvPerson').addEventListener('change',preview);
      for(const id of ['mvPaper','mvDir','mvMode','mvMarks','mvPaperW','mvPaperH','mvMargin','mvGap']){
        $(id).addEventListener('change',preview);
      }
      for(const id of ['mvPaperW','mvPaperH','mvMargin','mvGap'])$(id).addEventListener('input',preview);
      $('mvColumn').addEventListener('change',()=>{fields[active].col=Number($('mvColumn').value);preview();});
      $('mvFace').addEventListener('change',()=>{fields[active].face=$('mvFace').value;preview();});
      $('mvAlign').addEventListener('change',()=>{fields[active].align=$('mvAlign').value;preview();});
      $('mvBold').addEventListener('change',()=>{fields[active].bold=$('mvBold').value==='yes';preview();});
      $('mvSize').addEventListener('input',()=>{fields[active].size=clamp(Number($('mvSize').value)||16,6,60);preview();});
      $('mvWidth').addEventListener('input',()=>{fields[active].maxWidthMm=clamp(Number($('mvWidth').value)||80,10,400);preview();});
      function xy(){
        fields[active].x=clamp((Number($('mvX').value)||0)*MM/sw,0,1);
        fields[active].y=clamp((Number($('mvY').value)||0)*MM/sh,0,1);
        preview();
      }
      $('mvX').addEventListener('input',xy);$('mvY').addEventListener('input',xy);
      $('mvAdd').addEventListener('click',()=>{
        if(!headers.length){status('먼저 엑셀 명단을 불러오세요.',true);return;}
        if(fields.length>=20){status('최대 20개 항목까지 추가할 수 있습니다.',true);return;}
        const next=headers.findIndex((_,i)=>!fields.some(f=>f.col===i));
        const col=next>=0?next:0;
        fields.push({label:headers[col]||'항목',col,x:.5,y:.5,size:10,bold:false,align:'center',face:'gothic',maxWidthMm:80});
        active=fields.length-1;syncFields();preview();
      });
      $('mvDelete').addEventListener('click',()=>{
        if(fields.length<=1){status('항목을 하나 이상 유지해야 합니다.',true);return;}
        fields.splice(active,1);active=Math.min(active,fields.length-1);
        syncFields();preview();
      });
      const STORAGE_KEY='program-studio-variable-multi-layout-v1';
      $('mvSave').addEventListener('click',()=>{
        try{localStorage.setItem(STORAGE_KEY,JSON.stringify({sw,sh,fields}));status('문구 위치만 브라우저에 저장했습니다. 개인정보와 PDF 원본은 저장하지 않습니다.');}
        catch(error){status(error.message,true);}
      });
      $('mvLoad').addEventListener('click',()=>{
        try{
          const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
          if(!saved?.fields?.length)throw Error('저장된 위치 설정이 없습니다.');
          if(Math.abs(saved.sw-sw)>.5||Math.abs(saved.sh-sh)>.5)throw Error('원본 PDF 완성 크기가 저장한 작업과 다릅니다.');
          fields=saved.fields.slice(0,20).map(f=>({
            label:String(f.label||'항목').slice(0,50),col:Number.isInteger(f.col)&&f.col<headers.length?f.col:-1,
            x:clamp(Number(f.x)||0,0,1),y:clamp(Number(f.y)||0,0,1),
            size:clamp(Number(f.size)||10,6,60),bold:!!f.bold,
            align:['center','left','right'].includes(f.align)?f.align:'center',
            face:FONT[f.face]?f.face:'gothic',maxWidthMm:clamp(Number(f.maxWidthMm)||80,10,400)
          }));
          active=0;syncFields();preview();status('위치 설정을 불러왔습니다. 엑셀 열 연결을 확인하세요.');
        }catch(error){status(error.message,true);}
      });
      function pointer(event){
        const rect=canvas.getBoundingClientRect();
        if(!rect.width||!rect.height)return null;
        const plan=paper();
        const selected=clamp(Number($('mvPerson').value)||0,0,Math.max(0,records.length-1));
        const x=(event.clientX-rect.left)/rect.width*plan.paperW;
        const y=(event.clientY-rect.top)/rect.height*plan.paperH;
        const sheet=Math.floor(selected/plan.per);
        for(const pos of plan.items(sheet)){
          if(x>=pos.x&&x<=pos.x+sw&&y>=pos.y&&y<=pos.y+sh){
            return {x:(x-pos.x)/sw,y:(y-pos.y)/sh,index:pos.index};
          }
        }
        return null;
      }
      function move(event){
        let pos;try{pos=pointer(event);}catch(_){return;}
        if(!pos||pos.index!==drag)return;
        fields[active].x=clamp(pos.x,0,1);fields[active].y=clamp(pos.y,0,1);
        syncFields();preview();
      }
      canvas.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;
        let pos;try{pos=pointer(event);}catch(_){return;}
        if(!pos)return;
        $('mvPerson').value=String(pos.index);drag=pos.index;
        canvas.setPointerCapture?.(event.pointerId);move(event);
      });
      canvas.addEventListener('pointermove',event=>{if(drag!==null)move(event);});
      for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{drag=null;});
      $('mvPreview').addEventListener('click',()=>{preview();status('선택한 사람의 출력 용지를 미리보기로 표시했습니다.');});
      $('mvStop').addEventListener('click',()=>{stop=true;status('현재 처리 중인 인쇄물을 마치면 생성이 중단됩니다.');});
      $('mvExport').addEventListener('click',async()=>{
        if(working)return;
        if(!source||!records.length){status('원본 PDF와 엑셀 명단을 먼저 불러오세요.',true);return;}
        if(!fields.some(f=>f.col>=0)){status('엑셀 열을 하나 이상 연결하세요.',true);return;}
        let plan;try{plan=paper();}catch(error){status(error.message,true);return;}
        const list=records.map(row=>[...row]),mapping=fields.map(f=>({...f}));
        const bytes=new Uint8Array(source),width=sw,height=sh;
        const box={...sourceBox};
        const contentMode=$('mvMode').value,marks=$('mvMarks').value==='yes';
        working=true;stop=false;
        body.querySelectorAll('input,select,button').forEach(node=>{node.disabled=node.id!=='mvStop';});
        canvas.style.pointerEvents='none';
        try{
          status('다단 가변인쇄 PDF 생성 준비 중...');
          await ctx.library('pdf');
          if(document.fonts?.ready){
            await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1000))]);
          }
          const pdf=await window.PDFLib.PDFDocument.create();
          let artwork=null;
          if(contentMode==='background'){
            // PDF.js previews the visible CropBox / MediaBox intersection.
            // Embed that SAME region at the origin to avoid shifted artwork
            // on templates with a cropped or non-zero MediaBox.
            const original=await window.PDFLib.PDFDocument.load(bytes);
            artwork=await pdf.embedPage(original.getPage(0),box,
              [1,0,0,1,-box.left,-box.bottom]);
          }
          const temp=document.createElement('canvas');temp.width=1;temp.height=1;
          const cache=new Map(),pixelScale=DPI/72;
          async function embedText(f,value){
            const key=JSON.stringify([value,f.face,f.size,f.bold,f.align,f.maxWidthMm]);
            if(cache.has(key))return cache.get(key);
            let c=temp.getContext('2d',{alpha:true});
            const fontPx=f.size*pixelScale;
            c.font=(f.bold?'700 ':'400 ')+fontPx+'px '+(FONT[f.face]||FONT.gothic);
            const limit=Math.min(width*.96,f.maxWidthMm*MM)*pixelScale;
            const textWidth=Math.max(1,Math.min(c.measureText(value).width,limit));
            const pad=Math.max(5,Math.ceil(fontPx*.35));
            temp.width=Math.ceil(textWidth+pad*2);
            temp.height=Math.ceil(fontPx*1.6+pad*2);
            if(temp.width*temp.height>5000000)throw Error('글자 크기가 너무 큽니다.');
            c=temp.getContext('2d',{alpha:true});
            c.fillStyle='#172033';c.textBaseline='middle';c.textAlign=f.align;
            c.font=(f.bold?'700 ':'400 ')+fontPx+'px '+(FONT[f.face]||FONT.gothic);
            c.fillText(value,f.align==='left'?pad:f.align==='right'?temp.width-pad:temp.width/2,temp.height/2,textWidth);
            const blob=await new Promise((resolve,reject)=>temp.toBlob(x=>x?resolve(x):reject(Error('가변 글자 이미지 생성 실패')),'image/png'));
            const image=await pdf.embedPng(await blob.arrayBuffer());
            const result={image,width:temp.width/pixelScale,height:temp.height/pixelScale,pad:pad/pixelScale};
            cache.set(key,result);return result;
          }
          function cropMarks(page,pos){
            const x=pos.x,y=plan.paperH-pos.y-height;
            const length=Math.min(2.3,Math.max(1,plan.gap/MM/2-.5))*MM;
            const inset=.25*MM,col=window.PDFLib.rgb(.45,.48,.52);
            const corners=[[x,y,-1,-1],[x+width,y,1,-1],[x,y+height,-1,1],[x+width,y+height,1,1]];
            for(const [cx,cy,dx,dy] of corners){
              page.drawLine({start:{x:cx+dx*inset,y:cy},end:{x:cx+dx*length,y:cy},thickness:.35,color:col});
              page.drawLine({start:{x:cx,y:cy+dy*inset},end:{x:cx,y:cy+dy*length},thickness:.35,color:col});
            }
          }
          for(let sheet=0;sheet<Math.ceil(list.length/plan.per);sheet++){
            if(stop)throw Error('사용자가 생성을 중단했습니다.');
            const page=pdf.addPage([plan.paperW,plan.paperH]);
            for(const pos of plan.items(sheet)){
              if(stop)throw Error('사용자가 생성을 중단했습니다.');
              const bottom=plan.paperH-pos.y-height;
              if(artwork)page.drawPage(artwork,{x:pos.x,y:bottom,width,height});
              for(const f of mapping){
                const value=fieldText(f,list[pos.index]);if(!value)continue;
                const img=await embedText(f,value);
                const anchor=pos.x+f.x*width;
                const x=f.align==='center'?anchor-img.width/2:f.align==='left'?anchor-img.pad:anchor-img.width+img.pad;
                page.drawImage(img.image,{x,y:plan.paperH-(pos.y+f.y*height)-img.height/2,width:img.width,height:img.height});
              }
              if(marks)cropMarks(page,pos);
            }
            status('가변인쇄 출력 용지 '+(sheet+1)+' / '+Math.ceil(list.length/plan.per)+'장 생성 중');
          }
          temp.width=1;temp.height=1;
          if(stop)throw Error('사용자가 생성을 중단했습니다.');
          const result=await pdf.save({useObjectStreams:true});
          ctx.download(result,'가변데이터_다단_'+list.length+'건.pdf');
          status('완료: '+list.length+'건 · '+Math.ceil(list.length/plan.per)+'장 PDF. 실제 크기 100%로 출력하세요.');
        }catch(error){status('생성 실패: '+error.message,true);}
        finally{
          working=false;body.querySelectorAll('input,select,button').forEach(node=>{node.disabled=node.id==='mvStop';});
          canvas.style.pointerEvents='auto';
        }
      });
      syncPaper();syncFields();preview();
    }
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();