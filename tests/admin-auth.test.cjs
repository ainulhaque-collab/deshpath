'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),adapter=fs.readFileSync(path.join(repo,'cloud.js'),'utf8'),ui=fs.readFileSync(path.join(repo,'admin-auth.js'),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
const fixture='  A fixture password 123!  ';
function cloudEnvironment(options={}){
  const calls=[],storage=new Map(),owner={id:'owner-fixture',email:'owner@example.test'},current={user:options.signedOut?null:owner};
  const result=error=>({data:{user:current.user},error:error||null});
  const main={auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},async getUser(){calls.push(['getUser']);return current.user?result():{data:{user:null},error:{name:'AuthSessionMissingError'}};},async getSession(){calls.push(['getSession']);return{data:{session:{user:options.sessionUser||current.user,access_token:'fixture-access',refresh_token:'fixture-refresh'}},error:null};},async signInWithPassword(value){calls.push(['passwordSignIn',value]);return{data:{user:options.loginUser||owner},error:options.loginError||null};}}};
  const temp={auth:{async setSession(value){calls.push(['bind',value]);return{data:{session:{}},error:options.bindError||null};},async getUser(){calls.push(['boundGetUser']);if(options.throwBound)throw Error('private-provider-detail');return{data:{user:options.boundUser||owner},error:null};},async updateUser(value){calls.push(['passwordUpdate',value]);return options.pendingUpdate?options.pendingUpdate():{data:{user:owner},error:options.updateError||null};},async dispose(){calls.push(['dispose']);}}};
  const window={DESH_CLOUD_CONFIG:{enabled:options.enabled!==false,authReady:options.authReady!==false,url:'https://project-fixture.supabase.co',publishableKey:'sb_publishable_fixture'},supabase:{createClient(url,key,config){calls.push(['client',config]);return config.auth.storageKey==='deshpath.cloud.password-change'?temp:main;}},localStorage:{setItem(k,v){storage.set(k,v);},getItem(k){return storage.get(k)||null;},removeItem(k){storage.delete(k);}},location:{href:'https://deshpath.vercel.app/#admin',hash:'#admin'},async fetch(url,request){calls.push(['api',JSON.parse(request.body)]);assert.equal(request.headers.apikey,'sb_publishable_fixture');assert.equal(request.headers.Authorization,'Bearer fixture-access');return{ok:true,status:200,async json(){return{isAdmin:options.isAdmin!==false,role:options.role||'owner'};}};}};
  vm.runInNewContext(adapter,{window,URL,URLSearchParams,TextEncoder,AbortController,setTimeout,clearTimeout,console});
  return{api:window.DESH_CLOUD,calls,storage,current,owner};
}
function uiEnvironment(options={}){
  const calls=[],callbacks=[],nodes=new Map();let language=options.lang||'en';
  class Element{
    constructor(tag='div',attrs='',parent=null){this.tag=tag;this.parentElement=parent;this.dataset={};this.events={};this.children=[];this.isConnected=true;this.value='';this.checked=false;this.disabled=false;this._html='';this.name=/\bname="([^"]*)"/.exec(attrs)?.[1];for(const attr of attrs.matchAll(/data-([a-z-]+)(?:="([^"]*)")?/g))this.dataset[attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attr[2]??'';this.value=/\bvalue="([^"]*)"/.exec(attrs)?.[1]||'';}
    set innerHTML(value){for(const child of this.children)child.isConnected=false;this.children=[];this._html=String(value);for(const match of this._html.matchAll(/<(form|input|button|p)\b([^>]*)>/g)){const child=new Element(match[1],match[2],this);this.children.push(child);if(child.name)nodes.set(child.name,child);}}
    get innerHTML(){return this._html;}
    querySelector(query){const name=/^\[name="([^"]+)"\]$/.exec(query)?.[1];if(name)return this.children.find(n=>n.name===name)||null;if(query==='[data-admin-auth-status]')return this.children.find(n=>Object.hasOwn(n.dataset,'adminAuthStatus'))||null;return null;}
    querySelectorAll(query){return query==='button,input'?this.children.filter(n=>n.tag==='button'||n.tag==='input'):[];}
    contains(node){for(let p=node;p;p=p.parentElement)if(p===this)return true;return false;}
    closest(query){if(query==='[data-admin-auth-form]'&&this.dataset.adminAuthForm)return this;if(query==='[data-admin-auth-action]'&&this.dataset.adminAuthAction)return this;return null;}
    addEventListener(name,callback){(this.events[name]??=[]).push(callback);}
    removeEventListener(name,callback){this.events[name]=(this.events[name]||[]).filter(value=>value!==callback);}
    setAttribute(name,value){this[name]=value;}
  }
  const mount=new Element(),user={id:'owner-fixture',email:'owner@example.test'};
  const cloud={enabled:options.enabled!==false,getStatus:()=>({authReady:options.authReady!==false}),async getUser(){calls.push(['getUser']);return options.signedOut?null:user;},async community(action){calls.push(['community',action]);return{isAdmin:options.isAdmin!==false,role:options.role||'owner'};},async signInWithPassword(email,password){calls.push(['login',email,password]);if(options.login) return options.login();if(options.loginError)throw options.loginError;return user;},async setMyAdminPassword(password,extra){calls.push(['setPassword',password,extra]);if(options.update)return options.update();if(options.updateError)throw options.updateError;return{updated:true};},async signOut(){calls.push(['signOut']);}};
  const window={DESH_CLOUD:cloud,location:{hash:'#admin'},DESH_I18N:{lang:language}};
  vm.runInNewContext(ui,{window,console});
  const api=window.DESH_ADMIN_AUTH.mount(mount,{mode:options.mode||'login',tr:(bn,en)=>language==='en'?en:bn,onAuthenticated:value=>callbacks.push(['authenticated',value]),onSignedOut:()=>callbacks.push(['signedOut']),onPasswordChanged:()=>callbacks.push(['passwordChanged']),onNeedsEmailLink:()=>callbacks.push(['emailLink'])});
  const status=()=>mount.querySelector('[data-admin-auth-status]');
  const form=()=>mount.children.find(node=>node.dataset.adminAuthForm);
  const submit=()=>{const event={target:form(),preventDefault(){}};return Promise.all((mount.events.submit||[]).map(f=>f(event)));};
  const click=action=>{const target=mount.children.find(node=>node.dataset.adminAuthAction===action);assert(target,'Action must be visible');return Promise.all((mount.events.click||[]).map(f=>f({target,preventDefault(){}})));};
  return{api,calls,callbacks,nodes,mount,cloud,status,submit,click,setLanguage(value){language=value;api.refreshLanguage();}};
}
(async()=>{
  for(const options of [{enabled:false},{authReady:false}]){
    const e=cloudEnvironment(options),expected=options.enabled===false?'cloud-disabled':'auth-not-ready';
    await assert.rejects(e.api.signInWithPassword('owner@example.test',fixture),error=>error.code===expected);
    await assert.rejects(e.api.setMyAdminPassword(fixture),error=>error.code===expected);assert.equal(e.calls.length,0);
  }
  const login=cloudEnvironment();assert.equal((await login.api.signInWithPassword('OWNER@EXAMPLE.TEST',fixture)).id,login.owner.id);
  assert.equal(login.calls.find(c=>c[0]==='passwordSignIn')[1].password,fixture,'Intentional spaces are preserved');
  assert.equal(login.calls.find(c=>c[0]==='passwordSignIn')[1].email,'owner@example.test');
  assert(login.calls.findIndex(c=>c[0]==='getUser')>login.calls.findIndex(c=>c[0]==='passwordSignIn'),'Auth server verification follows password sign-in');assert.equal(login.storage.size,0);
  for(const loginError of [{code:'invalid_credentials',message:'private-provider-detail'},{code:'user_not_found',message:'private-provider-detail'},{code:'email_not_confirmed',message:'private-provider-detail'}]){
    const e=cloudEnvironment({loginError});await assert.rejects(e.api.signInWithPassword('owner@example.test',fixture),error=>error.code==='invalid-credentials'&&!error.message.includes('private-provider'));
  }
  const mismatch=cloudEnvironment({loginUser:{id:'different-fixture'}});await assert.rejects(mismatch.api.signInWithPassword('owner@example.test',fixture),error=>error.code==='invalid-credentials');
  for(const options of [{isAdmin:false},{role:'moderator'},{signedOut:true},{sessionUser:{id:'different-fixture'}},{boundUser:{id:'different-fixture',email:'other@example.test'}}]){
    const e=cloudEnvironment(options);await assert.rejects(e.api.setMyAdminPassword(fixture));assert(!e.calls.some(c=>c[0]==='passwordUpdate'),'A missing/mismatched owner never changes a password');
  }
  const update=cloudEnvironment();assert.equal((await update.api.setMyAdminPassword(fixture,{currentPassword:'previous fixture'})).updated,true);
  const temporary=update.calls.find(c=>c[0]==='client'&&c[1].auth.storageKey==='deshpath.cloud.password-change')[1].auth;
  for(const key of ['persistSession','autoRefreshToken','detectSessionInUrl'])assert.equal(temporary[key],false);
  assert(update.calls.some(c=>c[0]==='api'&&c[1].action==='admin.status'));assert.equal(update.calls.find(c=>c[0]==='passwordUpdate')[1].password,fixture);assert.equal(update.calls.find(c=>c[0]==='passwordUpdate')[1].current_password,'previous fixture');assert(update.calls.some(c=>c[0]==='boundGetUser'));assert(update.calls.some(c=>c[0]==='dispose'));assert.equal(update.storage.size,0);
  for(const [updateError,code] of [[{code:'reauthentication_needed'},'password-reauth-required'],[{code:'current_password_required'},'password-current-required'],[{code:'weak_password'},'weak-password'],[{code:'same_password'},'password-unchanged'],[{status:429},'cloud-rate-limited'],[{code:'unexpected_failure',message:'private-provider-detail'},'password-update-failed']]){
    const e=cloudEnvironment({updateError});await assert.rejects(e.api.setMyAdminPassword(fixture),error=>error.code===code&&!error.message.includes('private-provider'));assert(e.calls.some(c=>c[0]==='dispose'));
  }
  const thrown=cloudEnvironment({throwBound:true});await assert.rejects(thrown.api.setMyAdminPassword(fixture),error=>error.code==='auth-unavailable'&&!error.message.includes('private-provider'));assert(thrown.calls.some(c=>c[0]==='dispose'));
  const invalid=cloudEnvironment();await assert.rejects(invalid.api.setMyAdminPassword('short'),error=>error.code==='invalid-password');assert.equal(invalid.calls.length,0);
  const initial=uiEnvironment();await flush();assert.equal(initial.calls.length,0,'Opening login must not send email or attempt sign-in');assert.match(initial.mount.innerHTML,/autocomplete="current-password"/);assert.match(initial.mount.innerHTML,/not your Gmail password/);
  initial.nodes.get('email').value='owner@example.test';initial.nodes.get('password').value=fixture;await initial.submit();assert.equal(initial.nodes.get('password').value,'');assert.equal(initial.callbacks[0][0],'authenticated');assert.equal(initial.calls[1][1],'admin.status');assert(!JSON.stringify(initial.api.getSnapshot()).includes(fixture));assert(!initial.mount.innerHTML.includes(fixture));
  const denied=uiEnvironment({isAdmin:false});denied.nodes.get('email').value='visitor@example.test';denied.nodes.get('password').value=fixture;await denied.submit();assert.equal(denied.callbacks.length,0);assert.match(denied.status().textContent,/does not have Deshpath administrator access/);assert(!denied.mount.innerHTML.includes(fixture));await denied.click('signout');assert.equal(denied.callbacks[0][0],'signedOut');
  const pending=uiEnvironment({login:()=>new Promise(resolve=>{pending.resolve=resolve;})});pending.nodes.get('password').value=fixture;const signing=pending.submit();await flush();assert.equal(pending.nodes.get('password').value,'','Clear before the network settles');assert.equal(pending.api.getSnapshot().busy,true);await pending.submit();assert.equal(pending.calls.filter(c=>c[0]==='login').length,1,'Repeated submission is blocked');pending.api.destroy();pending.resolve({id:'owner-fixture'});await signing;assert.equal(pending.callbacks.length,0,'A destroyed view must not unlock a replacement workspace');
  for(const options of [{role:'moderator'},{isAdmin:false},{signedOut:true}]){const e=uiEnvironment({...options,mode:'account'});await flush();assert(!e.mount.innerHTML.includes('data-admin-auth-form="password"'));assert(!e.calls.some(c=>c[0]==='setPassword'));}
  const owner=uiEnvironment({mode:'account'});await flush();assert.equal(owner.api.getSnapshot().hasOwnerAccess,true);assert.match(owner.mount.innerHTML,/shared sign-in account/);assert.match(owner.mount.innerHTML,/not your Gmail or Google password/);assert(!owner.nodes.get('sharedAccount').checked);assert(!owner.calls.some(c=>c[0]==='setPassword'));
  function fill(e,agree=true,confirm=fixture){e.nodes.get('newPassword').value=fixture;e.nodes.get('confirmPassword').value=confirm;e.nodes.get('sharedAccount').checked=agree;}
  fill(owner,false);await owner.submit();assert.equal(owner.api.getSnapshot().messageCode,'shared-account-confirmation-required');assert(!owner.calls.some(c=>c[0]==='setPassword'));assert.equal(owner.nodes.get('newPassword').value,'');
  fill(owner,true,'different fixture password');await owner.submit();assert.equal(owner.api.getSnapshot().messageCode,'passwords-mismatch');assert(!owner.calls.some(c=>c[0]==='setPassword'));
  fill(owner);await owner.submit();assert.equal(owner.calls.filter(c=>c[0]==='setPassword').length,1);assert.equal(owner.status().dataset.state,'success');assert.match(owner.status().textContent,/Password saved/);assert.equal(owner.nodes.get('sharedAccount').checked,false);assert.equal(owner.nodes.get('newPassword').value,'');assert.equal(owner.callbacks[0][0],'passwordChanged');assert(!JSON.stringify(owner.api.getSnapshot()).includes(fixture));
  owner.nodes.get('newPassword').value=fixture;owner.setLanguage('bn');assert.equal(owner.nodes.get('newPassword').value,'');assert.match(owner.mount.innerHTML,/আপনার Gmail বা Google পাসওয়ার্ড নয়/);await owner.click('email-link');assert.equal(owner.callbacks.at(-1)[0],'emailLink');assert(!owner.calls.some(c=>c[0]==='email'));
  for(const lang of ['en','bn']){const e=uiEnvironment({lang,loginError:{code:'invalid-credentials',message:'private-provider-detail'}});e.nodes.get('password').value=fixture;await e.submit();assert.equal(e.api.getSnapshot().messageCode,'invalid-credentials');assert(!e.status().textContent.includes('private-provider'));}
  const reauth=uiEnvironment({mode:'account',updateError:{code:'password-reauth-required',message:'private-provider-detail'}});await flush();fill(reauth);await reauth.submit();assert.match(reauth.status().textContent,/fresh email link/);assert(!reauth.status().textContent.includes('private-provider'));assert.equal(reauth.nodes.get('newPassword').value,'');assert.equal(reauth.callbacks.length,0);
  for(const options of [{enabled:false},{authReady:false}]){const e=uiEnvironment(options);await flush();assert.equal(e.calls.length,0);assert(!e.mount.innerHTML.includes('<form'));}
  const css=fs.readFileSync(path.join(repo,'admin-auth.css'),'utf8');assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
  console.log('PASS: explicit administrator password forms; generic login failures; post-login server verification; owner-only password update with a nonpersisted bound client; shared-account consent and matching password gates; no automatic credential writes or email; password fields cleared before await; denied role, account switch and destroyed-view protection; fixed bilingual errors; no provider details or credential persistence. Mock tests only; no password, email, or remote setting changed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
