import facts from './games-data.mjs';
import {fail as problem} from './validation.mjs';

export const GAME_RULES = Object.freeze({version:facts.version,ttlMs:3600000,puzzlePenaltyMs:5000,minAnswerIntervalMs:200});
const TYPES = ['knowledge','photo','farthest','puzzle'];
const EVENTS = ['game_started','game_completed','game_activity','export_prepared','download_requested','print_requested'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const byDistrict = new Map(facts.districts.map(d=>[d.id,d]));
const pair = (bn,en)=>({bn,en});
function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))problem('invalid-input');}
function checked(result){if(result.error)problem('game-service-unavailable',503);return result.data;}
export function distanceKm(a,b){const rad=n=>n*Math.PI/180,h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));}
export function photoScore(km){return Math.max(0,Math.round(1000*(1-Math.max(0,km)/650)));}
function rng(seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h+=0x6D2B79F5;let n=h;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296;};}
function shuffled(items,random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const option = d=>({id:d.id,label:pair(d.bn,d.en)});
export function challengeDay(now){return new Date(now+6*3600000).toISOString().slice(0,10);}
export function makeChallenge(game,difficulty,day){
  if(!TYPES.includes(game))problem('invalid-game');
  const level=game==='puzzle'?(difficulty||'easy'):'standard';
  if(game==='puzzle'&&!['easy','medium','hard'].includes(level))problem('invalid-game');
  if(game!=='puzzle'&&difficulty&&difficulty!=='standard')problem('invalid-game');
  const random=rng(facts.version+'|'+game+'|'+level+'|'+day),pick=(a,n)=>shuffled(a,random).slice(0,n);
  let rounds;
  if(game==='knowledge')rounds=pick(facts.districts,5).map(d=>({question:pair(d.bn+' জেলা কোন বিভাগে?','Which division contains '+d.en+' district?'),options:shuffled([facts.divisions.find(v=>v.id===d.division),...pick(facts.divisions.filter(v=>v.id!==d.division),3)],random).map(option),correct:d.division,explanation:pair(d.bn+' জেলা '+facts.divisions.find(v=>v.id===d.division).bn+' বিভাগে।',d.en+' belongs to '+d.division+' Division.')}));
  if(game==='photo')rounds=pick(facts.places,5).map(p=>({question:pair('ছবিটি কোন জেলায়?','Which district is shown in this photograph?'),image:p.image,options:facts.districts.map(option),correct:p.district,explanation:pair(p.bn+' · '+byDistrict.get(p.district).bn,p.en+' · '+byDistrict.get(p.district).en)}));
  if(game==='farthest')rounds=pick(facts.districts,5).map(origin=>{const choices=pick(facts.districts.filter(d=>d.id!==origin.id),4),correct=[...choices].sort((a,b)=>distanceKm(origin,b)-distanceKm(origin,a))[0];return{question:pair(origin.bn+' থেকে কোন জেলা সবচেয়ে দূরে?', 'Which district is farthest from '+origin.en+'?'),options:choices.map(option),correct:correct.id,explanation:pair('আনুমানিক জেলা কেন্দ্রের সরলরেখার দূরত্ব: '+Math.round(distanceKm(origin,correct))+' কিমি।','Approximate straight-line distance between district centres: '+Math.round(distanceKm(origin,correct))+' km. Not a road route.')};});
  if(game==='puzzle')rounds=pick(facts.districts,{easy:6,medium:12,hard:20}[level]).map(d=>({question:pair('মানচিত্রে '+d.bn+' জেলা বাছাই করুন।','Select '+d.en+' on the map.'),options:facts.districts.map(option),correct:d.id,explanation:pair(d.bn+' ঠিক জায়গায়!',d.en+' is in the right place!')}));
  return {version:facts.version,game,difficulty:level,day,rounds,index:0,score:0,mistakes:0,revision:0,lastAnswerAt:0,lastRequestId:null,lastFeedback:null};
}
export function publicSession(row){const s=row.state,q=s.rounds[s.index];return{id:row.id,game:row.game,difficulty:row.difficulty,round:s.index,total:s.rounds.length,startedAt:row.started_at,expiresAt:row.expires_at,day:row.challenge_day,done:row.status==='completed',cancelled:row.status==='cancelled',challenge:q?{question:q.question,options:q.options,...(q.image?{image:q.image}:{}),map:row.game==='puzzle',rulesVersion:s.version}:null};}
export function answerSession(row,answer,now){
  exact(answer,['choice','round','requestId']);
  if(typeof answer.choice!=='string'||!Number.isInteger(answer.round)||!UUID.test(answer.requestId||''))problem('invalid-input');
  const s=structuredClone(row.state);
  if(answer.requestId===s.lastRequestId)return {replay:true,state:s,status:row.status,feedback:s.lastFeedback};
  if(row.status!=='active'||now>=Date.parse(row.expires_at))problem('game-closed',409);
  if(answer.round!==s.index)problem('game-conflict',409);
  if(s.lastAnswerAt&&now-s.lastAnswerAt<GAME_RULES.minAnswerIntervalMs)problem('game-rate-limited',429);
  const q=s.rounds[s.index];if(!q.options.some(o=>o.id===answer.choice))problem('invalid-answer');
  const correct=answer.choice===q.correct;
  let points=correct?1:0;
  if(row.game==='photo')points=correct?1000:photoScore(distanceKm(byDistrict.get(answer.choice),byDistrict.get(q.correct)));
  if(row.game==='puzzle'&&!correct){s.mistakes++;points=0;}else{s.score+=points;s.index++;}
  s.revision++;s.lastAnswerAt=now;s.lastRequestId=answer.requestId;
  // A failed puzzle placement does not reveal its secret target identifier.
  s.lastFeedback={correct,points,explanation:row.game==='puzzle'&&!correct?pair('আবার চেষ্টা করুন। ভুল বাছাইয়ে ৫ সেকেন্ড যোগ হয়।','Try again. A wrong selection adds 5 seconds.'):q.explanation};
  const done=s.index===s.rounds.length;
  const durationMs=Math.max(0,now-Date.parse(row.started_at))+(row.game==='puzzle'?s.mistakes*GAME_RULES.puzzlePenaltyMs:0);
  if(durationMs>7200000)problem('game-closed',409);
  return{state:s,status:done?'completed':'active',feedback:s.lastFeedback,score:s.score,durationMs};
}
function resultProjection(r){return{game:r.game,difficulty:r.difficulty,score:r.score,durationMs:r.duration_ms,finishedAt:r.finished_at,challengeDay:r.challenge_day};}
async function resultFor(ctx,row){const data=checked(await ctx.db.from('deshpath_game_results').select('game,difficulty,score,duration_ms,finished_at,challenge_day').eq('session_id',row.id).maybeSingle());return data?resultProjection(data):null;}
async function ownedSession(ctx,id,user){if(!UUID.test(id||''))problem('invalid-input');const row=checked(await ctx.db.from('deshpath_game_sessions').select('*').eq('id',id).eq('user_id',user.id).maybeSingle());if(!row)problem('game-not-found',404);return row;}
async function analytics(payload,ctx){
  exact(payload,['id','sessionId','event','game','exportType','format','consent']);
  if(payload.consent!==true||!UUID.test(payload.id||'')||!UUID.test(payload.sessionId||'')||!EVENTS.includes(payload.event))problem('invalid-input');
  const isGame=payload.event.startsWith('game_');
  if(isGame?(![...TYPES,'personality'].includes(payload.game)||payload.exportType!==undefined||payload.format!==undefined):(!['bangladesh-map','world-map','bangladesh-passport','world-passport'].includes(payload.exportType)||!['png','jpeg','pdf'].includes(payload.format)||payload.game!==undefined))problem('invalid-input');
  await ctx.rateLimit?.('analytics',60,60);
  if(ctx.user){const profile=checked(await ctx.db.from('deshpath_profiles').select('analytics_opt_in').eq('user_id',ctx.user.id).maybeSingle());if(!profile?.analytics_opt_in)return{accepted:false};}
  const row={id:payload.id,session_id:payload.sessionId,user_id:ctx.user?.id||null,event:payload.event,game:payload.game||null,export_type:payload.exportType||null,format:payload.format||null};
  const res=await ctx.db.from('deshpath_analytics_events').insert(row);if(res.error&&res.error.code!=='23505')problem('analytics-unavailable',503);
  return{accepted:true};
}
async function leaderboard(payload,ctx){
  exact(payload,['game','difficulty','period']);const game=payload.game||'knowledge',difficulty=game==='puzzle'?(payload.difficulty||'easy'):'standard',period=payload.period||'week';
  if(!TYPES.includes(game)||!['week','all'].includes(period)||(game==='puzzle'?!['easy','medium','hard'].includes(difficulty):payload.difficulty&&payload.difficulty!=='standard'))problem('invalid-input');
  // DB returns only opted-in identities; no Auth UUIDs pass this RPC boundary.
  const rows=checked(await ctx.db.rpc('deshpath_public_leaderboard',{p_game:game,p_difficulty:difficulty,p_period:period}))||[];
  return{game,difficulty,period,rows:rows.map((r,i)=>({rank:i+1,profileId:r.profile_id,displayName:r.display_name,score:r.score,durationMs:r.duration_ms,finishedAt:r.finished_at}))};
}
export async function handleGames(action,payload={},ctx){
  if(action==='analytics.record')return analytics(payload,ctx);
  if(action==='leaderboard.list')return leaderboard(payload,ctx);
  if(!action.startsWith('game.'))return null;
  const user=await ctx.requireUser(),now=typeof ctx.now==='function'?ctx.now():Date.now();
  await ctx.rateLimit?.('games',90,60);
  if(action==='game.start'){
    exact(payload,['game','difficulty']);const state=makeChallenge(payload.game,payload.difficulty,challengeDay(now));
    const existing=checked(await ctx.db.from('deshpath_game_sessions').select('*').eq('user_id',user.id).eq('game',state.game).eq('difficulty',state.difficulty).eq('challenge_day',state.day).maybeSingle());
    if(existing){if(existing.status==='cancelled'||existing.status==='active'&&now>=Date.parse(existing.expires_at))problem('daily-attempt-used',409);return{session:publicSession(existing),...(existing.status==='completed'?{result:await resultFor(ctx,existing)}:{})};}
    const row={user_id:user.id,game:state.game,difficulty:state.difficulty,challenge_day:state.day,state,status:'active',started_at:new Date(now).toISOString(),expires_at:new Date(now+GAME_RULES.ttlMs).toISOString()};
    const res=await ctx.db.from('deshpath_game_sessions').insert(row).select('*').single();if(res.error?.code==='23505')problem('game-conflict',409);return{session:publicSession(checked(res))};
  }
  if(action==='game.answer'){
    exact(payload,['sessionId','answer']);const row=await ownedSession(ctx,payload.sessionId,user),next=answerSession(row,payload.answer,now);
    if(next.replay)return{session:publicSession(row),feedback:next.feedback,...(row.status==='completed'?{result:await resultFor(ctx,row)}:{})};
    const res=await ctx.db.rpc('deshpath_commit_game_answer',{p_session_id:row.id,p_user_id:user.id,p_revision:row.state.revision,p_state:next.state,p_status:next.status,p_score:next.score,p_duration_ms:next.durationMs});
    if(res.error){const conflict=/game-conflict|game-closed/.test(res.error.message||'');problem(conflict?'game-conflict':'game-service-unavailable',conflict?409:503);}
    const saved=res.data;return{session:publicSession(saved),feedback:next.feedback,...(saved.status==='completed'?{result:await resultFor(ctx,saved)}:{})};
  }
  if(action==='game.cancel'){
    exact(payload,['sessionId']);const row=await ownedSession(ctx,payload.sessionId,user);
    if(row.status==='active')checked(await ctx.db.from('deshpath_game_sessions').update({status:'cancelled',updated_at:new Date(now).toISOString()}).eq('id',row.id).eq('user_id',user.id).eq('status','active'));
    return{cancelled:true};
  }
  problem('invalid-action');
}
