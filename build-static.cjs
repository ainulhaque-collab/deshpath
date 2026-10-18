'use strict';
// Publish the browser application only, excluding SQL, tests and operational notes.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,out=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(root).filter(name=>/\.(js|css)$/.test(name)||['index.html','manifest.webmanifest','offline-assets.json'].includes(name));
for(const file of files)fs.copyFileSync(path.join(root,file),path.join(out,file));
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
console.log(`Prepared browser application: ${files.length} root files plus assets.`);
