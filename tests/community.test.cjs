'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
function environment({enabled=true,authReady=true,signedIn=true,callbackError=false,emailError=null,userError=null,lang='en',cloudJournal=null,initialValues={}}={}){
  const nodes=new Map(),observers=[],calls=[],messages=[],values=new Map(),authListeners=[];
  class Element{
    constructor(id,parent=null){this.id=id;this.parentElement=parent;this.children=[];this.dataset={};this.events={};this.value='';this.disabled=false;this.hidden=false;this.isConnected=true;this.style={};this._html='';}
    set innerHTML(html){for(const child of this.children)child.detach();this.children=[];this._html=String(html);this.parse(this._html);}
    get innerHTML(){return this._html;}
    detach(){this.isConnected=false;for(const child of this.children)child.detach();if(nodes.get(this.id)===this)nodes.delete(this.id);}
    parse(html){for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const child=new Element(match[1],this);child.value=/\bvalue="([^"]*)"/.exec(match[0])?.[1]||'';child.hidden=/\shidden(?:\s|>|=)/.test(match[0]);nodes.set(child.id,child);this.children.push(child);}for(const match of html.matchAll(/data-public-reviews="([^"]+)"/g)){const child=new Element('public-'+match[1],this);child.dataset.publicReviews=match[1];nodes.set(child.id,child);this.children.push(child);}for(const match of html.matchAll(/data-local-online-status="([^"]+)"/g)){const child=new Element('status-'+match[1],this);child.dataset.localOnlineStatus=match[1];nodes.set(child.id,child);this.children.push(child);}}
    insertAdjacentHTML(where,html){this._html+=html;this.parse(html);}
    addEventListener(name,callback){(this.events[name]??=[]).push(callback);}
    contains(element){for(let p=element;p;p=p.parentElement)if(p===this)return true;return false;}
    querySelector(query){if(query.startsWith('#'))return nodes.get(query.slice(1))||null;if(query==='button[type=submit]')return new Element('submit',this);return null;}
    querySelectorAll(query){const all=[...nodes.values()].filter(node=>node!==this&&this.contains(node));if(query==='[data-review-place]:not([data-review-ready])')return all.filter(node=>node.dataset.reviewPlace&&!node.dataset.reviewReady);if(query==='[data-public-reviews]')return all.filter(node=>node.dataset.publicReviews);if(query==='[data-local-online-status]')return all.filter(node=>node.dataset.localOnlineStatus);return [];}
    closest(query){if(query==='[data-review-place]'){for(let p=this;p;p=p.parentElement)if(p.dataset.reviewPlace)return p;}return null;}
    reportValidity(){return true;}setAttribute(key,value){this[key]=value;}removeAttribute(key){delete this[key];}reset(){}focus(){}
  }
  for(const id of ['communityRoot','profileRoot','dialogBody','contentDialog'])nodes.set(id,new Element(id));nodes.get('contentDialog').open=true;
  const document={activeElement:null,querySelector:query=>nodes.get(query.slice(1))||null,createElement:tag=>new Element('created-'+tag),body:new Element('body')};
  const localStorage={getItem:key=>values.has(key.slice(9))?JSON.stringify(values.get(key.slice(9))):null,setItem:(key,value)=>values.set(key.slice(9),JSON.parse(value)),removeItem:key=>values.delete(key.slice(9)),get length(){return values.size;},key:index=>'deshpath.'+[...values.keys()][index]};
  let user=signedIn?{id:'owner-a',email:'owner@example.test'}:null;
  const own={contributions:[],reviews:[]};
  const cloud={enabled,getStatus:()=>({enabled,authReady}),async completeAuthCallback(){calls.push(['callback']);if(callbackError)throw typeof callbackError==='object'?callbackError:Error('bad callback');return {handled:false};},async getUser(){calls.push(['getUser']);if(userError)throw userError;return user;},onAuthChange(callback){authListeners.push(callback);},async listApprovedContributions(){calls.push(['publicStories']);return [{id:'published-1',district_id:'dhaka',title:'<img src=x>',body:'Public <script> story'}];},async listApprovedReviews(id){calls.push(['publicReviews',id]);return [{id:'published-review',place_id:id,rating:4,body:'Approved <script> review'}];},async listMySubmissions(){calls.push(['mine']);return JSON.parse(JSON.stringify(own));},async submitContribution(payload){calls.push(['submitStory',payload]);const row={id:'story-owned',district_id:payload.districtId,title:payload.title,body:payload.body,status:'pending'};own.contributions.push(row);return row;},async submitReview(payload){calls.push(['submitReview',payload]);const row={id:'review-owned',place_id:payload.placeId,rating:payload.rating,body:payload.body,status:'pending'};own.reviews.push(row);return row;},async requestMagicLink(email){calls.push(['email',email]);if(emailError)throw emailError;return {accepted:true,email,method:'email'};},async verifyOtp(email,code){calls.push(['verifyOtp',email,code]);user={id:'owner-a',email};return user;},async signOut(){user=null;authListeners.forEach(f=>f('SIGNED_OUT'));}};
  cloud.saveJournal=async snapshot=>{calls.push(['saveJournal',snapshot]);return {updatedAt:'2026-10-18T00:00:00Z'};};
  cloud.loadJournal=async()=>{calls.push(['loadJournal']);return cloudJournal;};
  const window={DESH_CLOUD:cloud,DESH_I18N:{lang},addEventListener(){}};
  const context={window,document,localStorage,MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}},crypto:{randomUUID:()=> 'new-id'},console,Map,Set,Object,Number,Array,String,Math,Date,JSON,Promise,Blob:class{},location:{reload(){}},setTimeout,clearTimeout};vm.createContext(context);
  for(const name of ['data.js','content-en.js','world-data.js','journal-kit.js'])vm.runInContext(fs.readFileSync(path.join(repo,name),'utf8'),context);
  const data=window.DESH_DATA,place=data.places[0];
  const draft={id:'draft-one',kind:'place',district:'dhaka',title:'My private draft',area:'A local area',description:'An original private story with enough characters for meaningful validation.',directions:'Directions are long enough to describe the journey.',notes:'Private travel notes to submit explicitly',author:'My own name',createdAt:'2026-10-18T00:00:00Z',photoId:'draft-photo'};
  const review={id:'review-one',placeId:place.id,rating:5,body:'My private review, sent only after an explicit click.',createdAt:'2026-10-18T00:00:00Z',photoId:'review-photo'};
  values.set('contributions',[draft]);values.set('reviews',[review]);
  for(const [key,value] of Object.entries(initialValues))values.set(key,value);
  window.DESH_JOURNAL.media=async()=>[];
  // Normalize VM-created object prototypes at the test boundary; keep the real validator.
  const validateBackup=window.DESH_JOURNAL.validateBackup;
  window.DESH_JOURNAL.validateBackup=value=>validateBackup(JSON.parse(JSON.stringify(value)));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const helpers={$:(query,root=document)=>root.querySelector(query),esc,bn:String,tr:(b,e)=>window.DESH_I18N.lang==='en'?(e??b):b,storage:{get:(key,fallback)=>values.has(key)?values.get(key):fallback,set:(key,value)=>values.set(key,value)},districts:data.districts,places:data.places,districtName:d=>d.en,districtById:new Map(data.districts.map(d=>[d.id,d])),placeText:(p,f)=>window.DESH_EN.places[p.id]?.[f]||p[f],toast:message=>messages.push(message)};
  vm.runInContext(fs.readFileSync(path.join(repo,'community-profile.js'),'utf8'),context);const api=window.initDeshCommunity(helpers);
  async function event(node,type,target){for(const callback of node.events[type]||[])await callback({target,preventDefault(){}});await flush();}
  const clicked=(selector,node)=>({closest:q=>q===selector?node:null});
  function button(dataset){const node=new Element('button');node.dataset=dataset;return node;}
  function openPlace(){const mount=new Element('reviewMount',nodes.get('dialogBody'));mount.dataset.reviewPlace=place.id;nodes.set(mount.id,mount);for(const observer of observers)observer.callback();return mount;}
  return {nodes,calls,messages,values,cloud,own,api,helpers,window,event,clicked,button,openPlace,place,draft,review,authListeners};
}
(async()=>{
  const disabled=environment({enabled:false,authReady:false});await flush();assert.equal(disabled.calls.length,0,'Local mode must make no cloud calls');
  const setup=environment({authReady:false});await flush();assert.ok(setup.calls.some(c=>c[0]==='publicStories'));assert.ok(!setup.calls.some(c=>['getUser','callback','email','mine'].includes(c[0])));assert.match(setup.nodes.get('cloudProfile').innerHTML,/Final settings are still needed/);assert.ok(!setup.nodes.get('cloudProfile').innerHTML.includes('id="cloudLogin"'));assert.ok(!setup.nodes.get('contributionDrafts').innerHTML.includes('data-send-draft'));
  assert.match(setup.nodes.get('approvedCommunityStories').innerHTML,/&lt;img src=x&gt;/);assert.ok(!setup.nodes.get('approvedCommunityStories').innerHTML.includes('<script>'));
  const ready=environment();await flush();assert.equal(ready.calls.filter(c=>c[0]==='callback').length,1);assert.equal(ready.calls.filter(c=>['submitStory','submitReview','email'].includes(c[0])).length,0,'Sign-in must not upload private notes or send email automatically');
  const storyButton=ready.button({sendDraft:ready.draft.id});await ready.event(ready.nodes.get('communityRoot'),'click',ready.clicked('[data-send-draft]',storyButton));const storyCall=ready.calls.find(c=>c[0]==='submitStory');assert.deepEqual(Object.keys(storyCall[1]).sort(),['body','districtId','title']);assert.ok(!JSON.stringify(storyCall).includes('photo'));assert.match(ready.nodes.get('myOnlineSubmissions').innerHTML,/Awaiting review/);assert.ok(!ready.nodes.get('approvedCommunityStories').innerHTML.includes('My private draft'));
  const mount=ready.openPlace();await flush();assert.match(mount.innerHTML,/Submit text & rating for review/);assert.match(ready.nodes.get('public-'+ready.place.id).innerHTML,/4\.0/);assert.match(ready.nodes.get('public-'+ready.place.id).innerHTML,/Approved &lt;script&gt; review/);
  const reviewButton=ready.button({sendReview:ready.review.id});await ready.event(ready.nodes.get('dialogBody'),'click',ready.clicked('[data-send-review]',reviewButton));const reviewCall=ready.calls.find(c=>c[0]==='submitReview');assert.deepEqual(Object.keys(reviewCall[1]).sort(),['body','placeId','rating']);assert.equal(reviewCall[1].body,ready.review.body);assert.ok(!JSON.stringify(reviewCall).includes('photo'));assert.match(ready.nodes.get('myOnlineSubmissions').innerHTML,/Awaiting review/);assert.equal(ready.api.getSnapshot().reviews,1,'Online submit must preserve private note');
  await ready.event(ready.nodes.get('dialogBody'),'click',ready.clicked('[data-send-review]',reviewButton));assert.equal(ready.calls.filter(c=>c[0]==='submitReview').length,1,'Already-submitted place must not submit twice');
  const signedOut=environment({signedIn:false});await flush();assert.match(signedOut.nodes.get('cloudProfile').innerHTML,/same browser and device/);assert.match(signedOut.nodes.get('cloudProfile').innerHTML,/pattern="\[0-9\]\{6,10\}"/);assert.equal(signedOut.calls.filter(c=>c[0]==='email').length,0);signedOut.nodes.get('cloudEmail').value='visitor@example.test';await signedOut.event(signedOut.nodes.get('profileRoot'),'submit',signedOut.nodes.get('cloudLogin'));assert.equal(signedOut.calls.filter(c=>c[0]==='email').length,1);assert.match(signedOut.nodes.get('cloudStatus').textContent,/Sign-in email requested/);
  const failed=environment({callbackError:true,signedIn:false});await flush();assert.match(failed.nodes.get('cloudProfile').innerHTML,/Email-link sign-in did not finish/);
  for(const [code,en,bn] of [['cloud-rate-limited',/request limit/,/অনুরোধের সীমা/],['email-unavailable',/email service cannot send/,/লগইন ইমেইল পাঠাতে পারছে না/]]){
    for(const lang of ['en','bn']){
      const rejected=environment({signedIn:false,lang,emailError:{code,message:'secret-provider-detail'}});await flush();
      rejected.nodes.get('cloudEmail').value='visitor@example.test';await rejected.event(rejected.nodes.get('profileRoot'),'submit',rejected.nodes.get('cloudLogin'));
      assert.match(rejected.nodes.get('cloudStatus').textContent,lang==='en'?en:bn);assert.ok(!rejected.nodes.get('cloudStatus').textContent.includes('secret-provider-detail'));
      assert.equal(rejected.calls.filter(c=>c[0]==='email').length,1);assert.equal(rejected.api.getSnapshot().drafts,1,'Provider failures retain local drafts');
    }
  }
  const limitedStatus=environment({userError:{code:'cloud-rate-limited'}});await flush();assert.match(limitedStatus.nodes.get('cloudProfile').innerHTML,/request limit/);
  const limitedLink=environment({signedIn:false,callbackError:{code:'cloud-rate-limited'}});await flush();assert.match(limitedLink.nodes.get('cloudProfile').innerHTML,/request limit/);
  for(const lang of ['en','bn']){
    const empty=environment({lang});await flush();
    await empty.event(empty.nodes.get('profileRoot'),'click',empty.clicked('#cloudLoad',empty.nodes.get('cloudLoad')));
    assert.equal(empty.calls.filter(c=>c[0]==='loadJournal').length,1);
    assert.match(empty.nodes.get('cloudStatus').textContent,lang==='en'?/no cloud copy yet/:/ক্লাউড কপি নেই/);
    assert.equal(empty.nodes.get('backupPreview').hidden,true);assert.equal(empty.nodes.get('confirmRestore').hidden,true);
  }
  const localProfile={name:'Local traveller',bio:'Keep my local profile'};
  const privatePhotoData={mapAvatar:{src:'data:image/png;base64,AAAA',width:1,height:1},photoAssignments:{dhaka:'personal-photo'},photoGroups:[]};
  const saving=environment({initialValues:{profile:localProfile,visited:['dhaka'],...privatePhotoData}});await flush();
  assert.equal(saving.calls.filter(c=>c[0]==='saveJournal').length,0,'Signing in never saves the journal automatically');
  await saving.event(saving.nodes.get('profileRoot'),'click',saving.clicked('#cloudSave',saving.nodes.get('cloudSave')));
  const saved=saving.calls.find(c=>c[0]==='saveJournal')[1];
  assert.equal(saved.app,'deshpath');assert.equal(saved.version,1);assert.equal(saved.values.profile.name,localProfile.name);assert.equal(saved.values.visited[0],'dhaka');
  for(const key of Object.keys(privatePhotoData)){assert.ok(!Object.hasOwn(saved.values,key),'Cloud text snapshot excludes '+key);assert.deepEqual(saving.values.get(key),privatePhotoData[key],'Local photo data remains available');}
  assert.match(saving.nodes.get('cloudStatus').textContent,/saved to cloud/);
  const loading=environment({initialValues:{profile:localProfile,visited:['dhaka']},cloudJournal:{snapshot:{app:'deshpath',version:1,values:{profile:{name:'Cloud traveller',bio:'Cloud profile'},visited:[]}},updatedAt:'2026-10-18T00:00:00Z'}});await flush();
  assert.equal(loading.nodes.get('backupPreview').hidden,true);assert.equal(loading.nodes.get('confirmRestore').hidden,true);
  await loading.event(loading.nodes.get('profileRoot'),'click',loading.clicked('#cloudLoad',loading.nodes.get('cloudLoad')));
  assert.equal(loading.nodes.get('backupPreview').hidden,false);assert.equal(loading.nodes.get('confirmRestore').hidden,false);assert.match(loading.nodes.get('cloudStatus').textContent,/Cloud copy ready/);
  assert.equal(loading.values.get('profile').name,localProfile.name);assert.equal(loading.nodes.get('profileName').value,localProfile.name);assert.deepEqual(loading.values.get('visited'),['dhaka'],'Loading only previews; replacement needs explicit Restore');
  const rerender=environment();await flush();let rejectSave;
  rerender.cloud.saveJournal=snapshot=>{rerender.calls.push(['saveJournal',snapshot]);return new Promise((resolve,reject)=>{rejectSave=reject;});};
  const pendingSave=rerender.event(rerender.nodes.get('profileRoot'),'click',rerender.clicked('#cloudSave',rerender.nodes.get('cloudSave')));await flush();
  const originalStatus=rerender.nodes.get('cloudStatus');assert.match(originalStatus.textContent,/Completing your request/);
  rerender.authListeners.forEach(callback=>callback('TOKEN_REFRESHED'));await flush();
  const currentStatus=rerender.nodes.get('cloudStatus');assert.notEqual(currentStatus,originalStatus);assert.equal(originalStatus.isConnected,false);
  rejectSave({code:'cloud-rate-limited',message:'secret-provider-detail'});await pendingSave;
  assert.match(currentStatus.textContent,/request limit/);assert.ok(!currentStatus.textContent.includes('secret-provider-detail'));
  const large=environment();await flush();large.draft.description='x'.repeat(2000);large.draft.directions='y'.repeat(1000);large.draft.notes='z'.repeat(1000);large.draft.area='a'.repeat(100);await large.event(large.nodes.get('communityRoot'),'click',large.clicked('[data-send-draft]',large.button({sendDraft:large.draft.id})));assert.equal(large.calls.filter(c=>c[0]==='submitStory').length,0);assert.match(large.messages.at(-1),/4,000 characters/);assert.equal(large.api.getSnapshot().drafts,1);
  const css=fs.readFileSync(path.join(repo,'journal-features.css'),'utf8');assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
  console.log('PASS: local mode no cloud calls; auth-setup mode public reads only; one callback; escaped approved stories/reviews; private notes never auto-upload; explicit text-only story/review payloads; pending status separated from public feed; duplicate review blocked; note retained; email-link/optional6–10digit code UI; email only after submit; bilingual provider rate/config errors preserve local drafts and hide provider details; callback/status rate errors visible; empty cloud copy guidance; explicit save omits photo fields without deleting local data; cloud load previews without replacing local profile; pending operation errors survive auth rerenders; balanced CSS.');
})().catch(error=>{console.error(error);process.exitCode=1;});
