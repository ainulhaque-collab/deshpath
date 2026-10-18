import {fail,text,imageInfo,metadataProjection} from './validation.mjs';
import {checked,PRIVATE_BUCKET,privatePhotos} from './community.mjs';
export const MEDIA_LIMITS=Object.freeze({original:5*1024*1024,prepared:700*1024,maxPreparedPixels:1600000,maxPreparedEdge:1600});
export async function processPhoto(original,prepared,{jpeg,exifr}){
  if(!original?.length||original.length>MEDIA_LIMITS.original||!prepared?.length||prepared.length>MEDIA_LIMITS.prepared)fail('invalid-image');
  const info=imageInfo(original),preview=imageInfo(prepared);
  if(preview.mime!=='image/jpeg'||preview.width>MEDIA_LIMITS.maxPreparedEdge||preview.height>MEDIA_LIMITS.maxPreparedEdge||preview.width*preview.height>MEDIA_LIMITS.maxPreparedPixels)fail('invalid-image');
  let decoded;
  try{decoded=jpeg.decode(prepared,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:1.6,maxMemoryUsageInMB:64});}catch{fail('invalid-image');}
  if(decoded.width!==preview.width||decoded.height!==preview.height||decoded.data.length!==preview.width*preview.height*4)fail('invalid-image');
  // A new pixel-only frame deliberately excludes decoder EXIF buffers/comments.
  const frame={width:decoded.width,height:decoded.height,data:decoded.data};let output;
  try{output=jpeg.encode(frame,78).data;if(output.length>MEDIA_LIMITS.prepared)output=jpeg.encode(frame,58).data;}catch{fail('invalid-image');}
  if(!output?.length||output.length>MEDIA_LIMITS.prepared)fail('invalid-image');
  let metadata={reviewSignalOnly:true};
  try{metadata=metadataProjection(await exifr.parse(original,{pick:['Make','Model','Software','DateTimeOriginal','CreateDate','ModifyDate','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef'],translateValues:true,reviveValues:true,sanitize:true}));}catch{/* Missing or malformed metadata is a signal, never proof of fraud. */}
  return {info,prepared:new Uint8Array(output),metadata:{...metadata,originalWidth:info.width,originalHeight:info.height,preparedWidth:preview.width,preparedHeight:preview.height}};
}
export async function uploadPhoto(form,ctx,deps){
  const user=await ctx.requireUser();await ctx.rateLimit('media-hour',10,3600);await ctx.rateLimit('media-day',20,86400);
  if(form.get('action')!=='media.upload'||form.get('consent')!=='true')fail('consent-required');
  const original=form.get('original'),prepared=form.get('prepared');
  if(!original||!prepared||typeof original.arrayBuffer!=='function'||typeof prepared.arrayBuffer!=='function'||original.size>MEDIA_LIMITS.original||prepared.size>MEDIA_LIMITS.prepared)fail('invalid-image');
  const caption=text(String(form.get('caption')||''),0,200),bytes=new Uint8Array(await original.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  const existing=checked(await ctx.db.from('deshpath_media').select('id,status').eq('user_id',user.id).eq('sha256',hash).maybeSingle());
  if(existing){if(existing.status==='rejected')fail('invalid-photo');return {photo:(await privatePhotos(ctx,[existing.id]))[0]};}
  const result=await processPhoto(bytes,new Uint8Array(await prepared.arrayBuffer()),deps);
  if(original.type&&original.type!==result.info.mime||prepared.type&&prepared.type!=='image/jpeg')fail('invalid-image');
  const id=crypto.randomUUID(),originalPath='originals/'+user.id+'/'+id+'.'+result.info.extension,preparedPath='prepared/'+user.id+'/'+id+'.jpg';
  try{
    checked(await ctx.db.storage.from(PRIVATE_BUCKET).upload(originalPath,bytes,{contentType:result.info.mime,upsert:false,cacheControl:'0'}));
    checked(await ctx.db.storage.from(PRIVATE_BUCKET).upload(preparedPath,result.prepared,{contentType:'image/jpeg',upsert:false,cacheControl:'0'}));
    const row={id,user_id:user.id,sha256:hash,original_path:originalPath,prepared_path:preparedPath,mime:result.info.mime,bytes:bytes.length,width:result.info.width,height:result.info.height,metadata:result.metadata,caption,status:'pending'};
    const saved=await ctx.db.from('deshpath_media').insert(row);
    if(saved.error){
      await ctx.db.storage.from(PRIVATE_BUCKET).remove([originalPath,preparedPath]);
      if(saved.error.code==='23505'){const duplicate=checked(await ctx.db.from('deshpath_media').select('id,status').eq('user_id',user.id).eq('sha256',hash).single());if(duplicate.status==='rejected')fail('invalid-photo');return {photo:(await privatePhotos(ctx,[duplicate.id]))[0]};}
      checked(saved);
    }
    return {photo:(await privatePhotos(ctx,[id]))[0]};
  }catch(error){
    // Only our new unreferenced private paths may be removed on an upload failure.
    const row=await ctx.db.from('deshpath_media').select('id').eq('id',id).maybeSingle();
    if(!row.error&&!row.data)await ctx.db.storage.from(PRIVATE_BUCKET).remove([originalPath,preparedPath]);
    throw error;
  }
}
