/* Deshpath field games. Original interactions; all records stay in this browser. */
(function (global) {
  'use strict';
  const shuffle = (items, random = Math.random) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  const distanceKm = (a, b) => {
    const rad = n => n * Math.PI / 180, lat = rad(b.lat - a.lat), lng = rad(b.lng - a.lng);
    const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(lng / 2) ** 2;
    return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  };
  const photoScore = km => Math.max(0, Math.round(1000 * (1 - Math.max(0, km) / 650)));
  global.DESH_GAME_MATH = Object.freeze({ shuffle, distanceKm, photoScore });

  global.initDeshGames = function (helpers) {
    const root = document.querySelector('#gamesRoot');
    if (!root) return { refreshLanguage() {}, getSnapshot: () => ({ available: false }) };
    const { tr, bn, esc, icon, storage, districts, places, districtById, districtName, placeText } = helpers;
    const geometry = global.DESH_MAP.paths, geometryById = new Map(geometry.map(item => [item.id, item]));
    const divisions = global.DESH_DATA.divisions;
    const catalog = [
      { id: 'puzzle', n: '01', icon: 'map-pin', name: ['জেলার ঠিকানা', 'District placement'], detail: ['সীমানার ভেতর জেলা বসান। তিন স্তর, নিজের সময়ের সঙ্গে চ্যালেঞ্জ।', 'Put each district in its place. Three levels, one personal time challenge.'], tag: ['ম্যাপ পাজল', 'Map puzzle'] },
      { id: 'photo', n: '02', icon: 'compass', name: ['ছবির পেছনের পথ', 'Beyond the photograph'], detail: ['ছবি দেখে জেলা অনুমান করুন। যত কাছে, তত বেশি পয়েন্ট।', 'Guess the district from a photograph. The closer you are, the more points you earn.'], tag: ['ছবিতে খুঁজুন', 'Photo discovery'] },
      { id: 'farthest', n: '03', icon: 'route', name: ['সবচেয়ে দূরের ডাক', 'The farthest call'], detail: ['চারটি জেলার মধ্যে কোনটি সবচেয়ে দূরে? দূরত্বের ধারণা যাচাই করুন।', 'Which of four districts is farthest away? Test your sense of distance.'], tag: ['দূরত্ব চ্যালেঞ্জ', 'Distance challenge'] },
      { id: 'knowledge', n: '04', icon: 'sparkles', name: ['দেশ চেনার খেলা', 'Know your Bangladesh'], detail: ['প্রতি রাউন্ডে এলোমেলো পাঁচটি প্রশ্ন। প্রতিটি উত্তরে নতুন আবিষ্কার।', 'Five shuffled questions each round. Discover something with every answer.'], tag: ['জ্ঞান কুইজ', 'Knowledge quiz'] },
      { id: 'personality', n: '05', icon: 'leaf', name: ['আপনার ভ্রমণের ছন্দ', 'Your travel rhythm'], detail: ['ছয়টি ছোট্ট বাছাইয়ে খুঁজে নিন পরের ভ্রমণের অনুপ্রেরণা।', 'Six small choices to find inspiration for your next journey.'], tag: ['মজার ব্যক্তিত্ব কুইজ', 'Just-for-fun personality'] }
    ];
    const personalityQuestions = [
      [['ছুটির সকালে কোথায় থাকতে চান?', 'Where would you spend a free morning?'], [['সবুজের মাঝে হাঁটতে', 'Walking among greenery'], ['ঢেউয়ের পাশে', 'Beside the waves'], ['পুরোনো গলিতে', 'In a historic lane'], ['পাহাড়ের পথে', 'On a hillside trail']]],
      [['ব্যাগে আগে কী রাখবেন?', 'What goes into your bag first?'], [['পাখি দেখার দূরবীন', 'Binoculars for birdwatching'], ['সমুদ্রপাড়ের বই', 'A book for the beach'], ['গল্প লেখার খাতা', 'A notebook for stories'], ['হাঁটার জুতা', 'Walking shoes']]],
      [['একটি দৃশ্য বেছে নিন', 'Choose a view'], [['জলে গাছের ছায়া', 'Trees reflected in water'], ['দিগন্তে সমুদ্র', 'The sea at the horizon'], ['প্রাচীন খিলান', 'An old stone arch'], ['মেঘে ঢাকা পাহাড়', 'Cloud-covered hills']]],
      [['আপনার পছন্দের বিরতি?', 'Your favourite pause?'], [['গাছের ছায়ায় চা', 'Tea under a tree'], ['সৈকতে সূর্যাস্ত', 'A beach sunset'], ['স্থানীয় ইতিহাসের গল্প', 'A local history story'], ['উঁচু পথের বিশ্রাম', 'A rest on a high trail']]],
      [['ভ্রমণের কোন স্মৃতি রাখবেন?', 'Which memory would you keep?'], [['শান্ত নৌপথ', 'A quiet boat journey'], ['নোনা হাওয়া', 'Salty sea air'], ['নতুন জানা ইতিহাস', 'A piece of history learned'], ['কঠিন পথ পেরোনো', 'Finishing a challenging trail']]],
      [['পরের সফরের গতি কেমন?', 'How should the next trip feel?'], [['প্রকৃতির ছন্দে ধীর', 'Slow, with nature'], ['নির্ভার অবকাশ', 'An easy escape'], ['কৌতূহলে ভরা', 'Full of curiosity'], ['সামান্য রোমাঞ্চ', 'A little adventurous']]]
    ];
    const personalityTypes = [
      { category: 'nature', title: ['সবুজের সঙ্গী', 'Nature companion'], text: ['নীরব পথ, গাছের ছায়া আর জলের গল্প আপনার সফরের অনুপ্রেরণা।', 'Quiet paths, leafy shade and water inspire your journeys.'] },
      { category: 'beach', title: ['ঢেউয়ের পথিক', 'Coastal wanderer'], text: ['খোলা দিগন্ত আর নির্ভার সময়ের দিকে আপনার টান।', 'Open horizons and unhurried time call to you.'] },
      { category: 'heritage', title: ['গল্পের সন্ধানী', 'Story seeker'], text: ['স্থাপত্য, মানুষের গল্প আর অতীতের চিহ্নে আপনি নতুন পথ খুঁজে পান।', 'Architecture, people’s stories and traces of the past spark your curiosity.'] },
      { category: 'adventure', title: ['পাহাড়ের অভিযাত্রী', 'Hill explorer'], text: ['পথের বাঁক আর একটু নতুন চ্যালেঞ্জ আপনার সফরকে প্রাণ দেয়।', 'A winding trail and a fresh challenge bring your journeys to life.'] }
    ];
    let active = null, game = null, timer = null;
    const rawRecords = storage.get('gamesRecords', {});
    const records = rawRecords && typeof rawRecords === 'object' && !Array.isArray(rawRecords) ? rawRecords : {};
    const validNumber = value => Number.isFinite(Number(value)) && Number(value) >= 0;
    Object.keys(records).forEach(key => { if (!validNumber(records[key])) delete records[key]; });
    const choose = pair => tr(pair[0], pair[1]);
    const name = id => districtName(districtById.get(id));
    const seconds = () => game ? Math.floor((Date.now() - game.startedAt) / 1000) : 0;
    const clock = value => bn(String(Math.floor(value / 60)).padStart(2, '0')) + ':' + bn(String(value % 60).padStart(2, '0'));
    const sorted = () => [...districts].sort((a, b) => districtName(a).localeCompare(districtName(b), global.DESH_I18N?.lang || 'bn'));
    const optionList = selected => `<option value="">${tr('জেলা বেছে নিন', 'Choose a district')}</option>` + sorted().map(d => `<option value="${d.id}"${d.id === selected ? ' selected' : ''}>${esc(districtName(d))}</option>`).join('');
    const action = (id, label, primary = false, extra = '') => `<button type="button" class="dp-game-button${primary ? ' dp-game-button-primary' : ''}" data-game-action="${id}" ${extra}>${label}</button>`;
    function remember(key, score, lowerIsBetter = false) {
      if (!validNumber(score)) return;
      const previous = records[key];
      records[key] = previous === undefined ? score : (lowerIsBetter ? Math.min(Number(previous), score) : Math.max(Number(previous), score));
      storage.set('gamesRecords', records);
      global.dispatchEvent(new CustomEvent('deshpath:gameschange', {detail:{records:{...records}}}));
      global.DESH_ACTIVITY?.record('game_completed',{game:active});
    }
    function mapMarkup(mode, classes = {}) {
      const paths = geometry.map(p => `<path d="${p.d}" data-game-district="${p.id}" class="dp-game-region ${classes[p.id] || ''}"><title>${esc(name(p.id))}</title></path>`).join('');
      const labels = mode === 'puzzle' && game?.difficulty === 'easy' ? game.targets.map(id => { const p = geometryById.get(id); return `<text x="${p.label[0]}" y="${p.label[1]}" class="dp-game-map-label">${esc(name(id))}</text>`; }).join('') : '';
      const origin = mode === 'farthest' ? geometryById.get(game.rounds[game.index].origin.id) : null;
      return `<svg class="dp-game-map" viewBox="${global.DESH_MAP.viewBox}" aria-label="${tr('জেলা বাছাইয়ের মানচিত্র; নিচের তালিকা দিয়েও বাছাই করা যায়', 'District selection map; the list below offers the same choices')}" role="img">${paths}${labels}${origin ? `<circle cx="${origin.label[0]}" cy="${origin.label[1]}" r="7" class="dp-game-origin"/>` : ''}</svg>`;
    }
    function knowledgePool() {
      const pool = [];
      // Sundarbans spans several districts, so it is intentionally excluded from single-district questions.
      places.filter(p => p.id !== 'sundarbans' && districtById.has(p.district)).forEach(p => {
        const choices = shuffle([p.district, ...shuffle(districts.filter(d => d.id !== p.district)).slice(0, 3).map(d => d.id)]);
        pool.push({ id: 'place-' + p.id, question: () => tr(placeText(p, 'name') + ' কোন জেলায়?', 'Which district is home to ' + placeText(p, 'name') + '?'), choices, correct: p.district, label: name, fact: () => tr(placeText(p, 'name') + ' ' + name(p.district) + ' জেলায় অবস্থিত।', placeText(p, 'name') + ' is in ' + name(p.district) + ' district.') });
      });
      districts.forEach(d => {
        if (!divisions.some(v => v.id === d.division)) return;
        const choices = shuffle([d.division, ...shuffle(divisions.filter(v => v.id !== d.division)).slice(0, 3).map(v => v.id)]);
        const divisionLabel = id => { const v = divisions.find(item => item.id === id); return tr(v.name, v.id); };
        pool.push({ id: 'division-' + d.id, question: () => tr(districtName(d) + ' জেলা কোন বিভাগে?', 'Which division contains ' + districtName(d) + ' district?'), choices, correct: d.division, label: divisionLabel, fact: () => tr(districtName(d) + ' জেলা ' + divisionLabel(d.division) + ' বিভাগে।', districtName(d) + ' district belongs to ' + divisionLabel(d.division) + ' Division.') });
      });
      return pool.filter(q => q.choices.length === 4 && new Set(q.choices).size === 4 && q.choices.includes(q.correct));
    }
    function start(id, difficulty = 'easy') {
      if (!catalog.some(item => item.id === id)) return;
      clearInterval(timer); timer = null; active = id;
      game = { index: 0, score: 0, answer: null, done: false, feedback: '', startedAt: Date.now() };
      if (id === 'puzzle') {
        const counts = { easy: 6, medium: 12, hard: 20 };
        game.difficulty = Object.hasOwn(counts, difficulty) ? difficulty : 'easy';
        game.targets = shuffle(districts).slice(0, counts[game.difficulty]).map(d => d.id);
        game.placed = []; game.mistakes = 0; game.selected = '';
        timer = setInterval(() => { const node = root.querySelector('[data-game-clock]'); if (node && active === 'puzzle' && !game.done) node.textContent = clock(seconds()); }, 1000);
      } else if (id === 'photo') {
        game.rounds = shuffle(places.filter(p => p.id !== 'sundarbans' && districtById.has(p.district))).slice(0, 5);
        game.selected = ''; game.results = [];
      } else if (id === 'farthest') {
        game.rounds = shuffle(districts).slice(0, 5).map(origin => {
          const choices = shuffle(districts.filter(d => d.id !== origin.id)).slice(0, 4);
          const correct = [...choices].sort((a, b) => distanceKm(origin, b) - distanceKm(origin, a))[0].id;
          return { origin, choices, correct };
        });
      } else if (id === 'knowledge') { game.rounds = shuffle(knowledgePool()).slice(0, 5); }
      else if (id === 'personality') { game.scores = [0, 0, 0, 0]; game.answers = []; }
      global.DESH_ACTIVITY?.record('game_started',{game:id});
      render(true);
    }
    function hubMarkup() {
      return `<div class="dp-games-heading"><div><div class="eyebrow">${tr('খেলতে খেলতে দেশ চেনা', 'Find your bearings, one game at a time')}</div><h2>${tr('পথের খেলার ঘর', 'The discovery playground')}</h2></div><p>${tr('অল্প বিরতিতে একটু কৌতূহল। নিজের দেশকে নতুন করে চিনুন পাঁচ রকম খেলায়।', 'A little curiosity for your next break. Get to know Bangladesh through five different games.')}</p></div><div class="dp-game-catalog">${catalog.map(item => `<button type="button" data-game-mode="${item.id}" class="dp-game-card${active === item.id ? ' is-active' : ''}" aria-pressed="${active === item.id}"><span class="dp-game-card-top"><span>${icon(item.icon)}</span><small>${item.n}</small></span><span class="dp-game-tag">${choose(item.tag)}</span><strong>${choose(item.name)}</strong><span class="dp-game-card-copy">${choose(item.detail)}</span><span class="dp-game-card-bottom">${tr('খেলা শুরু', 'Play now')} ${icon('arrow-up-right')}</span></button>`).join('')}</div>`;
    }
    function playHeader() {
      const item = catalog.find(item => item.id === active);
      return `<div class="dp-game-play-header"><div><span class="dp-game-tag">${choose(item.tag)}</span><h3 tabindex="-1" data-game-heading>${choose(item.name)}</h3></div>${action('restart', tr('নতুন রাউন্ড', 'New round'))}</div>`;
    }
    const progressMarkup = count => `<div class="dp-game-progress" aria-label="${tr('অগ্রগতি', 'Progress')}">${Array.from({ length: count }, (_, i) => `<span class="${i < game.index ? 'is-complete' : ''}${i === game.index ? ' is-current' : ''}"></span>`).join('')}</div>`;
    function resultMarkup() {
      let result;
      if (active === 'personality') {
        const top = Math.max(...game.scores), typeIndex = game.answers.find(index => game.scores[index] === top) ?? 0, type = personalityTypes[typeIndex];
        const suggestions = places.filter(p => p.category === type.category).slice(0, 3);
        result = `<span class="dp-game-result-icon">${icon('compass')}</span><div class="dp-game-tag">${tr('আপনার আজকের ভ্রমণের ছন্দ', 'Your travel rhythm today')}</div><h4>${choose(type.title)}</h4><p>${choose(type.text)}</p><div class="dp-game-suggestions">${suggestions.map(p => `<a href="#explore" data-place="${p.id}"><img src="${p.image}" alt="${esc(placeText(p, 'name'))}" width="150" height="100" loading="lazy"><strong>${esc(placeText(p, 'name'))}</strong></a>`).join('')}</div><p class="dp-game-small">${tr('শুধুই মজার অনুপ্রেরণা—এটি বৈজ্ঞানিক ব্যক্তিত্ব মূল্যায়ন নয়। আপনার বাছাই বদলালে ফলও বদলাতে পারে।', 'Just for inspiration, not a scientific personality assessment. Different choices can give a different result.')}</p>`;
      } else if (active === 'puzzle') {
        result = `<div class="dp-game-tag">${tr('সব জেলা ঠিক জায়গায়!', 'Every district in its place!')}</div><strong class="dp-game-result-number">${clock(game.elapsed)}</strong><h4>${bn(game.targets.length)} ${tr('টি জেলা সাজানো হয়েছে', 'districts placed')}</h4><p>${tr('ভুল চেষ্টা', 'Incorrect attempts')}: ${bn(game.mistakes)} · ${tr('নিজের সেরা সময়', 'Personal best time')}: ${clock(Number(records['puzzle-' + game.difficulty]))}</p>`;
      } else {
        const max = active === 'photo' ? 5000 : 5;
        result = `<div class="dp-game-tag">${tr('রাউন্ড শেষ', 'Round complete')}</div><strong class="dp-game-result-number">${bn(game.score)}<small> / ${bn(max)}</small></strong><h4>${tr('আরেকটি পথ চেনা হলো', 'Another route discovered')}</h4><p>${tr('এই ব্রাউজারে আপনার সেরা ফল', 'Your best result in this browser')}: ${bn(records[active] || 0)} / ${bn(max)}</p>`;
      }
      return `<div class="dp-game-result" role="status" tabindex="-1" data-game-feedback>${result}${action('restart', tr('আবার খেলি', 'Play again'), true)}</div>`;
    }
    function puzzleMarkup() {
      const target = game.targets[game.placed.length], d = districtById.get(target), classes = {};
      geometry.forEach(p => { classes[p.id] = game.placed.includes(p.id) ? 'is-correct' : ''; });
      const division = divisions.find(v => v.id === d.division);
      return `<div class="dp-game-toolbar"><label>${tr('খেলার স্তর', 'Difficulty')}<select data-game-difficulty>${[['easy', tr('সহজ · ৬ জেলা', 'Easy · 6 districts')], ['medium', tr('মাঝারি · ১২ জেলা', 'Medium · 12 districts')], ['hard', tr('কঠিন · ২০ জেলা', 'Hard · 20 districts')]].map(([id, label]) => `<option value="${id}"${game.difficulty === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><span class="dp-game-metric">${icon('clock')} <strong data-game-clock>${clock(seconds())}</strong></span><span class="dp-game-metric">${bn(game.placed.length)} / ${bn(game.targets.length)}</span></div><div class="dp-game-two-columns"><div class="dp-game-map-frame">${mapMarkup('puzzle', classes)}</div><div class="dp-game-instructions"><span class="dp-game-tag">${tr('এবার বসান', 'Place this district')}</span><strong class="dp-game-piece" draggable="true" data-game-piece="${target}">${esc(name(target))} ${icon('map-pin')}</strong><p>${tr('নামটি টেনে সঠিক সীমানায় ছাড়ুন, অথবা ম্যাপে সেই জেলায় চাপ দিন।', 'Drag the name onto its boundary, or tap that district on the map.')}</p>${game.difficulty !== 'hard' ? `<p class="dp-game-hint">${tr('ইঙ্গিত', 'Hint')}: ${tr(division.name, division.id)} ${tr('বিভাগ', 'Division')}</p>` : ''}<div class="dp-game-accessible-choice"><label for="dpPuzzleDistrict">${tr('তালিকা দিয়েও উত্তর দিতে পারেন', 'Or answer using the list')}</label><select id="dpPuzzleDistrict" data-game-select>${optionList('')}</select>${action('puzzle-submit', tr('এই জেলায় বসান', 'Place here'), true)}</div><p class="dp-game-feedback${game.feedback ? ' is-visible' : ''}" role="status" data-game-feedback>${esc(game.feedback)}</p><p class="dp-game-small">${tr('সব সীমানা আঁকা আছে। সহজ স্তরে বাছাই করা জেলার নামও দেখা যায়। সময় শুধু এই রাউন্ডের জন্য; স্তর বদলালে নতুন রাউন্ড শুরু হবে।', 'All boundaries are shown. Easy mode also labels the target districts. The timer runs for this round; changing difficulty starts a new round.')}</p></div></div>`;
    }
    function photoMarkup() {
      const p = game.rounds[game.index], answered = game.answer !== null, correct = p.district, classes = {};
      if (game.selected) classes[game.selected] = 'is-selected';
      if (answered) { classes[correct] = 'is-correct'; if (game.answer !== correct) classes[game.answer] = 'is-wrong'; }
      const km = answered ? distanceKm(districtById.get(game.answer), districtById.get(correct)) : 0;
      return `${progressMarkup(game.rounds.length)}<div class="dp-game-round-meta">${tr('ছবি', 'Photograph')} ${bn(game.index + 1)} / ${bn(game.rounds.length)} <span>${bn(game.score)} ${tr('পয়েন্ট', 'points')}</span></div><div class="dp-game-photo-layout"><div><img class="dp-game-photo" src="${p.image}" alt="${tr('কোন জেলার ছবি? রাউন্ড', 'Which district is this? Round')} ${bn(game.index + 1)}" width="960" height="650"><p class="dp-game-small">${tr('সাইটে ব্যবহৃত আসল স্থানের ছবি। ছবির উৎস ও লাইসেন্স ফুটারের কৃতজ্ঞতা অংশে আছে।', 'A real destination photograph. Sources and licences are listed in the footer credits.')}</p></div><div><div class="dp-game-mini-map">${mapMarkup('photo', classes)}</div><label for="dpPhotoDistrict">${tr('এটি কোন জেলায়?', 'Which district is this in?')}</label><select id="dpPhotoDistrict" data-game-select${answered ? ' disabled' : ''}>${optionList(game.selected)}</select>${answered ? `<div class="dp-game-feedback is-visible" role="status" tabindex="-1" data-game-feedback><strong>${esc(placeText(p, 'name'))} · ${esc(name(correct))}</strong><p>${game.answer === correct ? tr('একদম ঠিক জেলা!', 'Exactly the right district!') : tr('আপনার বাছাই', 'Your choice') + ': ' + esc(name(game.answer)) + ' · ' + tr('আনুমানিক ব্যবধান', 'Approximate separation') + ': ' + bn(Math.round(km)) + ' ' + tr('কিমি', 'km')}</p><p>+${bn(game.results[game.index])} ${tr('পয়েন্ট', 'points')}</p></div>${action('next', game.index === game.rounds.length - 1 ? tr('ফলাফল', 'See result') : tr('পরের ছবি', 'Next photograph'), true)}` : action('photo-submit', tr('অনুমান জমা দিন', 'Submit guess'), true)}<p class="dp-game-small">${tr('দূরত্ব দুই জেলার আনুমানিক কেন্দ্রের সরলরেখার ব্যবধান; ছবির নির্দিষ্ট স্থান বা সড়কদূরত্ব নয়। সঠিক জেলায় ১০০০; অন্যথায় ৬৫০ কিমি পর্যন্ত দূরত্ব বাড়লে পয়েন্ট কমে।', 'Distance is the straight-line separation of approximate district centres, not the photo’s exact coordinates or a road distance. A matching district earns 1,000 points; otherwise points fall with distance up to 650 km.')}</p></div></div>`;
    }
    function questionMarkup() {
      const q = game.rounds[game.index], answered = game.answer !== null, far = active === 'farthest';
      const correct = q.correct;
      const heading = far ? tr(name(q.origin.id) + ' থেকে এই চারটির মধ্যে সবচেয়ে দূরের জেলা কোনটি?', 'Which of these four districts is farthest from ' + name(q.origin.id) + '?') : q.question();
      const choices = far ? q.choices.map(d => d.id) : q.choices;
      const label = far ? name : q.label;
      const explanation = far ? tr('জেলার আনুমানিক কেন্দ্র ধরে সরলরেখার দূরত্ব:', 'Straight-line distances between approximate district centres:') + ' ' + q.choices.map(d => esc(name(d.id)) + ' ' + bn(Math.round(distanceKm(q.origin, d))) + ' ' + tr('কিমি', 'km')).join(' · ') : esc(q.fact());
      return `${progressMarkup(game.rounds.length)}<div class="dp-game-round-meta">${tr('প্রশ্ন', 'Question')} ${bn(game.index + 1)} / ${bn(game.rounds.length)}<span>${bn(game.score)} / ${bn(game.rounds.length)}</span></div>${far ? `<div class="dp-game-origin-label">${icon('map-pin')} ${tr('যাত্রা শুরু', 'Starting point')}: <strong>${esc(name(q.origin.id))}</strong></div>` : ''}<h4 class="dp-game-question">${esc(heading)}</h4><div class="dp-game-answers">${choices.map((id, i) => `<button type="button" class="dp-game-answer${answered && id === correct ? ' is-correct' : ''}${answered && id === game.answer && id !== correct ? ' is-wrong' : ''}" data-game-answer="${id}"${answered ? ' disabled' : ''}><span>${bn(i + 1)}</span>${esc(label(id))}${answered && id === correct ? icon('check') : ''}</button>`).join('')}</div>${answered ? `<div class="dp-game-feedback is-visible" role="status" tabindex="-1" data-game-feedback><strong>${game.answer === correct ? tr('ঠিক ধরেছেন!', 'You got it!') : tr('জেনে নিলাম!', 'A new discovery!')} ${tr('সঠিক উত্তর:', 'Correct answer:')} ${esc(label(correct))}</strong><p>${explanation}</p></div>${action('next', game.index === game.rounds.length - 1 ? tr('ফলাফল', 'See result') : tr('পরের প্রশ্ন', 'Next question'), true)}` : ''}<p class="dp-game-small">${far ? tr('এটি বাছাই করা চারটি বিকল্পের তুলনা। সড়কপথের দৈর্ঘ্য বা যাত্রার সময় নয়।', 'This compares the four offered choices, not road lengths or journey times.') : tr('অ্যাপের গন্তব্য ও জেলা–বিভাগের তথ্য থেকে তৈরি ' + bn(knowledgePool().length) + 'টি প্রশ্নের সংগ্রহ; প্রতি রাউন্ডে আলাদা বাছাই।', 'A pool of ' + knowledgePool().length + ' questions from the app’s destination and district–division data, shuffled each round.')}</p>`;
    }
    function personalityMarkup() {
      const q = personalityQuestions[game.index];
      return `${progressMarkup(personalityQuestions.length)}<div class="dp-game-round-meta">${tr('বাছাই', 'Choice')} ${bn(game.index + 1)} / ${bn(personalityQuestions.length)}</div><h4 class="dp-game-question">${choose(q[0])}</h4><div class="dp-game-answers">${q[1].map((answer, i) => `<button type="button" class="dp-game-answer" data-game-personality="${i}"><span>${icon(['leaf', 'waves', 'landmark', 'mountain'][i])}</span>${choose(answer)}</button>`).join('')}</div><p class="dp-game-small">${tr('সঠিক বা ভুল নেই। আজ আপনার মন যেদিকে যেতে চায়, সেটিই বেছে নিন।', 'There are no right or wrong answers. Choose what feels right today.')}</p>`;
    }
    function recordsMarkup() {
      const available = catalog.filter(item => item.id !== 'personality' && (item.id === 'puzzle' ? ['easy', 'medium', 'hard'].some(level => records['puzzle-' + level] !== undefined) : records[item.id] !== undefined));
      return `<details class="dp-game-records"><summary>${tr('আমার খেলার খাতা', 'My game journal')} <span>${tr('শুধু এই ব্রাউজারে', 'Only in this browser')}</span></summary><p class="dp-game-small">${tr('এটি আপনার ব্যক্তিগত সেরা ফল। কোনো অনলাইন র‍্যাঙ্কিং বা অন্য খেলোয়াড়ের তালিকা নয়।', 'These are your personal best results, not an online ranking or a list of other players.')}</p>${available.length ? `<ul>${available.map(item => `<li><strong>${choose(item.name)}</strong><span>${item.id === 'puzzle' ? ['easy', 'medium', 'hard'].filter(level => records['puzzle-' + level] !== undefined).map(level => ({ easy: tr('সহজ', 'Easy'), medium: tr('মাঝারি', 'Medium'), hard: tr('কঠিন', 'Hard') })[level] + ': ' + clock(Number(records['puzzle-' + level]))).join(' · ') : bn(records[item.id]) + ' / ' + bn(item.id === 'photo' ? 5000 : 5)}</span></li>`).join('')}</ul>` : `<p>${tr('একটি রাউন্ড শেষ করলে আপনার সেরা ফল এখানে দেখা যাবে।', 'Finish a round to see your personal best here.')}</p>`}</details>`;
    }
    function render(focus = false, feedback = false) {
      root.innerHTML = `${hubMarkup()}${active ? `<div class="dp-game-play" id="dpGamePlay">${playHeader()}${game.done ? resultMarkup() : active === 'puzzle' ? puzzleMarkup() : active === 'photo' ? photoMarkup() : active === 'personality' ? personalityMarkup() : questionMarkup()}</div>` : `<div class="dp-game-welcome">${icon('compass')}<p>${tr('একটি খেলা বেছে নিয়ে শুরু করুন। ফল ও অগ্রগতি আপনার এই ব্রাউজারেই থাকে।', 'Choose a game to begin. Results stay in this browser.')}</p></div>`}${recordsMarkup()}`;
      if (focus) root.querySelector(feedback ? '[data-game-feedback]' : '[data-game-heading]')?.focus({ preventScroll: false });
    }
    function placePuzzle(id) {
      if (active !== 'puzzle' || game.done || !districtById.has(id)) return;
      global.DESH_ACTIVITY?.record('game_activity',{game:active});
      const target = game.targets[game.placed.length];
      if (id === target) {
        game.placed.push(target);
        game.feedback = tr(name(target) + ' ঠিক জায়গায় বসেছে!', name(target) + ' is in the right place!');
        if (game.placed.length === game.targets.length) {
          game.done = true; game.elapsed = seconds(); clearInterval(timer); timer = null; remember('puzzle-' + game.difficulty, game.elapsed, true);
        }
      } else { game.mistakes++; game.feedback = tr('এটি ' + name(id) + '। আবার চেষ্টা করুন।', 'That is ' + name(id) + '. Try again.'); }
      game.selected = ''; render(true, game.done);
    }
    function answerQuestion(id) {
      if (!['farthest', 'knowledge'].includes(active) || game.done || game.answer !== null) return;
      const q = game.rounds[game.index], choices = active === 'farthest' ? q.choices.map(d => d.id) : q.choices;
      if (!choices.includes(id)) return;
      global.DESH_ACTIVITY?.record('game_activity',{game:active});
      game.answer = id; if (id === q.correct) game.score++;
      render(true, true);
    }
    root.addEventListener('click', event => {
      const mode = event.target.closest('[data-game-mode]'); if (mode) { start(mode.dataset.gameMode); return; }
      const region = event.target.closest('[data-game-district]');
      if (region && !game?.done) {
        if (active === 'puzzle') placePuzzle(region.dataset.gameDistrict);
        else if (active === 'photo' && game.answer === null) { game.selected = region.dataset.gameDistrict; render(); root.querySelector('#dpPhotoDistrict')?.focus({ preventScroll: true }); }
        return;
      }
      const choice = event.target.closest('[data-game-answer]'); if (choice) { answerQuestion(choice.dataset.gameAnswer); return; }
      const personality = event.target.closest('[data-game-personality]');
      if (personality && active === 'personality' && !game.done) {
        const index = Number(personality.dataset.gamePersonality); if (!Number.isInteger(index) || index < 0 || index > 3) return;
        game.scores[index]++; game.answers.push(index); game.index++;
        global.DESH_ACTIVITY?.record('game_activity',{game:active});
        if (game.index === personalityQuestions.length) { game.done = true; global.DESH_ACTIVITY?.record('game_completed',{game:active}); }
        render(true, game.done); return;
      }
      const control = event.target.closest('[data-game-action]'); if (!control || !active) return;
      const cmd = control.dataset.gameAction;
      if (cmd === 'restart') { start(active, game.difficulty); return; }
      if (cmd === 'puzzle-submit') { const id = root.querySelector('[data-game-select]').value; if (id) placePuzzle(id); else helpers.toast(tr('আগে একটি জেলা বেছে নিন।', 'Choose a district first.')); return; }
      if (cmd === 'photo-submit' && active === 'photo' && !game.done && game.answer === null) {
        const selected = root.querySelector('[data-game-select]').value; if (!districtById.has(selected)) { helpers.toast(tr('ম্যাপ বা তালিকা থেকে জেলা বেছে নিন।', 'Choose a district on the map or in the list.')); return; }
        game.selected = selected; game.answer = selected;
        global.DESH_ACTIVITY?.record('game_activity',{game:active});
        const correct = game.rounds[game.index].district, points = selected === correct ? 1000 : photoScore(distanceKm(districtById.get(selected), districtById.get(correct)));
        game.results.push(points); game.score += points; render(true, true); return;
      }
      if (cmd === 'next' && ['photo', 'knowledge', 'farthest'].includes(active) && !game.done && game.answer !== null) {
        game.index++; game.answer = null; game.selected = '';
        if (game.index === game.rounds.length) { game.done = true; remember(active, game.score); }
        render(true, game.done);
      }
    });
    root.addEventListener('change', event => {
      if (event.target.matches('[data-game-difficulty]') && active === 'puzzle') start('puzzle', event.target.value);
      if (event.target.matches('[data-game-select]') && active === 'photo' && game.answer === null) game.selected = event.target.value;
    });
    root.addEventListener('dragstart', event => {
      const piece = event.target.closest('[data-game-piece]'); if (!piece || active !== 'puzzle' || game.done) return;
      event.dataTransfer.setData('application/x-deshpath-district', piece.dataset.gamePiece); event.dataTransfer.effectAllowed = 'move';
    });
    root.addEventListener('dragover', event => { if (active === 'puzzle' && !game.done && event.target.closest('[data-game-district]')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
    root.addEventListener('drop', event => {
      const region = event.target.closest('[data-game-district]'); if (!region || active !== 'puzzle' || game.done) return;
      event.preventDefault(); if (event.dataTransfer.getData('application/x-deshpath-district') !== game.targets[game.placed.length]) return;
      placePuzzle(region.dataset.gameDistrict);
    });
    render();
    return { refreshLanguage: () => render(), getSnapshot: () => ({ available: true, active, index: game?.index ?? 0, done: game?.done ?? false, score: game?.score ?? 0, questionPoolSize: knowledgePool().length, records: { ...records } }) };
  };
})(typeof window !== 'undefined' ? window : globalThis);
