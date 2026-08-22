(function(){
  'use strict';
  if(window.__designEditorAssetStoreV1)return;
  window.__designEditorAssetStoreV1=true;

  const DB_NAME='programTool.designEditor.assets.v1';
  const DB_VERSION=1;
  const STORE='assets';
  const objectUrls=new Map();
  let dbPromise=null;

  const uid=()=>`design_asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(_){return null;}};
  const isDataUrl=value=>/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(value||''));

  function imageItems(project){
    const items=[];
    for(const surface of project?.surfaces||[]){
      for(const item of surface?.extras||[]){
        if(item?.type==='image')items.push(item);
      }
    }
    return items;
  }

  function openDb(){
    if(!('indexedDB'in window))return Promise.reject(new Error('이 브라우저에서는 대용량 이미지 저장소를 사용할 수 없습니다.'));
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('이미지 저장소를 열지 못했습니다.'));
      request.onblocked=()=>reject(new Error('이미지 저장소가 다른 탭에서 사용 중입니다.'));
    });
    return dbPromise;
  }

  async function transact(mode,operation){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      const store=tx.objectStore(STORE);
      let result;
      try{result=operation(store);}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error||result?.error||new Error('이미지 저장소 작업에 실패했습니다.'));
      tx.onabort=()=>reject(tx.error||new Error('이미지 저장소 작업이 중단됐습니다.'));
    });
  }

  async function putBlob(blob,meta={}){
    if(!(blob instanceof Blob)||!blob.size)throw new Error('저장할 이미지 데이터가 없습니다.');
    const id=String(meta.id||uid());
    const now=Date.now();
    await transact('readwrite',store=>store.put({
      id,
      blob,
      name:String(meta.name||''),
      type:String(blob.type||meta.type||'application/octet-stream'),
      size:Number(blob.size)||0,
      createdAt:Number(meta.createdAt)||now,
      updatedAt:now
    }));
    return id;
  }

  async function getRecord(id){
    if(!id)return null;
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const request=tx.objectStore(STORE).get(String(id));
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('이미지를 불러오지 못했습니다.'));
    });
  }

  function dataUrlToBlob(dataUrl){
    const match=String(dataUrl||'').match(/^data:([^;,]+);base64,(.+)$/i);
    if(!match)throw new Error('지원하지 않는 이미지 데이터입니다.');
    const binary=atob(match[2]);
    const bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);
    return new Blob([bytes],{type:match[1]});
  }

  function blobToDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('이미지 데이터를 변환하지 못했습니다.'));
      reader.readAsDataURL(blob);
    });
  }

  async function resolve(id){
    const key=String(id||'');
    if(!key)return '';
    if(objectUrls.has(key))return objectUrls.get(key);
    const record=await getRecord(key);
    if(!record?.blob)return '';
    const url=URL.createObjectURL(record.blob);
    objectUrls.set(key,url);
    return url;
  }

  async function storeBlob(blob,meta={}){
    const assetId=await putBlob(blob,meta);
    const src=await resolve(assetId);
    return {assetId,src};
  }

  function snapshotProject(project){
    const snapshot=clone(project);
    if(!snapshot)return null;
    imageItems(snapshot).forEach(item=>{
      if(item.assetId)delete item.src;
    });
    snapshot.assetStorageVersion=1;
    return snapshot;
  }

  async function ensureProject(project){
    if(!project)return {changed:false,missing:0};
    let changed=false,missing=0;
    for(const item of imageItems(project)){
      if(item.assetId){
        const src=await resolve(item.assetId);
        if(src){if(item.src!==src){item.src=src;changed=true;}}
        else missing+=1;
        continue;
      }
      if(isDataUrl(item.src)){
        const assetId=await putBlob(dataUrlToBlob(item.src),{name:item.name});
        const src=await resolve(assetId);
        item.assetId=assetId;
        item.src=src;
        changed=true;
      }
    }
    return {changed,missing};
  }

  async function toPortableProject(project){
    const portable=clone(project);
    if(!portable)throw new Error('현재 디자인 작업을 복사하지 못했습니다.');
    for(const item of imageItems(portable)){
      if(item.assetId){
        const record=await getRecord(item.assetId);
        if(!record?.blob)throw new Error(`프로젝트 이미지 저장본을 찾지 못했습니다: ${item.name||'이미지'}`);
        item.src=await blobToDataUrl(record.blob);
        delete item.assetId;
      }else if(item.src&&String(item.src).startsWith('blob:')){
        throw new Error(`프로젝트 이미지 저장본을 찾지 못했습니다: ${item.name||'이미지'}`);
      }
    }
    delete portable.assetStorageVersion;
    return portable;
  }

  async function importPortableProject(project){
    const incoming=clone(project);
    if(!incoming)throw new Error('프로젝트 내용을 복사하지 못했습니다.');
    for(const item of imageItems(incoming)){
      if(isDataUrl(item.src)){
        const assetId=await putBlob(dataUrlToBlob(item.src),{name:item.name});
        item.assetId=assetId;
        item.src=await resolve(assetId);
      }else if(item.assetId){
        const src=await resolve(item.assetId);
        if(!src)throw new Error(`프로젝트 이미지 저장본을 찾지 못했습니다: ${item.name||'이미지'}`);
        item.src=src;
      }
    }
    incoming.assetStorageVersion=1;
    return incoming;
  }

  window.addEventListener('pagehide',()=>{
    for(const url of objectUrls.values()){
      try{URL.revokeObjectURL(url);}catch(_){}
    }
    objectUrls.clear();
  },{once:true});

  window.DesignEditorAssetStore={
    storeBlob,
    resolve,
    ensureProject,
    snapshotProject,
    toPortableProject,
    importPortableProject,
    isDataUrl,
    stage:'indexeddb-image-assets-with-portable-project-export'
  };
})();
