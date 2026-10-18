'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const repo=path.resolve(__dirname,'..'),UUID='10000000-0000-4000-8000-000000000001';
async function main(){
  const {makeChallenge,publicSession,answerSession,handleGames,challengeDay,photoScore}=await import(pathToFileURL(path.join(repo,'backend/functions/deshpath-community/games.mjs')));
  const at=Date.parse('2026-10-18T12:00:00Z'),user={id:UUID,email:'test@example.test'};
  assert.equal(challengeDay(Date.parse('2026-10-18T17:59:59Z')),'2026-10-18');assert.equal(challengeDay(Date.parse('2026-10-18T18:00:00Z')),'2026-10-19');
  for(const game of ['knowledge','photo','farthest','puzzle']){
    const levels=game==='puzzle'?['easy','medium','hard']:['standard'];
    for(const difficulty of levels){
      const state=makeChallenge(game,difficulty,'2026-10-18');assert.deepEqual(state,makeChallenge(game,difficulty,'2026-10-18'),'Challenge is identical for all users on the same day');
      let row={id:UUID,user_id:user.id,game,difficulty,challenge_day:'2026-10-18',state,status:'active',started_at:new Date(at).toISOString(),expires_at:new Date(at+3600000).toISOString()};
      assert(!JSON.stringify(publicSession(row)).includes('"correct"'),'Server answer keys never appear in challenges');
      assert.equal(state.rounds.length,game==='puzzle'?{easy:6,medium:12,hard:20}[difficulty]:5);
      if(game==='puzzle'){
        const wrong=state.rounds[0].options.find(o=>o.id!==state.rounds[0].correct).id;
        const failed=answerSession(row,{choice:wrong,round:0,requestId:'20000000-0000-4000-8000-000000000001'},at+1000);
        assert.equal(failed.state.index,0);assert.equal(failed.state.mistakes,1);assert.equal(failed.durationMs,6000);row={...row,state:failed.state};
      }
      for(let index=0;index<state.rounds.length;index++){
        const key='30000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),answer={choice:row.state.rounds[index].correct,round:index,requestId:key};
        const next=answerSession(row,answer,at+2000+index*1000);row={...row,state:next.state,status:next.status};
        const replay=answerSession(row,answer,at+2001+index*1000);assert.equal(replay.replay,true);assert.equal(replay.state.score,row.state.score,'Retry does not add points');
      }
      assert.equal(row.status,'completed');assert.equal(row.state.score,game==='photo'?5000:state.rounds.length);
      assert.throws(()=>answerSession(row,{choice:state.rounds[0].correct,round:0,requestId:'40000000-0000-4000-8000-000000000001'},at+60000),/game-closed/);
    }
  }
  assert.throws(()=>makeChallenge('personality','standard','2026-10-18'),/invalid-game/,'Personality is never ranked');
  assert.throws(()=>makeChallenge('puzzle','super','2026-10-18'),/invalid-game/);
  assert(photoScore(100)>photoScore(500));assert.equal(photoScore(700),0);
  const state=makeChallenge('knowledge','standard','2026-10-18'),row={id:UUID,user_id:user.id,game:'knowledge',difficulty:'standard',challenge_day:'2026-10-18',state,status:'active',started_at:new Date(at).toISOString(),expires_at:new Date(at+3600000).toISOString()};
  assert.throws(()=>answerSession(row,{choice:'invalid',round:0,requestId:UUID},at+1000),/invalid-answer/);
  assert.throws(()=>answerSession(row,{choice:state.rounds[0].correct,round:1,requestId:UUID},at+1000),/game-conflict/);
  assert.throws(()=>answerSession(row,{choice:state.rounds[0].correct,round:0,requestId:UUID,score:5000},at+1000),/invalid-input/);
  assert.throws(()=>answerSession(row,{choice:state.rounds[0].correct,round:0,requestId:UUID},at+3600000),/game-closed/);
  const first=answerSession(row,{choice:state.rounds[0].correct,round:0,requestId:UUID},at+1000);
  assert.throws(()=>answerSession({...row,state:first.state},{choice:first.state.rounds[1].correct,round:1,requestId:'50000000-0000-4000-8000-000000000001'},at+1001),/game-rate-limited/);

  // Exercise transport boundary guards and identity scoping independently of UI.
  const calls=[];
  const ctx={user,now:()=>at,requireUser:async()=>user,rateLimit:async()=>{},db:{from(table){calls.push(table);return{select(){return this;},eq(key,value){calls.push([key,value]);return this;},maybeSingle:async()=>({data:null,error:null})};}}};
  await assert.rejects(handleGames('game.answer',{sessionId:UUID,answer:{choice:'x',round:0,requestId:UUID}},ctx),/game-not-found/);
  assert(calls.some(c=>Array.isArray(c)&&c[0]==='user_id'&&c[1]===user.id),'Session reads are scoped to verified identity');
  await assert.rejects(handleGames('game.start',{game:'knowledge',score:5000},ctx),/invalid-input/);
  await assert.rejects(handleGames('game.start',{game:'knowledge',user_id:'attacker'},ctx),/invalid-input/);
  await assert.rejects(handleGames('analytics.record',{id:UUID,sessionId:UUID,event:'download_requested',exportType:'bangladesh-map',format:'png',consent:true,mapName:'private'},ctx),/invalid-input/);
  await assert.rejects(handleGames('analytics.record',{id:UUID,sessionId:UUID,event:'game_started',game:'knowledge',consent:false},ctx),/invalid-input/);
  const analytics=[];let opted=true;
  const analyticsCtx={now:()=>at,rateLimit:async()=>{},db:{from(table){return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{analytics_opt_in:opted},error:null}),insert:async v=>{analytics.push(v);return{data:null,error:null};}}}}};
  assert.deepEqual(await handleGames('analytics.record',{id:UUID,sessionId:UUID,event:'game_started',game:'knowledge',consent:true},analyticsCtx),{accepted:true});assert.equal(analytics[0].user_id,null,'Guests have no account identity');
  analyticsCtx.user=user;opted=false;assert.deepEqual(await handleGames('analytics.record',{id:UUID,sessionId:UUID,event:'game_started',game:'knowledge',consent:true},analyticsCtx),{accepted:false});assert.equal(analytics.length,1,'Revoked account consent blocks further optional events');
  await assert.rejects(handleGames('leaderboard.list',{game:'personality'},analyticsCtx),/invalid-input/);

  // Run only the optional analytics adapter in a DOM-free loading page. It must
  // discard private caller metadata and never queue events without consent.
  let consentValue='false',serial=1,online=true;const sent=[];
  const w={crypto:{randomUUID:()=>`60000000-0000-4000-8000-${String(serial++).padStart(12,'0')}`},navigator:{get onLine(){return online;}},DESH_CLOUD:{enabled:true,publicCommunity:async(action,payload)=>{sent.push({action,payload});return{accepted:true};}}};
  const store=new Map();const sandbox={window:w,document:{readyState:'loading',addEventListener(){}},localStorage:{getItem:()=>consentValue,setItem:(_k,v)=>consentValue=v},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},console,Date,Set,Map,CustomEvent:class{}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(repo,'ranked-games.js'),'utf8'),sandbox);
  assert.equal(await w.DESH_ACTIVITY.record('game_started',{game:'knowledge'}),false);assert.equal(sent.length,0);
  w.DESH_ACTIVITY.setConsent(true);assert.equal(await w.DESH_ACTIVITY.record('export_prepared',{exportType:'bangladesh-map',format:'png',mapName:'Secret',districts:['dhaka'],photo:'private'}),true);
  assert.deepEqual(Object.keys(sent[0].payload).sort(),['consent','event','exportType','format','id','sessionId'].sort());
  assert.equal(await w.DESH_ACTIVITY.record('screen_capture',{game:'knowledge'}),false);
  assert.equal(await w.DESH_ACTIVITY.record('game_started',{game:'invented'}),false);
  online=false;assert.equal(await w.DESH_ACTIVITY.record('game_started',{game:'knowledge'}),false);online=true;assert.equal(sent.length,1,'Offline events are not replayed');
  w.DESH_ACTIVITY.setConsent(false);assert.equal(store.size,0,'Opt-out removes the anonymous tab session');
  assert.equal(await w.DESH_ACTIVITY.record('game_started',{game:'knowledge'}),false);
  w.DESH_ACTIVITY.syncConsent(true);assert.equal(w.DESH_ACTIVITY.getConsent(),false,'Account refresh cannot override this device’s explicit opt-out');
  const css=fs.readFileSync(path.join(repo,'ranked-games.css'),'utf8');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'Ranked styles have balanced rules');

  const sql=fs.readFileSync(path.join(repo,'backend/games.sql'),'utf8');assert(!/security\s+definer/i.test(sql));assert(/unique\(user_id,game,difficulty,challenge_day\)/.test(sql));assert(/unique references public\.deshpath_game_sessions/.test(sql));assert(!/grant[^;]+to\s+(anon|authenticated)/i.test(sql),'No direct browser game/analytics grants');
  console.log('Daily online challenges: fair seeds, server answer keys/scoring/time, difficulty, replay/closed/rate guards, owned-session boundary, consented minimal analytics and service-only SQL checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
