'use strict';
window.initDeshMap = function ({$, $$, esc, bn, icon, storage, districts, divisions, districtById, sortedDistricts, districtFoods, districtName, divisionName, foodText, tr, toast, openDialog}) {
  const selected = new Set((Array.isArray(storage.get('visited',[])) ? storage.get('visited',[]) : []).filter(id=>districtById.has(id)));
  const foodData = window.DESH_FOODS;
  const photoData = window.DESH_FOOD_IMAGES?.districts || {};
  const sourceById = new Map(foodData.sources.map(source=>[source.id,source]));
  const themes = {emerald:'#216b58',sunset:'#b66e48',ocean:'#397d9d',midnight:'#71618e'};
  let theme = storage.get('theme','emerald');
  if (!themes[theme]) theme='emerald';
  let mapStyle = storage.get('mapStyle','food') === 'color' ? 'color' : 'food';
  let mapName = String(storage.get('name','')).slice(0,36);
  const failedPhotos = new Set();
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox',window.DESH_MAP.viewBox);
  svg.setAttribute('class','bangladesh-map');
  svg.setAttribute('role','group');
  const defs=document.createElementNS(svgNS,'defs');svg.append(defs);
  const paths=new Map(), bounds=new Map();
  for(const item of window.DESH_MAP.paths){
    const district=districtById.get(item.id); if(!district)continue;
    const path=document.createElementNS(svgNS,'path');
    path.setAttribute('d',item.d);path.setAttribute('class','district-path');
    path.setAttribute('tabindex','0');path.setAttribute('role','button');path.dataset.district=item.id;
    path.append(document.createElementNS(svgNS,'title'));
    svg.append(path);paths.set(item.id,path);
  }
  $('#mapMount').append(svg);
  for(const [id,path] of paths){const b=path.getBBox();bounds.set(id,{x:b.x,y:b.y,width:b.width,height:b.height});}
  function photo(id){return failedPhotos.has(id)?null:photoData[id];}
  function photoName(item){return tr(item.name,item.nameEn);}
  function ensurePattern(id){
    if(defs.querySelector('#food-'+id))return;
    const item=photo(id),b=bounds.get(id);if(!item||!b)return;
    const pattern=document.createElementNS(svgNS,'pattern');
    pattern.id='food-'+id;pattern.setAttribute('patternUnits','userSpaceOnUse');
    for(const key of ['x','y','width','height'])pattern.setAttribute(key,b[key]);
    pattern.setAttribute('viewBox',`0 0 ${b.width} ${b.height}`);
    pattern.setAttribute('preserveAspectRatio','xMidYMid slice');
    const image=document.createElementNS(svgNS,'image');image.setAttribute('href',item.src);
    image.setAttribute('x','0');image.setAttribute('y','0');
    for(const key of ['width','height'])image.setAttribute(key,b[key]);
    image.setAttribute('preserveAspectRatio','xMidYMid slice');
    image.addEventListener('error',()=>{failedPhotos.add(id);pattern.remove();updateSelection();},{once:true});
    pattern.append(image);defs.append(pattern);
  }
  function filteredDistricts(){const query=$('#districtSearch').value.trim().toLowerCase(),division=$('#divisionFilter').value;return sortedDistricts.filter(d=>(division==='all'||d.division===division)&&(!query||(d.name+' '+d.en).toLowerCase().includes(query)));}
  function renderDivisions(){const value=$('#divisionFilter').value||'all';$('#divisionFilter').innerHTML=`<option value="all">${tr('সব বিভাগ','All divisions')}</option>`+divisions.map(d=>`<option value="${d.id}">${esc(divisionName(d))}</option>`).join('');$('#divisionFilter').value=value;}
  function updateSelectAll(){const list=filteredDistricts();$('#selectAll').textContent=list.length&&list.every(d=>selected.has(d.id))?tr('বাছাই মুছুন','Clear selection'):tr('সব বাছাই','Select all');$('#selectAll').disabled=!list.length;}
  function renderDistricts(){const list=filteredDistricts();$('#districtList').innerHTML=list.length?list.map(d=>`<button class="district-button${selected.has(d.id)?' selected':''}" data-district="${d.id}" aria-pressed="${selected.has(d.id)}"><span class="district-checkbox">${selected.has(d.id)?icon('check'):''}</span>${esc(districtName(d))}</button>`).join(''):`<p class="no-districts">${tr('কোনো জেলা পাওয়া যায়নি।','No district found.')}</p>`;updateSelectAll();}
  function updateSelection(){
    let pictured=0;
    svg.setAttribute('aria-label',tr('বাংলাদেশের ৬৪ জেলা। এন্টার বা স্পেস দিয়ে জেলা বাছাই করুন।','Bangladesh, 64 districts. Press Enter or Space to select a district.'));
    for(const [id,path] of paths){
      const yes=selected.has(id),item=photo(id),hasPhoto=yes&&mapStyle==='food'&&!!item;
      path.classList.toggle('visited',yes);path.classList.toggle('photo-filled',hasPhoto);path.setAttribute('aria-pressed',String(yes));
      if(hasPhoto){ensurePattern(id);path.style.fill=`url(#food-${id})`;pictured++;}else path.style.removeProperty('fill');
      const title=districtName(districtById.get(id))+(yes?' · '+tr('ঘুরেছি','Visited'):'')+(hasPhoto?' · '+photoName(item):'');
      path.setAttribute('aria-label',title);path.querySelector('title').textContent=title;
    }
    $$('.district-button').forEach(button=>{const yes=selected.has(button.dataset.district);button.classList.toggle('selected',yes);button.setAttribute('aria-pressed',String(yes));$('.district-checkbox',button).innerHTML=yes?icon('check'):'';});
    $('#visitedCount').textContent=bn(selected.size);const percent=Math.round(selected.size/64*100);$('#visitedPercent').textContent=bn(percent)+'%';$('#mapProgress').style.width=percent+'%';
    $$('[data-map-style]').forEach(b=>{const active=b.dataset.mapStyle===mapStyle;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('#mapPhotoNote').textContent=mapStyle==='color'?tr('পছন্দের রঙে দেখুন আপনার ঘুরে আসা জেলাগুলো।','Show your visited districts in your favourite colour.'):selected.size?tr(`${bn(pictured)}টি জেলার ভেতরে স্থানীয় খাবারের ছবি। ছবি না থাকলে রং দেখাবে।`,`${pictured} districts filled with local food photos. Colour is used where a verified photo is unavailable.`):tr('জেলা বাছলেই তার ভেতরে স্থানীয় খাবারের ছবি ফুটে উঠবে।','Select a district to fill its shape with a local food photo.');
    $('.map-workspace').classList.toggle('food-map',mapStyle==='food');updateSelectAll();renderFoods();
  }
  function toggleDistrict(id){if(!districtById.has(id))return;selected.has(id)?selected.delete(id):selected.add(id);storage.set('visited',[...selected]);updateSelection();}
  svg.addEventListener('click',event=>{const path=event.target.closest('[data-district]');if(path)toggleDistrict(path.dataset.district);});
  svg.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.district){event.preventDefault();toggleDistrict(event.target.dataset.district);}});
  const tooltip=$('#mapTooltip');
  svg.addEventListener('pointermove',event=>{
    const path=event.target.closest('[data-district]');if(!path){tooltip.hidden=true;return;}
    const id=path.dataset.district,item=photo(id);tooltip.textContent=districtName(districtById.get(id))+' · '+(selected.has(id)?tr('ঘুরেছি','Visited'):tr('বেছে নিন','Select'))+(selected.has(id)&&mapStyle==='food'&&item?' · '+photoName(item):'');tooltip.hidden=false;
    const box=$('.map-canvas-panel').getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(event.clientX-box.left+12,box.width-225))+'px';tooltip.style.top=Math.max(42,Math.min(event.clientY-box.top-38,box.height-48))+'px';
  });
  svg.addEventListener('pointerleave',()=>tooltip.hidden=true);
  function foodSourceLinks(items){const ids=[...new Set(items.flatMap(item=>item.sourceIds||[]))];return ids.map(id=>sourceById.get(id)).filter(Boolean).map((source,i)=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" title="${esc(tr(source.title,window.DESH_EN?.sources[source.id]||source.title))}">${tr('তথ্যসূত্র','Source')}${ids.length>1?' '+bn(i+1):''} ${icon('arrow-up-right')}</a>`).join('');}
  function renderFoods(){
    $('#foodPhotoDisclaimer').textContent=tr('খাবার ও স্থানীয় পণ্যের প্রতিনিধিত্বমূলক ছবি। নির্দিষ্ট দোকান, উৎপাদক বা ফলের জাতের ছবি নয়। উৎস ও লাইসেন্স কৃতজ্ঞতা অংশে আছে।','Food photos represent the food or local product, rather than a particular shop, producer or fruit cultivar. Sources and licences are listed in the credits.');
    const kinds={dish:tr('স্থানীয় পদ','Local dish'),sweet:tr('মিষ্টি','Sweet'),produce:tr('ফল ও ফসল','Fruit & crops'),drink:tr('পানীয়','Drink'),dairy:tr('দুগ্ধপণ্য','Dairy'),pantry:tr('রান্নার উপকরণ','Pantry'),fish:tr('মাছ ও শুঁটকি','Fish & dried fish')};
    const list=sortedDistricts.filter(d=>selected.has(d.id)),count=list.reduce((sum,d)=>sum+districtFoods(d.id).length,0);
    $('#foodSummary').textContent=list.length?tr(`${bn(list.length)}টি জেলার বাছাই · ${bn(count)}টি স্থানীয় স্বাদ`,`${list.length} districts selected · ${count} local flavours`):tr('একটি জেলা বেছে নিলেই তার পরিচিত খাবার এখানে যোগ হবে।','Select a district to discover its local flavours.');
    $('#districtFoods').classList.toggle('is-empty',!list.length);
    $('#districtFoods').innerHTML=list.length?list.map(d=>{const items=districtFoods(d.id),image=photo(d.id);return `<article class="food-card${items.length?'':' food-pending'}" data-food-district="${d.id}">${image?`<figure class="food-photo"><img src="${esc(image.src)}" alt="${esc(photoName(image))}" loading="lazy"><figcaption>${esc(photoName(image))}</figcaption></figure>`:''}<div class="food-card-heading"><span class="food-district-icon">${icon('map-pin')}</span><div><h4>${esc(districtName(d))}</h4><span>${tr(bn(items.length)+'টি পরিচিত স্বাদ',items.length+' local flavours')}</span></div><span class="food-selected-mark" aria-label="${tr('মানচিত্রে বাছাই করা','Selected on your map')}">${icon('check')}</span></div>${items.length?`<ul class="food-items">${items.map(item=>`<li><div><strong>${esc(foodText(item,'name'))}</strong><span class="food-kind">${esc(kinds[item.kind]||tr('স্থানীয় স্বাদ','Local flavour'))}</span></div><p>${esc(foodText(item,'note'))}</p></li>`).join('')}</ul><div class="food-source-links">${foodSourceLinks(items)}</div>`:`<p class="food-pending-note">${tr('এই জেলার নির্ভরযোগ্য খাবারের তথ্য এখনও যোগ করা হয়নি।','Verified food information for this district has not been added yet.')}</p>`}</article>`;}).join(''):`<div class="food-empty-copy"><span class="food-empty-icon">${icon('utensils')}</span><div><strong>${tr('ভ্রমণের গল্পে স্বাদটুকুও থাকুক','Let local flavours be part of your journey')}</strong><p>${tr('মানচিত্রে জেলা বাছুন, অথবা শুরু করুন এই পরিচিত স্বাদগুলো দিয়ে।','Choose a district on the map, or start with one of these local favourites.')}</p></div></div><div class="food-examples">${['tangail','bogura','cumilla'].map(id=>`<button class="food-example" data-food-example="${id}"><span>${esc(districtName(districtById.get(id)))}</span><strong>${esc(foodText(districtFoods(id)[0],'name'))}</strong>${icon('plus')}</button>`).join('')}</div>`;
  }
  $('#districtFoods').addEventListener('click',event=>{const b=event.target.closest('[data-food-example]');if(b)toggleDistrict(b.dataset.foodExample);});
  $('#includeFoods').checked=storage.get('includeFoods',true)!==false;
  $('#includeFoods').addEventListener('change',event=>storage.set('includeFoods',event.target.checked));
  $('#foodSources').addEventListener('click',()=>openDialog(()=>`<div class="dialog-copy"><div class="eyebrow">${tr('স্থানীয় স্বাদের তথ্য','Local flavour notes')}</div><h2>${tr('খাবারের তথ্য কোথা থেকে?','Where does the food information come from?')}</h2><p>${tr('সরকারি জেলা পোর্টাল, জিআই পণ্যের তথ্য এবং প্রকাশিত প্রতিবেদনের ভিত্তিতে জেলার পরিচিত খাবার ও কৃষিপণ্য রাখা হয়েছে। প্রতিটি জেলার কার্ডে সংশ্লিষ্ট উৎস পাবেন।','The local food and produce list draws on official district portals, geographical indication records and published reporting. Each district card links to its sources.')}</p><ul class="credits-list">${foodData.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(tr(source.title,window.DESH_EN?.sources[source.id]||source.title))}</a></li>`).join('')}</ul></div>`));
  $('#districtSearch').addEventListener('input',renderDistricts);$('#divisionFilter').addEventListener('change',renderDistricts);
  $('#districtList').addEventListener('click',event=>{const b=event.target.closest('[data-district]');if(b)toggleDistrict(b.dataset.district);});
  $('#selectAll').addEventListener('click',()=>{const list=filteredDistricts(),remove=list.every(d=>selected.has(d.id));list.forEach(d=>remove?selected.delete(d.id):selected.add(d.id));storage.set('visited',[...selected]);updateSelection();});
  $('#resetMap').addEventListener('click',()=>{selected.clear();storage.set('visited',[]);updateSelection();toast(tr('জেলার বাছাই মুছে দেওয়া হয়েছে।','Your district selection has been cleared.'));});
  function setTheme(value){theme=value;$('.map-workspace').style.setProperty('--district-color',themes[theme]);$$('[data-theme]').forEach(b=>{b.classList.toggle('active',b.dataset.theme===theme);b.setAttribute('aria-pressed',String(b.dataset.theme===theme));});}
  $$('[data-theme]').forEach(b=>b.addEventListener('click',()=>{setTheme(b.dataset.theme);storage.set('theme',theme);}));
  $$('[data-map-style]').forEach(b=>b.addEventListener('click',()=>{mapStyle=b.dataset.mapStyle;storage.set('mapStyle',mapStyle);updateSelection();}));
  $('#mapName').value=mapName;$('#mapName').addEventListener('input',event=>{mapName=event.target.value.slice(0,36);storage.set('name',mapName);});

  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  function wrapText(ctx,text,width){const result=[];let line='';for(const word of String(text).split(' ')){if(ctx.measureText(line+(line?' ':'')+word).width<=width){line+=(line?' ':'')+word;continue;}if(line)result.push(line);line='';for(const char of word){if(ctx.measureText(line+char).width>width){result.push(line);line='';}line+=char;}}if(line)result.push(line);return result;}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  $('#downloadMap').addEventListener('click',async()=>{
    if(!selected.size){toast(tr('আগে ঘুরে আসা অন্তত একটি জেলা বেছে নিন।','Select at least one visited district first.'));$('#districtSearch').focus();return;}
    const button=$('#downloadMap');button.disabled=true;
    // Snapshot the poster so changing language/selection during image loading cannot mix states.
    const ids=[...selected],posterStyle=mapStyle,posterTheme=themes[theme],posterName=mapName,english=window.DESH_I18N.lang==='en';
    const local=(b,e)=>english?e:b,number=n=>english?String(n):String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
    const name=d=>english?d.en:d.name;
    const rows=$('#includeFoods').checked?sortedDistricts.filter(d=>ids.includes(d.id)&&districtFoods(d.id).length).map(d=>({name:name(d),foods:districtFoods(d.id).map(item=>english?(window.DESH_EN.foods[item.name]?.name||item.name):item.name).join(' · ')})):[];
    try{
      await document.fonts.ready;
      const images=new Map();
      if(posterStyle==='food')await Promise.all([...new Set(ids.map(id=>photo(id)?.src).filter(Boolean))].map(async src=>{try{images.set(src,await loadImage(src));}catch{}}));
      const creditLines=[];
      const canvas=document.createElement('canvas');canvas.width=1400;let ctx=canvas.getContext('2d');ctx.font='16px Arial,sans-serif';
      if(images.size){const response=await fetch('assets/credits.json');if(!response.ok)throw new Error('Photo credits unavailable');const credits=await response.json();for(const src of images.keys()){const credit=credits.photos.find(p=>'assets/'+p.file===src);if(!credit)throw new Error('Missing photo attribution: '+src);creditLines.push(...wrapText(ctx,`${credit.title} — ${credit.author} · ${credit.license}`,1200),...wrapText(ctx,credit.source+' · '+credit.licenseUrl,1200),'');}}
      const foodHeight=rows.length?150+Math.ceil(rows.length/2)*130:0,creditsHeight=creditLines.length?100+creditLines.length*23:0;
      canvas.height=1650+foodHeight+creditsHeight;ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;
      ctx.fillStyle='#faf8f3';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#165b4d';ctx.font='700 74px DeshBangla,sans-serif';ctx.fillText(local('দেশপথ.','Deshpath.'),700,125);
      let size=48;ctx.font='600 '+size+'px DeshBangla,sans-serif';const title=posterName.trim()||local('আমার বাংলাদেশ','My Bangladesh');while(ctx.measureText(title).width>1240&&size>18){size-=2;ctx.font='600 '+size+'px DeshBangla,sans-serif';}ctx.fillStyle='#263e2e';ctx.fillText(title,700,216);
      ctx.font='400 30px DeshBangla,sans-serif';ctx.fillStyle='#687b70';ctx.fillText(local('ঘুরে দেখেছি '+number(ids.length)+'টি জেলা · '+number(Math.round(ids.length/64*100))+'% বাংলাদেশ','Visited '+ids.length+' districts · '+Math.round(ids.length/64*100)+'% of Bangladesh'),700,275);
      const [vx,vy,vw,vh]=window.DESH_MAP.viewBox.split(' ').map(Number),scale=Math.min(1000/vw,1190/vh);
      ctx.save();ctx.translate(200+(1000-vw*scale)/2,320+(1190-vh*scale)/2);ctx.scale(scale,scale);ctx.translate(-vx,-vy);
      for(const item of window.DESH_MAP.paths){const path=new Path2D(item.d),yes=ids.includes(item.id),record=photo(item.id),image=posterStyle==='food'&&yes&&record?images.get(record.src):null;ctx.fillStyle=yes?posterTheme:'#dce4d3';ctx.fill(path);if(image){const b=bounds.get(item.id);ctx.save();ctx.clip(path);const ratio=Math.max(b.width/image.naturalWidth,b.height/image.naturalHeight),iw=image.naturalWidth*ratio,ih=image.naturalHeight*ratio;ctx.drawImage(image,b.x+(b.width-iw)/2,b.y+(b.height-ih)/2,iw,ih);ctx.restore();}ctx.strokeStyle='#faf8f3';ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.stroke(path);}
      ctx.restore();
      if(rows.length){ctx.fillStyle='#e8dfce';ctx.fillRect(95,1518,1210,2);ctx.textAlign='center';ctx.font='600 34px DeshBangla,sans-serif';ctx.fillStyle='#165b4d';ctx.fillText(local('পথের সাথে জেলার স্বাদ','Local flavours along the way'),700,1580);ctx.textAlign='left';rows.forEach((row,i)=>{const x=110+(i%2)*620,y=1644+Math.floor(i/2)*130;ctx.font='600 28px DeshBangla,sans-serif';ctx.fillStyle='#213f36';ctx.fillText(row.name,x,y);ctx.font='400 21px DeshBangla,sans-serif';ctx.fillStyle='#626e67';wrapText(ctx,row.foods,555).forEach((line,j)=>ctx.fillText(line,x,y+34+j*28));});}
      if(creditLines.length){const y=1555+foodHeight;ctx.fillStyle='#e8dfce';ctx.fillRect(95,y,1210,2);ctx.textAlign='left';ctx.fillStyle='#445e50';ctx.font='600 21px DeshBangla,sans-serif';ctx.fillText(local('খাবারের ছবির কৃতজ্ঞতা (সীমানা অনুযায়ী ক্রপ করা)','Food photo credits (cropped to district boundaries)'),100,y+38);ctx.font='16px Arial,sans-serif';ctx.fillStyle='#68766b';creditLines.forEach((line,i)=>ctx.fillText(line,100,y+70+i*23));}
      ctx.textAlign='center';ctx.fillStyle='#687b70';ctx.font='400 23px DeshBangla,sans-serif';ctx.fillText(local('প্রতিটি পথেই নতুন গল্প।','Every journey has a new story.'),700,h-65);ctx.font='16px Arial,sans-serif';ctx.fillText('Map: geoBoundaries / BBS / OCHA ROAP · CC BY 3.0 IGO · Simplified',700,h-25);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');downloadBlob(blob,'deshpath-my-bangladesh.png');toast(local('আপনার মানচিত্র ডাউনলোড হয়েছে।','Your map has been downloaded.'));
    }catch(error){console.error('Map export:',error);toast(tr('মানচিত্র তৈরি করা যায়নি। আবার চেষ্টা করুন।','The map could not be created. Please try again.'));}finally{button.disabled=false;}
  });
  function refreshLanguage(){renderDivisions();renderDistricts();updateSelection();tooltip.hidden=true;}
  setTheme(theme);refreshLanguage();
  return {refreshLanguage,foodSourceLinks};
};
