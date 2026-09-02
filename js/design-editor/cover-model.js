(function(root){
  'use strict';
  if(root.DesignEditorCoverModel)return;

  const DEFAULTS=Object.freeze({
    trimWidth:210,
    trimHeight:297,
    bleed:3,
    safe:10,
    pageCount:160,
    paperCaliper:0.1,
    bindingAdjust:0.5,
    manualSpine:false,
    spineManual:8.5,
    spineDirection:'bottomToTop'
  });

  const CAPABILITIES=Object.freeze({
    common:Object.freeze([
      Object.freeze({capability:'text-editing',owner:'common',target:'DesignEditorApp text + common inspector'}),
      Object.freeze({capability:'image-editing',owner:'common',target:'DesignEditor Phase2 + asset store + print quality'}),
      Object.freeze({capability:'selection-layout-history',owner:'common',target:'DesignEditor selection + rotation + history + quickbar'}),
      Object.freeze({capability:'project-recovery',owner:'common',target:'DesignEditor project file + draft + cloud projects'}),
      Object.freeze({capability:'output-preflight',owner:'common',target:'DesignEditor final print check + verified 300DPI output'})
    ]),
    coverSpecific:Object.freeze([
      Object.freeze({capability:'spread-geometry',owner:'cover-model + cover-settings',reason:'back + spine + front geometry and binding dimensions'}),
      Object.freeze({capability:'spine-orientation',owner:'cover-spine-tools',reason:'spine text direction is unique to book covers'}),
      Object.freeze({capability:'spine-print-safety',owner:'cover-spine-tools',reason:'narrow-spine text and safety checks are cover-specific'}),
      Object.freeze({capability:'cover-project',owner:'project-file + draft-scope + cloud-projects',reason:'cover geometry and common elements must roundtrip together'}),
      Object.freeze({capability:'cover-preview-zones',owner:'cover-preview-zones',reason:'full-spread panel preview remains a cover-mode presentation concern'})
    ])
  });
  // Compatibility alias for callers created before the legacy editor was retired.
  const LEGACY_CAPABILITIES=CAPABILITIES;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round1=value=>Math.round((Number(value)||0)*10)/10;

  function normalize(options={}){
    const merged={...DEFAULTS,...options};
    return{
      trimWidth:clamp(Number(merged.trimWidth)||DEFAULTS.trimWidth,80,300),
      trimHeight:clamp(Number(merged.trimHeight)||DEFAULTS.trimHeight,100,450),
      bleed:clamp(Number(merged.bleed),0,10),
      safe:clamp(Number(merged.safe)||DEFAULTS.safe,3,30),
      pageCount:Math.max(2,Math.ceil(Number(merged.pageCount)||DEFAULTS.pageCount)),
      paperCaliper:clamp(Number(merged.paperCaliper)||DEFAULTS.paperCaliper,0.01,1),
      bindingAdjust:clamp(Number(merged.bindingAdjust),0,20),
      manualSpine:Boolean(merged.manualSpine),
      spineManual:clamp(Number(merged.spineManual)||0,0,100),
      spineDirection:['bottomToTop','topToBottom','vertical'].includes(merged.spineDirection)?merged.spineDirection:DEFAULTS.spineDirection
    };
  }

  function calculateSpine(options={}){
    const config=normalize(options);
    if(config.manualSpine)return round1(config.spineManual);
    const sheets=Math.ceil(config.pageCount/2);
    return round1(Math.max(0,sheets*config.paperCaliper+config.bindingAdjust));
  }

  function makeSpec(options={}){
    const config=normalize(options);
    const spine=calculateSpine(config);
    const spreadWidth=round1(config.trimWidth*2+spine);
    const totalWidth=round1(spreadWidth+config.bleed*2);
    const totalHeight=round1(config.trimHeight+config.bleed*2);
    return{
      ...config,
      spine,
      spreadWidth,
      totalWidth,
      totalHeight,
      folds:[round1(config.trimWidth),round1(config.trimWidth+spine)],
      panels:['뒤표지',`책등 ${spine.toFixed(1)}mm`,'앞표지']
    };
  }

  function makePreset(options={}){
    const spec=makeSpec(options);
    return{
      id:'cover-a4',
      group:'표지',
      name:'무선제본 전체 표지',
      description:'뒤표지·책등·앞표지를 한 펼침면에서 편집',
      width:spec.spreadWidth,
      height:spec.trimHeight,
      bleed:spec.bleed,
      safe:spec.safe,
      designMode:'cover',
      cover:{...spec},
      surfaces:[{id:'cover',label:'전체 표지',folds:[...spec.folds],panels:[...spec.panels]}]
    };
  }

  function registerPreset(options={}){
    const presets=root.DesignEditorPresets?.PRESETS;
    if(!presets)return false;
    presets['cover-a4']=makePreset(options);
    return true;
  }

  function applyToProject(project,options={}){
    if(!project)return null;
    const current=project.cover&&typeof project.cover==='object'?project.cover:{};
    const spec=makeSpec({...current,...options});
    const existing=Array.isArray(project.surfaces)?project.surfaces.find(surface=>surface.id==='cover'):null;
    project.presetId='cover-a4';
    project.designMode='cover';
    project.name='무선제본 전체 표지';
    project.width=spec.spreadWidth;
    project.height=spec.trimHeight;
    project.bleed=spec.bleed;
    project.safe=spec.safe;
    project.showFolds=true;
    project.activeSurface='cover';
    project.cover={...spec};
    project.surfaces=[{
      id:'cover',
      label:'전체 표지',
      folds:[...spec.folds],
      panels:[...spec.panels],
      background:existing?.background||'#ffffff',
      elements:Array.isArray(existing?.elements)?existing.elements:[],
      extras:Array.isArray(existing?.extras)?existing.extras:[]
    }];
    return project;
  }

  registerPreset();

  root.DesignEditorCoverModel={
    DEFAULTS,
    CAPABILITIES,
    LEGACY_CAPABILITIES,
    normalize,
    calculateSpine,
    makeSpec,
    makePreset,
    registerPreset,
    applyToProject,
    stage:'cover-spread-model-integrated-capability-contract'
  };
})(window);
