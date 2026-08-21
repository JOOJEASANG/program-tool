(function(root){
  'use strict';
  if(root.DesignEditorPresets)return;

  const ROLE_PRESETS={
    title:{label:'메인 제목',size:34,weight:900,align:'center',color:'#12396d'},
    subtitle:{label:'부제목',size:18,weight:800,align:'center',color:'#334155'},
    body:{label:'본문',size:11,weight:500,align:'left',color:'#334155'},
    info:{label:'날짜·장소',size:10,weight:700,align:'left',color:'#475569'},
    institution:{label:'기관명',size:9,weight:700,align:'center',color:'#64748b'}
  };

  const PRESETS={
    'poster-a4':{
      id:'poster-a4',group:'포스터',name:'A4 포스터',description:'행사·교육·안내용 세로 포스터',width:210,height:297,bleed:3,safe:10,
      surfaces:[{id:'front',label:'앞면',folds:[],panels:['포스터']}]
    },
    'poster-a3':{
      id:'poster-a3',group:'포스터',name:'A3 포스터',description:'게시·출력용 큰 포스터',width:297,height:420,bleed:3,safe:12,
      surfaces:[{id:'front',label:'앞면',folds:[],panels:['포스터']}]
    },
    'flyer-a4':{
      id:'flyer-a4',group:'전단',name:'A4 양면 전단',description:'앞·뒷면을 따로 편집하는 A4 전단',width:210,height:297,bleed:3,safe:10,
      surfaces:[{id:'front',label:'앞면',folds:[],panels:['앞면']},{id:'back',label:'뒷면',folds:[],panels:['뒷면']}]
    },
    'flyer-a5':{
      id:'flyer-a5',group:'전단',name:'A5 양면 전단',description:'휴대하기 좋은 소형 양면 전단',width:148,height:210,bleed:3,safe:8,
      surfaces:[{id:'front',label:'앞면',folds:[],panels:['앞면']},{id:'back',label:'뒷면',folds:[],panels:['뒷면']}]
    },
    'leaflet-2':{
      id:'leaflet-2',group:'리플렛',name:'A4 2단 리플렛',description:'A4 가로 2단 접지 · 바깥면/안쪽면',width:297,height:210,bleed:3,safe:8,
      surfaces:[
        {id:'outside',label:'바깥면',folds:[148.5],panels:['뒷표지','앞표지']},
        {id:'inside',label:'안쪽면',folds:[148.5],panels:['내용 왼쪽','내용 오른쪽']}
      ]
    },
    'leaflet-3-z':{
      id:'leaflet-3-z',group:'리플렛',name:'A4 3단 Z접지',description:'세 면을 같은 폭으로 사용하는 Z접지',width:297,height:210,bleed:3,safe:7,
      surfaces:[
        {id:'outside',label:'바깥면',folds:[99,198],panels:['뒷면','가운데 면','앞표지']},
        {id:'inside',label:'안쪽면',folds:[99,198],panels:['내용 1','내용 2','내용 3']}
      ]
    },
    'leaflet-3-roll':{
      id:'leaflet-3-roll',group:'리플렛',name:'A4 3단 말아접기',description:'접혀 들어가는 면을 1mm씩 줄인 실무형 접지',width:297,height:210,bleed:3,safe:7,
      surfaces:[
        {id:'outside',label:'바깥면',folds:[98,197],panels:['접히는 면 98mm','뒷면 99mm','앞표지 100mm']},
        {id:'inside',label:'안쪽면',folds:[100,199],panels:['내용 100mm','내용 99mm','내용 98mm']}
      ]
    },
    'custom':{
      id:'custom',group:'사용자 지정',name:'사용자 지정',description:'원하는 완성 크기로 시작합니다.',width:210,height:297,bleed:3,safe:10,custom:true,
      surfaces:[{id:'front',label:'앞면',folds:[],panels:['작업면']}]
    }
  };

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function get(id){return PRESETS[id]?clone(PRESETS[id]):null;}
  function all(){return Object.values(PRESETS).map(clone);}
  function groups(){return [...new Set(Object.values(PRESETS).map(item=>item.group))];}

  root.DesignEditorPresets={
    PRESETS,
    ROLE_PRESETS,
    get,
    all,
    groups,
    stage:'print-design-document-presets'
  };
})(window);
