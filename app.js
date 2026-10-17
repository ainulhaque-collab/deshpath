'use strict';
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bn = value => String(value).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const money = value => '৳' + bn(Math.round(value).toLocaleString('en-IN'));
  const clamp = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fallback;
  const icons = {
    'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'arrow-down':'<path d="M12 4v16m-6-6 6 6 6-6"/>',
    heart:'<path d="m20.8 4.7 0 0a5.4 5.4 0 0 0-7.6 0L12 5.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    'map-pin':'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
    leaf:'<path d="M20 3c-10 0-16 3-16 9a7 7 0 0 0 7 7c6 0 9-7 9-16Z"/><path d="M4 21 15 10M9 15l-1-5m1 5 5 1"/>',
    rotate:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    mountain:'<path d="m2 20 7-14 4 8 3-5 6 11ZM6.5 11l2.5 2 2.5-2"/>',
    waves:'<path d="M2 6c4-5 6 5 10 0s6 5 10 0M2 12c4-5 6 5 10 0s6 5 10 0M2 18c4-5 6 5 10 0s6 5 10 0"/>',
    landmark:'<path d="m3 8 9-5 9 5ZM5 10v8m7-8v8m7-8v8M3 21h18M3 18h18"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    x:'<path d="m6 6 12 12M6 18 18 6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    sparkles:'<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6ZM20 2v4m-2-2h4"/>',
    print:'<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7ZM17 11h.01"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
    users:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-2-4"/>',
    utensils:'<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M17 3v7h4V3c-3 0-4 3-4 7m4 0v11"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.compass}</svg>`;
  function hydrate(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  let toastTimer;
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3300);
  }
  const storage = {
    get(key, fallback) { try { const v = localStorage.getItem('deshpath.' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('deshpath.' + key, JSON.stringify(value)); } catch { toast('এই ব্রাউজারে তথ্য সেভ করা যাচ্ছে না।'); } }
  };
  const { districts, places, divisions } = window.DESH_DATA;
  const districtById = new Map(districts.map(d => [d.id, d]));
  const placeById = new Map(places.map(p => [p.id, p]));
  const sortedDistricts = [...districts].sort((a,b) => a.name.localeCompare(b.name, 'bn'));
  const foodData = window.DESH_FOODS || { sources: [], districts: {} };
  const foodSourceById = new Map(foodData.sources.map(source => [source.id, source]));
  const foodKindLabels = {dish:'স্থানীয় পদ',sweet:'মিষ্টি',produce:'ফল ও ফসল',drink:'পানীয়',dairy:'দুগ্ধপণ্য',pantry:'রান্নার উপকরণ',fish:'মাছ ও শুঁটকি'};
  const districtFoods = id => foodData.districts[id]?.items || [];
  const arrayOrEmpty = value => Array.isArray(value) ? value : [];
  const selected = new Set(arrayOrEmpty(storage.get('visited', [])).filter(id => districtById.has(id)));
  const favorites = new Set(arrayOrEmpty(storage.get('favorites', [])).filter(id => placeById.has(id)));
  const themes = { emerald:'#216b58', sunset:'#b66e48', ocean:'#397d9d', midnight:'#71618e' };
  let theme = storage.get('theme', 'emerald');
  if (!themes[theme]) theme = 'emerald';
  let mapName = String(storage.get('name', '')).slice(0,36);
  const savedTrip = storage.get('trip', null);
  let trip = savedTrip && typeof savedTrip === 'object' ? savedTrip : {};
  let tripIds = [...new Set(arrayOrEmpty(trip.destinations).filter(id => districtById.has(id)))].slice(0,7);
  let category = 'all';
  let visibleCount = 6;
  const dialog = $('#contentDialog');
  const dialogBody = $('#dialogBody');
  function openDialog(content) { dialogBody.innerHTML = content; hydrate(dialogBody); if (!dialog.open) dialog.showModal(); }
  $('#closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const b=dialog.getBoundingClientRect(); if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close(); } });
  hydrate();

  // District selections are local. No form submission or analytics is sent to a server.
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', window.DESH_MAP.viewBox);
  svg.setAttribute('class', 'bangladesh-map');
  svg.setAttribute('role','group');
  svg.setAttribute('aria-label','বাংলাদেশের ৬৪ জেলা। এন্টার বা স্পেস দিয়ে জেলা বাছাই করুন।');
  const pathElements = new Map();
  for (const districtPath of window.DESH_MAP.paths) {
    const district = districtById.get(districtPath.id);
    if (!district) continue;
    const path = document.createElementNS(svgNS,'path');
    path.setAttribute('d',districtPath.d);
    path.setAttribute('class','district-path');
    path.dataset.district=district.id;
    path.setAttribute('tabindex','0');
    path.setAttribute('role','button');
    path.setAttribute('aria-label', district.name + ' জেলা');
    const title=document.createElementNS(svgNS,'title');title.textContent=district.name;path.append(title);
    svg.append(path);pathElements.set(district.id,path);
  }
  $('#mapMount').append(svg);
  svg.addEventListener('click',event=>{const target=event.target.closest('[data-district]');if(target)toggleDistrict(target.dataset.district);});
  svg.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.dataset.district){event.preventDefault();toggleDistrict(event.target.dataset.district);}});
  const tooltip=$('#mapTooltip');
  function moveTooltip(event) {
    const target=event.target.closest('[data-district]');
    if(!target){tooltip.hidden=true;return;}
    const d=districtById.get(target.dataset.district);
    tooltip.textContent=d.name+(selected.has(d.id)?' · ঘুরেছি':' · বেছে নিন');
    tooltip.hidden=false;
    const panel=$('.map-canvas-panel').getBoundingClientRect();
    tooltip.style.left=Math.max(8,Math.min(event.clientX-panel.left+12,panel.width-145))+'px';
    tooltip.style.top=Math.max(42,Math.min(event.clientY-panel.top-38,panel.height-48))+'px';
  }
  svg.addEventListener('pointermove',moveTooltip);
  svg.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
  function filteredDistricts() {
    const query=$('#districtSearch').value.trim().toLocaleLowerCase();
    const division=$('#divisionFilter').value;
    return sortedDistricts.filter(d=>(division==='all'||d.division===division)&&(!query||(d.name+' '+d.en).toLocaleLowerCase().includes(query)));
  }
  function renderDistricts() {
    const list=filteredDistricts();
    $('#districtList').innerHTML=list.length?list.map(d=>`<button class="district-button${selected.has(d.id)?' selected':''}" data-district="${d.id}" aria-pressed="${selected.has(d.id)}"><span class="district-checkbox">${selected.has(d.id)?icon('check'):''}</span>${d.name}</button>`).join(''):'<p class="no-districts">কোনো জেলা পাওয়া যায়নি।</p>';
    updateSelectAll();
  }
  function updateSelectAll(){const list=filteredDistricts();$('#selectAll').textContent=list.length&&list.every(d=>selected.has(d.id))?'বাছাই মুছুন':'সব বাছাই';$('#selectAll').disabled=!list.length;}
  function updateSelection() {
    for(const [id,path] of pathElements){path.classList.toggle('visited',selected.has(id));path.setAttribute('aria-pressed',String(selected.has(id)));}
    $$('.district-button').forEach(button=>{const yes=selected.has(button.dataset.district);button.classList.toggle('selected',yes);button.setAttribute('aria-pressed',String(yes));$('.district-checkbox',button).innerHTML=yes?icon('check'):'';});
    $('#visitedCount').textContent=bn(selected.size);
    const percent=Math.round(selected.size/64*100);
    $('#visitedPercent').textContent=bn(percent)+'%';
    $('#mapProgress').style.width=percent+'%';
    updateSelectAll();
    renderFoods();
  }
  function foodSourceLinks(items) {
    const ids = [...new Set(items.flatMap(item => item.sourceIds || []))];
    return ids.map(id => foodSourceById.get(id)).filter(Boolean).map((source,i) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" title="${esc(source.title)}">তথ্যসূত্র${ids.length>1?' '+bn(i+1):''} ${icon('arrow-up-right')}</a>`).join('');
  }
  function renderFoods() {
    const list = sortedDistricts.filter(d => selected.has(d.id));
    const count = list.reduce((sum,d) => sum + districtFoods(d.id).length, 0);
    $('#foodSummary').textContent = list.length ? bn(list.length)+'টি জেলার বাছাই · '+bn(count)+'টি স্থানীয় স্বাদ' : 'একটি জেলা বেছে নিলেই তার পরিচিত খাবার এখানে যোগ হবে।';
    $('#districtFoods').classList.toggle('is-empty', !list.length);
    $('#districtFoods').innerHTML = list.length ? list.map(d => {
      const items = districtFoods(d.id);
      return `<article class="food-card${items.length?'':' food-pending'}" data-food-district="${d.id}"><div class="food-card-heading"><span class="food-district-icon">${icon('map-pin')}</span><div><h4>${esc(d.name)}</h4><span>${bn(items.length)}টি পরিচিত স্বাদ</span></div><span class="food-selected-mark" aria-label="মানচিত্রে বাছাই করা">${icon('check')}</span></div>${items.length?`<ul class="food-items">${items.map(item=>`<li><div><strong>${esc(item.name)}</strong><span class="food-kind">${esc(foodKindLabels[item.kind] || 'স্থানীয় স্বাদ')}</span></div>${item.note?`<p>${esc(item.note)}</p>`:''}</li>`).join('')}</ul><div class="food-source-links">${foodSourceLinks(items)}</div>`:'<p class="food-pending-note">এই জেলার নির্ভরযোগ্য খাবারের তথ্য এখনও যোগ করা হয়নি।</p>'}</article>`;
    }).join('') : `<div class="food-empty-copy"><span class="food-empty-icon">${icon('utensils')}</span><div><strong>ভ্রমণের গল্পে স্বাদটুকুও থাকুক</strong><p>মানচিত্রে জেলা বাছুন, অথবা শুরু করুন এই পরিচিত স্বাদগুলো দিয়ে।</p></div></div><div class="food-examples">${['tangail','bogura','cumilla'].filter(id=>districtById.has(id)&&districtFoods(id).length).map(id=>`<button class="food-example" data-food-example="${id}"><span>${esc(districtById.get(id).name)}</span><strong>${esc(districtFoods(id)[0].name)}</strong>${icon('plus')}</button>`).join('')}</div>`;
  }
  $('#districtFoods').addEventListener('click', event => { const b=event.target.closest('[data-food-example]'); if(b)toggleDistrict(b.dataset.foodExample); });
  $('#includeFoods').checked = storage.get('includeFoods',true) !== false;
  $('#includeFoods').addEventListener('change',event=>storage.set('includeFoods',event.target.checked));
  $('#foodSources').addEventListener('click',()=>openDialog(`<div class="dialog-copy"><div class="eyebrow">স্থানীয় স্বাদের তথ্য</div><h2>খাবারের তথ্য কোথা থেকে?</h2><p>সরকারি জেলা পোর্টাল, জিআই পণ্যের তথ্য এবং প্রকাশিত প্রতিবেদনের ভিত্তিতে জেলার পরিচিত খাবার ও কৃষিপণ্য রাখা হয়েছে। প্রতিটি জেলার কার্ডে সংশ্লিষ্ট উৎস পাবেন। কোনো তথ্য যাচাই করা না গেলে সেখানে খাবারের নাম যোগ করা হয়নি।</p><ul class="credits-list">${foodData.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul></div>`));
  function toggleDistrict(id){if(!districtById.has(id))return;selected.has(id)?selected.delete(id):selected.add(id);storage.set('visited',[...selected]);updateSelection();}
  $('#districtList').addEventListener('click',event=>{const b=event.target.closest('[data-district]');if(b)toggleDistrict(b.dataset.district);});
  $('#districtSearch').addEventListener('input',renderDistricts);
  $('#divisionFilter').innerHTML='<option value="all">সব বিভাগ</option>'+divisions.map(d=>`<option value="${d.id}">${d.name} বিভাগ</option>`).join('');
  $('#divisionFilter').addEventListener('change',renderDistricts);
  $('#selectAll').addEventListener('click',()=>{const list=filteredDistricts();const remove=list.every(d=>selected.has(d.id));list.forEach(d=>remove?selected.delete(d.id):selected.add(d.id));storage.set('visited',[...selected]);updateSelection();});
  $('#resetMap').addEventListener('click',()=>{selected.clear();storage.set('visited',[]);updateSelection();toast('জেলার বাছাই মুছে দেওয়া হয়েছে।');});
  function setTheme(value){theme=value;$('.map-workspace').style.setProperty('--district-color',themes[theme]);$$('[data-theme]').forEach(b=>{b.classList.toggle('active',b.dataset.theme===theme);b.setAttribute('aria-pressed',String(b.dataset.theme===theme));});}
  $$('[data-theme]').forEach(b=>b.addEventListener('click',()=>{setTheme(b.dataset.theme);storage.set('theme',theme);}));
  $('#mapName').value=mapName;
  $('#mapName').addEventListener('input',event=>{mapName=event.target.value.slice(0,36);storage.set('name',mapName);});
  setTheme(theme);renderDistricts();updateSelection();
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  $('#downloadMap').addEventListener('click',async()=>{
    if(!selected.size){toast('আগে ঘুরে আসা অন্তত একটি জেলা বেছে নিন।');$('#districtSearch').focus();return;}
    const button=$('#downloadMap');button.disabled=true;
    try {
      await document.fonts.ready;
      const foodRows = $('#includeFoods').checked ? sortedDistricts.filter(d=>selected.has(d.id)&&districtFoods(d.id).length).map(d=>({name:d.name,foods:districtFoods(d.id).map(item=>item.name).join(' · ')})) : [];
      const w=1400,h=1650+(foodRows.length?160+Math.ceil(foodRows.length/2)*102:0),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#faf8f3';ctx.fillRect(0,0,w,h);ctx.fillStyle='#165b4d';ctx.textAlign='center';ctx.font='700 74px DeshBangla, sans-serif';ctx.fillText('দেশপথ.',w/2,125);
      ctx.font='600 48px DeshBangla, sans-serif';ctx.fillStyle='#263e2e';let title=mapName.trim()||'আমার বাংলাদেশ';while(ctx.measureText(title).width>w-160){ctx.font=(parseInt(ctx.font.match(/\d+px/)[0])-2)+'px DeshBangla, sans-serif';}ctx.fillText(title,w/2,216);
      ctx.font='400 30px DeshBangla, sans-serif';ctx.fillStyle='#78876d';ctx.fillText('ঘুরে দেখেছি '+bn(selected.size)+'টি জেলা · '+bn(Math.round(selected.size/64*100))+'% বাংলাদেশ',w/2,275);
      const paths=window.DESH_MAP.paths.map(p=>`<path d="${p.d}" fill="${selected.has(p.id)?themes[theme]:'#dce4d3'}" stroke="#f6f7ef" stroke-width="1.6" stroke-linejoin="round"/>`).join('');
      const mapSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${window.DESH_MAP.viewBox}" width="1000" height="1190">${paths}</svg>`;
      const mapUrl=URL.createObjectURL(new Blob([mapSvg],{type:'image/svg+xml;charset=utf-8'}));
      try{const mapImage=new Image();await new Promise((resolve,reject)=>{mapImage.onload=resolve;mapImage.onerror=reject;mapImage.src=mapUrl;});ctx.drawImage(mapImage,200,320,1000,1190);}finally{URL.revokeObjectURL(mapUrl);}
      if(foodRows.length){
        ctx.fillStyle='#e8dfce';ctx.fillRect(95,1518,1210,2);ctx.font='600 34px DeshBangla, sans-serif';ctx.fillStyle='#165b4d';ctx.fillText('পথের সাথে জেলার স্বাদ',w/2,1580);
        ctx.textAlign='left';
        foodRows.forEach((row,i)=>{const x=110+(i%2)*620,y=1644+Math.floor(i/2)*102;ctx.font='600 29px DeshBangla, sans-serif';ctx.fillStyle='#213f36';ctx.fillText(row.name,x,y);let size=23;ctx.font='400 '+size+'px DeshBangla, sans-serif';while(ctx.measureText(row.foods).width>560&&size>14){size--;ctx.font='400 '+size+'px DeshBangla, sans-serif';}ctx.fillStyle='#626e67';ctx.fillText(row.foods,x,y+36);});
        ctx.textAlign='center';ctx.font='400 19px DeshBangla, sans-serif';ctx.fillStyle='#7d827a';ctx.fillText('স্থানীয় খাবার ও পণ্য · উৎস: দেশপথের খাবারের তথ্যসূত্র',w/2,h-119);
      }
      ctx.font='400 24px DeshBangla, sans-serif';ctx.fillStyle='#687b70';ctx.fillText('প্রতিটি পথেই নতুন গল্প।',w/2,h-72);
      ctx.font='17px Arial, sans-serif';ctx.fillStyle='#7d877d';ctx.fillText('Map: geoBoundaries / BBS / OCHA ROAP · CC BY 3.0 IGO · Simplified',w/2,h-27);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');downloadBlob(blob,'deshpath-my-bangladesh.png');toast('আপনার মানচিত্র ডাউনলোড হয়েছে।');
    }catch(error){console.error('Map export:',error);toast('মানচিত্র তৈরি করা যায়নি। আবার চেষ্টা করুন।');}finally{button.disabled=false;}
  });

  const firstPlaces=['sreemangal','coxsbazar-beach','sajek','sundarbans','paharpur','ratargul'];
  const orderedPlaces=[...places].sort((a,b)=>{const ai=firstPlaces.indexOf(a.id),bi=firstPlaces.indexOf(b.id);return (ai<0?99:ai)-(bi<0?99:bi);});
  function renderFavoriteButtons(){
    $('#savedCount').textContent=bn(favorites.size);
    $$('[data-favorite]').forEach(b=>{const yes=favorites.has(b.dataset.favorite);b.classList.toggle('is-favorite',yes);b.setAttribute('aria-pressed',String(yes));b.setAttribute('aria-label',placeById.get(b.dataset.favorite).name+(yes?' পছন্দ থেকে সরান':' পছন্দে রাখুন'));});
  }
  function toggleFavorite(id){if(!placeById.has(id))return;favorites.has(id)?favorites.delete(id):favorites.add(id);storage.set('favorites',[...favorites]);renderFavoriteButtons();toast(favorites.has(id)?'পছন্দের তালিকায় রাখা হয়েছে।':'পছন্দের তালিকা থেকে সরানো হয়েছে।');}
  function getFilteredPlaces(){const query=$('#placeSearch').value.trim().toLocaleLowerCase();return orderedPlaces.filter(p=>(category==='all'||p.category===category)&&(!query||(p.name+' '+p.description+' '+districtById.get(p.district).name+' '+districtById.get(p.district).en).toLocaleLowerCase().includes(query)));}
  function placeCard(p){const d=districtById.get(p.district);const yes=favorites.has(p.id);return `<article class="place-card"><div class="place-card-image"><button class="place-image-link" data-place="${p.id}" aria-label="${p.name} সম্পর্কে জানুন"><img src="${p.image}" alt="${imageAlt(p)}" loading="lazy" width="960" height="650"></button><span class="place-category">${p.categoryLabel}</span><button class="favorite-button${yes?' is-favorite':''}" data-favorite="${p.id}" aria-pressed="${yes}" aria-label="${p.name}${yes?' পছন্দ থেকে সরান':' পছন্দে রাখুন'}">${icon('heart')}</button></div><div class="place-card-body"><div class="place-location">${icon('map-pin')} ${d.name}, বাংলাদেশ</div><h3><a href="#explore" data-place="${p.id}">${p.name}</a></h3><p>${p.description}</p><div class="place-card-bottom"><span>${icon('clock')} ${p.duration}</span><button class="place-detail-button" data-place="${p.id}">ঘুরে দেখুন ${icon('arrow-up-right')}</button></div></div></article>`;}
  function imageAlt(p){return p.name+' · '+districtById.get(p.district).name+' — স্থানের বাস্তব আলোকচিত্র';}
  function renderPlaces(){const list=getFilteredPlaces();$('#placesGrid').innerHTML=list.slice(0,visibleCount).map(placeCard).join('')||'<div class="empty-results">এই বাছাইয়ে কোনো জায়গা পাওয়া যায়নি।<button class="text-button" id="clearPlaceFilters">সব জায়গা দেখুন</button></div>';$('#loadMore').hidden=list.length<=visibleCount;$('#placesResult').textContent=bn(Math.min(visibleCount,list.length))+' / '+bn(list.length)+'টি গন্তব্য দেখানো হচ্ছে';}
  $('#placeTotal').innerHTML=bn(places.length)+'<span>টি</span>';
  $$('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;visibleCount=6;$$('[data-category]').forEach(x=>x.classList.toggle('active',x===b));renderPlaces();}));
  $('#placeSearch').addEventListener('input',()=>{visibleCount=6;renderPlaces();});
  $('#loadMore').addEventListener('click',()=>{visibleCount+=6;renderPlaces();});
  document.addEventListener('click',event=>{
    const favorite=event.target.closest('[data-favorite]');if(favorite){toggleFavorite(favorite.dataset.favorite);return;}
    const place=event.target.closest('[data-place]');if(place){event.preventDefault();openPlace(place.dataset.place);return;}
    if(event.target.closest('#clearPlaceFilters')){category='all';$('#placeSearch').value='';$$('[data-category]').forEach(x=>x.classList.toggle('active',x.dataset.category==='all'));renderPlaces();}
  });
  function openPlace(id){
    const p=placeById.get(id);if(!p)return;const d=districtById.get(p.district);
    const mapsUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.name+' '+d.en+' Bangladesh');
    const foods=districtFoods(d.id);
    openDialog(`<img class="dialog-image" src="${p.image}" alt="${imageAlt(p)}"><div class="dialog-copy"><div class="place-location">${icon('map-pin')} ${d.name} · ${p.categoryLabel}</div><h2>${p.name}</h2><p>${p.description}</p><div class="detail-facts"><div class="detail-fact">কখন যেতে পারেন<strong>${p.season}</strong></div><div class="detail-fact">সময় রাখুন<strong>${p.duration}</strong></div></div>${foods.length?`<div class="detail-foods"><span>${icon('utensils')} ${d.name} জেলার পরিচিত স্বাদ</span><strong>${foods.map(item=>esc(item.name)).join(' · ')}</strong><div class="food-source-links">${foodSourceLinks(foods)}</div></div>`:''}<p>স্থানীয় গাইড বা সংশ্লিষ্ট কর্তৃপক্ষের কাছ থেকে যাতায়াত, প্রবেশের অনুমতি, আবহাওয়া ও থাকার তথ্য যাচাই করে পরিকল্পনা করুন।</p><div class="dialog-actions"><button class="button primary" id="planPlace">ট্রিপে জেলা যোগ করুন ${icon('plus')}</button><a class="button secondary" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Google Maps ${icon('arrow-up-right')}</a></div><p class="source-note">এই গন্তব্যের নিজস্ব আলোকচিত্র ব্যবহার করা হয়েছে। ছবির লেখক, উৎস ও লাইসেন্স ফুটারের কৃতজ্ঞতা অংশে পাবেন।</p></div>`);
    $('#planPlace').addEventListener('click',()=>{if(addTrip(d.id)){dialog.close();location.hash='planner';$('#planner').scrollIntoView({behavior:'smooth'});}});
  }
  function openSaved(){openDialog(`<div class="dialog-copy"><div class="eyebrow">পরে ঘুরে দেখবেন</div><h2>পছন্দের জায়গা <small>(${bn(favorites.size)})</small></h2><p>আপনার বাছাই করা জায়গাগুলো এই ব্রাউজারে রাখা আছে।</p><div class="saved-list">${favorites.size?[...favorites].map(id=>{const p=placeById.get(id);return `<div class="saved-item"><img src="${p.image}" alt="${imageAlt(p)}"><div><h3><a href="#explore" data-place="${p.id}">${p.name}</a></h3><p>${districtById.get(p.district).name} · ${p.duration}</p></div><button class="icon-button" data-remove-saved="${p.id}" aria-label="${p.name} সরান">${icon('x')}</button></div>`;}).join(''):`<div class="saved-empty">${icon('heart')}<h3>এখনো কোনো জায়গা বাছাই করেননি</h3><p>গন্তব্যের ছবির হার্ট চিহ্নে চাপ দিয়ে পছন্দে রাখুন।</p><button class="button primary" id="savedExplore">গন্তব্যগুলো দেখি ${icon('arrow-right')}</button></div>`}</div></div>`);const go=$('#savedExplore');if(go)go.addEventListener('click',()=>{dialog.close();location.hash='explore';});}
  $('#savedBtn').addEventListener('click',openSaved);
  dialogBody.addEventListener('click',event=>{const b=event.target.closest('[data-remove-saved]');if(b){favorites.delete(b.dataset.removeSaved);storage.set('favorites',[...favorites]);renderFavoriteButtons();openSaved();}});
  renderPlaces();renderFavoriteButtons();

  // A suggested itinerary, using an explicit user budget rather than live fare claims.
  const districtOptions=sortedDistricts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  $('#origin').innerHTML=districtOptions;$('#origin').value=districtById.has(trip.origin)?trip.origin:'dhaka';
  $('#destination').innerHTML='<option value="">জেলা বেছে নিন</option>'+districtOptions;
  $('#days').value=clamp(trip.days,1,14,3);$('#travelers').value=clamp(trip.travelers,1,30,2);$('#budget').value=clamp(trip.budget,1000,10000000,15000);
  const emptyPlanHtml = $('#planResult').innerHTML;
  function currentTrip(){return {origin:$('#origin').value,destinations:tripIds,days:clamp($('#days').value,1,14,3),travelers:clamp($('#travelers').value,1,30,2),budget:clamp($('#budget').value,1000,10000000,15000)};}
  function saveTrip(){storage.set('trip',currentTrip());storage.set('planGenerated',false);if($('#planResult .plan-ready')){$('#planResult').innerHTML=emptyPlanHtml;hydrate($('#planResult'));}}
  function renderTripChips(){const origin=$('#origin').value;$('#tripChips').innerHTML=tripIds.length?tripIds.map(id=>`<span class="trip-chip">${districtById.get(id).name}<button type="button" data-remove-trip="${id}" aria-label="${districtById.get(id).name} ট্রিপ থেকে সরান">${icon('x')}</button></span>`).join(''):'<span style="color:#97a18d;font-size:10px">সর্বোচ্চ ৭টি জেলা যোগ করতে পারেন</span>';$$('#destination option').forEach(o=>{o.disabled=o.value===origin||tripIds.includes(o.value);});}
  function addTrip(id){if(!districtById.has(id)){toast('আগে একটি জেলা বেছে নিন।');$('#destination').focus();return false;}if(id===$('#origin').value){toast('যাত্রার শুরুর জেলা ও গন্তব্য আলাদা রাখুন।');return false;}if(tripIds.includes(id)){toast('এই জেলা ট্রিপে আগে থেকেই আছে।');return true;}if(tripIds.length>=7){toast('এক ট্রিপে সর্বোচ্চ ৭টি জেলা যোগ করতে পারেন।');return false;}tripIds.push(id);saveTrip();renderTripChips();$('#destination').value='';return true;}
  $('#addDestination').addEventListener('click',()=>addTrip($('#destination').value));
  $('#tripChips').addEventListener('click',event=>{const b=event.target.closest('[data-remove-trip]');if(b){tripIds=tripIds.filter(id=>id!==b.dataset.removeTrip);saveTrip();renderTripChips();}});
  $('#origin').addEventListener('change',()=>{tripIds=tripIds.filter(id=>id!==$('#origin').value);saveTrip();renderTripChips();});
  ['days','travelers','budget'].forEach(id=>$('#'+id).addEventListener('input',saveTrip));
  $$('[data-step]').forEach(b=>b.addEventListener('click',()=>{const [id,amount]=b.dataset.step.split(':');const input=$('#'+id);input.value=clamp(Number(input.value)+Number(amount),Number(input.min),Number(input.max),Number(input.min));saveTrip();}));
  function distance(a,b){const toR=x=>x*Math.PI/180,dl=toR(b.lat-a.lat),dn=toR(b.lng-a.lng);const t=Math.sin(dl/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dn/2)**2;return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t));}
  function routeOrder(ids,origin){const left=[...ids],result=[];let current=districtById.get(origin);while(left.length){left.sort((a,b)=>distance(current,districtById.get(a))-distance(current,districtById.get(b)));const id=left.shift();result.push(id);current=districtById.get(id);}return result;}
  function generatePlan(announce=true){
    const t=currentTrip();if(!tripIds.length){toast('ট্রিপে অন্তত একটি গন্তব্য জেলা যোগ করুন।');$('#destination').focus();return;}
    if(t.days<tripIds.length){toast('প্রতি জেলার জন্য অন্তত এক দিন রাখুন, অথবা জেলার সংখ্যা কমান।');$('#days').focus();return;}
    saveTrip();storage.set('planGenerated',true);
    const route=routeOrder(tripIds,t.origin);
    const days=Array.from({length:t.days},(_,i)=>{const idx=Math.min(route.length-1,Math.floor(i*route.length/t.days)),id=route[idx],d=districtById.get(id),local=places.filter(p=>p.district===id),prior=i&&Math.floor((i-1)*route.length/t.days)===idx;const offset=i-Math.ceil(idx*t.days/route.length),place=local[offset];return {d,foods:districtFoods(id),heading:(prior?'আরেকটু ঘুরে দেখা: ':'পথে নামি: ')+d.name,body:place?`${place.name} ঘিরে দিনটি সাজান। ${place.description}`:prior?'ধীরে-সুস্থে স্থানীয় বাজার, সংস্কৃতি ও আশপাশের পথ ঘুরে দেখুন। আগের দিনের একই জায়গা পুনরাবৃত্তি না করে স্থানীয়দের পরামর্শ নিন।':'শহর ও আশপাশের স্থানীয় আকর্ষণ, খাবার ও সংস্কৃতি আবিষ্কার করুন। স্থানীয়দের পরামর্শ নিয়ে যাতায়াত ঠিক করুন।'};});
    $('#planResult').innerHTML=`<div class="plan-ready"><div class="plan-heading"><div><div class="eyebrow">আপনার ভ্রমণের খসড়া</div><h3>${bn(t.days)} দিনের একটু ছুটি</h3></div><button class="plan-print" id="printPlan">${icon('print')} প্রিন্ট / PDF</button></div><div class="plan-meta"><span>${icon('calendar')} ${bn(t.days)} দিন</span><span>${icon('users')} ${bn(t.travelers)} জন</span><span>${bn(route.length)}টি জেলা</span></div><div class="plan-route">${icon('map-pin')} ${[t.origin,...route].map(id=>esc(districtById.get(id).name)).join(' <span aria-hidden="true">→</span> ')}</div><div class="itinerary">${days.map((day,i)=>`<div class="itinerary-day"><div class="day-number">দিন<b>${bn(i+1)}</b></div><div class="day-content"><h4>${esc(day.heading)}</h4><p>${esc(day.body)}</p>${day.foods.length?`<div class="itinerary-food">${icon('utensils')}<span>জেলার স্বাদ: ${day.foods.map(item=>esc(item.name)).join(' · ')}</span></div>`:''}</div></div>`).join('')}</div><div class="plan-budget"><div class="plan-budget-heading"><span>আপনার দেওয়া মোট বাজেট</span><strong>${money(t.budget)}</strong></div><div class="budget-parts">${[['যাতায়াত',.35],['থাকা',.30],['খাবার',.25],['অন্যান্য',.10]].map(([label,share])=>`<div class="budget-part">${label} · ${bn(share*100)}%<strong>${money(t.budget*share)}</strong></div>`).join('')}</div></div><p class="plan-limit">বাজেটের ভাগ একটি প্রস্তাব, প্রকৃত ভাড়া বা বুকিং মূল্য নয়। রুটটি জেলার আনুমানিক অবস্থান অনুযায়ী সাজানো; সড়কপথ ও যাতায়াতের সময় যাচাই করুন। বিশেষত পাহাড়, বন ও দ্বীপে প্রবেশের বর্তমান নিয়ম জেনে নিন।</p></div>`;
    $('#printPlan').addEventListener('click',()=>window.print());
    if(announce){toast('আপনার ট্রিপের খসড়া তৈরি। শুভ ভ্রমণ!');if(innerWidth<681)$('#planResult').scrollIntoView({behavior:'smooth',block:'start'});}
  }
  $('#plannerForm').addEventListener('submit',event=>{event.preventDefault();generatePlan();});
  renderTripChips();if(storage.get('planGenerated',false)&&tripIds.length)generatePlan(false);

  const questions=[
    {q:'বাংলাদেশের কোন জেলায় পাহাড়পুর বৌদ্ধবিহার?',options:['বগুড়া','নওগাঁ','দিনাজপুর','রাজশাহী'],answer:1,fact:'পাহাড়পুরের সোমপুর মহাবিহার নওগাঁ জেলার বদলগাছী উপজেলায় অবস্থিত।'},
    {q:'সাজেক ভ্যালি কোন জেলায় অবস্থিত?',options:['বান্দরবান','খাগড়াছড়ি','রাঙামাটি','সিলেট'],answer:2,fact:'খাগড়াছড়ি হয়ে যাওয়া হলেও সাজেক রাঙামাটির বাঘাইছড়ি উপজেলায় অবস্থিত।'},
    {q:'কুয়াকাটা সমুদ্রসৈকত কোন জেলায়?',options:['বরগুনা','ভোলা','পটুয়াখালী','কক্সবাজার'],answer:2,fact:'কুয়াকাটা পটুয়াখালী জেলার কলাপাড়া উপজেলায়।'},
    {q:'চায়ের রাজধানী নামে পরিচিত শ্রীমঙ্গল কোন জেলায়?',options:['সিলেট','হবিগঞ্জ','মৌলভীবাজার','সুনামগঞ্জ'],answer:2,fact:'শ্রীমঙ্গল মৌলভীবাজার জেলার একটি উপজেলা।'},
    {q:'ষাট গম্বুজ মসজিদ কোথায় অবস্থিত?',options:['বাগেরহাট','খুলনা','সাতক্ষীরা','যশোর'],answer:0,fact:'ঐতিহাসিক ষাট গম্বুজ মসজিদ বাগেরহাটে অবস্থিত।'}
  ];
  let quiz={index:0,score:0,answered:false};
  function renderQuiz(){
    if(quiz.index>=questions.length){openDialog(`<div class="dialog-copy quiz-result"><div class="eyebrow" style="justify-content:center">পথের গল্পে আপনার ফল</div><div class="quiz-score">${bn(quiz.score)}<small style="font-size:30px"> / ৫</small></div><h3>${quiz.score>=4?'দেশটাকে বেশ ভালোই চেনেন!':'আরও পথ, আরও নতুন গল্প!'}</h3><p>ভ্রমণ মানেই নতুন কিছু শেখা। এবার নতুন গন্তব্য বেছে নেওয়া যাক।</p><button class="button primary" id="restartQuiz">আবার খেলি ${icon('rotate')}</button></div>`);$('#restartQuiz').addEventListener('click',startQuiz);storage.set('quizBest',Math.max(quiz.score,clamp(storage.get('quizBest',0),0,5,0)));return;}
    const q=questions[quiz.index];openDialog(`<div class="dialog-copy"><div class="eyebrow">দেশটাকে কতটা চেনেন? · ${bn(quiz.index+1)} / ৫</div><div class="quiz-progress">${questions.map((_,i)=>`<span class="${i<=quiz.index?'done':''}"></span>`).join('')}</div><h2>${q.q}</h2><div class="quiz-options">${q.options.map((answer,i)=>`<button class="quiz-option" data-answer="${i}">${bn(i+1)}. ${answer}</button>`).join('')}</div><p class="quiz-feedback" id="quizFeedback" aria-live="polite"></p><button class="button primary" id="quizNext" hidden>${quiz.index===questions.length-1?'ফলাফল দেখি':'পরের প্রশ্ন'} ${icon('arrow-right')}</button></div>`);
    $$('[data-answer]',dialogBody).forEach(b=>b.addEventListener('click',()=>{if(quiz.answered)return;quiz.answered=true;const chosen=Number(b.dataset.answer);if(chosen===q.answer)quiz.score++;$$('[data-answer]',dialogBody).forEach(option=>{option.disabled=true;option.classList.toggle('correct',Number(option.dataset.answer)===q.answer);if(option===b&&chosen!==q.answer)option.classList.add('wrong');});$('#quizFeedback').textContent=(chosen===q.answer?'সঠিক! ':'শিখে নিলাম! ')+q.fact;$('#quizNext').hidden=false;}));
    $('#quizNext').addEventListener('click',()=>{quiz.index++;quiz.answered=false;renderQuiz();});
  }
  function startQuiz(){quiz={index:0,score:0,answered:false};renderQuiz();}
  $('#quizBtn').addEventListener('click',startQuiz);
  $('#aboutBtn').addEventListener('click',()=>openDialog('<div class="dialog-copy"><div class="eyebrow">নিজের দেশকে নতুন করে দেখা</div><h2>দেশপথ সম্পর্কে</h2><p>দেশপথ একটি স্বাধীন বাংলা ভ্রমণ ওয়েব অ্যাপ। ৬৪ জেলার ইন্টারেক্টিভ ম্যাপ, স্থানীয় খাবারের পরিচিতি, বাছাই করা গন্তব্য, ব্যক্তিগত পছন্দের তালিকা, কুইজ ও ট্রিপের খসড়া—সব এক জায়গায়।</p><p>মানচিত্র, ছবি ও গন্তব্যের তথ্য অ্যাপের সাথেই আছে। আপনার বাছাই এই ব্রাউজারে সেভ থাকে। বুকিং, পেমেন্ট বা বাস্তব সময়ের ভাড়া যাচাইয়ের সুবিধা যুক্ত করা হয়নি।</p><p>এই অ্যাপ Unseen Bangladesh বা অন্য কোনো ভ্রমণ সাইটের সাথে সংশ্লিষ্ট নয়। নিজস্ব নকশা ও কোডে তৈরি।</p></div>'));
  $('#privacyBtn').addEventListener('click',()=>openDialog('<div class="dialog-copy"><div class="eyebrow">আপনার তথ্য, আপনার ব্রাউজার</div><h2>তথ্য ও গোপনীয়তা</h2><p>আপনার নাম, ঘোরা জেলার বাছাই, পছন্দের জায়গা, ট্রিপ ও কুইজের সেরা ফল এই ব্রাউজারের localStorage-এ রাখা হয়। কোনো অ্যাকাউন্ট বা ব্যক্তিগত তথ্য পাঠানোর সার্ভার নেই।</p><p>ব্রাউজারের সাইট ডেটা মুছলে এই তথ্য মুছে যাবে। অন্য ডিভাইস বা ব্রাউজারে এগুলো স্বয়ংক্রিয়ভাবে পাওয়া যাবে না। ম্যাপের ছবি আপনার ডিভাইসেই তৈরি হয়।</p><p>Google Maps-এর লিংক খুললে Google-এর ওয়েবসাইটে যাবেন। তখন তাদের নীতি প্রযোজ্য।</p><button class="button secondary" id="clearLocalData">এই ব্রাউজার থেকে আমার সব তথ্য মুছুন</button></div>'));
  dialogBody.addEventListener('click',event=>{if(event.target.closest('#clearLocalData')){for(const key of ['visited','favorites','theme','name','trip','planGenerated','quizBest','includeFoods']){try{localStorage.removeItem('deshpath.'+key);}catch{}}location.reload();}});
  $('#creditsBtn').addEventListener('click',async()=>{
    openDialog('<div class="dialog-copy"><h2>ম্যাপ ও ছবির কৃতজ্ঞতা</h2><p>তথ্য লোড হচ্ছে…</p></div>');
    try{const response=await fetch('assets/credits.json');if(!response.ok)throw new Error('Credits not found');const credits=await response.json();const source=window.DESH_MAP.source;
      openDialog(`<div class="dialog-copy"><div class="eyebrow">যাঁদের কাজে পথটা সহজ হয়েছে</div><h2>ম্যাপ ও ছবির কৃতজ্ঞতা</h2><p>মানচিত্র: <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a> · <a href="${esc(source.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.license)}</a>। প্রদর্শনের জন্য সীমানা সরলীকরণ ও SVG-তে রূপান্তর করা হয়েছে।</p><p>প্রতিটি গন্তব্যে সংশ্লিষ্ট স্থানের আলাদা বাস্তব আলোকচিত্র ব্যবহার করা হয়েছে। ফটোগুলো পাতার বিন্যাস অনুযায়ী ক্রপ করে দেখানো হয়েছে।</p><ul class="credits-list">${credits.photos.map(p=>`<li><a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a><br>ছবি: <a href="${esc(p.authorUrl||p.source)}" target="_blank" rel="noopener noreferrer">${esc(p.author)}</a> · <a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a><br><small>${esc(p.changes)}</small></li>`).join('')}</ul><p>বাংলা ফন্ট: Hind Siliguri · SIL Open Font License। লাইসেন্স অ্যাপের assets ফোল্ডারে সংরক্ষিত।</p></div>`);
    }catch{openDialog('<div class="dialog-copy"><h2>ম্যাপ ও ছবির কৃতজ্ঞতা</h2><p>মানচিত্র: geoBoundaries / BBS / OCHA ROAP, CC BY 3.0 IGO। ছবির লেখক ও লাইসেন্সের পূর্ণ তালিকা অ্যাপের assets/credits.json ফাইলে আছে।</p></div>');}
  });
  $('#menuBtn').addEventListener('click',()=>{const open=$('#mainNav').classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',String(open));$('#menuBtn').setAttribute('aria-label',open?'মেনু বন্ধ করুন':'মেনু খুলুন');});
  $$('.nav-link').forEach(a=>a.addEventListener('click',()=>{$('#mainNav').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false');}));
  const sections=$$('main>section[id]');
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(entry=>{$$('.nav-link').forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));});},{rootMargin:'-15% 0px -65% 0px'});sections.forEach(s=>observer.observe(s));}
})();
