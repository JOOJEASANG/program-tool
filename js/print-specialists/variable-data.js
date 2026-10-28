// Excel/CSV variable printing: multiple unique names or codes on cut-ready sheets.
(function(){
'use strict';
function install(){
  if(!window.PrintSpecialistUi)return setTimeout(install,80);
  const ui=window.PrintSpecialistUi;
  ui.register('variable',{
    title:'엑셀 명단 자동 출력',
    description:'엑셀 명단 → 명찰·번호표·쿠폰 자동 배치 → 재단선 포함 PDF',
    markup:[
      '<div class="ps-fields">',
      '<label class="wide">명단 불러오기 (.xlsx / .xls / .csv)<input id="pvFile" type="file" accept=".xlsx,.xls,.csv,text/csv"></label>',
      '<label>이름·번호 열<select id="pvName"><option value="0">첫 번째 열</option></select></label>',
      '<label>보조 문구 열<select id="pvSub"><option value="-1">사용 안 함</option></select></label>',
      '<label>QR 주소 열<select id="pvQr"><option value="-1">사용 안 함</option></select></label>',
      '<label>출력 용지<select id="pvPaper"><option value="A4">A4 · 210×297mm</option><option value="A3">A3 · 297×420mm</option></select></label>',
      '<label>제품 가로 (mm)<input id="pvW" type="number" value="90" min="20" max="210" step="1"></label>',
      '<label>제품 세로 (mm)<input id="pvH" type="number" value="50" min="20" max="290" step="1"></label>',
      '<label>바깥 여백 (mm)<input id="pvMargin" type="number" value="5" min="3" max="25" step=".5"></label>',
      '<label>제품 간격 (mm)<input id="pvGap" type="number" value="5" min="4" max="25" step=".5"></label>',
      '<label>이름 글자 크기 (pt)<input id="pvFont" type="number" value="18" min="9" max="60"></label>',
      '<label>한글 제목·번호 폰트<select id="pvTypeface"><option value="Noto Sans KR">고딕체</option><option value="Malgun Gothic">맑은 고딕</option><option value="serif">명조체</option></select></label>',
      '<label>재단 표시<select id="pvMarks"><option value="yes">표시</option><option value="no">표시 안 함</option></select></label>',
      '</div>',
      '<p class="ps-help">첫 줄은 열 제목으로 인식합니다. 각 행에서 이름과 보조 문구·QR주소를 읽습니다. QR 주소가 없으면 QR은 생성하지 않습니다. 미리보기와 결과 PDF는 300dpi로 제작하며 인쇄 배율을 실제 크기 100%로 설정하세요.</p>',
      '<div class="ps-actions"><button class="ps-btn secondary" id="pvPreview" type="button">첫 장 미리보기</button><button class="ps-btn" id="pvRun" type="button">명단 전체 PDF 만들기</button></div>',
      '<p class="ps-status" role="status" aria-live="polite">엑셀 또는 CSV 파일을 선택하세요.</p>',
      '<div class="ps-preview" id="pvCanvasBox">미리보기가 표시됩니다.</div>',
      '<p class="ps-note">모든 명단은 현재 브라우저에서 처리됩니다. 한 번에 최대 1,000명·100장까지 처리합니다. 개인정보가 포함된 결과 PDF는 안전하게 관리하세요.</p>'
    ].join(''),
    bind(body,ctx){
      const $=id=>body.querySelector('#'+id);
      let rows=[],head=[],qrCache=new Map();
      function val(id){return Number($(id).value);}
      const papers={A4:[210,297],A3:[297,420]};
      function settings(){
        const w=val('pvW'),h=val('pvH'),margin=val('pvMargin'),gap=val('pvGap'),paper=papers[$('pvPaper').value],font=val('pvFont');
        if(![w,h,margin,gap,font].every(Number.isFinite)||w<20||h<20||margin<3||gap<4)throw Error('제품 크기·여백·간격 입력값을 확인하세요.');
        const cols=Math.floor((paper[0]-2*margin+gap)/(w+gap));
        const lines=Math.floor((paper[1]-2*margin+gap)/(h+gap));
        if(cols<=0||lines<=0)throw Error('선택한 출력 용지에 제품이 들어가지 않습니다. 크기를 줄이세요.');
        const total=Math.ceil(rows.length/(cols*lines));
        if(total>100)throw Error('최대 100장까지만 한 번에 처리합니다. 명단을 나누세요.');
        return {w,h,margin,gap,font,paper,cols,lines,total,per:cols*lines,marks:$('pvMarks').value==='yes',face:$('pvTypeface').value,
          name:val('pvName'),sub:val('pvSub'),qr:val('pvQr')};
      }
      function textCell(row,index){return index>=0?String(row[index]??'').trim():'';}
      function populate(){
        for(const id of ['pvName','pvSub','pvQr']){
          const sel=$(id),optional=id!=='pvName';
          sel.innerHTML=optional?'<option value="-1">사용 안 함</option>':'';
          head.forEach((label,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'열 · '+(label||'이름 없음');sel.appendChild(o);});
          sel.value=optional?'-1':'0';
        }
      }
      function parseCsv(raw){
        const cells=[],result=[];let v='',inQuotes=false;
        for(let i=0;i<raw.length;i++){const c=raw[i];
          if(c==='"'&&raw[i+1]==='"'&&inQuotes){v+='"';i++;continue;}
          if(c==='"'){inQuotes=!inQuotes;continue;}
          if(!inQuotes&&(c===','||c==='\n'||c==='\r')){
            cells.push(v);v='';
            if(c!==','){if(c==='\r'&&raw[i+1]==='\n')i++;result.push(cells.splice(0));}
          }else v+=c;
        }
        cells.push(v);if(cells.some(Boolean))result.push(cells);
        return result;
      }
      $('pvFile').addEventListener('change',async()=>{
        const file=$('pvFile').files?.[0];rows=[];head=[];qrCache.clear();if(!file)return;
        try{
          if(file.size>10*1024*1024)throw Error('명단 파일은 10MB 이하로 선택하세요.');
          let sheet;
          if(/\.csv$/i.test(file.name)){
            const buffer=await file.arrayBuffer();let decoded=new TextDecoder('utf-8').decode(buffer);
            // Korean Excel CSV is often encoded as CP949/EUC-KR.
            if(decoded.includes('\uFFFD'))decoded=new TextDecoder('euc-kr').decode(buffer);
            sheet=parseCsv(decoded.replace(/^\uFEFF/,''));
          }else{
            await ctx.library('xlsx');
            const book=window.XLSX.read(await file.arrayBuffer(),{type:'array'});
            sheet=window.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:''});
          }
          head=(sheet.shift()||[]).map(x=>String(x));rows=sheet.filter(row=>row.some(cell=>String(cell??'').trim()!=='')).slice(0,1001);
          if(rows.length>1000)throw Error('1회 1,000명까지만 지원합니다. 명단을 나눠주세요.');
          if(!rows.length)throw Error('입력된 명단이 없습니다.');
          populate();ctx.setStatus(body,rows.length+'명 불러왔습니다. 첫 장을 미리 확인하세요.');
        }catch(e){rows=[];ctx.setStatus(body,e.message,true);}
      });
      async function qrImage(text){
        if(!text)return null;
        if(qrCache.has(text))return qrCache.get(text);
        await ctx.library('qr');
        const holder=document.createElement('div');
        new window.QRCode(holder,{text,width:160,height:160,correctLevel:window.QRCode.CorrectLevel.M});
        const canvas=holder.querySelector('canvas');
        if(!canvas)throw Error('QR코드를 생성하지 못했습니다.');
        const img=new Image();img.src=canvas.toDataURL('image/png');await img.decode();
        qrCache.set(text,img);return img;
      }
      function line(ctx2,x,y,w,h,s){
        ctx2.strokeStyle='#64748b';ctx2.lineWidth=Math.max(.3,s*.11);
        const l=2*s,offset=.5*s;
        [[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]].forEach(p=>{
          ctx2.beginPath();ctx2.moveTo(p[0]+p[2]*l,p[1]);ctx2.lineTo(p[0]+p[2]*offset,p[1]);ctx2.moveTo(p[0],p[1]+p[3]*l);ctx2.lineTo(p[0],p[1]+p[3]*offset);ctx2.stroke();
        });
      }
      function fitText(c,text,maxWidth,px){
        let n=px;while(n>10&&c.measureText(text).width>maxWidth){n-=2;c.font='700 '+n+'px '+c.__face;}return n;
      }
      async function render(index,dpi){
        const s=settings(),scale=dpi/25.4;
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(s.paper[0]*scale);canvas.height=Math.round(s.paper[1]*scale);
        const c=canvas.getContext('2d',{alpha:false});c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
        c.__face='"'+s.face+'","Malgun Gothic",sans-serif';
        for(let j=0;j<s.per;j++){
          const row=rows[index*s.per+j];if(!row)break;
          const col=j%s.cols,r=Math.floor(j/s.cols),x=(s.margin+col*(s.w+s.gap))*scale,y=(s.margin+r*(s.h+s.gap))*scale,w=s.w*scale,h=s.h*scale;
          c.strokeStyle='#e2e8f0';c.lineWidth=.3*scale;c.strokeRect(x,y,w,h);
          if(s.marks)line(c,x,y,w,h,scale);
          const name=textCell(row,s.name),sub=textCell(row,s.sub),qr=textCell(row,s.qr);
          const avail=qr?w-h*.57:w;
          c.textBaseline='middle';c.textAlign='center';c.fillStyle='#172033';
          const cx=x+avail/2,mainY=y+h*(sub?.41:.50);
          c.font='700 '+(s.font*dpi/72)+'px '+c.__face;
          fitText(c,name,avail*.87,s.font*dpi/72);
          c.fillText(name,cx,mainY,avail*.87);
          if(sub){c.font='500 '+Math.max(10,s.font*.58*dpi/72)+'px '+c.__face;c.fillText(sub,cx,y+h*.69,avail*.85);}
          if(qr){const image=await qrImage(qr);const size=Math.min(h*.58,w*.32);c.drawImage(image,x+w-size-(h*.12),y+(h-size)/2,size,size);}
        }
        return canvas;
      }
      async function go(preview){
        if(!rows.length){ctx.setStatus(body,'먼저 엑셀 또는 CSV 명단을 불러오세요.',true);return;}
        const button=$('pvRun'),prev=$('pvPreview');button.disabled=true;prev.disabled=true;
        try{
          const s=settings();if(s.qr>=0)await ctx.library('qr');
          ctx.setStatus(body,s.cols+'열 × '+s.lines+'행, 한 장당 '+s.per+'개 · 총 '+s.total+'장');
          const first=await render(0,preview?105:300);$('pvCanvasBox').replaceChildren(first);
          if(!preview){
            await ctx.library('pdf');const pdf=await window.PDFLib.PDFDocument.create();
            for(let k=0;k<s.total;k++){
              ctx.setStatus(body,'출력 PDF 만드는 중 · '+(k+1)+' / '+s.total+'장');
              const canvas=k===0?first:await render(k,300);
              const jpg=await pdf.embedJpg(canvas.toDataURL('image/jpeg',.94));
              const [w,h]=s.paper;pdf.addPage([ctx.mm(w),ctx.mm(h)]).drawImage(jpg,{x:0,y:0,width:ctx.mm(w),height:ctx.mm(h)});
            }
            ctx.download(await pdf.save(),'명단_자동배치_'+rows.length+'명.pdf');
            ctx.setStatus(body,'완료: '+rows.length+'명 · '+s.total+'장 PDF를 저장했습니다.');
          }
        }catch(e){ctx.setStatus(body,'작업 실패: '+e.message,true);}
        finally{button.disabled=false;prev.disabled=false;}
      }
      $('pvPreview').addEventListener('click',()=>go(true));
      $('pvRun').addEventListener('click',()=>go(false));
    }
  });
  let tries=0;
  function launch(){let existing=document.getElementById('pvLaunch');if(existing)return true;
    const panel=document.querySelector('.sidebar .first-panel');if(!panel)return false;
    const button=document.createElement('button');button.type='button';button.id='pvLaunch';button.className='ps-launch';button.textContent='엑셀 명단 자동 출력 · 명찰/번호표';
    button.addEventListener('click',()=>ui.open('variable'));panel.appendChild(button);return true;}
  if(!launch()){const timer=setInterval(()=>{if(launch()||++tries>70)clearInterval(timer);},80);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();