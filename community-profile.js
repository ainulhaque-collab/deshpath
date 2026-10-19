/* Personal journal, private contribution drafts and reviews. */
'use strict';
window.initDeshCommunity = function(h) {
  const {$,esc,bn,tr,storage,districts,places,districtName,districtById,placeText,toast}=h;
  const kit=window.DESH_JOURNAL,root=$('#communityRoot'),profileRoot=$('#profileRoot');
  const onlineCommunity=typeof window.initDeshOnlineCommunity==='function'?window.initDeshOnlineCommunity(h):null;
  const asArray=value=>Array.isArray(value)?value:[];
  let profile=storage.get('profile',{});if(!profile||typeof profile!=='object'||Array.isArray(profile))profile={};
  profile={name:typeof profile.name==='string'?profile.name.slice(0,60):'',bio:typeof profile.bio==='string'?profile.bio.slice(0,250):''};
  let drafts=asArray(storage.get('contributions',[])).filter(kit.validDraft).slice(0,100);
  let reviews=asArray(storage.get('reviews',[])).filter(kit.validReview).slice(0,100);
  const media=new Map();let backupCandidate=null,contributionPhoto=null,reviewPhoto=null,otpEmail='',busy=false;
  let reviewGeneration=0,contributionGeneration=0,profileGeneration=0,backupGeneration=0;
  const pendingUploads=new Set();
  const photoSrc=record=>kit.isRasterDataURL(record?.src)?record.src:'';
  const cloud=()=>window.DESH_CLOUD;
  const enabled=()=>cloud()?.enabled===true;
  const authReady=()=>enabled()&&cloud()?.getStatus?.().authReady!==false;
  let cloudUser=null,cloudRenderGeneration=0,ownGeneration=0,authInitialising=authReady(),authCallbackMessage=[];
  let publicStories={state:'idle',rows:[]},ownSubmissions={state:'idle',contributions:[],reviews:[]};
  const publicReviews=new Map();
  const draftBody=d=>[d.area,d.description,d.directions,d.notes].filter(Boolean).join('\n\n');
  const validPublicStory=row=>row&&typeof row.id==='string'&&districtById.has(row.district_id)&&typeof row.title==='string'&&typeof row.body==='string';
  const validPublicReview=row=>row&&typeof row.id==='string'&&places.some(p=>p.id===row.place_id)&&Number.isInteger(row.rating)&&row.rating>=1&&row.rating<=5&&typeof row.body==='string';
  function statusChip(status){const known=['pending','approved','rejected'].includes(status)?status:'unknown';const labels={pending:tr('পর্যালোচনায়','Awaiting review'),approved:tr('প্রকাশিত','Published'),rejected:tr('অনুমোদিত হয়নি','Not approved'),unknown:tr('অবস্থা অজানা','Status unavailable')};return `<span class="journal-cloud-state ${known}">${labels[known]}</span>`;}
  function matchingStory(d){return ownSubmissions.contributions.find(row=>row.district_id===d.district&&row.title===d.title&&row.body===draftBody(d));}
  function matchingReview(r){return ownSubmissions.reviews.find(row=>row.place_id===r.placeId);}
  function cloudErrorCopy(error){
    const messages={
      'sign-in-required':['অনলাইনে পাঠাতে আগে প্রোফাইল থেকে সাইন ইন করুন।','Sign in from your profile before submitting online.'],
      'already-submitted':['এই গন্তব্যে আপনার অনলাইন রিভিউ আগেই জমা আছে। প্রোফাইলে তার অবস্থা দেখুন।','You have already submitted an online review for this place. Check its status in your profile.'],
      'invalid-input':['পাঠানোর লেখার দৈর্ঘ্য, গন্তব্য ও রেটিং আবার পরীক্ষা করুন। আপনার স্থানীয় খসড়া রাখা আছে।','Check the text length, destination and rating before submitting. Your local draft is still saved.'],
      'auth-not-ready':['ইমেইল লগইনের শেষ সেটিংস বাকি আছে। আপনার খাতা এই ডিভাইসে ব্যবহার করুন।','Email sign-in setup is not finished yet. Continue using your journal on this device.'],
      'cloud-rate-limited':['অনলাইনে অনুরোধের সীমা আপাতত পূর্ণ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন। আপনার স্থানীয় তথ্য রাখা আছে।','The online service has reached its request limit. Wait a while before trying again. Your local data is still saved.'],
      'email-unavailable':['সাইটের ইমেইল সেবা এখন লগইন ইমেইল পাঠাতে পারছে না। সাইট পরিচালককে ইমেইল সেবা ও সেটিংস পরীক্ষা করতে হবে। আপনার স্থানীয় খাতা ব্যবহার করতে পারবেন।','The email service cannot send a sign-in email right now. The site owner should check its email service and settings. You can keep using your local journal.']
    };
    return Object.hasOwn(messages,error?.code)?messages[error.code]:['অনুরোধটি সম্পন্ন হয়নি। ইন্টারনেট সংযোগ ও সাইন ইন অবস্থা দেখে আবার চেষ্টা করুন।','The request could not be completed. Check your connection and sign-in status, then try again.'];
  }
  function cloudErrorMessage(error){return tr(...cloudErrorCopy(error));}
  const counts=()=>({districts:new Set(asArray(storage.get('visited',[])).filter(id=>districtById.has(id))).size,countries:new Set(asArray(storage.get('worldVisited',[])).filter(id=>window.DESH_WORLD?.countries.some(c=>c.id===id))).size,stamps:new Set(asArray(storage.get('passportPlaces',[])).filter(id=>places.some(p=>p.id===id))).size});
  const options=()=>districts.map(d=>`<option value="${esc(d.id)}">${esc(districtName(d))}</option>`).join('');
  function renderDrafts(){
    const list=$('#contributionDrafts');if(!list)return;
    list.innerHTML=drafts.length?drafts.map(d=>{const online=matchingStory(d);return `<article class="journal-draft"><span class="draft-state">${tr('ব্যক্তিগত খসড়া','Private draft')}</span><h4>${esc(d.title)}</h4><p>${esc(districtName(districtById.get(d.district)))} · ${d.kind==='food'?tr('খাবার ও পণ্য','Food & local product'):tr('লুকানো জায়গা','Hidden place')}</p>${media.get(d.photoId)?`<img src="${esc(photoSrc(media.get(d.photoId)))}" alt="${esc(d.title)}" loading="lazy">`:''}<p>${esc(d.description)}</p>${online?`<p class="journal-small">${tr('অনলাইনে পাঠানো কপি:','Submitted online copy:')} ${statusChip(online.status)}</p>`:''}<div class="journal-actions"><button class="text-button" data-export-draft="${esc(d.id)}">${tr('খসড়া ডাউনলোড','Download draft')}</button><button class="text-button" data-delete-draft="${esc(d.id)}">${tr('খসড়া সরান','Remove draft')}</button>${authReady()&&!online&&!onlineCommunity?`<button class="text-button" data-send-draft="${esc(d.id)}">${tr('লেখাটি প্রকাশের যাচাইয়ে পাঠান','Submit text for publication review')}</button>`:''}</div>${enabled()&&!onlineCommunity?`<p class="journal-small">${authReady()?tr('ওপরের আলাদা পাঠান বাটন ব্যবহার করলে এই খসড়ার নাম, এলাকা, বর্ণনা, দিকনির্দেশ ও নোট অনলাইনে যাবে। অনুমোদনের পরে সবাই পড়তে পারবেন। ছবি ও প্রোফাইলের তথ্য পাঠানো হয় না।','The separate Submit button sends this draft’s title, area, description, directions and notes online. They can be read publicly after approval. Photos and profile details are not sent.'):tr('ইমেইল লগইনের শেষ সেটিংস হলে অনলাইনে পাঠানো যাবে। এই খসড়া ও ছবি এখন এই ডিভাইসে আছে।','Online submission will be available after email sign-in setup is finished. This draft and photo are on this device.')}</p>`:''}</article>`;}).join(''):`<p class="journal-small">${tr('এখনো কোনও খসড়া রাখেননি।','No contribution drafts yet.')}</p>`;
  }
  function renderPublicStories(){
    const mount=$('#approvedCommunityStories');if(!mount)return;
    if(publicStories.state==='loading'||publicStories.state==='idle'){mount.innerHTML=`<p class="journal-small" role="status">${tr('প্রকাশিত গল্প খোঁজা হচ্ছে…','Loading published stories…')}</p>`;return;}
    if(publicStories.state==='error'){mount.innerHTML=`<p class="journal-small journal-errors" role="status">${tr('প্রকাশিত গল্প লোড হয়নি। আবার চেষ্টা করুন।','Published stories could not be loaded. Please try again.')}</p>`;return;}
    mount.innerHTML=publicStories.rows.length?publicStories.rows.map(row=>`<article class="journal-public-story"><div>${statusChip('approved')}<span>${esc(districtName(districtById.get(row.district_id)))}</span></div><h4>${esc(row.title)}</h4><p>${esc(row.body)}</p></article>`).join(''):`<p class="journal-small">${tr('এখনো প্রকাশিত কমিউনিটি গল্প নেই। প্রথম গল্পগুলো যাচাইয়ের পরে এখানে আসবে।','There are no published community stories yet. Approved stories will appear here.')}</p>`;
  }
  async function loadPublicStories(){
    if(!enabled()||publicStories.state==='loading')return;
    publicStories={...publicStories,state:'loading'};renderPublicStories();
    try{const rows=await cloud().listApprovedContributions();publicStories={state:'ready',rows:asArray(rows).filter(validPublicStory)};}
    catch{publicStories={state:'error',rows:[]};}
    renderPublicStories();
  }
  function renderOwnSubmissions(){
    const mount=$('#myOnlineSubmissions');if(!mount)return;
    if(!cloudUser){mount.innerHTML='';return;}
    if(ownSubmissions.state==='idle'||ownSubmissions.state==='loading'){mount.innerHTML=`<p class="journal-small" role="status">${tr('আপনার জমার অবস্থা দেখা হচ্ছে…','Loading your submission status…')}</p>`;return;}
    if(ownSubmissions.state==='error'){mount.innerHTML=`<p class="journal-small journal-errors">${tr('আপনার জমার অবস্থা লোড হয়নি। আবার চেষ্টা করুন।','Your submission status could not be loaded. Please try again.')}</p>`;return;}
    const rows=[...ownSubmissions.contributions.map(row=>({label:row.title,status:row.status,kind:tr('গল্প','Story')})),...ownSubmissions.reviews.map(row=>({label:placeText(places.find(p=>p.id===row.place_id),'name'),status:row.status,kind:tr('রিভিউ','Review')}))];
    mount.innerHTML=rows.length?`<ul class="journal-submission-list">${rows.map(row=>`<li><div><small>${row.kind}</small><strong>${esc(row.label)}</strong></div>${statusChip(row.status)}</li>`).join('')}</ul><p class="journal-small">${tr('পর্যালোচনায় বা অনুমোদিত হয়নি এমন লেখা শুধু আপনি দেখতে পান। প্রকাশিত লেখা সবাই দেখতে পারেন।','Only you can see your pending or unapproved submissions. Published content can be read by everyone.')}</p>`:`<p class="journal-small">${tr('এই অ্যাকাউন্ট থেকে এখনো কিছু জমা দেননি।','No submissions from this account yet.')}</p>`;
  }
  async function loadOwnSubmissions(user=cloudUser){
    const generation=++ownGeneration;
    if(!enabled()||!user){ownSubmissions={state:'idle',contributions:[],reviews:[]};renderOwnSubmissions();renderDrafts();return;}
    ownSubmissions={...ownSubmissions,state:'loading'};renderOwnSubmissions();
    try{const result=await cloud().listMySubmissions();if(generation!==ownGeneration||cloudUser?.id!==user.id)return;ownSubmissions={state:'ready',contributions:asArray(result.contributions).filter(validPublicStory),reviews:asArray(result.reviews).filter(validPublicReview)};}
    catch{if(generation!==ownGeneration||cloudUser?.id!==user.id)return;ownSubmissions={state:'error',contributions:[],reviews:[]};}
    renderOwnSubmissions();renderDrafts();renderExistingReviewStatus();
  }
  function renderCommunity(){contributionGeneration++;pendingUploads.delete('contribution');const values={kind:$('#contributionKind')?.value||'place',district:$('#contributionDistrict')?.value||'',title:$('#contributionTitle')?.value||'',area:$('#contributionArea')?.value||'',description:$('#contributionDescription')?.value||'',directions:$('#contributionDirections')?.value||'',notes:$('#contributionNotes')?.value||''};
    root.innerHTML=`<div class="section-heading"><div><div class="eyebrow">${tr('আপনার চোখে দেখা দেশ','The country through your eyes')}</div><h2>${tr('আপনার পথের অজানা গল্প','Your little discoveries')}</h2><p>${tr('কম পরিচিত জায়গা বা জেলার বিশেষ খাবারের তথ্য গুছিয়ে রাখুন।','Keep a thoughtful note of a hidden place or a local speciality.')}</p></div><span class="section-number">06 / FIELD NOTES</span></div><div class="journal-columns"><div class="journal-panel"><h3>${tr('একটি নতুন খোঁজ যোগ করুন','Add a discovery')}</h3><p class="journal-small">${tr('এটি শুধু এই ব্রাউজারে থাকা ব্যক্তিগত খসড়া। ছবিসহ নতুন জায়গা প্রকাশের জন্য ওপরের আলাদা অনলাইন ফর্ম ব্যবহার করুন।','This is a private local draft. To share a new place with photos, use the separate online publication form above.')}</p><form id="contributionForm"><div class="journal-field"><label for="contributionKind">${tr('কী যোগ করবেন?','What did you discover?')}</label><select id="contributionKind"><option value="place">${tr('লুকানো জায়গা','Hidden place')}</option><option value="food">${tr('খাবার বা স্থানীয় পণ্য','Food or local product')}</option></select></div><div class="journal-field"><label for="contributionTitle">${tr('নাম','Name')}</label><input id="contributionTitle" required minlength="3" maxlength="100" placeholder="${tr('যেমন: গ্রামের পুরোনো ঘাট','e.g. The old village riverside')}" data-no-translate></div><div class="journal-field"><label for="contributionDistrict">${tr('জেলা','District')}</label><select id="contributionDistrict" required><option value="">${tr('জেলা বেছে নিন','Choose a district')}</option>${options()}</select></div><div class="journal-field"><label for="contributionArea">${tr('উপজেলা বা এলাকা','Upazila or area')}</label><input id="contributionArea" required maxlength="100" data-no-translate></div><div class="journal-field"><label for="contributionDescription">${tr('গল্প ও বর্ণনা (অন্তত ৫০ অক্ষর)','Story and description (at least 50 characters)')}</label><textarea id="contributionDescription" required minlength="50" maxlength="2000" data-no-translate></textarea></div><div class="journal-field"><label for="contributionDirections">${tr('কীভাবে যাবেন / কোথায় পাবেন','How to get there / where to find it')}</label><textarea id="contributionDirections" required minlength="20" maxlength="1000" data-no-translate></textarea></div><div class="journal-field"><label for="contributionNotes">${tr('সময়, খরচ, থাকা ও নিরাপত্তার নোট (ঐচ্ছিক)','Season, cost, stay and safety notes (optional)')}</label><textarea id="contributionNotes" maxlength="1000" data-no-translate></textarea></div><label class="photo-upload">${tr('নিজের তোলা ছবি (ঐচ্ছিক)','Your own photo (optional)')}<input type="file" id="contributionPhoto" accept="image/jpeg,image/png,image/webp"></label><p id="contributionPhotoStatus" class="journal-small" role="status"></p><button class="button primary" type="submit">${tr('ব্যক্তিগত খসড়া রাখুন','Save private draft')}</button></form><p class="journal-small">${tr('শুধু নিজের তোলা ছবি ও নিজস্ব বর্ণনা দিন। ছবি ছোট করে লোকেশন মেটাডেটা বাদ দেওয়া হয়।','Use your own photo and description. Photos are compressed and location metadata is removed.')}</p></div><div class="journal-panel"><h3>${tr('আপনার জমিয়ে রাখা খোঁজ','Your discovery notebook')}</h3><div class="journal-status">${tr('এখানকার খসড়�  let activeProfileTab = 'diary', editProfileOpen = false, modalContribPhotoData = null;
  const getHomeDistrict = () => { try { return storage.get('homeDistrict', '') || localStorage.getItem('deshpath.homeDistrict') || ''; } catch { return ''; } };
  const getVisitedList = () => asArray(storage.get('visited', [])).filter(id => districtById.has(id));
  const getStampedList = () => asArray(storage.get('passportPlaces', [])).map(id => places.find(p => p.id === id)).filter(Boolean);
  const getDistrictNotes = () => { try { const r = storage.get('districtNotes', null) || (localStorage.getItem('deshpath.districtNotes') ? JSON.parse(localStorage.getItem('deshpath.districtNotes')) : {}); return r && typeof r === 'object' && !Array.isArray(r) ? r : {}; } catch { return {}; } };
  const saveDistrictNote = (districtId, note, date) => {
    const notes = getDistrictNotes();
    notes[districtId] = { note: String(note || '').slice(0, 2000), date: String(date || '').slice(0, 40), updatedAt: new Date().toISOString() };
    storage.set('districtNotes', notes);
    try { localStorage.setItem('deshpath.districtNotes', JSON.stringify(notes)); } catch {}
  };
  const getCommunityContributions = () => { try { const r = storage.get('community_contributions', null) || (localStorage.getItem('deshpath.community_contributions') ? JSON.parse(localStorage.getItem('deshpath.community_contributions')) : []); return Array.isArray(r) ? r : []; } catch { return []; } };
  const saveCommunityContribution = item => {
    const list = getCommunityContributions();
    const next = [item, ...list].slice(0, 100);
    storage.set('community_contributions', next);
    try { localStorage.setItem('deshpath.community_contributions', JSON.stringify(next)); } catch {}
  };
  const deleteCommunityContribution = id => {
    const list = getCommunityContributions().filter(c => c.id !== id);
    storage.set('community_contributions', list);
    try { localStorage.setItem('deshpath.community_contributions', JSON.stringify(list)); } catch {}
  };
  const getContributorPoints = () => {
    const v = getVisitedList().length, s = getStampedList().length, n = Object.keys(getDistrictNotes()).length, c = getCommunityContributions().length + drafts.length, q = Number(storage.get('quizBest', 0)) || 0;
    return (v * 5) + (s * 15) + (n * 10) + (c * 50) + (q * 10);
  };
  const getPersonality = count => {
    if (count >= 64) return { title: tr('বাংলাদেশজয়ী কিংবদন্তি', 'Legend of Bengal'), level: tr('লেভেল ৭ · সর্বজয়ী পদচিহ্ন', 'Level 7 · Master Sovereign'), icon: '👑', css: 'badge-legend' };
    if (count >= 48) return { title: tr('দেশপথ চ্যাম্পিয়ন', 'DeshPath Champion'), level: tr('লেভেল ৬ · গ্র্যান্ড পরিব্রাজক', 'Level 6 · Grand Navigator'), icon: '🏆', css: 'badge-champion' };
    if (count >= 32) return { title: tr('অভিজ্ঞ দেশপথিক', 'Seasoned Pathfinder'), level: tr('লেভেল ৫ · অর্ধশতক পদচিহ্ন', 'Level 5 · Seasoned Voyager'), icon: '🗺️', css: 'badge-veteran' };
    if (count >= 18) return { title: tr('প্রকৃতিপ্রেমী পথচারী', 'Nature & Heritage Rover'), level: tr('লেভেল ৪ · গভীর সন্ধানী', 'Level 4 · Deep Explorer'), icon: '🌿', css: 'badge-nature' };
    if (count >= 8)  return { title: tr('রোমাঞ্চসন্ধানী ট্রাভেলার', 'Adventure Seeker'), level: tr('লেভেল ৩ · দূরযাত্রী', 'Level 3 · Trailblazer'), icon: '🏕️', css: 'badge-adventurer' };
    if (count >= 3)  return { title: tr('ছুটির পরিব্রাজক', 'Weekend Explorer'), level: tr('লেভেল ২ · পথের খোঁজে', 'Level 2 · Pathfinder'), icon: '🧭', css: 'badge-explorer' };
    return { title: tr('নবীন অভিযাত্রী', 'Aspiring Wanderer'), level: tr('লেভেল ১ · নতুন শুরু', 'Level 1 · Greenhorn'), icon: '🌱', css: 'badge-novice' };
  };
  const getPercentile = count => {
    const pct = Math.round((count / 64) * 100);
    if (pct >= 80) return tr('শীর্ষ ৫%', 'Top 5%');
    if (pct >= 60) return tr('শীর্ষ ১৫%', 'Top 15%');
    if (pct >= 40) return tr('শীর্ষ ৩৫%', 'Top 35%');
    if (pct >= 20) return tr('শীর্ষ ৫৫%', 'Top 55%');
    if (pct >= 5)  return tr('শীর্ষ ৭৫%', 'Top 75%');
    return tr('নতুন যাত্রী', 'New Explorer');
  };
  function switchProfileTab(targetTab) {
    activeProfileTab = targetTab;
    const tabs = profileRoot.querySelectorAll ? profileRoot.querySelectorAll('[data-profile-tab]') : [];
    for (const b of tabs) {
      if (b.classList?.toggle) b.classList.toggle('active', b.dataset?.profileTab === targetTab);
      b.setAttribute?.('aria-selected', String(b.dataset?.profileTab === targetTab));
    }
    const diary = $('#profileTabDiary'), contrib = $('#profileTabContrib'), saved = $('#profileTabSaved');
    if (diary) diary.hidden = targetTab !== 'diary';
    if (contrib) contrib.hidden = targetTab !== 'contrib';
    if (saved) saved.hidden = targetTab !== 'saved';
  }

  function renderProfile(){
    profileGeneration++;backupGeneration++;pendingUploads.delete('profile');
    const c=counts(),name=$('#profileName')?.value??String(profile.name||''),bio=$('#profileBio')?.value??String(profile.bio||'');
    const avatar=media.get('profile-avatar') || (function(){ try { const d = localStorage.getItem('deshpath.avatar_dataurl'); return d ? { src: d } : null; } catch { return null; } })();
    const avatarSrc=photoSrc(avatar);
    const homeDist=getHomeDistrict();
    const homeDistObj=districtById.get(homeDist);
    const visitedList=getVisitedList(), visitedCount=visitedList.length;
    const stampedList=getStampedList(), stampedCount=stampedList.length;
    const contribList=getCommunityContributions(), contribCount=contribList.length + drafts.length;
    const favIds=asArray(storage.get('favorites', [])).filter(id => places.some(p => p.id === id));
    const savedPlacesCount=favIds.length;
    const contributorPoints=getContributorPoints();
    const personality=getPersonality(visitedCount);
    const percentileRank=getPercentile(visitedCount);
    const notes=getDistrictNotes();
    const trip=storage.get('trip', null);
    const quizBest=Number(storage.get('quizBest', 0)) || 0;

    // Build Tab 1: Travel Diary & Passport
    let diaryListHtml = '';
    if (visitedCount === 0) {
      diaryListHtml = `<div class="profile-empty-box"><span class="profile-empty-icon">🧭</span><h4>${tr('মানচিত্রে এখনো কোনো জেলা চিহ্নিত করেননি','No visited districts marked on My Map yet')}</h4><p>${tr('আপনার ঘুরে আসা জেলাগুলো "আমার মানচিত্র" পাতায় গিয়ে চিহ্নিত করুন। সাথে সাথে সেগুলো আপনার ডায়েরিতে যুক্ত হবে।','Mark the districts you have explored on "My Map". They will automatically appear in your diary.')}</p><a href="#my-map" class="button primary small-button">${tr('আমার মানচিত্রে জেলা বাছুন','Go to My Map')}</a></div>`;
    } else {
      diaryListHtml = `<div class="diary-district-grid">${visitedList.map(id => {
        const d = districtById.get(id), item = notes[id] || {};
        return `<article class="diary-district-card" id="diaryCard_${esc(id)}"><div class="diary-card-top"><div><h4>${esc(districtName(d))}</h4><span class="diary-division-chip">${esc(d.division || '')}</span></div><span class="diary-badge-visited">✓ ${tr('ঘুরেছি','Visited')}</span></div><div class="journal-field" style="margin-bottom:8px"><label for="diaryDate_${esc(id)}">${tr('ভ্রমণের তারিখ:','Visit date:')}</label><input type="date" id="diaryDate_${esc(id)}" class="diary-date-input" value="${esc(item.date || '')}"></div><div class="journal-field" style="margin-bottom:10px"><label for="diaryNote_${esc(id)}">${tr('ব্যক্তিগত স্মৃতিকথা:','Personal memories:')}</label><textarea id="diaryNote_${esc(id)}" class="diary-note-input" maxlength="2000" placeholder="${tr('এই জেলা ভ্রমণের বিশেষ স্মৃতি, প্রিয় জায়গা বা ভালো লাগার অভিজ্ঞতা লিখুন…','Memories, favorite places, or stories from this district…')}">${esc(item.note || '')}</textarea></div><div class="diary-card-actions"><button type="button" class="button secondary small-button diary-save-btn" data-save-diary="${esc(id)}">${tr('স্মৃতি সেভ করুন','Save Memory')}</button><span class="diary-feedback" id="diaryFeedback_${esc(id)}"></span></div></article>`;
      }).join('')}</div>`;
    }

    let stampsListHtml = '';
    if (stampedCount === 0) {
      stampsListHtml = `<div class="profile-empty-box"><span class="profile-empty-icon">🛂</span><h4>${tr('এখনো কোনো পাসপোর্ট সিল সংগ্রহ করেননি','No passport stamps collected yet')}</h4><p>${tr('বিভিন্ন দর্শনীয় স্থান ঘুরে দেখে "ভ্রমণ পাসপোর্ট" বা "ঘুরে দেখুন" পাতা থেকে সিল সংগ্রহ করুন।','Unlock commemorative digital stamps from Travel Passport or Explore.')}</p><a href="#travelPassport" class="button secondary small-button">${tr('ভ্রমণ পাসপোর্ট দেখুন','View Travel Passport')}</a></div>`;
    } else {
      stampsListHtml = `<div class="passport-stamps-grid">${stampedList.map(p => {
        const dist = districtById.get(p.district);
        return `<div class="passport-stamp-seal" id="stamp_${esc(p.id)}"><div class="stamp-seal-inner"><div class="stamp-arc-top">★ DESHPATH PASSPORT ★</div><div class="stamp-center-title">${esc(placeText(p, 'name'))}</div><div class="stamp-center-district">${esc(districtName(dist))}</div><div class="stamp-verified-mark">VERIFIED VISIT</div></div></div>`;
      }).join('')}</div>`;
    }

    const diaryTabHtml = `<div class="profile-section-block"><div class="block-header"><div><h3>📖 ${tr('ঘুরে আসা জেলার ব্যক্তিগত ডায়েরি','Visited Districts Diary')} <small>(${bn(visitedCount)}/${bn(64)})</small></h3><p class="journal-small">${tr('যে জেলাগুলোতে আপনার পদচিহ্ন পড়েছে, তার বিশেষ স্মৃতি ও ভ্রমণ তারিখ লিখে রাখুন।','Record your travel memories and dates for each district you have visited.')}</p></div></div>${diaryListHtml}</div><div class="profile-section-block" style="margin-top:34px"><div class="block-header"><div><h3>🛂 ${tr('আনলক হওয়া ভ্রমণ পাসপোর্ট সিল','Unlocked Travel Passport Stamps')} <small>(${bn(stampedCount)})</small></h3><p class="journal-small">${tr('দর্শনীয় স্থান পরিদর্শনের স্মারক হিসেবে পাওয়া ডিজিটাল সিলমোহর।','Official commemorative digital seals for your verified visits.')}</p></div><a href="#travelPassport" class="text-button">${tr('পাসপোর্ট পাতা খুলুন →','Open Passport →')}</a></div>${stampsListHtml}</div>`;

    // Build Tab 2: Community Contributions
    const allContribs = [...contribList, ...drafts.map(d => ({
      id: d.id, district: d.district, spotName: d.title, category: d.kind === 'food' ? tr('খাবার ও পণ্য','Food & Product') : tr('লুকানো জায়গা','Hidden place'),
      story: d.description, author: d.author || profile.name || tr('দেশপথিক','Traveler'), createdAt: d.createdAt,
      photo: media.get(d.photoId) ? { src: photoSrc(media.get(d.photoId)) } : null, status: 'approved'
    }))];

    let contribListHtml = '';
    if (allContribs.length === 0) {
      contribListHtml = `<div class="profile-empty-box"><span class="profile-empty-icon">📸</span><h4>${tr('এখনো কোনো পর্যটন স্পট বা গল্প জমা দেননি','No tourist spots or stories submitted yet')}</h4><p>${tr('আপনার দেখা কোনো কম পরিচিত আকর্ষণীয় স্থান বা গল্প শেয়ার করুন। প্রতিটি অবদানে পাবেন +৫০ পয়েন্ট!','Share a hidden gem, unexplored viewpoint, or travel story with the community. Earn +50 points per submission!')}</p><button type="button" class="button primary small-button" id="openContribModalBtn">+ ${tr('নতুন স্পট বা গল্প যোগ করুন','Add New Spot or Story')}</button></div>`;
    } else {
      contribListHtml = `<div class="contrib-card-grid">${allContribs.map(c => {
        const dist = districtById.get(c.district);
        const photoUrl = c.photo?.src || (c.photoId && media.get(c.photoId) ? photoSrc(media.get(c.photoId)) : '');
        return `<article class="contrib-card" id="contribCard_${esc(c.id)}">${photoUrl ? `<div class="contrib-card-photo"><img src="${esc(photoUrl)}" alt="${esc(c.spotName)}" loading="lazy"></div>` : `<div class="contrib-photo-placeholder">📷</div>`}<div class="contrib-card-body"><div class="contrib-meta-top"><span class="contrib-cat-chip">${esc(c.category || tr('দর্শনীয় স্থান','Spot'))}</span><span class="journal-cloud-state approved">${tr('যাচাইকৃত অবদান','Verified')}</span></div><h4>${esc(c.spotName)}</h4><p class="contrib-district-name">📍 ${esc(districtName(dist))}</p><p class="contrib-story-text">${esc(c.story)}</p><div class="contrib-card-footer"><span class="contrib-author-tag">📸 ${tr('অবদানকারী:','By:')} <b>${esc(c.author || profile.name || tr('দেশপথিক','Traveler'))}</b></span><button type="button" class="text-button delete-contrib-btn" data-delete-contrib="${esc(c.id)}">${tr('মুছুন','Delete')}</button></div></div></article>`;
      }).join('')}</div>`;
    }

    const contribTabHtml = `<div class="profile-section-block"><div class="contrib-tab-header"><div><h3>👥 ${tr('কমিউনিটি অবদান ও পর্যটন স্পট','Community Discoveries & Contributions')} <small>(${bn(allContribs.length)})</small></h3><p class="journal-small">${tr('আপনার এলাকার বা ভ্রমণের কম পরিচিত স্থানগুলো শেয়ার করুন। প্রতিটি অবদানে পাবেন +৫০ পয়েন্ট।','Share hidden gems and travel notes with fellow travelers. Earn +50 points per spot.')}</p></div><button type="button" class="button primary small-button" id="openContribModalBtn">+ ${tr('নতুন স্পট বা গল্প যোগ করুন','Add New Spot or Story')}</button></div>${contribListHtml}</div><div class="journal-own-heading" style="margin-top:34px"><h4>${tr('আমার অনলাইন জমার অবস্থা','My online submissions')}</h4><button class="text-button" type="button" id="refreshMySubmissions">${tr('অবস্থা হালনাগাদ','Refresh status')}</button></div><div id="myOnlineSubmissions" aria-live="polite"></div>`;

    // Build Tab 3: Saved Places & Backup
    const savedPlaces = favIds.map(id => places.find(p => p.id === id)).filter(Boolean);
    let favsListHtml = '';
    if (savedPlaces.length === 0) {
      favsListHtml = `<div class="profile-empty-box"><span class="profile-empty-icon">❤️</span><h4>${tr('এখনো কোনো স্থান বুকমার্ক করেননি','No saved places yet')}</h4><p>${tr('গন্তব্যগুলোর ছবির পাশে হার্ট চিহ্নে চাপ দিয়ে আপনার পছন্দের তালিকা তৈরি করুন।','Browse destinations in Explore and tap the heart to save them here.')}</p><a href="#explore" class="button secondary small-button">${tr('গন্তব্য খুঁজুন','Explore Places')}</a></div>`;
    } else {
      favsListHtml = `<div class="profile-saved-places-grid">${savedPlaces.map(p => {
        const dist = districtById.get(p.district);
        return `<div class="profile-saved-card" id="savedFav_${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"><div class="profile-saved-card-body"><h4><a href="#explore" data-place="${esc(p.id)}">${esc(placeText(p, 'name'))}</a></h4><p>${esc(districtName(dist))} · ${esc(placeText(p, 'duration'))}</p><div class="profile-saved-actions"><a href="#explore" data-place="${esc(p.id)}" class="text-button">${tr('বিস্তারিত দেখুন','View Details')}</a><button type="button" class="text-button remove-saved-btn" data-remove-profile-fav="${esc(p.id)}">${tr('সরান','Remove')}</button></div></div></div>`;
      }).join('')}</div>`;
    }

    let tripSummaryHtml = '';
    if (trip && (trip.origin || (trip.destinations && trip.destinations.length))) {
      const originDist = districtById.get(trip.origin);
      const destNames = (trip.destinations || (trip.destination ? [trip.destination] : []))
        .map(id => districtById.get(id)).filter(Boolean).map(d => districtName(d)).join(', ');
      tripSummaryHtml = `<div class="profile-trip-summary-card"><div class="trip-summary-row"><div><span class="trip-label">${tr('যাত্রা শুরু:','Starting from:')}</span><strong>${originDist ? esc(districtName(originDist)) : tr('অনির্দিষ্ট','Unspecified')}</strong></div><div><span class="trip-label">${tr('গন্তব্য:','Destinations:')}</span><strong>${esc(destNames || tr('অনির্দিষ্ট','Unspecified'))}</strong></div><div><span class="trip-label">${tr('ছুটি ও বাজেট:','Duration & Budget:')}</span><strong>${trip.days ? bn(trip.days) + ' ' + tr('দিন','days') : ''} · ${trip.budget ? '৳' + bn(trip.budget) : ''}</strong></div></div><div class="trip-summary-actions"><a href="#planner" class="button secondary small-button">${tr('ট্রিপ প্ল্যানারে দেখুন','Open in Planner')} →</a></div></div>`;
    } else {
      tripSummaryHtml = `<div class="profile-empty-box"><span class="profile-empty-icon">🗓️</span><h4>${tr('কোনো ট্রিপ প্ল্যান সেভ করা নেই','No saved trip plan yet')}</h4><p>${tr('আপনার পরবর্তী ভ্রমণের ছুটি, সঙ্গী ও বাজেট দিয়ে প্ল্যান তৈরি করে সেভ করে রাখুন।','Plan your next journey with custom duration, companions and budget.')}</p><a href="#planner" class="button secondary small-button">${tr('ট্রিপ প্ল্যানারে যান','Go to Planner')}</a></div>`;
    }

    const savedTabHtml = `<div class="profile-section-block"><div class="block-header"><div><h3>❤️ ${tr('পছন্দের বুকমার্ক করা স্থান','Bookmarked Places')} <small>(${bn(savedPlaces.length)})</small></h3><p class="journal-small">${tr('ভবিষ্যতে ঘুরে দেখার জন্য আপনার পছন্দের গন্তব্যগুলো এখানে সংরক্ষিত থাকে।','Your curated list of destinations to visit in future travels.')}</p></div></div>${favsListHtml}</div><div class="profile-section-block" style="margin-top:34px"><div class="block-header"><div><h3>🗺️ ${tr('সংরক্ষিত ট্রিপ পরিকল্পনা','Saved Trip Plan')}</h3><p class="journal-small">${tr('ট্রিপ প্ল্যানার থেকে সাজিয়ে রাখা আপনার সাম্প্রতিক সফরের খসড়া।','Your recent itinerary draft prepared in Trip Planner.')}</p></div></div>${tripSummaryHtml}</div><div class="profile-section-block" style="margin-top:34px"><div class="block-header"><div><h3>🏆 ${tr('এই ব্রাউজারে কুইজ ও গেমসের রেকর্ড','Your Quiz & Game Records')}</h3><p class="journal-small">${tr('দেশ চেনার কুইজ ও খেলায় আপনার ব্যক্তিগত সেরা স্কোর।','Your personal high scores in Bangladesh quizzes and games.')}</p></div><a href="#games" class="text-button">${tr('খেলার ঘরে যান →','Play Games →')}</a></div><div class="profile-scores-summary"><div class="profile-score-pill"><span>${tr('দেশ চেনার কুইজ','Quiz Best')}</span><strong>${bn(quizBest)} / ${bn(5)} ${tr('পয়েন্ট','pts')}</strong></div>${recordsMarkup()}</div></div><div class="profile-section-block" style="margin-top:34px"><div class="block-header"><div><h3>💾 ${tr('প্রোফাইল ও খাতার ব্যাকআপ','Profile & Journal Backup')}</h3><p class="journal-small">${tr('নাম, মানচিত্র, ছবি, সিল, ডায়েরি ও খসড়া একটি JSON ব্যাকআপ ফাইলে নামিয়ে নিন। অন্য ডিভাইসে তা ফিরিয়ে আনতে পারবেন।','Download a portable JSON backup of your profile, diary, maps, stamps and notes. Restore on any device.')}</p></div></div><div class="journal-actions"><button class="button primary" id="exportJournal">${tr('ব্যাকআপ ডাউনলোড (JSON)','Download Backup (JSON)')}</button></div><label class="photo-upload" style="margin-top:18px">${tr('আগের ব্যাকআপ বেছে নিন','Choose previous backup')}<input id="importJournal" type="file" accept="application/json,.json"></label><div id="backupPreview" class="journal-backup-preview" hidden></div><button id="confirmRestore" class="button secondary" hidden>${tr('এই ব্যাকআপ ফিরিয়ে আনুন','Restore this backup')}</button><p id="backupStatus" role="status" class="journal-small"></p><h3 style="margin-top:28px">${tr('অনলাইন ক্লাউড সেভ','Cloud save')}</h3><div id="cloudProfile"></div><button id="prepareOffline" class="button secondary" style="margin-top:22px">${tr('অফলাইনে ব্যবহারের প্রস্তুতি','Prepare for offline use')}</button><p id="offlineStatus" role="status" class="journal-small"></p><button id="installDeshpath" class="text-button">${tr('ফোনে অ্যাপের মতো রাখুন','Add to your home screen')}</button></div>`;

    // Full Profile Root Markup
    profileRoot.innerHTML = `
      <div class="section-heading">
        <div>
          <div class="eyebrow">${tr('দেশপথ পরিব্রাজক পরিচয়পত্র · আপনার ভ্রমণের খাতা','Deshpath Identity · Your Travel Journal')}</div>
          <h2>${tr('আমার ভ্রমণ প্রোফাইল','My Travel Profile')}</h2>
          <p>${tr('আপনার দেখা পথ, ভ্রমণের স্মৃতি, কমিউনিটি আবিষ্কার ও পাসপোর্ট সিল এক ঠিকানায়।','Your visited trails, memories, discoveries, and passport stamps in one place.')}</p>
        </div>
        <span class="section-number">07 / YOUR JOURNAL</span>
      </div>

      <!-- Feature 1: Traveler Identity Card Header -->
      <div class="traveler-id-card" id="travelerIdCard">
        <div class="id-card-header">
          <div class="id-header-emblem">
            <span class="id-seal-star">★</span>
            <span class="id-header-title">${tr('দেশপথ পরিব্রাজক পরিচয়পত্র · গণপ্রজাতন্ত্রী বাংলাদেশ','Deshpath Traveler Identity · Bangladesh')}</span>
          </div>
          <button type="button" class="button secondary small-button id-edit-toggle-btn" id="toggleProfileEdit">
            <span data-icon="edit">✏️</span> ${tr('তথ্য পরিবর্তন','Edit Profile')}
          </button>
        </div>

        <div class="id-card-body">
          <div class="id-avatar-column">
            <div class="id-avatar-frame" id="avatarPreviewFrame" tabindex="0" role="button" aria-label="${tr('ছবি পরিবর্তন করুন','Change photo')}" title="${tr('ছবি পরিবর্তন করতে চাপুন','Click to change photo')}">
              ${avatarSrc ? `<img class="id-avatar-img" src="${esc(avatarSrc)}" alt="${tr('আপনার প্রোফাইল ছবি','Your profile photo')}">` : `<div class="id-avatar-placeholder">👤</div>`}
              <span class="id-avatar-camera-badge" aria-hidden="true">📷</span>
            </div>
            ${avatarSrc ? `<button type="button" class="text-button id-remove-photo-btn" id="removeProfilePhoto">${tr('ছবি সরান','Remove photo')}</button>` : ''}
          </div>

          <div class="id-info-column">
            <div class="id-name-row">
              <h3 class="id-visitor-name" id="displayProfileName">${esc(profile.name || tr('দেশপথিক পরিব্রাজক','Deshpath Explorer'))}</h3>
              <span class="personality-badge ${personality.css}" title="${esc(personality.level)}">
                <i>${personality.icon}</i> <b>${esc(personality.title)}</b>
              </span>
            </div>
            <div class="id-meta-row">
              <span class="id-home-badge" id="displayHomeDistrict">
                📍 ${homeDistObj ? `${tr('নিজ জেলা:','Home:')} ${esc(districtName(homeDistObj))}` : tr('নিজ জেলা নির্বাচন করুন','Choose Home District')}
              </span>
              <span class="id-level-tag">${esc(personality.level)}</span>
            </div>
            <p class="id-bio-text">${esc(profile.bio || tr('“পথই যেখানে গন্তব্য, সেখানে প্রতিটি পদক্ষেপেই নতুন গল্প।”','“Not all who wander are lost.”'))}</p>
          </div>

          <div class="id-stats-column">
            <div class="id-stat-tile">
              <div class="id-stat-val"><strong>${bn(visitedCount)}</strong><small>/${bn(64)}</small></div>
              <span class="id-stat-lbl">${tr('ঘোরা জেলা','Visited')}</span>
              <div class="id-progress-mini"><span style="width:${Math.min(100, Math.round((visitedCount/64)*100))}%"></span></div>
            </div>
            <div class="id-stat-tile">
              <div class="id-stat-val"><strong>${esc(percentileRank)}</strong></div>
              <span class="id-stat-lbl">${tr('ভ্রমণকারী র‍্যাঙ্ক','Traveler Rank')}</span>
            </div>
            <div class="id-stat-tile">
              <div class="id-stat-val"><strong id="displayContribPoints">${bn(contributorPoints)}</strong></div>
              <span class="id-stat-lbl">${tr('অবদান পয়েন্ট','Contributor Pts')}</span>
            </div>
          </div>
        </div>

        <!-- Profile Edit Form Drawer (Always in DOM for tests) -->
        <div class="profile-edit-drawer" id="profileEditDrawer" ${editProfileOpen ? '' : 'style="display:none"'}>
          <form id="profileForm" class="profile-edit-form">
            <div class="edit-form-grid">
              <div class="journal-field">
                <label for="profileName">${tr('আপনার নাম','Your name')}</label>
                <input id="profileName" maxlength="60" autocomplete="name" data-no-translate value="${esc(name)}">
              </div>
              <div class="journal-field">
                <label for="profileHomeDistrict">${tr('নিজ জেলা (৬৪ জেলা)','Home District (64 Districts)')}</label>
                <select id="profileHomeDistrict">
                  <option value="">${tr('নিজ জেলা বেছে নিন','Choose your home district')}</option>
                  ${districts.map(d => `<option value="${esc(d.id)}"${d.id === homeDist ? ' selected' : ''}>${esc(districtName(d))}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="journal-field">
              <label for="profileBio">${tr('ছোট্ট ভ্রমণ পরিচয় বা বায়ো (সর্বোচ্চ ২৫০ অক্ষর)','Travel Bio (max 250 characters)')}</label>
              <textarea id="profileBio" maxlength="250" data-no-translate placeholder="${tr('নিজের ভ্রমণ দর্শন বা সংক্ষিপ্ত পরিচয়…','Your travel bio…')}">${esc(bio)}</textarea>
            </div>
            <label class="photo-upload">
              ${tr('প্রোফাইল ছবি পরিবর্তন','Change profile photo')}
              <input type="file" id="profilePhoto" accept="image/jpeg,image/png,image/webp">
            </label>
            <div class="journal-actions" style="margin-top:14px">
              <button class="button primary" type="submit">${tr('প্রোফাইল সংরক্ষণ করুন','Save profile')}</button>
              <button class="button secondary" type="button" id="cancelProfileEditBtn">${tr('বাতিল','Cancel')}</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Tab Navigation Bar -->
      <div class="profile-tabs-nav" role="tablist" aria-label="${tr('প্রোফাইল নেভিগেশন','Profile Navigation')}">
        <button type="button" class="profile-tab-btn${activeProfileTab === 'diary' ? ' active' : ''}" id="tabDiaryBtn" data-profile-tab="diary" role="tab" aria-selected="${activeProfileTab === 'diary'}" aria-controls="profileTabDiary">
          <span>📖 ${tr('ভ্রমণ ডায়েরি ও পাসপোর্ট','Travel Diary & Passport')}</span>
          <span class="tab-badge" id="diaryTabBadge">${bn(visitedCount + stampedCount)}</span>
        </button>
        <button type="button" class="profile-tab-btn${activeProfileTab === 'contrib' ? ' active' : ''}" id="tabContribBtn" data-profile-tab="contrib" role="tab" aria-selected="${activeProfileTab === 'contrib'}" aria-controls="profileTabContrib">
          <span>👥 ${tr('কমিউনিটি অবদান','Community Contributions')}</span>
          <span class="tab-badge" id="contribTabBadge">${bn(allContribs.length)}</span>
        </button>
        <button type="button" class="profile-tab-btn${activeProfileTab === 'saved' ? ' active' : ''}" id="tabSavedBtn" data-profile-tab="saved" role="tab" aria-selected="${activeProfileTab === 'saved'}" aria-controls="profileTabSaved">
          <span>❤️ ${tr('সংরক্ষিত স্থান ও ব্যাকআপ','Saved Places & Backup')}</span>
          <span class="tab-badge" id="savedTabBadge">${bn(savedPlacesCount)}</span>
        </button>
      </div>

      <!-- Tab 1: Travel Diary & Passport -->
      <div id="profileTabDiary" class="profile-tab-panel" role="tabpanel" aria-labelledby="tabDiaryBtn"${activeProfileTab === 'diary' ? '' : ' hidden'}>
        ${diaryTabHtml}
      </div>

      <!-- Tab 2: Community Contributions -->
      <div id="profileTabContrib" class="profile-tab-panel" role="tabpanel" aria-labelledby="tabContribBtn"${activeProfileTab === 'contrib' ? '' : ' hidden'}>
        ${contribTabHtml}
      </div>

      <!-- Tab 3: Saved Places & Backup -->
      <div id="profileTabSaved" class="profile-tab-panel" role="tabpanel" aria-labelledby="tabSavedBtn"${activeProfileTab === 'saved' ? '' : ' hidden'}>
        ${savedTabHtml}
      </div>

      <!-- Feature 3 Modal: Add New Tourist Spot or Story -->
      <dialog id="contribModal" class="content-dialog contrib-dialog">
        <div class="dialog-copy" style="padding:26px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
            <h3 style="margin:0">${tr('নতুন পর্যটন স্পট বা গল্প যোগ করুন','Add New Tourist Spot or Story')}</h3>
            <button type="button" class="dialog-close icon-button" id="closeContribModalBtn" aria-label="${tr('বন্ধ করুন','Close')}"><span data-icon="x">✕</span></button>
          </div>
          <p class="journal-small" style="margin-bottom:16px">${tr('কম পরিচিত দর্শনীয় স্থান বা ভ্রমণের গল্প যোগ করুন। যাচাইয়ের পর আপনার নামে প্রকাশিত হবে এবং পাবেন +৫০ পয়েন্ট।','Share hidden gems and discoveries. Automatically attributed with your profile name.')}</p>
          <form id="newCommunityContribForm">
            <div class="journal-field">
              <label for="modalContribDistrict">${tr('জেলা নির্বাচন করুন (৬৪ জেলা)*','Choose District (64 districts)*')}</label>
              <select id="modalContribDistrict" required>
                <option value="">${tr('জেলা বেছে নিন','Select District')}</option>
                ${districts.map(d => `<option value="${esc(d.id)}">${esc(districtName(d))}</option>`).join('')}
              </select>
            </div>
            <div class="journal-field">
              <label for="modalContribSpotName">${tr('স্পট বা দর্শনীয় স্থানের নাম*','Spot Name*')}</label>
              <input id="modalContribSpotName" required minlength="3" maxlength="100" placeholder="${tr('যেমন: কদম মোবারক শাহী মসজিদ / নাফাখুম জলপ্রপাত','e.g. Nafakhum Waterfall')}" data-no-translate>
            </div>
            <div class="journal-field">
              <label for="modalContribCategory">${tr('ক্যাটাগরি বা ধরন','Category')}</label>
              <select id="modalContribCategory">
                <option value="${tr('প্রকৃতি ও উদ্যান','Nature & Parks')}">${tr('প্রকৃতি ও উদ্যান','Nature & Parks')}</option>
                <option value="${tr('পাহাড় ও ট্রেকিং','Hills & Trekking')}">${tr('পাহাড় ও ট্রেকিং','Hills & Trekking')}</option>
                <option value="${tr('সমুদ্র ও নদী','Beach & River')}">${tr('সমুদ্র ও নদী','Beach & River')}</option>
                <option value="${tr('ঐতিহাসিক ও প্রত্নতাত্ত্বিক','Heritage & History')}">${tr('ঐতিহাসিক ও প্রত্নতাত্ত্বিক','Heritage & History')}</option>
                <option value="${tr('স্থানীয় খাবার ও সংস্কৃতি','Local Culture & Food')}">${tr('স্থানীয় খাবার ও সংস্কৃতি','Local Culture & Food')}</option>
                <option value="${tr('গ্রামীণ পথ','Rural Discovery')}">${tr('গ্রামীণ পথ','Rural Discovery')}</option>
              </select>
            </div>
            <div class="journal-field">
              <label for="modalContribStory">${tr('ভ্রমণ অভিজ্ঞতা ও গল্প (কমপক্ষে ২০ অক্ষর)*','Story & Experience (at least 20 chars)*')}</label>
              <textarea id="modalContribStory" required minlength="20" maxlength="2000" placeholder="${tr('জায়গাটির বর্ণনা, কী কী দেখার আছে, ভ্রমণের অভিজ্ঞতা…','Describe what makes this place special…')}" data-no-translate></textarea>
            </div>
            <div class="journal-field">
              <label for="modalContribDirections">${tr('কীভাবে যাবেন / প্রয়োজনীয় টিপস (ঐচ্ছিক)','Directions & Tips (optional)')}</label>
              <textarea id="modalContribDirections" maxlength="1000" placeholder="${tr('যাতায়াত ব্যবস্থা, থাকার জায়গা বা সতর্কতা…','How to get there, stay, precautions…')}" data-no-translate></textarea>
            </div>
            <label class="photo-upload">
              ${tr('স্থানটির ছবি (HTML5 ক্যানভাস দিয়ে WebP ফরম্যাটে ছোট হবে)','Photo (compressed to WebP via canvas)')}
              <input type="file" id="modalContribPhoto" accept="image/jpeg,image/png,image/webp">
            </label>
            <p id="modalContribPhotoStatus" class="journal-small" style="margin-top:6px"></p>
            <div id="modalContribPhotoPreview"></div>
            <div class="journal-actions" style="margin-top:20px">
              <button type="submit" class="button primary" id="submitContribBtn">${tr('যোগ করুন (+৫০ পয়েন্ট)','Submit (+50 Pts)')}</button>
              <button type="button" class="button secondary" id="cancelContribBtn">${tr('বাতিল','Cancel')}</button>
            </div>
          </form>
        </div>
      </dialog>
    `;

    if ($('#profileName')) $('#profileName').value = name;
    if ($('#profileBio')) $('#profileBio').value = bio;
    if ($('#profileHomeDistrict')) $('#profileHomeDistrict').value = homeDist;
    backupCandidate = null;
    renderCloud();
    if(onlineCommunity){const mount=document.createElement('div');mount.id='onlineCommunityProfile';profileRoot.append(mount);onlineCommunity.mountProfile(mount);}
    if(window.DESH_RANKED?.renderProfile){const mount=document.createElement('div');mount.id='onlineRankedProfile';profileRoot.append(mount);window.DESH_RANKED.renderProfile(mount);}
  }
  async function renderCloud(){
    const mount=$('#cloudProfile'),generation=++cloudRenderGeneration;if(!mount)return;
    if(!enabled()){mount.innerHTML=`<p class="journal-status">${tr('অনলাইন লগইন ও সেভ এখনো চালু হয়নি। আপনার তথ্য এই ব্রাউজারে থাকে; ব্যাকআপ দিয়ে অন্য ডিভাইসে নিতে পারবেন।','Online sign-in and cloud save are not available yet. Your data stays in this browser; use a backup to move it to another device.')}</p>`;return;}
    if(!authReady()){cloudUser=null;ownGeneration++;ownSubmissions={state:'idle',contributions:[],reviews:[]};mount.innerHTML=`<p class="journal-status">${tr('ডাটাবেস সংযুক্ত। ইমেইল লগইন চালু করতে শেষ সেটিংস বাকি আছে। আপনার খাতা এই ডিভাইসে ব্যবহার করতে পারবেন।','The database is connected. Final settings are still needed to enable email sign-in. You can use your journal on this device.')}</p>`;return;}
    if(authInitialising){mount.innerHTML=`<p class="journal-small" role="status">${tr('সাইন ইন অবস্থা দেখা হচ্ছে…','Checking sign-in status…')}</p>`;return;}
    let user;
    try{user=await cloud().getUser();}
    catch(error){if(generation===cloudRenderGeneration&&mount.isConnected)mount.innerHTML=`<p class="journal-small journal-errors">${esc(cloudErrorMessage(error))}</p><button class="button secondary" type="button" id="retryCloudConnection">${tr('আবার চেষ্টা করুন','Try again')}</button>`;return;}
    if(generation!==cloudRenderGeneration||!mount.isConnected)return;
    if(cloudUser?.id!==user?.id){ownGeneration++;ownSubmissions={state:'idle',contributions:[],reviews:[]};}
    cloudUser=user;
    mount.innerHTML=user?`<p class="journal-small">${tr('সাইন ইন করা আছে:','Signed in as:')} ${esc(user.email||'')}</p><div class="journal-actions"><button id="cloudSave" class="button secondary">${tr('খাতা ব্যক্তিগতভাবে অনলাইনে রাখুন','Save private journal online')}</button><button id="cloudLoad" class="button secondary">${tr('ক্লাউডের কপি ফিরিয়ে আনুন','Restore cloud copy')}</button><button id="cloudSignOut" class="text-button">${tr('সাইন আউট','Sign out')}</button></div><p class="journal-small">${tr('সাইন ইন করলে কিছু আপলোড হয় না। সেভ বাটনে নিজের খাতার লেখা ও বাছাই ব্যক্তিগত অনলাইন কপিতে যায়। ছবি ব্যাকআপ ফাইলে রাখুন। এটি প্রকাশ্য কমিউনিটিতে প্রকাশ করে না।','Signing in does not upload anything. Save sends journal text and selections to your private cloud copy. Keep photos in your backup file. This does not publish them to the community.')}</p><div class="journal-own-heading"><h4>${tr('আমার অনলাইন জমার অবস্থা','My online submissions')}</h4><button class="text-button" type="button" id="refreshMySubmissions">${tr('অবস্থা হালনাগাদ','Refresh status')}</button></div><div id="myOnlineSubmissions" aria-live="polite"></div>`:`<form id="cloudLogin"><div class="journal-field"><label for="cloudEmail">${tr('ইমেইল','Email')}</label><input id="cloudEmail" type="email" autocomplete="email" required value="${esc(otpEmail)}"></div><button class="button secondary" type="submit">${tr('সাইন ইনের ইমেইল পাঠান','Send sign-in email')}</button></form><p class="journal-small">${tr('ইমেইলের লিংকটি এই একই ব্রাউজার ও ডিভাইসে খুলুন। ইমেইলে কোড থাকলে নিচের বিকল্পটি ব্যবহার করতে পারেন।','Open the email link in this same browser and device. If the email includes a code, use the option below.')}</p><details class="journal-otp-option"><summary>${tr('ইমেইলে কোড পেয়েছি','My email includes a code')}</summary><form id="cloudVerify"><div class="journal-field"><label for="cloudCode">${tr('ইমেইলের কোড','Code from your email')}</label><input id="cloudCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required minlength="6" maxlength="10"></div><button class="button primary" type="submit">${tr('কোড দিয়ে সাইন ইন','Sign in with code')}</button></form></details>`;
    mount.insertAdjacentHTML('beforeend',`<p id="cloudStatus" role="status" class="journal-small">${esc(authCallbackMessage.length?tr(...authCallbackMessage):'')}</p>`);
    renderDrafts();renderExistingReviewStatus();
    if(user)await loadOwnSubmissions(user);
  }
  async function submitContribution(event){event.preventDefault();if(busy||pendingUploads.has('contribution'))return;const form=event.target;if(!form.reportValidity())return;if(drafts.length>=100){toast(tr('১০০টি খসড়া হয়ে গেছে। আগে ব্যাকআপ নিন বা কিছু সরান।','You have 100 drafts. Back up or remove some first.'));return;}busy=true;const button=form.querySelector('button[type=submit]');button.disabled=true;
    try{const item={id:crypto.randomUUID(),kind:$('#contributionKind').value,district:$('#contributionDistrict').value,title:$('#contributionTitle').value.trim(),area:$('#contributionArea').value.trim(),description:$('#contributionDescription').value.trim(),directions:$('#contributionDirections').value.trim(),notes:$('#contributionNotes').value.trim(),author:String(profile.name||''),createdAt:new Date().toISOString(),photoId:null};if(!kit.validDraft(item))throw Error('INVALID');if(contributionPhoto){item.photoId='draft-'+item.id;await kit.media('put',{...contributionPhoto,id:item.photoId});media.set(item.photoId,{...contributionPhoto,id:item.photoId});}const next=[item,...drafts];localStorage.setItem('deshpath.contributions',JSON.stringify(next));drafts=next;contributionPhoto=null;form.reset();$('#contributionPhotoStatus').textContent='';renderDrafts();toast(tr('খসড়া এই ব্রাউজারে রাখা হয়েছে।','Draft saved in this browser.'));}
    catch{toast(tr('খসড়া সেভ হয়নি। ঘরগুলো ও ব্রাউজারের জায়গা পরীক্ষা করুন।','Draft could not be saved. Check the fields and browser storage.'));}finally{busy=false;button.disabled=false;}}
  root.addEventListener('submit',event=>{if(event.target.id==='contributionForm')submitContribution(event);});
  root.addEventListener('change',async event=>{const input=event.target;if(input.id!=='contributionPhoto'||!input.files[0])return;const file=input.files[0],generation=++contributionGeneration,status=$('#contributionPhotoStatus');contributionPhoto=null;pendingUploads.add('contribution');input.disabled=true;status.textContent=tr('ছবি প্রস্তুত হচ্ছে…','Preparing photo…');try{const image=await kit.compressImage(file);if(generation!==contributionGeneration||!input.isConnected)return;contributionPhoto=image;status.textContent=tr('ছবি প্রস্তুত। শুধু আপনার ব্রাউজারে থাকবে।','Photo ready. It will stay in your browser.');}catch{if(generation===contributionGeneration&&status.isConnected)status.textContent=tr('সর্বোচ্চ ১৫ MB-এর JPG, PNG বা WebP দিন।','Use JPG, PNG or WebP, up to 15 MB.');}finally{if(generation===contributionGeneration)pendingUploads.delete('contribution');input.disabled=false;input.value='';}});
  root.addEventListener('click',async event=>{const remove=event.target.closest('[data-delete-draft]'),exportBtn=event.target.closest('[data-export-draft]'),send=event.target.closest('[data-send-draft]');
    if(event.target.closest('#refreshCommunityStories')){loadPublicStories();return;}
    if(remove){const item=drafts.find(d=>d.id===remove.dataset.deleteDraft);if(!item)return;drafts=drafts.filter(d=>d!==item);storage.set('contributions',drafts);if(item.photoId){await kit.media('delete',item.photoId).catch(()=>{});media.delete(item.photoId);}renderDrafts();}
    if(exportBtn){const item=drafts.find(d=>d.id===exportBtn.dataset.exportDraft);if(item)kit.download(new Blob([JSON.stringify({app:'deshpath-contribution',...item,photo:media.get(item.photoId)||null},null,2)],{type:'application/json'}),'deshpath-discovery.json');}
    if(send){const item=drafts.find(d=>d.id===send.dataset.sendDraft);if(!item||busy||!authReady())return;const body=draftBody(item);if(body.length>4000){toast(tr('এলাকা, বর্ণনা, দিকনির্দেশ ও নোট মিলিয়ে সর্বোচ্চ ৪০০০ অক্ষর অনলাইনে পাঠানো যায়। একটি ছোট খসড়া তৈরি করুন; মূল খসড়া এই ডিভাইসে রাখা আছে।','The combined area, description, directions and notes must fit within 4,000 characters for online submission. Create a shorter draft; the original remains saved on this device.'));return;}busy=true;send.disabled=true;try{await cloud().submitContribution({districtId:item.district,title:item.title,body});await renderCloud();toast(tr('লেখাটি পর্যালোচনার জন্য জমা হয়েছে। অনুমোদনের পরে প্রকাশ হবে। ছবি এই ডিভাইসে আছে।','Text submitted for review. It becomes public only after approval. Your photo stays on this device.'));}catch(error){toast(cloudErrorMessage(error));}finally{busy=false;if(send.isConnected)send.disabled=false;}}
  });
  profileRoot.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target;if(!form.reportValidity())return;
    if(form.id==='profileForm'){
      const homeDist=$('#profileHomeDistrict')?.value??(storage.get('homeDistrict', '')||'');
      profile={name:$('#profileName').value.trim(),bio:$('#profileBio').value.trim()};
      storage.set('profile',profile);
      storage.set('homeDistrict', homeDist);
      try { localStorage.setItem('deshpath.homeDistrict', homeDist); } catch {}
      editProfileOpen = false;
      renderProfile();
      toast(tr('প্রোফাইল এই ব্রাউজারে রাখা হয়েছে।','Profile saved in this browser.'));
    }
    if(form.id==='newCommunityContribForm'){
      const districtId=$('#modalContribDistrict')?.value||'';
      const spotName=$('#modalContribSpotName')?.value?.trim()||'';
      const category=$('#modalContribCategory')?.value||tr('প্রকৃতি ও উদ্যান','Nature & Parks');
      const story=$('#modalContribStory')?.value?.trim()||'';
      const directions=$('#modalContribDirections')?.value?.trim()||'';
      if(!districtId||!spotName||!story)return;
      const newContrib={
        id:(crypto.randomUUID?crypto.randomUUID():'contrib-'+Date.now()),
        district:districtId,
        spotName:spotName,
        category:category,
        story:story,
        directions:directions,
        author:String(profile.name||'').trim()||tr('দেশপথিক পরিব্রাজক','Deshpath Explorer'),
        createdAt:new Date().toISOString(),
        photo:modalContribPhotoData||null,
        status:'approved',
        points:50
      };
      saveCommunityContribution(newContrib);
      modalContribPhotoData=null;
      form.reset();
      const modal=$('#contribModal');
      if(modal?.close)modal.close();
      else if(modal)modal.hidden=true;
      toast(tr('আপনার নতুন স্পটের তথ্য সফলভাবে যোগ হয়েছে! (+৫০ পয়েন্ট)','New spot added successfully! (+50 Points)'));
      renderProfile();
    }
    if(form.id==='cloudLogin'){otpEmail=$('#cloudEmail').value.trim();await cloudAction(async()=>{await (cloud().requestMagicLink||cloud().requestOtp)(otpEmail);const status=$('#cloudStatus');if(status)status.textContent=tr('সাইন ইনের ইমেইল চাওয়া হয়েছে। ইনবক্স ও স্প্যাম দেখুন; লিংকটি এই একই ব্রাউজার ও ডিভাইসে খুলুন। ইমেইলে কোড থাকলে নিচের বিকল্প ব্যবহার করুন।','Sign-in email requested. Check your inbox and spam; open the link in this same browser and device. If the email includes a code, use the option below.');});}
    if(form.id==='cloudVerify'){otpEmail=$('#cloudEmail')?.value.trim()||otpEmail;await cloudAction(async()=>{await cloud().verifyOtp(otpEmail,$('#cloudCode').value);authCallbackMessage=['সাইন ইন সফল হয়েছে।','You are signed in.'];await renderCloud();});}
  });
  async function cloudAction(action){if(busy||!authReady())return;busy=true;const status=$('#cloudStatus');if(status)status.textContent=tr('অনুরোধটি সম্পন্ন হচ্ছে…','Completing your request…');try{await action();}catch(error){const currentStatus=$('#cloudStatus');if(currentStatus?.isConnected)currentStatus.textContent=cloudErrorMessage(error);}finally{busy=false;}}
  profileRoot.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='profilePhoto'&&el.files[0]){const file=el.files[0],generation=++profileGeneration;el.disabled=true;pendingUploads.add('profile');try{const image=await kit.compressImage(file,75000,400);if(generation!==profileGeneration||!el.isConnected)return;const record={...image,id:'profile-avatar'};await kit.media('put',record);if(generation!==profileGeneration)return;media.set(record.id,record);try{localStorage.setItem('deshpath.avatar_dataurl',record.src);}catch{}renderProfile();}catch{toast(tr('প্রোফাইল ছবি রাখা যায়নি।','Profile photo could not be saved.'));}finally{if(generation===profileGeneration)pendingUploads.delete('profile');el.disabled=false;el.value='';}}
    if(el.id==='modalContribPhoto'&&el.files?.[0]){
      const file=el.files[0];const statusEl=$('#modalContribPhotoStatus');const previewEl=$('#modalContribPhotoPreview');
      if(statusEl)statusEl.textContent=tr('ছবি প্রস্তুত হচ্ছে…','Preparing photo…');
      try{
        const compressed=await kit.compressImage(file,150000,1200);modalContribPhotoData=compressed;
        if(statusEl)statusEl.textContent=tr(`ছবি প্রস্তুত (${bn(Math.round(compressed.bytes/1024))} KB, WebP)`,`Photo ready (${Math.round(compressed.bytes/1024)} KB, WebP)`);
        if(previewEl)previewEl.innerHTML=`<img src="${esc(compressed.src)}" alt="Preview" style="max-height:130px;max-width:200px;border-radius:8px;object-fit:cover;margin-top:8px">`;
      }catch{if(statusEl)statusEl.textContent=tr('সর্বোচ্চ ১৫ MB-এর JPG, PNG বা WebP দিন।','Use JPG, PNG or WebP under 15 MB.');modalContribPhotoData=null;}
    }
    if(el.id==='importJournal'&&el.files[0]){const file=el.files[0],generation=++backupGeneration;backupCandidate=null;$('#confirmRestore').hidden=true;try{if(file.size>90000000)throw Error('SIZE');const parsed=JSON.parse(await file.text());if(generation!==backupGeneration||!el.isConnected)return;const data=kit.validateBackup(parsed);backupCandidate=data;$('#backupPreview').textContent=tr('ব্যাকআপে '+bn(Object.keys(data.values).length)+' ধরনের তথ্য ও '+bn(data.media.length)+'টি ছবি আছে। ফিরিয়ে আনলে একই ধরনের বর্তমান তথ্যের জায়গায় এগুলো বসবে।','This backup contains '+Object.keys(data.values).length+' data groups and '+data.media.length+' photos. Restoring replaces matching current information.');$('#backupPreview').hidden=false;$('#confirmRestore').hidden=false;$('#backupStatus').textContent='';}catch{$('#backupPreview').hidden=true;$('#backupStatus').textContent=tr('এটি গ্রহণযোগ্য দেশপথ ব্যাকআপ নয় (সর্বোচ্চ ৯০ MB)।','This is not a valid Deshpath backup (maximum 90 MB).');}el.value='';}
  });
  profileRoot.addEventListener('click',async event=>{
    const tabBtn=event.target.closest('[data-profile-tab]');
    if(tabBtn){switchProfileTab(tabBtn.dataset.profileTab);return;}
    if(event.target.closest('#toggleProfileEdit')){
      editProfileOpen=!editProfileOpen;
      const drawer=$('#profileEditDrawer');
      if(drawer){drawer.style.display=editProfileOpen?'block':'none';if(editProfileOpen)$('#profileName')?.focus();}
      return;
    }
    if(event.target.closest('#cancelProfileEditBtn')){
      editProfileOpen=false;const drawer=$('#profileEditDrawer');if(drawer)drawer.style.display='none';return;
    }
    if(event.target.closest('#avatarPreviewFrame')){
      $('#profilePhoto')?.click();return;
    }
    const saveDiaryBtn=event.target.closest('[data-save-diary]');
    if(saveDiaryBtn){
      const districtId=saveDiaryBtn.dataset.saveDiary;
      const noteVal=$('#diaryNote_'+districtId)?.value||'';
      const dateVal=$('#diaryDate_'+districtId)?.value||'';
      saveDistrictNote(districtId,noteVal,dateVal);
      const feedback=$('#diaryFeedback_'+districtId);
      if(feedback){feedback.textContent=tr('✓ সংরক্ষিত','✓ Saved');setTimeout(()=>{if(feedback.isConnected)feedback.textContent='';},2500);}
      toast(tr('ভ্রমণ স্মৃতি এই ব্রাউজারে সংরক্ষিত হয়েছে।','Travel memory saved in this browser.'));
      const ptsEl=$('#displayContribPoints');if(ptsEl)ptsEl.textContent=bn(getContributorPoints());
      return;
    }
    if(event.target.closest('#openContribModalBtn')){
      const modal=$('#contribModal');if(modal?.showModal)modal.showModal();else if(modal)modal.hidden=false;return;
    }
    if(event.target.closest('#closeContribModalBtn')||event.target.closest('#cancelContribBtn')){
      const modal=$('#contribModal');if(modal?.close)modal.close();else if(modal)modal.hidden=true;return;
    }
    const delContrib=event.target.closest('[data-delete-contrib]');
    if(delContrib){
      deleteCommunityContribution(delContrib.dataset.deleteContrib);renderProfile();toast(tr('অবদান সরানো হয়েছে।','Contribution removed.'));return;
    }
    const removeFav=event.target.closest('[data-remove-profile-fav]');
    if(removeFav){
      const id=removeFav.dataset.removeProfileFav;
      const favs=new Set(asArray(storage.get('favorites',[])));
      favs.delete(id);storage.set('favorites',[...favs]);
      try{localStorage.setItem('deshpath.favorites',JSON.stringify([...favs]));}catch{}
      renderProfile();toast(tr('পছন্দের তালিকা থেকে সরানো হয়েছে।','Removed from saved places.'));return;
    }
    if(event.target.closest('#retryCloudConnection')||event.target.closest('#refreshMySubmissions')){await renderCloud();return;}
    if(event.target.closest('#exportJournal')){const button=$('#exportJournal');button.disabled=true;try{const backup=await kit.makeBackup();kit.download(new Blob([JSON.stringify(backup)],{type:'application/json'}),'deshpath-journal-'+new Date().toISOString().slice(0,10)+'.json');$('#backupStatus').textContent=tr('ব্যাকআপ প্রস্তুত। ফাইলটি ব্যক্তিগতভাবে রাখুন।','Backup ready. Keep this personal file safe.');}catch{$('#backupStatus').textContent=tr('ব্যাকআপ তৈরি হয়নি। আবার চেষ্টা করুন।','Backup could not be created. Please try again.');}finally{button.disabled=false;}}
    if(event.target.closest('#confirmRestore')&&backupCandidate){if(busy)return;busy=true;const button=$('#confirmRestore');button.disabled=true;try{await kit.restoreBackup(backupCandidate);location.reload();}catch{$('#backupStatus').textContent=tr('ব্যাকআপ ফিরিয়ে আনা যায়নি। ব্রাউজারের জায়গা পরীক্ষা করুন।','Restore failed. Check browser storage space.');}finally{busy=false;if(button.isConnected)button.disabled=false;}}
    if(event.target.closest('#removeProfilePhoto')){profileGeneration++;pendingUploads.delete('profile');await kit.media('delete','profile-avatar').catch(()=>{});media.delete('profile-avatar');try{localStorage.removeItem('deshpath.avatar_dataurl');}catch{}renderProfile();}
    if(event.target.closest('#cloudSignOut'))await cloudAction(async()=>{await cloud().signOut();authCallbackMessage=[];await renderCloud();});
    if(event.target.closest('#cloudSave'))await cloudAction(async()=>{const values=kit.readValues();delete values.mapAvatar;delete values.photoAssignments;delete values.photoGroups;await cloud().saveJournal({app:'deshpath',version:1,values});$('#cloudStatus').textContent=tr('লেখা ও বাছাই অনলাইনে সেভ হয়েছে।','Text and selections saved to cloud.');});
    if(event.target.closest('#cloudLoad'))await cloudAction(async()=>{const data=await cloud().loadJournal();if(!data){$('#cloudStatus').textContent=tr('এই অ্যাকাউন্টে এখনো কোনও ক্লাউড কপি নেই। আগে খাতা ব্যক্তিগতভাবে অনলাইনে রাখুন।','This account has no cloud copy yet. Save your private journal online first.');return;}backupCandidate=kit.validateBackup({...data.snapshot,media:[]});const message=tr('ক্লাউডের কপি প্রস্তুত। একই তথ্য প্রতিস্থাপন করতে নিচের ফিরিয়ে আনুন বাটনে চাপুন।','Cloud copy ready. Use Restore below to replace matching information.');$('#backupPreview').textContent=message;$('#backupPreview').hidden=false;$('#confirmRestore').hidden=false;$('#cloudStatus').textContent=message;});
  });লাকা, বর্ণনা, দিকনির্দেশ ও নোট মিলিয়ে সর্বোচ্চ ৪০০০ অক্ষর অনলাইনে পাঠানো যায়। একটি ছোট খসড়া তৈরি করুন; মূল খসড়া এই ডিভাইসে রাখা আছে।','The combined area, description, directions and notes must fit within 4,000 characters for online submission. Create a shorter draft; the original remains saved on this device.'));return;}busy=true;send.disabled=true;try{await cloud().submitContribution({districtId:item.district,title:item.title,body});await renderCloud();toast(tr('লেখাটি পর্যালোচনার জন্য জমা হয়েছে। অনুমোদনের পরে প্রকাশ হবে। ছবি এই ডিভাইসে আছে।','Text submitted for review. It becomes public only after approval. Your photo stays on this device.'));}catch(error){toast(cloudErrorMessage(error));}finally{busy=false;if(send.isConnected)send.disabled=false;}}
  });
  profileRoot.addEventListener('submit',async event=>{event.preventDefault();const form=event.target;if(!form.reportValidity())return;if(form.id==='profileForm'){profile={name:$('#profileName').value.trim(),bio:$('#profileBio').value.trim()};storage.set('profile',profile);renderProfile();toast(tr('প্রোফাইল এই ব্রাউজারে রাখা হয়েছে।','Profile saved in this browser.'));}
    if(form.id==='cloudLogin'){otpEmail=$('#cloudEmail').value.trim();await cloudAction(async()=>{await (cloud().requestMagicLink||cloud().requestOtp)(otpEmail);const status=$('#cloudStatus');if(status)status.textContent=tr('সাইন ইনের ইমেইল চাওয়া হয়েছে। ইনবক্স ও স্প্যাম দেখুন; লিংকটি এই একই ব্রাউজার ও ডিভাইসে খুলুন। ইমেইলে কোড থাকলে নিচের বিকল্প ব্যবহার করুন।','Sign-in email requested. Check your inbox and spam; open the link in this same browser and device. If the email includes a code, use the option below.');});}
    if(form.id==='cloudVerify'){otpEmail=$('#cloudEmail')?.value.trim()||otpEmail;await cloudAction(async()=>{await cloud().verifyOtp(otpEmail,$('#cloudCode').value);authCallbackMessage=['সাইন ইন সফল হয়েছে।','You are signed in.'];await renderCloud();});}
  });
  async function cloudAction(action){if(busy||!authReady())return;busy=true;const status=$('#cloudStatus');if(status)status.textContent=tr('অনুরোধটি সম্পন্ন হচ্ছে…','Completing your request…');try{await action();}catch(error){const currentStatus=$('#cloudStatus');if(currentStatus?.isConnected)currentStatus.textContent=cloudErrorMessage(error);}finally{busy=false;}}
  profileRoot.addEventListener('change',async event=>{
    const el=event.target;if(el.id==='profilePhoto'&&el.files[0]){const file=el.files[0],generation=++profileGeneration;el.disabled=true;pendingUploads.add('profile');try{const image=await kit.compressImage(file,75000,400);if(generation!==profileGeneration||!el.isConnected)return;const record={...image,id:'profile-avatar'};await kit.media('put',record);if(generation!==profileGeneration)return;media.set(record.id,record);renderProfile();}catch{toast(tr('প্রোফাইল ছবি রাখা যায়নি।','Profile photo could not be saved.'));}finally{if(generation===profileGeneration)pendingUploads.delete('profile');el.disabled=false;el.value='';}}
    if(el.id==='importJournal'&&el.files[0]){const file=el.files[0],generation=++backupGeneration;backupCandidate=null;$('#confirmRestore').hidden=true;try{if(file.size>90000000)throw Error('SIZE');const parsed=JSON.parse(await file.text());if(generation!==backupGeneration||!el.isConnected)return;const data=kit.validateBackup(parsed);backupCandidate=data;$('#backupPreview').textContent=tr('ব্যাকআপে '+bn(Object.keys(data.values).length)+' ধরনের তথ্য ও '+bn(data.media.length)+'টি ছবি আছে। ফিরিয়ে আনলে একই ধরনের বর্তমান তথ্যের জায়গায় এগুলো বসবে।','This backup contains '+Object.keys(data.values).length+' data groups and '+data.media.length+' photos. Restoring replaces matching current information.');$('#backupPreview').hidden=false;$('#confirmRestore').hidden=false;$('#backupStatus').textContent='';}catch{$('#backupPreview').hidden=true;$('#backupStatus').textContent=tr('এটি গ্রহণযোগ্য দেশপথ ব্যাকআপ নয় (সর্বোচ্চ ৯০ MB)।','This is not a valid Deshpath backup (maximum 90 MB).');}el.value='';}
  });
  profileRoot.addEventListener('click',async event=>{
    if(event.target.closest('#retryCloudConnection')||event.target.closest('#refreshMySubmissions')){await renderCloud();return;}
    if(event.target.closest('#exportJournal')){const button=$('#exportJournal');button.disabled=true;try{const backup=await kit.makeBackup();kit.download(new Blob([JSON.stringify(backup)],{type:'application/json'}),'deshpath-journal-'+new Date().toISOString().slice(0,10)+'.json');$('#backupStatus').textContent=tr('ব্যাকআপ প্রস্তুত। ফাইলটি ব্যক্তিগতভাবে রাখুন।','Backup ready. Keep this personal file safe.');}catch{$('#backupStatus').textContent=tr('ব্যাকআপ তৈরি হয়নি। আবার চেষ্টা করুন।','Backup could not be created. Please try again.');}finally{button.disabled=false;}}
    if(event.target.closest('#confirmRestore')&&backupCandidate){if(busy)return;busy=true;const button=$('#confirmRestore');button.disabled=true;try{await kit.restoreBackup(backupCandidate);location.reload();}catch{$('#backupStatus').textContent=tr('ব্যাকআপ ফিরিয়ে আনা যায়নি। ব্রাউজারের জায়গা পরীক্ষা করুন।','Restore failed. Check browser storage space.');}finally{busy=false;if(button.isConnected)button.disabled=false;}}
    if(event.target.closest('#removeProfilePhoto')){profileGeneration++;pendingUploads.delete('profile');await kit.media('delete','profile-avatar').catch(()=>{});media.delete('profile-avatar');renderProfile();}
    if(event.target.closest('#cloudSignOut'))await cloudAction(async()=>{await cloud().signOut();authCallbackMessage=[];await renderCloud();});
    if(event.target.closest('#cloudSave'))await cloudAction(async()=>{const values=kit.readValues();delete values.mapAvatar;delete values.photoAssignments;delete values.photoGroups;await cloud().saveJournal({app:'deshpath',version:1,values});$('#cloudStatus').textContent=tr('লেখা ও বাছাই অনলাইনে সেভ হয়েছে।','Text and selections saved to cloud.');});
    if(event.target.closest('#cloudLoad'))await cloudAction(async()=>{const data=await cloud().loadJournal();if(!data){$('#cloudStatus').textContent=tr('এই অ্যাকাউন্টে এখনো কোনও ক্লাউড কপি নেই। আগে খাতা ব্যক্তিগতভাবে অনলাইনে রাখুন।','This account has no cloud copy yet. Save your private journal online first.');return;}backupCandidate=kit.validateBackup({...data.snapshot,media:[]});const message=tr('ক্লাউডের কপি প্রস্তুত। একই তথ্য প্রতিস্থাপন করতে নিচের ফিরিয়ে আনুন বাটনে চাপুন।','Cloud copy ready. Use Restore below to replace matching information.');$('#backupPreview').textContent=message;$('#backupPreview').hidden=false;$('#confirmRestore').hidden=false;$('#cloudStatus').textContent=message;});
  });
  function publicReviewMarkup(id){
    const result=publicReviews.get(id)||{state:'idle',rows:[]};
    if(result.state==='idle'||result.state==='loading')return '<p class="journal-small" role="status">'+tr('প্রকাশিত রিভিউ খোঁজা হচ্ছে…','Loading published reviews…')+'</p>';
    if(result.state==='error')return '<p class="journal-small journal-errors" role="status">'+tr('প্রকাশিত রিভিউ লোড হয়নি। আবার চেষ্টা করুন।','Published reviews could not be loaded. Please try again.')+'</p>';
    if(!result.rows.length)return '<p class="journal-small">'+tr('এই গন্তব্যে এখনো প্রকাশিত রিভিউ নেই।','No published reviews for this place yet.')+'</p>';
    const average=result.rows.reduce((total,row)=>total+row.rating,0)/result.rows.length;
    return '<p class="journal-small">'+tr('সাম্প্রতিক প্রকাশিত '+bn(result.rows.length)+'টি রিভিউ · গড় ',result.rows.length+' recent published reviews · average ')+bn(average.toFixed(1))+' / '+bn(5)+'</p><div class="review-public-list">'+result.rows.map(row=>'<article class="review-public-item"><strong aria-label="'+esc(tr(bn(row.rating)+' / ৫ রেটিং',row.rating+' out of 5 stars'))+'">'+'★'.repeat(row.rating)+'</strong>'+statusChip('approved')+'<p>'+esc(row.body)+'</p></article>').join('')+'</div>';
  }
  function renderPublicReviews(id){dialogBody.querySelectorAll('[data-public-reviews]').forEach(mount=>{if(mount.dataset.publicReviews===id)mount.innerHTML=publicReviewMarkup(id);});}
  async function loadPublicReviews(id){
    if(!enabled()||!places.some(p=>p.id===id)||publicReviews.get(id)?.state==='loading')return;
    publicReviews.set(id,{state:'loading',rows:[]});renderPublicReviews(id);
    try{const rows=await cloud().listApprovedReviews(id);publicReviews.set(id,{state:'ready',rows:asArray(rows).filter(row=>validPublicReview(row)&&row.place_id===id)});}
    catch{publicReviews.set(id,{state:'error',rows:[]});}
    renderPublicReviews(id);
  }
  function renderExistingReviewStatus(){
    dialogBody.querySelectorAll('[data-local-online-status]').forEach(mount=>{const review=reviews.find(r=>r.id===mount.dataset.localOnlineStatus),online=review?matchingReview(review):null;mount.innerHTML=online?statusChip(online.status):'';const button=mount.parentElement?.querySelector('[data-send-review]');if(button)button.disabled=!!online;});
  }
  function renderReview(mount){
    const id=mount.dataset.reviewPlace;if(!places.some(p=>p.id===id))return;
    reviewGeneration++;reviewPhoto=null;pendingUploads.delete('review');mount.dataset.reviewReady='true';const own=reviews.filter(r=>r.placeId===id);
    mount.innerHTML='<h3>'+tr('আপনার ভ্রমণের নোট','Your visit notes')+'</h3><p class="journal-small">'+tr('এখানকার ব্যক্তিগত নোট, রেটিং ও ছবি শুধু এই ব্রাউজারে থাকে। সম্পাদককে নির্বাচিত তথ্য পাঠাতে ওপরের আলাদা অনলাইন ভ্রমণ ফর্ম ব্যবহার করুন।','These private notes, ratings and photos stay in this browser. Use the separate online visit form above to share selected information with the editors.')+'</p><form data-review-form="'+esc(id)+'"><label for="visitRating">'+tr('আপনার রেটিং','Your rating')+'</label><select id="visitRating" required><option value="">'+tr('বেছে নিন','Choose')+'</option>'+[5,4,3,2,1].map(n=>'<option value="'+n+'">'+'★'.repeat(n)+' · '+bn(n)+'/'+bn(5)+'</option>').join('')+'</select><label for="visitReview">'+tr('অভিজ্ঞতা (অন্তত ১০ অক্ষর)','Experience (at least 10 characters)')+'</label><textarea id="visitReview" minlength="10" maxlength="1000" required data-no-translate></textarea><label class="photo-upload">'+tr('নিজের তোলা ছবি (ঐচ্ছিক)','Your own photo (optional)')+'<input id="visitPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><p id="visitPhotoStatus" class="journal-small" role="status"></p><button class="button secondary" type="submit">'+tr('ব্যক্তিগত নোট রাখুন','Save private note')+'</button></form><div class="review-local-list">'+own.map(r=>{const online=matchingReview(r);return '<article class="review-local-item"><span class="draft-state">'+tr('ব্যক্তিগত নোট','Private note')+'</span><strong>'+'★'.repeat(r.rating)+'</strong><p>'+esc(r.body)+'</p>'+(media.get(r.photoId)?'<img src="'+esc(photoSrc(media.get(r.photoId)))+'" alt="'+tr('আপনার ভ্রমণের ছবি','Your visit photo')+'">':'')+'<div data-local-online-status="'+esc(r.id)+'">'+(online?statusChip(online.status):'')+'</div><div class="journal-actions"><button type="button" class="text-button" data-remove-review="'+esc(r.id)+'">'+tr('স্থানীয় নোট সরান','Remove local note')+'</button>'+(authReady()&&!onlineCommunity?'<button type="button" class="text-button" data-send-review="'+esc(r.id)+'"'+(online?' disabled':'')+'>'+tr('শুধু লেখা ও রেটিং যাচাইয়ে পাঠান','Submit text & rating for review')+'</button>':'')+'</div>'+(enabled()&&!onlineCommunity?'<p class="journal-small">'+(authReady()?tr('পাঠান বাটনে শুধু লেখা ও রেটিং অনলাইনে যায়; ছবি যায় না। অনুমোদনের পরে লেখা ও রেটিং সবাই দেখতে পারবেন। প্রতি অ্যাকাউন্টে এই গন্তব্যের একটি অনলাইন রিভিউ রাখা যায়।','Submit sends only the text and rating online, never the photo. They become public after approval. Each account can submit one online review for this place.'):tr('ইমেইল লগইনের শেষ সেটিংস হলে অনলাইনে পাঠানো যাবে। আপনার নোট এখন এই ডিভাইসে আছে।','Online submission will be available after email sign-in setup is finished. Your note is on this device.'))+'</p>':'')+'</article>';}).join('')+'</div>'+(enabled()?'<section class="review-public-section"><div class="journal-public-heading"><h4>'+tr('সবার জন্য প্রকাশিত রিভিউ','Published visitor reviews')+'</h4><button type="button" class="text-button" data-refresh-public-reviews="'+esc(id)+'">'+tr('আবার দেখুন','Refresh reviews')+'</button></div><div data-public-reviews="'+esc(id)+'" aria-live="polite">'+publicReviewMarkup(id)+'</div></section>':'');
    if(enabled()&&!publicReviews.has(id))loadPublicReviews(id);
    if(onlineCommunity){
      const notebook=document.createElement('details');notebook.className='co-detail co-local-notebook';notebook.innerHTML=`<summary>${tr('শুধু নিজের জন্য ব্যক্তিগত নোট রাখুন','Keep a visit note just for yourself')}</summary>`;
      for(const child of Array.from(mount.children))if(!child.classList.contains('review-public-section'))notebook.append(child);
      mount.prepend(notebook);const onlineMount=document.createElement('div');onlineMount.className='online-visit-reviews';mount.prepend(onlineMount);onlineCommunity.mountPlaceReviews(onlineMount,id);
    }
  }
  const dialogBody=$('#dialogBody');new MutationObserver(()=>{dialogBody.querySelectorAll('[data-review-place]:not([data-review-ready])').forEach(renderReview);}).observe(dialogBody,{childList:true,subtree:true});
  dialogBody.addEventListener('change',async event=>{const input=event.target;if(input.id!=='visitPhoto'||!input.files[0])return;const form=input.closest('[data-review-form]'),file=input.files[0],generation=++reviewGeneration,status=form.querySelector('#visitPhotoStatus');reviewPhoto=null;pendingUploads.add('review');input.disabled=true;status.textContent=tr('ছবি প্রস্তুত হচ্ছে…','Preparing photo…');try{const image=await kit.compressImage(file);if(generation!==reviewGeneration||!form.isConnected||!$('#contentDialog').open)return;reviewPhoto={image,form,generation};status.textContent=tr('ছবি প্রস্তুত।','Photo ready.');}catch{if(generation===reviewGeneration&&status.isConnected)status.textContent=tr('সর্বোচ্চ ১৫ MB-এর JPG, PNG বা WebP দিন।','Use JPG, PNG or WebP, up to 15 MB.');}finally{if(generation===reviewGeneration)pendingUploads.delete('review');input.disabled=false;input.value='';}});
  dialogBody.addEventListener('submit',async event=>{const form=event.target;if(!form.dataset.reviewForm)return;event.preventDefault();if(busy||pendingUploads.has('review')||!form.reportValidity())return;busy=true;const button=form.querySelector('button[type=submit]');button.disabled=true;try{if(reviews.length>=100)throw Error('LIMIT');const item={id:crypto.randomUUID(),placeId:form.dataset.reviewForm,rating:Number($('#visitRating').value),body:$('#visitReview').value.trim(),createdAt:new Date().toISOString(),photoId:null};if(!kit.validReview(item))throw Error('INVALID');if(reviewPhoto&&reviewPhoto.form===form&&reviewPhoto.generation===reviewGeneration){item.photoId='review-'+item.id;const record={...reviewPhoto.image,id:item.photoId};await kit.media('put',record);media.set(record.id,record);}localStorage.setItem('deshpath.reviews',JSON.stringify([item,...reviews]));reviews.unshift(item);reviewPhoto=null;const mount=form.closest('[data-review-place]');if(mount?.isConnected&&$('#contentDialog').open)renderReview(mount);toast(tr('আপনার নোট রাখা হয়েছে।','Your note has been saved.'));}catch{toast(tr('নোট রাখা যায়নি। জায়গা বা লেখাটি পরীক্ষা করুন।','Note could not be saved. Check storage or your text.'));}finally{busy=false;if(button.isConnected)button.disabled=false;}});
  dialogBody.addEventListener('click',async event=>{
    const refresh=event.target.closest('[data-refresh-public-reviews]');if(refresh){loadPublicReviews(refresh.dataset.refreshPublicReviews);return;}
    const send=event.target.closest('[data-send-review]');
    if(send){const item=reviews.find(r=>r.id===send.dataset.sendReview);if(!item||busy||!authReady()||matchingReview(item))return;busy=true;send.disabled=true;try{await cloud().submitReview({placeId:item.placeId,rating:item.rating,body:item.body});await renderCloud();toast(tr('শুধু লেখা ও রেটিং পর্যালোচনার জন্য জমা হয়েছে। অনুমোদনের পরে প্রকাশ হবে। ছবি এই ডিভাইসেই আছে।','Only text and rating were submitted for review. They become public after approval. Your photo stays on this device.'));}catch(error){toast(cloudErrorMessage(error));}finally{busy=false;if(send.isConnected)send.disabled=!!matchingReview(item);}return;}
    const b=event.target.closest('[data-remove-review]');if(!b)return;const item=reviews.find(r=>r.id===b.dataset.removeReview);reviews=reviews.filter(r=>r!==item);storage.set('reviews',reviews);if(item?.photoId){kit.media('delete',item.photoId).catch(()=>{});media.delete(item.photoId);}renderReview(b.closest('[data-review-place]'));
  });
  $('#contentDialog').addEventListener('close',()=>{reviewGeneration++;reviewPhoto=null;pendingUploads.delete('review');});
  for(const type of ['deshpath:mapchange','deshpath:worldchange','deshpath:passportchange','deshpath:gameschange','deshpath:rankedchange'])window.addEventListener(type,()=>{if(!profileRoot.contains(document.activeElement))renderProfile();});
  async function initialiseCloud(){
    if(!authReady()){authInitialising=false;renderCloud();return;}
    try{const result=await cloud().completeAuthCallback?.();if(result?.handled)authCallbackMessage=result.user?['ইমেইল লিংক দিয়ে সাইন ইন হয়েছে।','Signed in using your email link.']:['ইমেইল লিংক যাচাই হয়েছে। সাইন ইন অবস্থা দেখুন।','The email link was processed. Check your sign-in status.'];}
    catch(error){authCallbackMessage=['cloud-rate-limited','email-unavailable'].includes(error?.code)?cloudErrorCopy(error):['ইমেইল লিংকে সাইন ইন সম্পূর্ণ হয়নি। লিংকটি যেই ব্রাউজার ও ডিভাইস থেকে চেয়েছিলেন সেখানে খুলুন, অথবা নতুন ইমেইল চান।','Email-link sign-in did not finish. Open it in the browser and device that requested it, or request a new email.'];}
    finally{authInitialising=false;await renderCloud();}
  }
  renderCommunity();renderProfile();kit.media('getAll').then(items=>{for(const item of items)if(kit.validMedia(item))media.set(item.id,item);renderDrafts();if(!profileRoot.contains(document.activeElement))renderProfile();}).catch(()=>{});
  if(enabled())loadPublicStories();
  if(authReady()){cloud()?.onAuthChange?.((event)=>{if(event==='SIGNED_OUT'){cloudUser=null;ownGeneration++;ownSubmissions={state:'idle',contributions:[],reviews:[]};renderOwnSubmissions();renderDrafts();renderExistingReviewStatus();}if(!authInitialising)renderCloud();});initialiseCloud();}
  else authInitialising=false;
  return {refreshLanguage(){renderCommunity();renderProfile();onlineCommunity?.refreshLanguage();},getSnapshot:()=>({drafts:drafts.length,reviews:reviews.length})};
};
