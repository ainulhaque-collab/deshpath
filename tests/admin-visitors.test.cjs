'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
  const {handleCommunity}=await import(pathToFileURL(path.join(root,'backend/functions/deshpath-community/community.mjs')));
  function context(isAdmin){const calls=[],user={id:'11111111-1111-4111-8111-111111111111'};return {calls,user,requireUser:async()=>user,rateLimit:async()=>{},db:{from(table){assert.equal(table,'deshpath_admins');const q={table,filters:[]};calls.push(q);return {select(){return this;},eq(key,value){q.filters.push([key,value]);return this;},async maybeSingle(){return {data:isAdmin?{role:'owner'}:null,error:null};}};},async rpc(name,args){calls.push({name,args});return {data:{profiles:[],total:0,limited:false,limit:args.p_limit},error:null};}}};}
  const denied=context(false);await assert.rejects(handleCommunity('admin.visitors',{},denied),e=>e.code==='admin-required');assert(!denied.calls.some(c=>c.name));
  const allowed=context(true);const result=await handleCommunity('admin.visitors',{limit:20},allowed);assert.deepEqual(result.profiles,[]);assert.equal(allowed.calls.at(-1).args.p_actor,allowed.user.id);assert.equal(allowed.calls.at(-1).args.p_limit,20);
  for(const payload of [{limit:1000},{limit:0},{limit:'20'},{user_id:'someone-else'},{email:'other@example.test'}])await assert.rejects(handleCommunity('admin.visitors',payload,context(true)),e=>e.code==='invalid-input');
  const sql=fs.readFileSync(path.join(root,'backend/admin-visitors.sql'),'utf8');assert.match(sql,/security invoker set search_path=''/);assert.match(sql,/revoke all.+from public,anon,authenticated/);assert(!/auth\.users|deshpath_journals/.test(sql));
  console.log('PASS: visitor summaries require server membership, use the verified actor, reject forged scopes/oversized queries and exclude the shared Auth directory/private journals.');
})().catch(e=>{console.error(e);process.exitCode=1;});
