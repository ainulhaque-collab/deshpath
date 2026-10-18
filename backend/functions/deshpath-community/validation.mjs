// Shared, side-effect-free request validation. Public projections are built separately.
export class ApiError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
export const fail=(code,status=400)=>{throw new ApiError(code,status);};
export const DISTRICTS=new Set('dhaka faridpur gazipur gopalganj kishoreganj madaripur manikganj munshiganj narayanganj narsingdi rajbari shariatpur tangail bandarban brahmanbaria chandpur chattogram cumilla coxsbazar feni khagrachhari lakshmipur noakhali rangamati bogura joypurhat naogaon natore chapainawabganj pabna rajshahi sirajganj dinajpur gaibandha kurigram lalmonirhat nilphamari panchagarh rangpur thakurgaon bagerhat chuadanga jashore jhenaidah khulna kushtia magura meherpur narail satkhira barguna barishal bhola jhalokathi patuakhali pirojpur habiganj moulvibazar sunamganj sylhet jamalpur mymensingh netrokona sherpur'.split(' '));
export const CATEGORIES=new Set(['nature','adventure','beach','heritage']);
export const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export function object(value,allowed){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('invalid-input');return value;}
export function text(value,min=0,max=500){if(typeof value!=='string')fail('invalid-input');const clean=value.trim();if([...clean].length<min||[...clean].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean))fail('invalid-input');return clean;}
export const optionalText=(value,max=500)=>value===undefined||value===null?'':text(value,0,max);
export function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail('invalid-input');return value.toLowerCase();}
export function placeId(value){if(typeof value!=='string'||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(value))fail('invalid-input');return value;}
export function number(value,min,max,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||integer&&!Number.isInteger(value))fail('invalid-input');return value;}
export function photos(value,min=0){if(!Array.isArray(value)||value.length<min||value.length>3)fail('invalid-input');const ids=value.map(uuid);if(new Set(ids).size!==ids.length)fail('invalid-input');return ids;}
export function profileInput(value){object(value,['displayName','publicOptIn','analyticsOptIn']);if(typeof value.publicOptIn!=='boolean'||typeof value.analyticsOptIn!=='boolean')fail('invalid-input');return {display_name:text(value.displayName,2,60),public_opt_in:value.publicOptIn,analytics_opt_in:value.analyticsOptIn};}
const placeFields=['id','name','enName','district','area','category','description','enDescription','howTo','stay','season','duration','enSeason','enDuration','enCategoryLabel','lat','lng','cost','notes','photoIds','coverPhotoId','consent','en','months'];
export function submissionInput(value,{admin=false,minPhotos=1,legacy=false}={}){
  object(value,placeFields);if(value.consent!==true&&!admin)fail('consent-required');
  if(!DISTRICTS.has(value.district)||!CATEGORIES.has(value.category))fail('invalid-input');
  const ids=photos(value.photoIds,minPhotos),en=value.en??{};object(en,['name','description','season','duration','categoryLabel','howTo','stay','cost','notes','area']);
  const result={name:text(value.name,3,120),district:value.district,area:text(value.area??'',legacy?0:1,120),category:value.category,description:text(value.description,legacy?10:50,4000),howTo:text(value.howTo??'',legacy?0:20,2000),stay:optionalText(value.stay,1000),season:optionalText(value.season,160),duration:optionalText(value.duration,160),cost:optionalText(value.cost,1000),notes:optionalText(value.notes,2000),en:{name:optionalText(value.enName??en.name,120),description:optionalText(value.enDescription??en.description,4000),season:optionalText(value.enSeason??en.season,160),duration:optionalText(value.enDuration??en.duration,160),categoryLabel:optionalText(value.enCategoryLabel??en.categoryLabel,100)}};
  if(value.lat!==undefined&&value.lat!==null&&value.lat!=='')result.lat=number(value.lat,20.3,26.7);
  if(value.lng!==undefined&&value.lng!==null&&value.lng!=='')result.lng=number(value.lng,88,92.8);
  if(('lat'in result)!==('lng'in result))fail('invalid-input');
  for(const key of ['howTo','stay','cost','notes','area'])result.en[key]=optionalText(en[key],key==='area'?120:key==='cost'?1000:2000);
  if(value.months!==undefined){if(!Array.isArray(value.months)||value.months.length>12||new Set(value.months).size!==value.months.length)fail('invalid-input');result.months=value.months.map(value=>number(value,1,12,true));}
  if(ids.length){result.coverPhotoId=value.coverPhotoId?uuid(value.coverPhotoId):ids[0];if(!ids.includes(result.coverPhotoId))fail('invalid-input');}else if(value.coverPhotoId)fail('invalid-input');
  return {id:value.id===undefined?null:uuid(value.id),payload:result,photoIds:ids};
}
export function publishedPlaceInput(patch,row){
  object(patch,[...placeFields,'image','credit','categoryLabel']);
  const current=row.payload||{},data={...current,...patch,en:{...(current.en||{}),...(patch.en||{})},photoIds:patch.photoIds??row.photo_ids??[]};
  for(const key of ['image','credit','categoryLabel'])if(patch[key]!==undefined&&patch[key]!==current[key])fail('invalid-input');
  const editable=Object.fromEntries(Object.entries(data).filter(([key])=>placeFields.includes(key)));
  const result=submissionInput(editable,{admin:true,minPhotos:row.builtin?0:1,legacy:row.builtin});
  if(result.photoIds.some(id=>!(row.photo_ids||[]).includes(id)))fail('invalid-photo');
  result.payload={...current,...result.payload};return result;
}
export function reviewInput(value,{admin=false,now=Date.now()}={}){
  object(value,['id','placeId','rating','body','visitDate','origin','transport','totalCost','people','photoIds','consent']);if(value.consent!==true&&!admin)fail('consent-required');
  const date=text(value.visitDate,10,10),timestamp=Date.parse(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==date||timestamp>now+86400000||date<'1971-01-01')fail('invalid-input');
  return {id:value.id===undefined?null:uuid(value.id),placeId:placeId(value.placeId),photoIds:photos(value.photoIds),payload:{rating:number(value.rating,1,5,true),body:text(value.body,20,2000),visitDate:date,origin:text(value.origin,1,160),transport:text(value.transport,1,500),totalCost:number(value.totalCost,0,10000000),people:number(value.people,1,100,true)}};
}
export function reportInput(value){object(value,['placeId','reviewId','reason']);if(!value.placeId&&!value.reviewId)fail('invalid-input');return {place_id:value.placeId?placeId(value.placeId):null,review_id:value.reviewId?uuid(value.reviewId):null,reason:text(value.reason,10,1000)};}
export function moderateInput(value){object(value,['kind','id','decision','reason','payload','mergePlaceId','revision']);if(!['submissions','reviews','reports','places'].includes(value.kind)||!['approve','reject','changes_requested','archive','resolve'].includes(value.decision))fail('invalid-input');const id=value.kind==='places'?placeId(value.id):uuid(value.id);const reason=optionalText(value.reason,1000);if(['reject','changes_requested','archive'].includes(value.decision)&&reason.length<5)fail('reason-required');if(value.payload!==undefined&&!plain(value.payload))fail('invalid-input');const revision=['submissions','reviews'].includes(value.kind)?number(value.revision,1,1000000,true):null;return {...value,id,reason,revision,mergePlaceId:value.mergePlaceId?placeId(value.mergePlaceId):null};}
export async function readBoundedBody(request,limit){const reader=request.body?.getReader();if(!reader)return new Uint8Array();const parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();fail('request-too-large',413);}parts.push(value);}}finally{reader.releaseLock();}const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
export function imageInfo(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<12)fail('invalid-image');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height,mime,extension;
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';extension='jpg';let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)fail('invalid-image');while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===0xd9||marker===0xda)break;if(marker===1||marker>=0xd0&&marker<=0xd7)continue;const length=view.getUint16(i);if(length<2||i+length>bytes.length)fail('invalid-image');if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){if(length<8)fail('invalid-image');height=view.getUint16(i+3);width=view.getUint16(i+5);break;}i+=length;}}
  else if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)&&String.fromCharCode(...bytes.subarray(12,16))==='IHDR'){mime='image/png';extension='png';width=view.getUint32(16);height=view.getUint32(20);}
  else if(bytes.length>=30&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP'){
    mime='image/webp';extension='webp';const kind=String.fromCharCode(...bytes.subarray(12,16));
    if(kind==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(kind==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else if(kind==='VP8L'&&bytes[20]===0x2f){width=1+(bytes[21]|(bytes[22]&0x3f)<<8);height=1+((bytes[22]>>6)|bytes[23]<<2|(bytes[24]&15)<<10);}
  }
  if(!mime||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>24000000)fail('invalid-image');return {width,height,mime,extension};
}
export function metadataProjection(value){const result={reviewSignalOnly:true};if(!plain(value))return result;for(const key of ['Make','Model','Software'])if(typeof value[key]==='string')result[key]=value[key].replace(/[\u0000-\u001f]/g,'').slice(0,120);for(const key of ['DateTimeOriginal','CreateDate','ModifyDate']){const date=value[key] instanceof Date?value[key]:typeof value[key]==='string'?new Date(value[key]):null;if(date&&Number.isFinite(date.getTime()))result[key]=date.toISOString();}for(const [key,min,max]of[['latitude',-90,90],['longitude',-180,180]])if(typeof value[key]==='number'&&Number.isFinite(value[key])&&value[key]>=min&&value[key]<=max)result[key]=value[key];return result;}
