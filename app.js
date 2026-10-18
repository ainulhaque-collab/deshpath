'use strict';
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bn = value => window.DESH_I18N.lang === 'en' ? String(value) : String(value).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const money = value => (window.DESH_I18N.lang === 'en' ? 'BDT ' : '৳') + bn(Math.round(value).toLocaleString('en-IN'));
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
  const I18N=window.DESH_I18N;
  const tr=(b,e)=>I18N.tr(b,e);
  const districtName=d=>tr(d.name,d.en);
  const divisionName=d=>tr(d.name+' বিভাগ',d.id+' Division');
  const placeText=(p,field)=>tr(p[field],window.DESH_EN.places[p.id]?.[field]||p[field]);
  const foodText=(item,field)=>tr(item[field]||'',window.DESH_EN.static[item[field]]||window.DESH_EN.foods[item.name]?.[field]||item[field]||'');
  function hydrate(root=document){$$('[data-icon]',root).forEach(el=>el.innerHTML=icon(el.dataset.icon));}
  let toastTimer;
  function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3300);}
  const storage={
    get(key,fallback){try{const value=localStorage.getItem('deshpath.'+key);return value?JSON.parse(value):fallback;}catch{return fallback;}},
    set(key,value){try{localStorage.setItem('deshpath.'+key,JSON.stringify(value));}catch{toast(tr('এই ব্রাউজারে তথ্য সেভ করা যাচ্ছে না।','Your information could not be saved in this browser.'));}}
  };
  const {districts,places,divisions}=window.DESH_DATA;
  const districtById=new Map(districts.map(d=>[d.id,d]));
  const placeById=new Map(places.map(p=>[p.id,p]));
  const sortedDistricts=[...districts];
  function sortDistricts(){sortedDistricts.sort((a,b)=>districtName(a).localeCompare(districtName(b),I18N.lang));}
  function localizeCounters(){
    $$('.stats-strip>div>strong').slice(0,2).forEach((el,i)=>el.innerHTML=bn(i?8:64)+`<span>${tr('টি','')}</span>`);
    $$('.location-sub-label').forEach(el=>el.textContent=['origin','destination'].includes(el.htmlFor)?tr('জেলা','District'):tr('বিভাগ','Division'));
    $('.budget-input>span').textContent=tr('৳','BDT');
  }
  sortDistricts();
  const districtFoods=id=>window.DESH_FOODS.districts[id]?.items||[];
  const storedFavorites=storage.get('favorites',[]);
  const favorites=new Set((Array.isArray(storedFavorites)?storedFavorites:[]).filter(id=>placeById.has(id)));
  const dialog=$('#contentDialog'),dialogBody=$('#dialogBody');
  let activeDialog=null;
  function renderDialog(){if(!activeDialog)return;dialogBody.innerHTML=activeDialog();hydrate(dialogBody);}
  function openDialog(renderer){activeDialog=typeof renderer==='function'?renderer:()=>renderer;renderDialog();if(!dialog.open)dialog.showModal();}
  $('#closeDialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>activeDialog=null);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();});
  hydrate();
  const helpers={$, $$, esc,bn,money,clamp,icon,storage,districts,places,divisions,districtById,sortedDistricts,districtFoods,tr,districtName,divisionName,placeText,foodText,toast,openDialog};
  const planner=window.initDeshPlanner(helpers);
  const mapUI=window.initDeshMap(helpers);

  let category='all',visibleCount=6;
  const firstPlaces=['sreemangal','coxsbazar-beach','sajek','sundarbans','paharpur','ratargul'];
  const orderedPlaces=[...places].sort((a,b)=>{const ai=firstPlaces.indexOf(a.id),bi=firstPlaces.indexOf(b.id);return(ai<0?99:ai)-(bi<0?99:bi);});
  const discoveryData=window.DESH_DISCOVERY;
  let filterDivision='',filterDistrict='',filterMonth='',nearbyDistances=null,nearbyPending=false,nearbyError='',nearbyRequest=0;
  const discoveryControls=document.createElement('div');
  discoveryControls.className='discovery-controls';
  $('.explore-toolbar').after(discoveryControls);
  function discoveryText(value){return value?tr(value.bn,value.en):'';}
  function discoveryRefreshLanguage(){
    const districtOptions=districts.filter(d=>!filterDivision||d.division===filterDivision).sort((a,b)=>districtName(a).localeCompare(districtName(b),I18N.lang));
    discoveryControls.innerHTML=`<div class="discovery-filter-row"><label>${tr('বিভাগ','Division')}<select id="exploreDivision"><option value="">${tr('সব বিভাগ','All divisions')}</option>${divisions.map(d=>`<option value="${esc(d.id)}">${esc(divisionName(d))}</option>`).join('')}</select></label><label>${tr('জেলা','District')}<select id="exploreDistrict"><option value="">${tr('সব জেলা','All districts')}</option>${districtOptions.map(d=>`<option value="${esc(d.id)}">${esc(districtName(d))}</option>`).join('')}</select></label><label>${tr('ভ্রমণের মাস','Travel month')}<select id="exploreMonth"><option value="">${tr('যেকোনো মাস','Any month')}</option>${discoveryData.months.map(m=>`<option value="${m.value}">${esc(discoveryText(m))}</option>`).join('')}</select></label><button type="button" class="button secondary nearby-button${nearbyDistances?' active':''}" id="nearbyPlaces"${nearbyPending?' disabled':''} aria-pressed="${!!nearbyDistances}">${icon('compass')} ${nearbyPending?tr('অবস্থান পাওয়া হচ্ছে…','Finding your location…'):nearbyDistances?tr('দূরত্বের বাছাই সরান','Clear nearby sorting'):tr('আমার কাছাকাছি','Near me')}</button><button type="button" class="text-button discovery-reset" id="resetDiscovery">${tr('বাছাই মুছুন','Reset filters')}</button></div><p class="discovery-note">${esc(discoveryText(discoveryData.note))}</p><p class="nearby-note" id="nearbyStatus" role="status">${nearbyStatusText()}</p>`;
    $('#exploreDivision').value=filterDivision;$('#exploreDistrict').value=filterDistrict;$('#exploreMonth').value=filterMonth;
  }
  function nearbyStatusText(){
    if(nearbyPending)return tr('আপনার ব্রাউজারের অনুমতি পেলে কাছের জেলার ক্রম দেখাবে।','Your browser will ask for permission to sort nearby districts.');
    if(nearbyError==='denied')return tr('অবস্থানের অনুমতি পাওয়া যায়নি। বিভাগ বা জেলা বেছে গন্তব্য খুঁজুন।','Location permission was not granted. Choose a division or district to explore.');
    if(nearbyError==='unavailable')return tr('এই মুহূর্তে অবস্থান পাওয়া যায়নি। আবার চেষ্টা করুন অথবা জেলা বেছে নিন।','Your location is unavailable right now. Try again or choose a district.');
    if(nearbyError==='unsupported')return tr('এই ব্রাউজারে অবস্থানের সুবিধা নেই। জেলা বেছে গন্তব্য খুঁজুন।','Location is not supported in this browser. Choose a district to explore.');
    return nearbyDistances?tr('কাছের জেলা আগে দেখানো হচ্ছে। দূরত্ব আপনার অবস্থান থেকে জেলার আনুমানিক কেন্দ্র পর্যন্ত সরলরেখায়; দর্শনীয় স্থান বা সড়কপথের দূরত্ব নয়। অবস্থান সেভ করা হয় না।','Nearby districts appear first. Distances are straight lines from your location to approximate district centres, not to attractions or along roads. Your position is not saved.'):tr('“আমার কাছাকাছি” চাপলেই শুধু অবস্থানের অনুমতি চাওয়া হবে। আপনার অবস্থান সেভ করা হয় না।','Location permission is requested only after you press “Near me”. Your position is not saved.');
  }
  function resetPlaceFilters(){category='all';visibleCount=6;filterDivision='';filterDistrict='';filterMonth='';nearbyDistances=null;nearbyPending=false;nearbyError='';nearbyRequest++;$('#placeSearch').value='';$$('[data-category]').forEach(x=>x.classList.toggle('active',x.dataset.category==='all'));discoveryRefreshLanguage();renderPlaces();}
  discoveryControls.addEventListener('change',event=>{
    if(event.target.id==='exploreDivision'){filterDivision=event.target.value;filterDistrict='';discoveryRefreshLanguage();}
    if(event.target.id==='exploreDistrict')filterDistrict=event.target.value;
    if(event.target.id==='exploreMonth')filterMonth=event.target.value;
    visibleCount=6;renderPlaces();
  });
  discoveryControls.addEventListener('click',event=>{
    if(event.target.closest('#resetDiscovery')){resetPlaceFilters();return;}
    if(!event.target.closest('#nearbyPlaces'))return;
    if(nearbyDistances){nearbyDistances=null;nearbyError='';nearbyRequest++;discoveryRefreshLanguage();renderPlaces();return;}
    if(!navigator.geolocation){nearbyError='unsupported';discoveryRefreshLanguage();return;}
    const request=++nearbyRequest;nearbyPending=true;nearbyError='';discoveryRefreshLanguage();
    // Only derived district-centre distances remain in memory. Coordinates are
    // neither written to storage nor transmitted to an application server.
    navigator.geolocation.getCurrentPosition(position=>{
      if(request!==nearbyRequest)return;
      const rad=value=>value*Math.PI/180,lat=position.coords.latitude,lng=position.coords.longitude;
      nearbyDistances=new Map(districts.map(d=>{const a=Math.sin(rad(d.lat-lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(d.lat))*Math.sin(rad(d.lng-lng)/2)**2;return[d.id,6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))];}));
      nearbyPending=false;visibleCount=6;discoveryRefreshLanguage();renderPlaces();
    },error=>{if(request!==nearbyRequest)return;nearbyPending=false;nearbyError=error.code===1?'denied':'unavailable';discoveryRefreshLanguage();},{enableHighAccuracy:false,timeout:12000,maximumAge:0});
  });
  discoveryRefreshLanguage();
  function favoriteLabel(p){return tr(p.name+(favorites.has(p.id)?' পছন্দ থেকে সরান':' পছন্দে রাখুন'),(favorites.has(p.id)?'Remove ':'Save ')+placeText(p,'name'));}
  function renderFavoriteButtons(){
    $('#savedCount').textContent=bn(favorites.size);
    $$('[data-favorite]').forEach(b=>{const yes=favorites.has(b.dataset.favorite);b.classList.toggle('is-favorite',yes);b.setAttribute('aria-pressed',String(yes));b.setAttribute('aria-label',favoriteLabel(placeById.get(b.dataset.favorite)));});
  }
  function toggleFavorite(id){if(!placeById.has(id))return;favorites.has(id)?favorites.delete(id):favorites.add(id);storage.set('favorites',[...favorites]);renderFavoriteButtons();toast(favorites.has(id)?tr('পছন্দের তালিকায় রাখা হয়েছে।','Added to your saved places.'):tr('পছন্দের তালিকা থেকে সরানো হয়েছে।','Removed from your saved places.'));}
  function getFilteredPlaces(){const query=$('#placeSearch').value.trim().toLowerCase();const list=orderedPlaces.filter(p=>{const district=districtById.get(p.district);return(category==='all'||p.category===category)&&(!filterDivision||district.division===filterDivision)&&(!filterDistrict||p.district===filterDistrict)&&(!filterMonth||discoveryData.places[p.id]?.months.includes(Number(filterMonth)))&&(!query||[p.name,p.description,placeText(p,'name'),placeText(p,'description'),window.DESH_EN.places[p.id]?.name,district.name,district.en].join(' ').toLowerCase().includes(query));});return nearbyDistances?list.sort((a,b)=>nearbyDistances.get(a.district)-nearbyDistances.get(b.district)):list;}
  function imageAlt(p){return placeText(p,'name')+' · '+districtName(districtById.get(p.district))+tr(' — স্থানের বাস্তব আলোকচিত্র',' — a real photograph of this place');}
  function placeCard(p){const d=districtById.get(p.district),name=placeText(p,'name');return `<article class="place-card"><div class="place-card-image"><button class="place-image-link" data-place="${p.id}" aria-label="${esc(tr(name+' সম্পর্কে জানুন','Discover '+name))}"><img src="${p.image}" alt="${esc(imageAlt(p))}" loading="lazy" width="960" height="650"></button><span class="place-category">${esc(placeText(p,'categoryLabel'))}</span><button class="favorite-button${favorites.has(p.id)?' is-favorite':''}" data-favorite="${p.id}" aria-pressed="${favorites.has(p.id)}" aria-label="${esc(favoriteLabel(p))}">${icon('heart')}</button></div><div class="place-card-body"><div class="place-location">${icon('map-pin')} ${esc(districtName(d))}, ${tr('বাংলাদেশ','Bangladesh')}</div>${nearbyDistances?`<span class="place-distance">≈ ${bn(Math.round(nearbyDistances.get(p.district)))} ${tr('কিমি · জেলার কেন্দ্র পর্যন্ত','km · to district centre')}</span>`:''}<h3><a href="#explore" data-place="${p.id}">${esc(name)}</a></h3><p>${esc(placeText(p,'description'))}</p><div class="place-card-bottom"><span>${icon('clock')} ${esc(placeText(p,'duration'))}</span><button class="place-detail-button" data-place="${p.id}">${tr('ঘুরে দেখুন','Explore')} ${icon('arrow-up-right')}</button></div></div></article>`;}
  function renderPlaces(){const list=getFilteredPlaces();$('#placesGrid').innerHTML=list.slice(0,visibleCount).map(placeCard).join('')||`<div class="empty-results">${tr('এই বাছাইয়ে কোনো জায়গা পাওয়া যায়নি।','No places match your search.')}<button class="text-button" id="clearPlaceFilters">${tr('সব জায়গা দেখুন','Show all places')}</button></div>`;$('#loadMore').hidden=list.length<=visibleCount;$('#placesResult').textContent=tr(bn(Math.min(visibleCount,list.length))+' / '+bn(list.length)+'টি গন্তব্য দেখানো হচ্ছে','Showing '+Math.min(visibleCount,list.length)+' of '+list.length+' destinations');$('#placeTotal').innerHTML=bn(places.length)+`<span>${tr('টি','')}</span>`;}
  $$('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;visibleCount=6;$$('[data-category]').forEach(x=>x.classList.toggle('active',x===b));renderPlaces();}));
  $('#placeSearch').addEventListener('input',()=>{visibleCount=6;renderPlaces();});
  $('#loadMore').addEventListener('click',()=>{visibleCount+=6;renderPlaces();});
  function travelGuideMarkup(p){
    const guide=discoveryData.places[p.id],emergency=discoveryData.emergency;
    if(!guide)return '';
    return `<div class="travel-guide"><h3>${tr('যাত্রার আগে জেনে নিন','Before you go')}</h3><div class="guide-block"><h4>${tr('কীভাবে যাবেন','Getting there')}</h4><p>${esc(discoveryText(guide.howTo))}</p></div><div class="guide-block"><h4>${tr('থাকার পরিকল্পনা','Planning your stay')}</h4><p>${esc(discoveryText(guide.stay))}</p></div><div class="guide-block"><h4>${tr('খরচের প্রস্তুতি','Planning costs')}</h4><p>${esc(discoveryText(guide.cost))}</p></div><p class="guide-source"><a href="${esc(guide.source.url)}" target="_blank" rel="noopener noreferrer">${esc(discoveryText(guide.source.title))} ${icon('arrow-up-right')}</a></p><p class="source-note">${esc(discoveryText(discoveryData.adviceNote))}</p><div class="emergency-contact"><div><strong>${esc(discoveryText(emergency.title))}</strong><p>${esc(discoveryText(emergency.text))}</p><a href="${esc(emergency.source)}" target="_blank" rel="noopener noreferrer">${tr('সূত্র: বাংলাদেশ পুলিশ','Source: Bangladesh Police')}</a></div><a class="emergency-call" href="tel:999" aria-label="${esc(tr('জাতীয় জরুরি সেবা ৯৯৯-এ কল করুন','Call national emergency service 999'))}">${bn(999)}</a></div></div>`;
  }
  function openPlace(id){const p=placeById.get(id);if(!p)return;openDialog(()=>{
    const d=districtById.get(p.district),foods=districtFoods(d.id),mapsUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(window.DESH_EN.places[p.id].name+' '+d.en+' Bangladesh');
    return `<img class="dialog-image" src="${p.image}" alt="${esc(imageAlt(p))}"><div class="dialog-copy"><div class="place-location">${icon('map-pin')} ${esc(districtName(d))} · ${esc(placeText(p,'categoryLabel'))}</div><h2>${esc(placeText(p,'name'))}</h2><p>${esc(placeText(p,'description'))}</p><div class="detail-facts"><div class="detail-fact">${tr('কখন যেতে পারেন','When to go')}<strong>${esc(placeText(p,'season'))}</strong></div><div class="detail-fact">${tr('সময় রাখুন','Time to allow')}<strong>${esc(placeText(p,'duration'))}</strong></div></div>${foods.length?`<div class="detail-foods"><span>${icon('utensils')} ${tr(districtName(d)+' জেলার পরিচিত স্বাদ','Local flavours of '+districtName(d))}</span><strong>${foods.map(item=>esc(foodText(item,'name'))).join(' · ')}</strong><div class="food-source-links">${mapUI.foodSourceLinks(foods)}</div></div>`:''}${travelGuideMarkup(p)}<div class="review-panel" data-review-place="${p.id}"></div><div class="dialog-actions"><button class="button primary" data-plan-district="${d.id}">${tr('ট্রিপে জেলা যোগ করুন','Add district to trip')} ${icon('plus')}</button><a class="button secondary" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Google Maps ${icon('arrow-up-right')}</a></div><p class="source-note">${tr('এই গন্তব্যের নিজস্ব আলোকচিত্র ব্যবহার করা হয়েছে। ছবির লেখক, উৎস ও লাইসেন্স ফুটারের কৃতজ্ঞতা অংশে পাবেন।','This destination uses a real photograph of the place. Photo credits, sources and licences are listed in the footer.')}</p></div>`;
  });}
  function openSaved(){openDialog(()=>`<div class="dialog-copy"><div class="eyebrow">${tr('পরে ঘুরে দেখবেন','Places to explore later')}</div><h2>${tr('পছন্দের জায়গা','Saved places')} <small>(${bn(favorites.size)})</small></h2><p>${tr('আপনার বাছাই করা জায়গাগুলো এই ব্রাউজারে রাখা আছে।','Your saved places are stored in this browser.')}</p><div class="saved-list">${favorites.size?[...favorites].map(id=>{const p=placeById.get(id);return `<div class="saved-item"><img src="${p.image}" alt="${esc(imageAlt(p))}"><div><h3><a href="#explore" data-place="${p.id}">${esc(placeText(p,'name'))}</a></h3><p>${esc(districtName(districtById.get(p.district)))} · ${esc(placeText(p,'duration'))}</p></div><button class="icon-button" data-remove-saved="${p.id}" aria-label="${esc(tr(p.name+' সরান','Remove '+placeText(p,'name')))}">${icon('x')}</button></div>`;}).join(''):`<div class="saved-empty">${icon('heart')}<h3>${tr('এখনো কোনো জায়গা বাছাই করেননি','No saved places yet')}</h3><p>${tr('গন্তব্যের ছবির হার্ট চিহ্নে চাপ দিয়ে পছন্দে রাখুন।','Tap the heart on a destination photo to save it here.')}</p><button class="button primary" id="savedExplore">${tr('গন্তব্যগুলো দেখি','Explore destinations')} ${icon('arrow-right')}</button></div>`}</div></div>`);}
  document.addEventListener('click',event=>{
    const favorite=event.target.closest('[data-favorite]');if(favorite){toggleFavorite(favorite.dataset.favorite);return;}
    const place=event.target.closest('[data-place]');if(place){event.preventDefault();openPlace(place.dataset.place);return;}
    if(event.target.closest('#clearPlaceFilters'))resetPlaceFilters();
  });
  $('#savedBtn').addEventListener('click',openSaved);
  dialogBody.addEventListener('click',event=>{
    const remove=event.target.closest('[data-remove-saved]');if(remove){favorites.delete(remove.dataset.removeSaved);storage.set('favorites',[...favorites]);renderFavoriteButtons();renderDialog();return;}
    const plan=event.target.closest('[data-plan-district]');if(plan){if(planner.addTrip(plan.dataset.planDistrict)){dialog.close();location.hash='planner';$('#planner').scrollIntoView({behavior:'smooth'});}return;}
    if(event.target.closest('#savedExplore')){dialog.close();location.hash='explore';}
  });
  renderPlaces();renderFavoriteButtons();localizeCounters();

  $('#quizBtn').addEventListener('click',()=>{location.hash='games';$('#games').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  $('#aboutBtn').addEventListener('click',()=>openDialog(()=>`<div class="dialog-copy"><div class="eyebrow">${tr('নিজের দেশকে নতুন করে দেখা','See Bangladesh with fresh eyes')}</div><h2>${tr('দেশপথ সম্পর্কে','About Deshpath')}</h2><p>${tr('দেশপথ একটি স্বাধীন বাংলা ভ্রমণ ওয়েব অ্যাপ। ৬৪ জেলার ইন্টারেক্টিভ ম্যাপ, স্থানীয় খাবারের পরিচিতি, বাছাই করা গন্তব্য, ব্যক্তিগত পছন্দের তালিকা, কুইজ ও ট্রিপের খসড়া—সব এক জায়গায়।','Deshpath is an independent travel web app for Bangladesh. Explore an interactive map of all 64 districts, local food, handpicked destinations, saved places, a quiz and draft itineraries in one place.')}</p><p>${tr('মানচিত্র, ছবি ও গন্তব্যের তথ্য অ্যাপের সাথেই আছে। আপনার বাছাই এই ব্রাউজারে সেভ থাকে। বুকিং, পেমেন্ট বা বাস্তব সময়ের ভাড়া যাচাইয়ের সুবিধা যুক্ত করা হয়নি।','Map, photo and destination information is bundled with the app. Your selections are saved in this browser. Booking, payments and live fares are not available.')}</p></div>`));
  $('#privacyBtn').addEventListener('click',()=>openDialog(()=>`<div class="dialog-copy"><div class="eyebrow">${tr('আপনার তথ্য, আপনার ব্রাউজার','Your data, your browser')}</div><h2>${tr('তথ্য ও গোপনীয়তা','Information & privacy')}</h2><p>${tr('আপনার প্রোফাইল, মানচিত্র, পাসপোর্ট, ট্রিপ, খেলার ফল, ব্যক্তিগত নোট ও অবদানের খসড়া এই ব্রাউজারে থাকে। নিজের ছবি IndexedDB-তে রাখা হয়। অনুমোদিত প্রকাশ্য লেখা ও রিভিউ Supabase থেকে আসে। ইমেইল লগইনের শেষ সেটিংস এখনও বাকি; সেটি চালু হলে লগইন করে আলাদা বাটনে ব্যক্তিগত জার্নালের লেখা ও বাছাই ক্লাউডে রাখতে পারবেন। নিজের ছবি আপলোড হয় না।','Your profile, maps, passports, trip, game scores, private notes and contribution drafts stay in this browser. Personal photos are stored in IndexedDB. Approved public stories and reviews are retrieved from Supabase. Email sign-in setup is still pending; once enabled, signing in and pressing a separate button can save your private journal text and selections to the cloud. Personal photos are not uploaded.')}</p><p>${tr('আপনি ব্যাকআপ ডাউনলোড করে অন্য ডিভাইসে ফিরিয়ে আনতে পারেন। ব্যাকআপে ব্যক্তিগত ছবি ও লেখা থাকে; ফাইলটি নিরাপদে রাখুন। ব্রাউজারের সাইট ডেটা মুছলে স্থানীয় তথ্য মুছে যায়। ম্যাপের ছবি আপনার ডিভাইসেই তৈরি হয়।','Download a backup to restore your journal on another device. It contains personal photos and notes, so keep the file safe. Clearing browser site data removes local information. Map images are created on your device.')}</p><p>${tr('কাছাকাছি জায়গা বাটনে চাপলে ব্রাউজার আপনার অবস্থান ব্যবহারের অনুমতি চায়। অবস্থান সার্ভারে পাঠানো বা সেভ করা হয় না।','The nearby button requests browser location permission. Your location is not sent to a server or saved.')}</p><p>${tr('Google Maps-এর লিংক খুললে Google-এর ওয়েবসাইটে যাবেন। তখন তাদের নীতি প্রযোজ্য।','Google Maps links open Google’s website, where their policies apply.')}</p><p>${tr('প্রকাশ্য অবদান বা রিভিউ পাঠাতে আলাদা সম্মতি বাটন থাকে; অনুমোদনের আগে তা অন্যরা দেখতে পাবেন না। নিচের বাটনে এই ব্রাউজারের দেশপথ তথ্য ও নিজের ছবি মুছে যাবে। এটি ক্লাউডের তথ্য বা Supabase অ্যাকাউন্ট মুছে ফেলে না। আগে ব্যাকআপ নিতে চাইলে প্রোফাইলে যান।','Public stories or reviews require a separate submission action and remain hidden from other visitors until approved. The button below removes Deshpath data and personal photos from this browser. It does not delete cloud data or a Supabase account. Visit your profile first if you want a backup.')}</p><button class="button secondary" id="clearLocalData">${tr('এই ব্রাউজার থেকে আমার সব তথ্য মুছুন','Delete all my data from this browser')}</button></div>`));
  dialogBody.addEventListener('click',async event=>{const button=event.target.closest('#clearLocalData');if(!button)return;button.disabled=true;try{if(window.DESH_CLOUD?.enabled)await window.DESH_CLOUD.signOut();await window.DESH_JOURNAL.media('clear');for(const key of Object.keys(localStorage))if(key.startsWith('deshpath.'))localStorage.removeItem(key);location.reload();}catch{button.disabled=false;toast(tr('সব তথ্য মুছে ফেলা যায়নি। ব্রাউজারের সাইট ডেটা সেটিং ব্যবহার করতে পারেন।','Some information could not be removed. You can use your browser’s site-data settings.'));}});
  let credits=null;
  function creditsMarkup(){const source=window.DESH_MAP.source;return `<div class="dialog-copy"><div class="eyebrow">${tr('যাঁদের কাজে পথটা সহজ হয়েছে','Thanks to those who made this possible')}</div><h2>${tr('ম্যাপ ও ছবির কৃতজ্ঞতা','Map & photo credits')}</h2><p>${tr('মানচিত্র:','Map:')} <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a> · <a href="${esc(source.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.license)}</a>${tr('। প্রদর্শনের জন্য সীমানা সরলীকরণ ও SVG-তে রূপান্তর করা হয়েছে।','. Boundaries have been simplified and converted to SVG for display.')}</p><p>${tr('বিশ্ব মানচিত্র: Natural Earth-এর পাবলিক ডোমেইন তথ্য; Equal Earth প্রক্ষেপণ ও সরলীকরণ দেশপথের জন্য করা।','World map: public-domain Natural Earth data, simplified and projected with Equal Earth for Deshpath.')} <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a></p><p>${tr('গন্তব্যে সংশ্লিষ্ট স্থানের বাস্তব আলোকচিত্র এবং মানচিত্রে খাবারের আলোকচিত্র ব্যবহার করা হয়েছে। সীমানা ও কার্ডের মাপ অনুযায়ী ছবি ক্রপ করা হয়েছে।','Destinations use real photographs of each place. The map uses food photographs cropped to fit district boundaries. Photos are also cropped to fit the cards.')}</p>${credits?`<ul class="credits-list">${credits.photos.map(p=>`<li><a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a><br>${tr('ছবি:','Photo:')} <a href="${esc(p.authorUrl||p.source)}" target="_blank" rel="noopener noreferrer">${esc(p.author)}</a> · <a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a><br><small>${esc(p.changes)}</small></li>`).join('')}</ul>`:`<p>${tr('তথ্য লোড হচ্ছে…','Loading information…')}</p>`}<p>${tr('বাংলা ফন্ট: Hind Siliguri · SIL Open Font License। লাইসেন্স অ্যাপের assets ফোল্ডারে সংরক্ষিত।','Bengali font: Hind Siliguri · SIL Open Font License. The licence is included in the app’s assets folder.')}</p></div>`;}
  $('#creditsBtn').addEventListener('click',async()=>{openDialog(creditsMarkup);if(credits)return;try{const r=await fetch('assets/credits.json');if(!r.ok)throw Error('Credits unavailable');credits=await r.json();if(dialog.open&&activeDialog===creditsMarkup)renderDialog();}catch{if(dialog.open&&activeDialog===creditsMarkup)openDialog(()=>`<div class="dialog-copy"><h2>${tr('ম্যাপ ও ছবির কৃতজ্ঞতা','Map & photo credits')}</h2><p>${tr('সম্পূর্ণ কৃতজ্ঞতার তালিকা assets/credits.json ফাইলে আছে।','Full photo credits are available in assets/credits.json.')}</p></div>`);}});

  $('#menuBtn').addEventListener('click',()=>{const open=$('#mainNav').classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',String(open));$('#menuBtn').setAttribute('aria-label',open?tr('মেনু বন্ধ করুন','Close menu'):tr('মেনু খুলুন','Open menu'));});
  $$('.nav-link').forEach(a=>a.addEventListener('click',()=>{$('#mainNav').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false');}));
  const worldPassport=window.initDeshWorldPassport(helpers);
  const games=window.initDeshGames(helpers);
  const community=window.initDeshCommunity(helpers);
  const sections=$$('main>section[id],#worldPassportRoot');
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.filter(e=>e.isIntersecting).forEach(entry=>$$('.nav-link').forEach(a=>a.classList.toggle('active',a.hash==='#'+(entry.target.id==='worldPassportRoot'?'worldAtlas':entry.target.id)))),{rootMargin:'-15% 0px -65% 0px'});sections.forEach(section=>observer.observe(section));}
  $('#languageToggle').addEventListener('click',()=>I18N.setLanguage(I18N.lang==='bn'?'en':'bn'));
  I18N.onChange(()=>{sortDistricts();planner.refreshLanguage();mapUI.refreshLanguage();discoveryRefreshLanguage();renderPlaces();renderFavoriteButtons();localizeCounters();games.refreshLanguage();community.refreshLanguage();if(dialog.open)renderDialog();$('#toast').classList.remove('show');$('#menuBtn').setAttribute('aria-label',$('#mainNav').classList.contains('open')?tr('মেনু বন্ধ করুন','Close menu'):tr('মেনু খুলুন','Open menu'));});
})();
