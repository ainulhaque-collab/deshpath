'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,DESH_PORT:'0'},stdio:['ignore','pipe','pipe']});
(async()=>{
  const port=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(Error('Preview server did not start')),10000);child.once('error',reject);child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Preview server exited: '+code));});});
  const base='http://127.0.0.1:'+port+'/';
  const index=await fetch(base);assert.equal(index.status,200);assert.match(index.headers.get('content-type'),/text\/html/);
  const html=await index.text();assert(html.includes('worldPassportRoot')&&html.includes('communityRoot'));
  const manifestResponse=await fetch(base+'manifest.webmanifest');assert.match(manifestResponse.headers.get('content-type'),/application\/manifest\+json/);
  const manifest=await manifestResponse.json();assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons){const response=await fetch(base+icon.src);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/png/);const data=Buffer.from(await response.arrayBuffer());assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');}
  const assets=await(await fetch(base+'offline-assets.json')).json();assert(assets.length>80);
  for(let i=0;i<assets.length;i+=8)await Promise.all(assets.slice(i,i+8).map(async asset=>{const response=await fetch(new URL(asset,base),{method:'HEAD'});assert.equal(response.status,200,asset);assert(Number(response.headers.get('content-length'))>0,asset);}));
  assert.equal((await fetch(base+'.git/config')).status,403,'Git metadata cannot be served');
  assert.equal((await fetch(base+'%2e%2e%5cREADME.md')).status,403,'Encoded traversal cannot escape root');
  assert.equal((await fetch(base,{method:'POST'})).status,405,'Static preview rejects writes');
  console.log('Static server checks passed: app, manifest MIME, PNG icons, '+assets.length+' offline assets, protected metadata/traversal and read-only methods.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>child.kill());
