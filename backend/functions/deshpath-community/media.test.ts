import jpeg from 'npm:jpeg-js@0.4.4';
import exifr from 'npm:exifr@7.1.3';
import {processPhoto} from './media.mjs';
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
function gpsExif(){
  const bytes=new Uint8Array(128),v=new DataView(bytes.buffer);bytes.set([0x49,0x49,42,0,8,0,0,0]);v.setUint16(8,1,true);v.setUint16(10,0x8825,true);v.setUint16(12,4,true);v.setUint32(14,1,true);v.setUint32(18,26,true);
  v.setUint16(26,4,true);
  for(const[offset,tag,type,count,value]of[[28,1,2,2,78],[40,2,5,3,80],[52,3,2,2,69],[64,4,5,3,104]]){v.setUint16(offset,tag,true);v.setUint16(offset+2,type,true);v.setUint32(offset+4,count,true);v.setUint32(offset+8,value,true);}
  for(const[offset,n]of[[80,23],[88,45],[96,0],[104,90],[112,24],[120,0]]){v.setUint32(offset,n,true);v.setUint32(offset+4,1,true);}const exif=new Uint8Array(134);exif.set([69,120,105,102,0,0]);exif.set(bytes,6);return exif;
}
Deno.test('real pinned codecs: extract original GPS privately and re-encode prepared pixels without EXIF',async()=>{
  const frame={width:4,height:3,data:new Uint8Array(4*3*4).fill(180)};
  // jpeg-js supports exifBuffer at runtime, although its published types omit it.
  const withExif:any={...frame,exifBuffer:gpsExif()};
  const original=jpeg.encode(withExif,85).data,prepared=jpeg.encode(withExif,85).data;
  const parsed=await exifr.parse(original);assert(Math.abs(parsed.latitude-23.75)<0.001,'Synthetic original GPS fixture must be readable');
  const result=await processPhoto(original,prepared,{jpeg,exifr});
  assert(Math.abs((result.metadata as any).latitude-23.75)<0.001,'Private metadata should preserve GPS as an unverified review signal');
  const publicMetadata=await exifr.parse(result.prepared);assert(!publicMetadata?.latitude&&!publicMetadata?.longitude,'Public JPEG must not contain GPS');
  assert(!new TextDecoder().decode(result.prepared).includes('Exif'),'Public JPEG must not contain original EXIF bytes');
  const decoded=jpeg.decode(result.prepared);assert(decoded.width===4&&decoded.height===3,'Public derivative must be a decodable JPEG');
});
Deno.test('real decoder rejects truncated prepared JPEG instead of trusting its MIME/header',async()=>{
  const frame={width:4,height:3,data:new Uint8Array(48).fill(180)},valid=jpeg.encode(frame,85).data;
  let rejected=false;try{await processPhoto(valid,valid.subarray(0,valid.length-100),{jpeg,exifr});}catch(error){rejected=error.code==='invalid-image';}assert(rejected,'Truncated prepared bytes must fail');
});
