/* Local media and portable backups. No uploaded photo leaves this device. */
'use strict';
(() => {
  const database = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('deshpath-journal', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', {keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function media(action, value) {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('media', action === 'getAll' ? 'readonly' : 'readwrite');
        const request = tx.objectStore('media')[action](...(value === undefined ? [] : [value]));
        let result;
        request.onsuccess = () => {result=request.result;};
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
      });
    } finally { db.close(); }
  }
  const fileData = blob => new Promise((resolve,reject) => {
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  async function compressImage(file, maxBytes=200000, maxSide=1200) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>15*1024*1024) throw new Error('IMAGE_TYPE');
    const url=URL.createObjectURL(file), image=new Image();
    try {
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      if (!image.naturalWidth || image.naturalWidth*image.naturalHeight>60000000) throw new Error('IMAGE_SIZE');
      const canvas=document.createElement('canvas');
      let side=Math.min(maxSide,Math.max(image.naturalWidth,image.naturalHeight)), blob;
      for(let attempt=0;attempt<6;attempt++) {
        const ratio=Math.min(1,side/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
        const ctx=canvas.getContext('2d');ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
        blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',Math.max(.48,.86-attempt*.07)));
        if(blob&&blob.size<=maxBytes) return {src:await fileData(blob),width:canvas.width,height:canvas.height,bytes:blob.size};
        side*=.8;
      }
      throw new Error('IMAGE_SIZE');
    } finally { URL.revokeObjectURL(url); }
  }
  function download(blob, filename) {
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  const backupKeys = new Set(['visited','favorites','theme','name','trip','planGenerated','quizBest','includeFoods','mapStyle','lang',
    'showDistrictNames','mapAvatar','photoAssignments','photoGroups','homeDistrict','worldVisited','worldTheme','worldName','worldLabels','worldAvatar',
    'passportPlaces','passportName','passportCover','profile','contributions','reviews','gamesRecords','games','gameHistory','gameBests','personality','districtNotes','community_contributions']);
  const readValues = () => {
    const values={};
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if(!key?.startsWith('deshpath.'))continue;
      const suffix=key.slice(9);
      if(backupKeys.has(suffix)||suffix.startsWith('games.')) {
        try{values[suffix]=JSON.parse(localStorage.getItem(key));}catch{}
      }
    }
    return values;
  };
  const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const text=(value,max,min=0)=>typeof value==='string'&&value.length>=min&&value.length<=max;
  const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  const integer=(value,min,max)=>Number.isInteger(value)&&finite(value,min,max);
  const raster=value=>typeof value==='string'&&value.length<=280000&&/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value);
  const dimensions=value=>plain(value)&&raster(value.src)&&integer(value.width,1,10000)&&integer(value.height,1,10000)&&value.width*value.height<=60000000;
  const date=value=>text(value,40)&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
  function validMedia(item){
    if(!dimensions(item)||!safeId(item.id))return false;
    if(item.bytes!==undefined&&!integer(item.bytes,1,210000))return false;
    if(item.label!==undefined&&!text(item.label,160))return false;
    if(item.box!==undefined&&(!plain(item.box)||!finite(item.box.x,-10000,10000)||!finite(item.box.y,-10000,10000)||!finite(item.box.width,.001,10000)||!finite(item.box.height,.001,10000)))return false;
    return (item.zoom===undefined||finite(item.zoom,1,3))&&(item.panX===undefined||finite(item.panX,0,100))&&(item.panY===undefined||finite(item.panY,0,100));
  }
  function knownIds(){return {districts:new Set((window.DESH_DATA?.districts||[]).map(d=>d.id)),places:new Set((window.DESH_DATA?.places||[]).map(p=>p.id)),world:new Set((window.DESH_WORLD?.countries||[]).map(c=>c.id)),divisions:new Set((window.DESH_DATA?.divisions||[]).map(d=>d.id))};}
  // An approved community place may not have arrived from the online catalog
  // yet. Preserve its opaque reference in private backups and notes; this does
  // not publish it or assert that a visit was verified.
  const communityPlaceId=value=>typeof value==='string'&&/^community-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const placeReference=(value,ids=knownIds())=>ids.places.has(value)||communityPlaceId(value);
  const list=(value,valid,max)=>Array.isArray(value)&&value.length<=max&&new Set(value).size===value.length&&value.every(id=>typeof id==='string'&&valid.has(id));
  function validDraft(item){const ids=knownIds();return plain(item)&&safeId(item.id)&&['place','food'].includes(item.kind)&&ids.districts.has(item.district)&&text(item.title,100,3)&&text(item.area,100,1)&&text(item.description,2000,50)&&text(item.directions,1000,20)&&text(item.notes??'',1000)&&text(item.author??'',60)&&date(item.createdAt)&&(item.photoId==null||safeId(item.photoId));}
  function validReview(item){const ids=knownIds();return plain(item)&&safeId(item.id)&&placeReference(item.placeId,ids)&&integer(item.rating,1,5)&&text(item.body,1000,10)&&date(item.createdAt)&&(item.photoId==null||safeId(item.photoId));}
  function validValues(key,item){
    const ids=knownIds();
    if(['favorites','passportPlaces'].includes(key))return Array.isArray(item)&&item.length<=1100&&new Set(item).size===item.length&&item.every(id=>placeReference(id,ids));
    if(['visited','worldVisited'].includes(key))return list(item,key==='visited'?ids.districts:ids.world,key==='visited'?64:300);
    if(key==='profile')return plain(item)&&text(item.name??'',60)&&text(item.bio??'',250)&&Object.keys(item).every(k=>['name','bio'].includes(k));
    if(key==='contributions'||key==='reviews')return Array.isArray(item)&&item.length<=100&&new Set(item.map(r=>r?.id)).size===item.length&&item.every(key==='contributions'?validDraft:validReview);
    if(key==='mapAvatar')return item===null||dimensions(item);
    if(key==='worldAvatar')return item===null||item==='world-avatar';
    if(key==='photoAssignments')return plain(item)&&Object.keys(item).length<=64&&Object.entries(item).every(([id,photoId])=>ids.districts.has(id)&&safeId(photoId));
    if(key==='showDistrictNames'||key==='worldLabels'||key==='includeFoods'||key==='planGenerated')return typeof item==='boolean';
    if(key==='homeDistrict')return item===''||ids.districts.has(item);
    if(key==='theme')return ['emerald','sunset','ocean','midnight'].includes(item);
    if(key==='worldTheme')return ['cobalt','coral','ocean','violet'].includes(item);
    if(key==='mapStyle')return ['food','color','personal'].includes(item);
    if(key==='lang')return ['bn','en'].includes(item);
    if(key==='name')return text(item,36);
    if(key==='worldName'||key==='passportName')return text(item,48);
    if(key==='passportCover')return text(item,200);
    if(key==='quizBest')return integer(item,0,5);
    if(key==='gamesRecords')return plain(item)&&Object.keys(item).length<=12&&Object.entries(item).every(([mode,score])=>['photo','farthest','knowledge','puzzle-easy','puzzle-medium','puzzle-hard'].includes(mode)&&finite(score,0,864000));
    if(key==='trip'){
      if(!plain(item))return false;
      const fields=['version','originDivision','origin','destinationDivision','destination','destinations','days','travelers','budget','routeMode','roundTrip','comfort'];
      return Object.keys(item).every(k=>fields.includes(k))&&(item.version===undefined||item.version===2)&&['originDivision','destinationDivision'].every(k=>item[k]===undefined||item[k]===''||ids.divisions.has(item[k]))&&['origin','destination'].every(k=>item[k]===undefined||item[k]===''||ids.districts.has(item[k]))&&(item.destinations===undefined||list(item.destinations,ids.districts,7))&&(item.days==null||integer(item.days,1,14))&&(item.travelers==null||integer(item.travelers,1,30))&&(item.budget==null||integer(item.budget,1000,10000000))&&(item.routeMode===undefined||['manual','optimized'].includes(item.routeMode))&&(item.roundTrip===undefined||typeof item.roundTrip==='boolean')&&(item.comfort===undefined||['economy','balanced','comfort'].includes(item.comfort));
    }
    // Reserved legacy game data is limited to numbers, text and bounded lists.
    const scalar=value=>value===null||typeof value==='boolean'||text(value,500)||finite(value,0,864000);
    if(key==='games'||key==='gameBests'||key==='personality'||key.startsWith('games.'))return scalar(item)||(plain(item)&&Object.keys(item).length<=40&&Object.entries(item).every(([k,v])=>safeId(k)&&scalar(v)));
    if(key==='gameHistory')return Array.isArray(item)&&item.length<=100&&item.every(scalar);
    if(key==='districtNotes')return plain(item)&&Object.keys(item).length<=64&&Object.entries(item).every(([id,v])=>ids.districts.has(id)&&plain(v)&&(v.note===undefined||text(v.note,2000))&&(v.date===undefined||text(v.date,40)));
    if(key==='community_contributions')return Array.isArray(item)&&item.length<=100&&item.every(v=>plain(v)&&safeId(v.id));
    if(key==='photoGroups')return Array.isArray(item)&&item.length===0;
    return false;
  }
  async function makeBackup() {
    const values=readValues(),references=new Set(['profile-avatar',...(values.worldAvatar?['world-avatar']:[]),...Object.values(values.photoAssignments||{}),...(values.contributions||[]).map(item=>item.photoId),...(values.reviews||[]).map(item=>item.photoId)].filter(Boolean));
    const backup={app:'deshpath',version:1,exportedAt:new Date().toISOString(),values,media:(await media('getAll')).filter(item=>references.has(item.id))};
    return validateBackup(backup);
  }
  function validateBackup(value) {
    if(!value||value.app!=='deshpath'||value.version!==1||!plain(value.values)||Object.keys(value.values).length>100||!Array.isArray(value.media)||value.media.length>300||new Set(value.media.map(item=>item?.id)).size!==value.media.length) throw new Error('BACKUP_INVALID');
    for(const [key,item] of Object.entries(value.values)) {
      if(!(backupKeys.has(key)||/^games\.[a-zA-Z0-9_-]{1,40}$/.test(key))||!validValues(key,item)||JSON.stringify(item).length>2000000)throw new Error('BACKUP_INVALID');
    }
    for(const item of value.media) {
      if(!validMedia(item))throw new Error('BACKUP_INVALID');
    }
    return value;
  }
  async function restoreBackup(value) {
    validateBackup(value);
    const entries=Object.entries(value.values), previous=new Map(entries.map(([key])=>[key,localStorage.getItem('deshpath.'+key)]));
    // One IndexedDB transaction makes importing all media atomic. Save local values
    // first and restore them if either storage system rejects the import.
    try {
      for(const [key,item] of entries)localStorage.setItem('deshpath.'+key,JSON.stringify(item));
      const db=await database();
      try {await new Promise((resolve,reject)=>{const tx=db.transaction('media','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);try{for(const item of value.media)tx.objectStore('media').put(item);}catch(error){tx.abort();reject(error);}});}
      finally{db.close();}
    } catch(error) {
      for(const [key,item] of previous)try{item===null?localStorage.removeItem('deshpath.'+key):localStorage.setItem('deshpath.'+key,item);}catch{}
      throw error;
    }
  }
  window.DESH_JOURNAL={media,compressImage,download,makeBackup,validateBackup,restoreBackup,readValues,backupKeys,isRasterDataURL:raster,validMedia,validDraft,validReview};
})();
