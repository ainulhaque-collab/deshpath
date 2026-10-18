// Deploy with verify_jwt=false: this endpoint deliberately mixes public reads with
// private actions. Every private action verifies the end-user JWT with Auth.getUser.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import jpeg from 'npm:jpeg-js@0.4.4';
import exifr from 'npm:exifr@7.1.3';
import {ApiError,fail,plain,readBoundedBody} from './validation.mjs';
import {handleCommunity,PUBLIC_ACTIONS} from './community.mjs';
import {uploadPhoto} from './media.mjs';
import {handleGames} from './games.mjs';
import {createContext} from './context.mjs';

const projectURL=Deno.env.get('SUPABASE_URL')||'';
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'))[0]||'';
const allowedOrigins=new Set((Deno.env.get('DESHPATH_ALLOWED_ORIGINS')||'https://deshpath.vercel.app,http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:4174,http://localhost:4174').split(',').map(value=>value.trim()).filter(Boolean));
const clientOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const db=projectURL&&secret?createClient(projectURL,String(secret),clientOptions):null;
const headersFor=(origin:string)=>({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})});
const response=(body:unknown,status:number,headers:Record<string,string>)=>new Response(JSON.stringify(body),{status,headers});

export async function handler(req:Request){
  const origin=req.headers.get('origin')||'',headers=headersFor(origin);
  if(origin&&!allowedOrigins.has(origin))return response({error:{code:'origin-not-allowed'}},403,headers);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return response({error:{code:'method-not-allowed'}},405,headers);
  if(!db)return response({error:{code:'service-unavailable'}},503,headers);
  const ctx=createContext(db,req.headers.get('authorization'),{handleGames});
  try{
    const multipart=(req.headers.get('content-type')||'').startsWith('multipart/form-data');
    const bytes=await readBoundedBody(req,multipart?6*1024*1024:32768);
    if(multipart){await ctx.requireUser();const form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')}}).formData();return response(await uploadPhoto(form,ctx,{jpeg,exifr}),200,headers);}
    let input;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('invalid-input');}
    if(!plain(input)||Object.keys(input).some(key=>!['action','payload'].includes(key))||typeof input.action!=='string'||!plain(input.payload??{}))fail('invalid-input');
    const {action,payload={}}=input;
    if(action==='analytics.record')ctx.guestSessionId=payload.sessionId;
    if(!PUBLIC_ACTIONS.has(action))await ctx.requireUser();
    else if(action==='analytics.record'&&ctx.hasToken)await ctx.requireUser();
    return response(await handleCommunity(action,payload,ctx),200,headers);
  }catch(error:any){
    const code=error instanceof ApiError?error.code:typeof error?.code==='string'&&/^[a-z][a-z0-9-]{1,60}$/.test(error.code)?error.code:'service-unavailable';
    const status=error instanceof ApiError?error.status:code==='rate-limited'?429:code==='sign-in-required'?401:code==='admin-required'?403:code==='service-unavailable'?503:400;
    // Never return raw SDK messages, filenames, JWTs, original URLs, or stack traces.
    return response({error:{code}},status,headers);
  }
}
Deno.serve(handler);
