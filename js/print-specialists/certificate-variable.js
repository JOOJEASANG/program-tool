// Variable-data certificates: use an original single-page PDF and an Excel/CSV
// roster to generate one PDF page per person. All personal data stays in the browser.
(function(){
  'use strict';
  if(window.__certificateVariablePrintV1)return;
  window.__certificateVariablePrintV1=true;
  const MAX_PDF=30*1024*1024, MAX_ROSTER=10*1024*1024, MAX_PEOPLE=300;
  const dpi=300, ptPerMm=72/25.4, layoutKey='program-studio-certificate-layout-v1';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const number=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const defaults=[
    {label:'이름',aliases:['성명','이름','학생명'],x:.5,y:.34,size:24,bold:true,align:'center'},
    {label:'생년월일',aliases:['생년월일','생일','출생'],x:.5,y:.41,size:13,bold:false,align:'center'},
    {label:'학년',aliases:['학년','학급','학년반'],x:.5,y:.48,size:13,bold:false,align:'center'},
    {label:'상장번호',aliases:['상장번호','증서번호','번호'],x:.5,y:.14,size:11,bold:false,align:'center'}
  ];
  function parseCsv(source){
    const rows=[],line=[];let field='',quoted=false;
    for(let i=0;i<source.length;i++){
      const c=source[i];
      if(c==='"'&&quoted&&source[i+1]==='"'){field+='"';i++;continue;}
      if(c==='"'){quoted=!quoted;continue;}
      if(!quoted&&(c===','||c==='\n'||c==='\r')){
        line.push(field);field='';
        if(c!==','){if(c==='\r'&&source[i+1]==='\n')i++;rows.push(line.splice(0));}
      }else field+=c;
    }
    if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');
    line.push(field);if(line.some(x=>String(x).trim()))rows.push(line);
    return rows;
  }
  function sanitizeFields(fields){
    return fields.map(field=>({
      label:String(field.label||'항목').slice(0,50),
      column:Number.isInteger(field.column)?field.column:-1,
      x:clamp(number(field.x,.5),0,1),
      y:clamp(number(field.y,.5),0,1),
      size:clamp(number(field.size,15),8,80),
      bold:field.bold===true,
      align:['left','center','right'].includes(field.align)?field.align:'center',
      face:['gothic','serif','malgun'].includes(field.face)?field.face:'gothic',
      maxWidthMm:clamp(number(field.maxWidthMm,160),20,400)
    }));
  }
  function fontFamily(face){
    if(face==='serif')return '"Batang","Noto Serif KR",serif';
    if(face==='malgun')return '"Malgun Gothic","Noto Sans KR",sans-serif';
    return '"Pretendard","Noto Sans KR","Malgun Gothic",sans-serif';
  }
  function load(){
    if(!window.PrintSpecialistUi)return setTimeout(load,80);
    const ui=window.PrintSpecialistUi;
    ui.register('certificates',{
      title:'상장 · 수료증 가변데이터 인쇄',
      description:'상장 PDF 한 장 + 엑셀 명단 → 사람별 상장 PDF 자동 생성',
      markup:[
        '<p class="ps-help">상장 원본 PDF 1페이지와 엑셀 명단을 불러온 뒤 열을 연결하세요. 미리보기에서 문구를 클릭하거나 드래그해 정확한 위치를 지정합니다. 사람마다 한 페이지씩 300dpi 한글 인쇄 PDF를 생성합니다.</p>',
        '<div class="ps-fields">',
        '<label class="wide">상장 원본 PDF (1페이지, 최대 30MB)<input id="cvPdf" type="file" accept=".pdf,application/pdf"></label>',
        '<label class="wide">엑셀·CSV 명단 (첫 줄에 열 제목, 최대 10MB)<input id="cvRoster" type="file" accept=".xlsx,.xls,.csv,text/csv"></label>',
        '<label>출력 내용<select id="cvMode"><option value="background">상장 원본 + 학생별 데이터</option><option value="only">학생별 데이터만 · 기성 상장용지 인쇄</option></select></label>',
        '<label>미리보기 사람<select id="cvPerson"><option value="0">명단을 불러오세요</option></select></label>',
        '<label>표시 항목<select id="cvField"><option value="0">이름</option></select></label>',
        '<label>연결할 엑셀 열<select id="cvColumn"><option value="-1">사용 안 함</option></select></label>',
        '<label>글꼴<select id="cvFace"><option value="gothic">고딕체</option><option value="malgun">맑은 고딕</option><option value="serif">명조체</option></select></label>',
        '<label>글자 크기(pt)<input id="cvSize" type="number" value="24" min="8" max="80" step="1"></label>',
        '<label>정렬<select id="cvAlign"><option value="center">가운데</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></label>',
        '<label>X 위치 (mm)<input id="cvX" type="number" min="0" max="500" step=".5" value="105"></label>',
        '<label>Y 위치 (mm)<input id="cvY" type="number" min="0" max="500" step=".5" value="100"></label>',
        '<label>최대 글자폭 (mm)<input id="cvWidth" type="number" min="20" max="400" step="1" value="160"></label>',
        '<label>굵게 표시<select id="cvBold"><option value="yes">굵게</option><option value="no">보통</option></select></label>',
        '</div>',
        '<div class="ps-actions"><button type="button" id="cvAdd" class="ps-btn secondary">엑셀 열 항목 추가</button><button type="button" id="cvRemove" class="ps-btn secondary">선택 항목 삭제</button><button type="button" id="cvSave" class="ps-btn secondary">위치 설정 저장</button><button type="button" id="cvRestore" class="ps-btn secondary">위치 설정 불러오기</button></div>',
        '<p class="ps-help">좌표는 상장 왼쪽 위 기준입니다. 미리보기에서 글자를 끌어놓거나 빈 곳을 클릭하면 현재 선택 항목이 이동합니다. 개인정보가 들어 있는 명단과 PDF 원본은 서버로 업로드하지 않습니다.</p>',
        '<div class="ps-actions"><button type="button" id="cvPreview" class="ps-btn secondary">상장 미리보기</button><button type="button" id="cvRun" class="ps-btn">명단 전체 상장 PDF 만들기</button><button type="button" id="cvCancel" class="ps-btn secondary" disabled>생성 중단</button></div>',
        '<p class="ps-status" role="status" aria-live="polite">상장 원본 PDF와 엑셀 명단을 선택하세요.</p>',
        '<div class="ps-preview" id="cvCanvasBox"><canvas id="cvCanvas" role="img" aria-label="상장 데이터 위치 조정 미리보기" style="touch-action:none;cursor:crosshair"></canvas></div>',
        '<p class="ps-note">한 번에 최대 300명까지 생성합니다. PDF 배경은 가능한 한 벡터로 유지하고 한글 데이터는 300dpi 투명 이미지로 합성합니다. 기성 상장용지는 데이터만 인쇄를 선택해 시험 출력으로 위치를 검증하세요.</p>'
      ].join(''),
      bind(body,ctx){
        const $=id=>body.querySelector('#'+id);
        const canvas=$('cvCanvas'),view=canvas.getContext('2d');
        let pdfBytes=null,sourceDoc=null,background=null,sourceW=595.28,sourceH=841.89;
        let headers=[],records=[],fields=sanitizeFields(defaults.map(f=>Object.assign({},f,{column:-1,face:'gothic',maxWidthMm:160})));
        let active=0,dragging=false,canceled=false,working=false;
        function field(){return fields[active];}
        function status(message,error=false){ctx.setStatus(body,message,error);}
        function fieldValue(item,record){
          if(!record||item.column<0)return '';
          return String(record[item.column]??'').trim();
        }
        function selectedRow(){return records[clamp(number($('cvPerson').value),0,Math.max(0,records.length-1))]||[];}
        function xMm(f){return +(f.x*sourceW/ptPerMm).toFixed(1);}
        function yMm(f){return +(f.y*sourceH/ptPerMm).toFixed(1);}
        function updateFieldSelect(){
          $('cvField').replaceChildren();
          fields.forEach((f,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=f.label;$('cvField').appendChild(o);});
          $('cvField').value=String(active);
        }
        function updateColumnSelect(){
          const node=$('cvColumn');
          node.replaceChildren();
          const off=document.createElement('option');off.value='-1';off.textContent='사용 안 함';node.appendChild(off);
          headers.forEach((v,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=String(i+1)+'열 · '+v;node.appendChild(option);});
          node.value=String(field().column>=0&&field().column<headers.length?field().column:-1);
        }
        function updateInputs(){
          if(!field())return;
          $('cvField').value=String(active);
          updateColumnSelect();
          $('cvFace').value=field().face;
          $('cvSize').value=String(field().size);
          $('cvAlign').value=field().align;
          $('cvX').value=String(xMm(field()));
          $('cvY').value=String(yMm(field()));
          $('cvWidth').value=String(field().maxWidthMm);
          $('cvBold').value=field().bold?'yes':'no';
        }
        function drawFields(target,record,scale,highlight=false){
          target.save();
          target.textBaseline='middle';
          fields.forEach((f,i)=>{
            const value=fieldValue(f,record);
            if(!value)return;
            target.textAlign=f.align;
            target.fillStyle='#172033';
            target.font=(f.bold?'700 ':'400 ')+Math.round(f.size*scale*100)/100+'px '+fontFamily(f.face);
            const x=f.x*sourceW*scale,y=f.y*sourceH*scale;
            const max=Math.min(sourceW*scale*.97,f.maxWidthMm*ptPerMm*scale);
            target.fillText(value,x,y,max);
            if(highlight&&i===active){
              const width=Math.min(max,target.measureText(value).width);
              const left=f.align==='center'?x-width/2:f.align==='right'?x-width:x;
              target.strokeStyle='#2563eb';target.lineWidth=1.5;target.setLineDash([5,3]);
              target.strokeRect(left-3,y-f.size*scale*.7,width+6,f.size*scale*1.4);
              target.setLineDash([]);
            }
          });
          target.restore();
        }
        function preview(){
          const ratio=Math.min(800/sourceW,1.45);
          canvas.width=Math.max(1,Math.round(sourceW*ratio));
          canvas.height=Math.max(1,Math.round(sourceH*ratio));
          canvas.style.width='100%';canvas.style.maxWidth=canvas.width+'px';canvas.style.height='auto';
          view.fillStyle='#fff';view.fillRect(0,0,canvas.width,canvas.height);
          if(pdfBytes&&background&&$('cvMode').value==='background'){
            view.drawImage(background,0,0,canvas.width,canvas.height);
          }
          drawFields(view,selectedRow(),canvas.width/sourceW,true);
        }
        function findColumn(aliases){
          return headers.findIndex(name=>aliases.some(alias=>name.replace(/\s/g,'').includes(alias)));
        }
        function applyAutoColumns(){
          fields.forEach(f=>{
            const def=defaults.find(d=>d.label===f.label);
            if(def)f.column=findColumn(def.aliases);
            else f.column=headers.indexOf(f.label);
          });
          if(fields[0].column<0&&headers.length)fields[0].column=0;
          updateInputs();
        }
        function parseRoster(rows){
          headers=(rows.shift()||[]).map(v=>String(v??'').trim());
          records=rows.filter(row=>Array.isArray(row)&&row.some(v=>String(v??'').trim()));
          if(records.length>MAX_PEOPLE)throw Error('상장 자동 인쇄는 한 번에 최대 '+MAX_PEOPLE+'명입니다. 명단을 나눠서 출력하세요.');
          if(!records.length||!headers.length)throw Error('엑셀 첫 행에 열 제목과 학생 데이터가 필요합니다.');
          applyAutoColumns();
          $('cvPerson').replaceChildren();
          records.forEach((row,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+' · '+String(row[fields[0].column]||'학생').slice(0,40);$('cvPerson').appendChild(o);});
          status(records.length+'명 불러왔습니다. 상장 문구 위치를 조정하고 미리보기를 확인하세요.');
          preview();
        }
        $('cvRoster').addEventListener('change',async()=>{
          const file=$('cvRoster').files?.[0];records=[];headers=[];
          if(!file)return;
          try{
            if(file.size>MAX_ROSTER)throw Error('엑셀 명단은 10MB 이하여야 합니다.');
            let grid;
            if(/\.csv$/i.test(file.name)){
              const bytes=await file.arrayBuffer();let decoded=new TextDecoder('utf-8').decode(bytes);
              if(decoded.includes('\uFFFD'))decoded=new TextDecoder('euc-kr').decode(bytes);
              grid=parseCsv(decoded.replace(/^\uFEFF/,''));
            }else if(/\.xlsx?$/i.test(file.name)){
              await ctx.library('xlsx');
              const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
              grid=window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,defval:'',raw:false});
            }else throw Error('엑셀 또는 CSV 파일을 선택하세요.');
            parseRoster(grid);
          }catch(error){records=[];status(error.message,true);preview();}
        });
        $('cvPdf').addEventListener('change',async()=>{
          const file=$('cvPdf').files?.[0];pdfBytes=null;background=null;
          if(sourceDoc){try{await sourceDoc.destroy();}catch(_){ }sourceDoc=null;}
          if(!file)return;
          try{
            if(file.size>MAX_PDF)throw Error('상장 PDF는 30MB 이하여야 합니다.');
            if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')throw Error('PDF 파일만 선택하세요.');
            await ctx.library('pdfjs');
            pdfBytes=new Uint8Array(await file.arrayBuffer());
            const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(pdfBytes)}).promise;
            if(doc.numPages!==1){await doc.destroy();throw Error('상장 원본은 1페이지 PDF만 지원합니다.');}
            const page=await doc.getPage(1);
            if(((page.rotate||0)%360+360)%360!==0){await doc.destroy();throw Error('회전된 PDF 원본은 PDF배치에서 먼저 0도로 정리한 뒤 사용하세요.');}
            const viewport=page.getViewport({scale:1});
            sourceW=viewport.width;sourceH=viewport.height;
            if(sourceW<=0||sourceH<=0||sourceW>2000||sourceH>2000){await doc.destroy();throw Error('지원하지 않는 상장 용지 크기입니다.');}
            const scale=Math.min(950/sourceW,1.5);
            const backgroundCanvas=document.createElement('canvas'),v=page.getViewport({scale});
            backgroundCanvas.width=Math.round(v.width);backgroundCanvas.height=Math.round(v.height);
            await page.render({canvasContext:backgroundCanvas.getContext('2d'),viewport:v}).promise;
            background=backgroundCanvas;sourceDoc=doc;
            updateInputs();preview();status('상장 원본을 불러왔습니다. '+(sourceW/ptPerMm).toFixed(1)+'×'+(sourceH/ptPerMm).toFixed(1)+'mm');
          }catch(error){pdfBytes=null;background=null;status('상장 PDF: '+error.message,true);preview();}
        });
        $('cvField').addEventListener('change',()=>{active=Number($('cvField').value)||0;updateInputs();preview();});
        $('cvPerson').addEventListener('change',preview);
        $('cvMode').addEventListener('change',preview);
        $('cvColumn').addEventListener('change',()=>{field().column=Number($('cvColumn').value);preview();});
        $('cvFace').addEventListener('change',()=>{field().face=$('cvFace').value;preview();});
        $('cvAlign').addEventListener('change',()=>{field().align=$('cvAlign').value;preview();});
        $('cvBold').addEventListener('change',()=>{field().bold=$('cvBold').value==='yes';preview();});
        $('cvSize').addEventListener('input',()=>{field().size=clamp(number($('cvSize').value,15),8,80);preview();});
        $('cvWidth').addEventListener('input',()=>{field().maxWidthMm=clamp(number($('cvWidth').value,160),20,400);preview();});
        function coordinateEdit(){
          field().x=clamp(number($('cvX').value,0)*ptPerMm/sourceW,0,1);
          field().y=clamp(number($('cvY').value,0)*ptPerMm/sourceH,0,1);
          preview();
        }
        $('cvX').addEventListener('input',coordinateEdit);
        $('cvY').addEventListener('input',coordinateEdit);
        $('cvAdd').addEventListener('click',()=>{
          if(!headers.length){status('엑셀 명단을 먼저 불러오세요.',true);return;}
          if(fields.length>=20){status('한 장에 최대 20개 항목을 배치할 수 있습니다.',true);return;}
          const unused=headers.findIndex((_,index)=>!fields.some(f=>f.column===index));
          const idx=unused<0?0:unused;
          fields.push({label:headers[idx]||'추가 항목',column:idx,x:.5,y:.55,size:14,bold:false,align:'center',face:'gothic',maxWidthMm:160});
          active=fields.length-1;updateFieldSelect();updateInputs();preview();
        });
        $('cvRemove').addEventListener('click',()=>{
          if(fields.length<=1){status('표시 항목은 최소 하나가 필요합니다.',true);return;}
          fields.splice(active,1);active=Math.min(active,fields.length-1);
          updateFieldSelect();updateInputs();preview();
        });
        $('cvSave').addEventListener('click',()=>{
          try{localStorage.setItem(layoutKey,JSON.stringify({fields,sourceW,sourceH}));status('위치와 글꼴 설정을 이 브라우저에 저장했습니다. 명단과 상장 PDF는 저장하지 않습니다.');}
          catch(e){status('설정을 저장하지 못했습니다: '+e.message,true);}
        });
        $('cvRestore').addEventListener('click',()=>{
          try{
            const saved=JSON.parse(localStorage.getItem(layoutKey)||'null');
            if(!saved?.fields||!Array.isArray(saved.fields)||!saved.fields.length)throw Error('저장된 위치 설정이 없습니다.');
            if(Math.abs(saved.sourceW-sourceW)>.5||Math.abs(saved.sourceH-sourceH)>.5)throw Error('저장 당시 상장과 용지 크기가 다릅니다.');
            fields=sanitizeFields(saved.fields.slice(0,20));
            fields.forEach(f=>{if(f.column>=headers.length)f.column=-1;});
            active=0;updateFieldSelect();updateInputs();preview();status('저장한 위치와 글꼴을 불러왔습니다. 엑셀 열 연결을 확인하세요.');
          }catch(e){status(e.message,true);}
        });
        function move(event){
          const box=canvas.getBoundingClientRect();
          if(!box.width||!box.height)return;
          field().x=clamp((event.clientX-box.left)/box.width,0,1);
          field().y=clamp((event.clientY-box.top)/box.height,0,1);
          updateInputs();preview();
        }
        canvas.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;
          const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
          let closest=-1,dist=.07;
          fields.forEach((f,i)=>{const d=Math.hypot(f.x-x,f.y-y);if(d<dist){dist=d;closest=i;}});
          if(closest>=0){active=closest;updateInputs();}
          dragging=true;canvas.setPointerCapture?.(event.pointerId);move(event);
        });
        canvas.addEventListener('pointermove',event=>{if(dragging)move(event);});
        canvas.addEventListener('pointerup',()=>{dragging=false;});
        canvas.addEventListener('pointercancel',()=>{dragging=false;});
        $('cvPreview').addEventListener('click',()=>{
          if(!pdfBytes||!records.length){status('상장 PDF와 엑셀 명단을 먼저 불러오세요.',true);return;}
          preview();status(($('cvPerson').selectedIndex+1)+'번째 상장 미리보기입니다. 위치를 확인하세요.');
        });
        $('cvCancel').addEventListener('click',()=>{canceled=true;status('현재 페이지 처리가 끝나면 생성이 중단됩니다.');});
        $('cvRun').addEventListener('click',async()=>{
          if(working)return;
          if(!pdfBytes||!records.length){status('상장 PDF와 엑셀 명단을 먼저 불러오세요.',true);return;}
          if(!fields.some(f=>f.column>=0)){status('최소 한 개 항목의 엑셀 열을 연결하세요.',true);return;}
          working=true;canceled=false;
          $('cvRun').disabled=true;$('cvPreview').disabled=true;$('cvCancel').disabled=false;
          try{
            status('상장 PDF 생성 준비 중...');
            await ctx.library('pdf');
            // Network fonts may never settle on an offline print workstation.
            // Do not hold a 100-person batch forever waiting for web fonts.
            if(document.fonts?.ready){
              await Promise.race([
                document.fonts.ready,
                new Promise(resolve=>setTimeout(resolve,1000))
              ]);
            }
            const output=await window.PDFLib.PDFDocument.create();
            // Embed one original page once: preserve vector backgrounds instead
            // of rasterizing the template 100 times.
            let embedded=null;
            if($('cvMode').value==='background'){
              const pages=await output.embedPdf(pdfBytes,[0]);embedded=pages[0];
            }
            // Render only the variable TEXT bounding boxes at 300dpi.
            // A full A4 transparent bitmap for every award is needlessly slow
            // and memory-heavy at 100+ recipients.
            const pixelScale=dpi/72;
            const overlay=document.createElement('canvas');
            overlay.width=1;overlay.height=1;
            const textCache=new Map();
            async function imageForText(f,value){
              const key=JSON.stringify([f.size,f.bold,f.face,f.align,f.maxWidthMm,value]);
              if(textCache.has(key))return textCache.get(key);
              let layer=overlay.getContext('2d',{alpha:true});
              const px=f.size*pixelScale;
              const font=(f.bold?'700 ':'400 ')+px+'px '+fontFamily(f.face);
              layer.font=font;
              const limitPx=Math.min(sourceW*.97,f.maxWidthMm*ptPerMm)*pixelScale;
              const textWidth=Math.max(1,Math.min(limitPx,layer.measureText(value).width));
              const pad=Math.max(6,Math.ceil(px*.35));
              overlay.width=Math.ceil(textWidth+pad*2);
              overlay.height=Math.ceil(px*1.6+pad*2);
              if(overlay.width*overlay.height>5000000)throw Error('문구 크기나 글자폭이 너무 큽니다.');
              layer=overlay.getContext('2d',{alpha:true});
              layer.font=font;layer.textBaseline='middle';layer.textAlign=f.align;layer.fillStyle='#172033';
              const anchor=f.align==='left'?pad:f.align==='right'?overlay.width-pad:overlay.width/2;
              layer.fillText(value,anchor,overlay.height/2,textWidth);
              const blob=await new Promise((resolve,reject)=>overlay.toBlob(b=>b?resolve(b):reject(Error('한글 글자 이미지 생성에 실패했습니다.')),'image/png'));
              const image=await output.embedPng(await blob.arrayBuffer());
              const result={image,width:overlay.width/pixelScale,height:overlay.height/pixelScale,pad:pad/pixelScale};
              textCache.set(key,result);
              return result;
            }
            for(let i=0;i<records.length;i++){
              if(canceled)throw Error('사용자 요청으로 생성이 중단됐습니다.');
              const page=output.addPage([sourceW,sourceH]);
              if(embedded)page.drawPage(embedded,{x:0,y:0,width:sourceW,height:sourceH});
              for(const f of fields){
                const value=fieldValue(f,records[i]);
                if(!value)continue;
                const image=await imageForText(f,value);
                const anchorX=f.x*sourceW,anchorY=f.y*sourceH;
                const x=f.align==='center'?anchorX-image.width/2:
                  f.align==='left'?anchorX-image.pad:anchorX-image.width+image.pad;
                page.drawImage(image.image,{
                  x,y:sourceH-anchorY-image.height/2,
                  width:image.width,height:image.height
                });
              }
              if(i%5===0||i===records.length-1){
                status('상장 생성 중 '+(i+1)+' / '+records.length+'명');
                await new Promise(resolve=>setTimeout(resolve,0));
              }
            }
            overlay.width=1;overlay.height=1;
            if(canceled)throw Error('사용자 요청으로 생성이 중단됐습니다.');
            const bytes=await output.save({useObjectStreams:true});
            ctx.download(bytes,'상장_가변데이터_'+records.length+'명.pdf');
            status(records.length+'명 상장 PDF가 완성됐습니다. 출력은 실제 크기 100%로 설정하세요.');
          }catch(error){status('생성 실패: '+error.message,true);}
          finally{working=false;$('cvRun').disabled=false;$('cvPreview').disabled=false;$('cvCancel').disabled=true;}
        });
        updateFieldSelect();updateInputs();preview();
      }
    });
    function launch(){
      if(document.getElementById('cvLaunch'))return true;
      const host=document.querySelector('.sidebar .first-panel');
      if(!host)return false;
      const button=document.createElement('button');button.type='button';button.id='cvLaunch';
      button.className='ps-launch';button.textContent='상장·수료증 가변데이터 출력 · 엑셀 100명';
      button.addEventListener('click',()=>ui.open('certificates'));host.appendChild(button);return true;
    }
    if(!launch()){let tries=0;const timer=setInterval(()=>{if(launch()||++tries>70)clearInterval(timer);},80);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
