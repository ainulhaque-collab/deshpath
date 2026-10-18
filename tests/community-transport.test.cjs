'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function environment({signedIn=true,enabled=true,response={places:[]},status=200,sessionUserId='owner'}={}){
  const calls=[],user={id:'owner',email:'owner@example.test'};
  const window={DESH_CLOUD_CONFIG:{enabled,url:'https://project.supabase.co',publishableKey:'sb_publishable_test'},location:{href:'https://example.test/'},fetch:async(url,options)=>{calls.push({url,...options});return {ok:status<400,status,json:async()=>response};},supabase:{createClient(){calls.push({sdk:true});return {auth:{onAuthStateChange(){},getUser:async()=>signedIn?{data:{user}}:{error:{name:'AuthSessionMissingError'}},getSession:async()=>({data:{session:signedIn?{user:{...user,id:sessionUserId},access_token:'verified-user-jwt'}:null}})}};}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'cloud.js'),'utf8'),{window,document:{},URL,URLSearchParams,TextEncoder,AbortController,setTimeout,clearTimeout});
  return {api:window.DESH_CLOUD,calls,window};
}
(async()=>{
  const e=environment();await e.api.publicCommunity('catalog.list');
  assert.equal(e.calls.length,1);assert.equal(e.calls[0].headers.apikey,'sb_publishable_test');assert.equal(e.calls[0].headers.Authorization,undefined);assert.equal(e.calls[0].credentials,'omit');
  await assert.rejects(e.api.publicCommunity('admin.dashboard'),x=>x.code==='forbidden');assert.equal(e.calls.length,1);
  await e.api.community('admin.status');assert.equal(e.calls.at(-1).headers.Authorization,'Bearer verified-user-jwt');assert.equal(JSON.parse(e.calls.at(-1).body).action,'admin.status');
  const guest=environment({signedIn:false});await assert.rejects(guest.api.community('submission.save'),x=>x.code==='sign-in-required');assert.equal(guest.calls.filter(c=>c.url).length,0);
  const switched=environment({sessionUserId:'different-user'});await assert.rejects(switched.api.community('profile.save'),x=>x.code==='sign-in-required');assert.equal(switched.calls.filter(c=>c.url).length,0);
  const denied=environment({status:403,response:{error:{code:'forbidden',message:'sensitive provider detail'}}});await assert.rejects(denied.api.community('admin.dashboard'),x=>x.code==='forbidden'&&!x.message.includes('sensitive'));
  const off=environment({enabled:false});await assert.rejects(off.api.publicCommunity('catalog.list'),x=>x.code==='cloud-disabled');assert.equal(off.calls.length,0);
  await assert.rejects(e.api.uploadCommunityPhoto({},{}),x=>x.code==='consent-required');
  const events=[],catalogWindow={DESH_DATA:{places:[{id:'sajek',name:'Original'}],districts:[{id:'dhaka'}]},DESH_CLOUD_CONFIG:{url:'https://project.supabase.co'},DESH_CLOUD:{enabled:true,publicCommunity:async()=>({places:[{id:'community-good',district:'dhaka',name:'Approved',category:'nature',image:'https://project.supabase.co/storage/v1/object/public/deshpath-public/approved/a.jpg',en:{name:'Approved'},photos:[]},{id:'community-bad',district:'dhaka',name:'Tracker',category:'nature',image:'https://attacker.test/pixel.jpg'}]})}};
  const originalArray=catalogWindow.DESH_DATA.places;
  vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),{window:catalogWindow,document:{dispatchEvent:e=>events.push(e.type)},CustomEvent:class {constructor(type){this.type=type;}},URL});
  await catalogWindow.DESH_CATALOG.refresh();assert.equal(catalogWindow.DESH_DATA.places,originalArray);assert.equal(originalArray.length,2);assert.equal(originalArray[0].id,'sajek');assert.equal(originalArray[1].community,true);assert.deepEqual(events,['deshpath:catalogchange']);
  assert.equal(catalogWindow.DESH_CATALOG.safeImage('javascript:alert(1)'),'');assert.equal(catalogWindow.DESH_CATALOG.safeImage('https://project.supabase.co/storage/v1/object/sign/deshpath-private/a.jpg?token=x'),'');
  console.log('PASS: isolated public requests, verified private JWT, guest denial, fixed errors, upload consent, safe catalog media, original IDs and live array updates.');
})().catch(error=>{console.error(error);process.exitCode=1;});
