'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const tests=fs.readdirSync(__dirname).filter(name=>name.endsWith('.test.cjs')).sort();
for(const name of tests){const result=spawnSync(process.execPath,[path.join(__dirname,name)],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log(`${tests.length} test files passed.`);
