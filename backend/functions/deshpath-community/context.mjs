import {fail,uuid} from './validation.mjs';
import {checked} from './community.mjs';
// A fresh context is created for every request; no user identity is cached globally.
/** @param {any} db @param {string|null} authorization @param {{handleGames?:any,now?:()=>number,requestId?:string}} options */
export function createContext(db,authorization,{handleGames,now=()=>Date.now(),requestId=crypto.randomUUID()}={}){
  const token=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization||'')?.[1]||'';
  const ctx={db,user:null,now,requestId,fail,handleGames,guestSessionId:null};let authPromise;
  ctx.hasToken=!!token;
  ctx.requireUser=async()=>{
    if(!authPromise)authPromise=(async()=>{if(!token||token.split('.').length!==3)fail('sign-in-required',401);const verified=await db.auth.getUser(token);const user=verified.data?.user;if(verified.error||!user?.id||!user.email||!user.email_confirmed_at||user.is_anonymous===true)fail('sign-in-required',401);ctx.user={id:user.id,email:user.email};return ctx.user;})();return authPromise;
  };
  ctx.rateLimit=async(scope,limit,seconds)=>{
    let key;if(!ctx.user&&scope==='analytics'&&!ctx.hasToken){key='guest:'+uuid(ctx.guestSessionId)+':analytics';const global=checked(await db.rpc('deshpath_take_rate',{p_key:'global:guest-analytics',p_limit:600,p_window_seconds:60}));if(!global)fail('rate-limited',429);}
    else {const user=await ctx.requireUser();key='user:'+user.id+':'+scope;}
    const accepted=checked(await db.rpc('deshpath_take_rate',{p_key:key,p_limit:limit,p_window_seconds:seconds}));if(!accepted)fail('rate-limited',429);
  };
  return ctx;
}
