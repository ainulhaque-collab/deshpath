'use strict';

// Trip planning stays on this device; no form values are sent to a server.
window.initDeshPlanner = function initDeshPlanner(helpers) {
  const { $, $$, esc, bn, money, icon, storage, districts, places, divisions,
    districtById, districtFoods, tr, districtName, divisionName, placeText,
    foodText, toast = () => {} } = helpers;
  const form = $('#plannerForm');
  const originDivision = $('#originDivision');
  const origin = $('#origin');
  const destinationDivision = $('#destinationDivision');
  const destination = $('#destination');
  const result = $('#planResult');
  const numericIds = ['days', 'travelers', 'budget'];
  const divisionIds = new Set(divisions.map(d => d.id));
  const saved = storage.get('trip', null);
  const draft = saved && typeof saved === 'object' ? saved : {};
  let tripIds = [...new Set((Array.isArray(draft.destinations) ? draft.destinations : [])
    .filter(id => districtById.has(id)))].slice(0, 7);
  let hasGeneratedPlan = false;

  const numberValue = id => {
    const input = $('#' + id);
    if (!input.value.trim()) return null;
    const value = Number(input.value);
    return Number.isFinite(value) && Number.isInteger(value) && value >= Number(input.min)
      && value <= Number(input.max) ? value : null;
  };
  const districtList = division => districts.filter(d => d.division === division)
    .sort((a, b) => districtName(a).localeCompare(districtName(b), tr('bn', 'en')));
  const option = (value, label, disabled = false) => `<option value="${esc(value)}"${disabled ? ' disabled' : ''}>${esc(label)}</option>`;
  const currentTrip = () => ({
    originDivision: originDivision.value,
    origin: origin.value,
    destinationDivision: destinationDivision.value,
    destination: destination.value,
    destinations: [...tripIds],
    days: numberValue('days'),
    travelers: numberValue('travelers'),
    budget: numberValue('budget')
  });

  function renderEmpty() {
    result.innerHTML = `<div class="plan-empty"><span class="plan-illustration">${icon('route')}</span>
      <span class="eyebrow">${tr('একটু পরিকল্পনায়, অনেকটা নিশ্চিন্ত', 'A little planning, a lot of peace of mind')}</span>
      <h3>${tr('দারুণ একটা সফরের শুরু এখানেই', 'A wonderful journey starts here')}</h3>
      <p>${tr('পাশের ফর্মে আপনার গন্তব্যগুলো যোগ করুন।', 'Add your destinations in the form.')}<br>
      ${tr('দিনভিত্তিক ঘোরার ধারণা ও বাজেটের ভাগ এখানে দেখাবে।', 'Your daily itinerary and budget breakdown will appear here.')}</p>
      <div class="empty-plan-steps"><span>${tr('গন্তব্য বাছাই', 'Choose places')}</span><i>→</i>
      <span>${tr('প্ল্যান তৈরি', 'Make a plan')}</span><i>→</i><span>${tr('পথে নামা', 'Set off')}</span></div></div>`;
  }

  function saveTrip() {
    storage.set('trip', currentTrip());
    storage.set('planGenerated', false);
    hasGeneratedPlan = false;
    renderEmpty();
  }

  function updateAddButton() {
    $('#addDestination').disabled = !destination.value || tripIds.length >= 7;
    $('#addDestination').setAttribute('aria-label', tr('গন্তব্য যোগ করুন', 'Add destination'));
  }

  function renderDestinationOptions(value = destination.value) {
    const division = destinationDivision.value;
    destination.disabled = !divisionIds.has(division);
    destination.innerHTML = option('', division ? tr('জেলা বেছে নিন', 'Choose a district') : tr('আগে বিভাগ বেছে নিন', 'Choose a division first'))
      + districtList(division).map(d => option(d.id, districtName(d), d.id === origin.value || tripIds.includes(d.id))).join('');
    const selectable = districtById.get(value);
    destination.value = selectable && selectable.division === division && value !== origin.value && !tripIds.includes(value) ? value : '';
    updateAddButton();
  }

  function renderOriginOptions(value = origin.value) {
    const division = originDivision.value;
    origin.disabled = !divisionIds.has(division);
    origin.innerHTML = option('', division ? tr('জেলা বেছে নিন', 'Choose a district') : tr('আগে বিভাগ বেছে নিন', 'Choose a division first'))
      + districtList(division).map(d => option(d.id, districtName(d))).join('');
    origin.value = districtById.get(value)?.division === division ? value : '';
  }

  function renderDivisionOptions(select, value = select.value) {
    select.innerHTML = option('', tr('বিভাগ বেছে নিন', 'Choose a division'))
      + divisions.map(d => option(d.id, divisionName(d))).join('');
    select.value = divisionIds.has(value) ? value : '';
  }

  function renderTripChips() {
    $('#tripChips').innerHTML = tripIds.length ? tripIds.map(id => {
      const name = districtName(districtById.get(id));
      return `<span class="trip-chip">${esc(name)}<button type="button" data-remove-trip="${id}" aria-label="${esc(tr(name + ' ট্রিপ থেকে সরান', 'Remove ' + name + ' from trip'))}">${icon('x')}</button></span>`;
    }).join('') : `<span class="trip-chips-hint">${tr('সর্বোচ্চ ৭টি জেলা যোগ করতে পারেন', 'Add up to 7 districts, across any divisions')}</span>`;
    renderDestinationOptions();
  }

  function addTrip(id) {
    if (!districtById.has(id)) {
      toast(tr('আগে একটি গন্তব্য জেলা বেছে নিন।', 'Choose a destination district first.'));
      (destination.disabled ? destinationDivision : destination).focus();
      return false;
    }
    if (id === origin.value) {
      toast(tr('যাত্রার শুরুর জেলা ও গন্তব্য আলাদা রাখুন।', 'Choose a destination different from your starting district.'));
      return false;
    }
    if (tripIds.includes(id)) {
      toast(tr('এই জেলা ট্রিপে আগে থেকেই আছে।', 'This district is already in your trip.'));
      return true;
    }
    if (tripIds.length >= 7) {
      toast(tr('এক ট্রিপে সর্বোচ্চ ৭টি জেলা যোগ করতে পারেন।', 'You can add up to 7 districts to one trip.'));
      return false;
    }
    tripIds.push(id);
    destination.value = '';
    saveTrip();
    renderTripChips();
    return true;
  }

  function feedback(input, message, announce) {
    if (announce) {
      toast(message);
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    return false;
  }

  function validate(announce = true) {
    [originDivision, origin, ...numericIds.map(id => $('#' + id))].forEach(input => input.removeAttribute('aria-invalid'));
    if (!divisionIds.has(originDivision.value)) return feedback(originDivision, tr('যাত্রা শুরুর বিভাগ বেছে নিন।', 'Choose your starting division.'), announce);
    if (!districtById.has(origin.value) || districtById.get(origin.value).division !== originDivision.value) return feedback(origin, tr('যাত্রা শুরুর জেলা বেছে নিন।', 'Choose your starting district.'), announce);
    if (!tripIds.length) return feedback(destination.disabled ? destinationDivision : destination, tr('ট্রিপে অন্তত একটি গন্তব্য জেলা যোগ করুন।', 'Add at least one destination district to your trip.'), announce);
    if (tripIds.includes(origin.value)) return feedback(origin, tr('যাত্রার শুরুর জেলা ও গন্তব্য আলাদা রাখুন।', 'Your starting district must be different from your destinations.'), announce);
    for (const id of numericIds) {
      const input = $('#' + id);
      if (numberValue(id) === null) {
        const message = id === 'days' ? tr('ছুটির দিনের সংখ্যা ১ থেকে ১৪-এর মধ্যে লিখুন।', 'Enter a whole number of days from 1 to 14.')
          : id === 'travelers' ? tr('মোট ভ্রমণকারীর সংখ্যা ১ থেকে ৩০-এর মধ্যে লিখুন।', 'Enter a whole number of travelers from 1 to 30.')
            : tr('মোট বাজেট ১,০০০ থেকে ১,০০,০০,০০০ টাকার মধ্যে লিখুন।', 'Enter a total budget from BDT 1,000 to BDT 10,000,000.');
        return feedback(input, message, announce);
      }
    }
    if (numberValue('days') < tripIds.length) return feedback($('#days'), tr('প্রতি জেলার জন্য অন্তত এক দিন রাখুন, অথবা জেলার সংখ্যা কমান।', 'Allow at least one day per district, or remove a destination.'), announce);
    return true;
  }

  function distance(a, b) {
    const toRadians = value => value * Math.PI / 180;
    const latitude = toRadians(b.lat - a.lat), longitude = toRadians(b.lng - a.lng);
    const angle = Math.sin(latitude / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(longitude / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
  }

  function routeOrder(ids, start) {
    const remaining = [...ids], route = [];
    let current = districtById.get(start);
    while (remaining.length) {
      remaining.sort((a, b) => distance(current, districtById.get(a)) - distance(current, districtById.get(b)));
      const id = remaining.shift();
      route.push(id);
      current = districtById.get(id);
    }
    return route;
  }

  function renderPlan() {
    const trip = currentTrip();
    const route = routeOrder(tripIds, trip.origin);
    const occurrences = new Map();
    const itinerary = Array.from({ length: trip.days }, (_, index) => {
      const routeIndex = Math.min(route.length - 1, Math.floor(index * route.length / trip.days));
      const id = route[routeIndex], district = districtById.get(id);
      const visit = occurrences.get(id) || 0;
      occurrences.set(id, visit + 1);
      // Each attraction is used once, even when a district gets several days.
      const attraction = places.filter(place => place.district === id)[visit];
      const heading = tr(visit ? 'আরেকটু ঘুরে দেখা: ' : 'পথে নামি: ', visit ? 'Explore a little more: ' : 'A day in: ') + districtName(district);
      const body = attraction
        ? tr(placeText(attraction, 'name') + ' ঘিরে দিনটি সাজান। ', 'Plan your day around ' + placeText(attraction, 'name') + '. ') + placeText(attraction, 'description')
        : visit ? tr('ধীরে-সুস্থে স্থানীয় বাজার, সংস্কৃতি ও আশপাশের পথ ঘুরে দেখুন। আগের দিনের একই জায়গা পুনরাবৃত্তি না করে স্থানীয়দের পরামর্শ নিন।', 'Take your time with local markets, culture and nearby walks. Ask local people for a new experience instead of repeating yesterday’s attraction.')
          : tr('শহর ও আশপাশের স্থানীয় আকর্ষণ, খাবার ও সংস্কৃতি আবিষ্কার করুন। স্থানীয়দের পরামর্শ নিয়ে যাতায়াত ঠিক করুন।', 'Discover the town, nearby attractions, food and culture. Ask local people for advice on getting around.');
      return { heading, body, foods: districtFoods(id) };
    });
    const budgetLabels = [[tr('যাতায়াত', 'Transport'), .35], [tr('থাকা', 'Stay'), .30], [tr('খাবার', 'Food'), .25], [tr('অন্যান্য', 'Other'), .10]];
    result.innerHTML = `<div class="plan-ready"><div class="plan-heading"><div><div class="eyebrow">${tr('আপনার ভ্রমণের খসড়া', 'Your travel draft')}</div>
      <h3>${tr(bn(trip.days) + ' দিনের একটু ছুটি', 'A ' + bn(trip.days) + '-day getaway')}</h3></div>
      <button type="button" class="plan-print" id="printPlan">${icon('print')} ${tr('প্রিন্ট / PDF', 'Print / PDF')}</button></div>
      <div class="plan-meta"><span>${icon('calendar')} ${bn(trip.days)} ${tr('দিন', 'days')}</span>
      <span>${icon('users')} ${bn(trip.travelers)} ${tr('জন', trip.travelers === 1 ? 'traveler' : 'travelers')}</span>
      <span>${bn(route.length)} ${tr('টি জেলা', route.length === 1 ? 'district' : 'districts')}</span></div>
      <div class="plan-route">${icon('map-pin')} ${[trip.origin, ...route].map(id => esc(districtName(districtById.get(id)))).join(' <span aria-hidden="true">→</span> ')}</div>
      <div class="itinerary">${itinerary.map((day, index) => `<div class="itinerary-day"><div class="day-number">${tr('দিন', 'Day')}<b>${bn(index + 1)}</b></div>
      <div class="day-content"><h4>${esc(day.heading)}</h4><p>${esc(day.body)}</p>
      ${day.foods.length ? `<div class="itinerary-food">${icon('utensils')}<span>${tr('জেলার স্বাদ: ', 'Local tastes: ')}${day.foods.map(item => esc(foodText(item, 'name'))).join(' · ')}</span></div>` : ''}</div></div>`).join('')}</div>
      <div class="plan-budget"><div class="plan-budget-heading"><span>${tr('আপনার দেওয়া মোট বাজেট', 'Your total budget')}</span><strong>${money(trip.budget)}</strong></div>
      <div class="budget-parts">${budgetLabels.map(([label, share]) => `<div class="budget-part">${label} · ${bn(Math.round(share * 100))}%<strong>${money(trip.budget * share)}</strong></div>`).join('')}</div></div>
      <p class="plan-limit">${tr('বাজেটের ভাগ একটি প্রস্তাব, প্রকৃত ভাড়া বা বুকিং মূল্য নয়। রুটটি জেলার আনুমানিক অবস্থান অনুযায়ী সাজানো; সড়কপথ ও যাতায়াতের সময় যাচাই করুন। বিশেষত পাহাড়, বন ও দ্বীপে প্রবেশের বর্তমান নিয়ম জেনে নিন।', 'The budget breakdown is a suggestion, not a live fare or booking quote. The route uses approximate district locations; check road routes and travel times. Check current entry rules, especially for hills, forests and islands.')}</p></div>`;
    $('#printPlan').addEventListener('click', () => window.print());
  }

  function generatePlan(announce = true) {
    if (!validate(announce)) return false;
    storage.set('trip', currentTrip());
    storage.set('planGenerated', true);
    hasGeneratedPlan = true;
    renderPlan();
    if (announce) {
      toast(tr('আপনার ট্রিপের খসড়া তৈরি। শুভ ভ্রমণ!', 'Your travel draft is ready. Have a wonderful trip!'));
      if (innerWidth < 681) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  }

  function refreshLanguage() {
    renderDivisionOptions(originDivision);
    renderOriginOptions();
    renderDivisionOptions(destinationDivision);
    renderTripChips();
    $('#days').placeholder = tr('যেমন: ৩', 'e.g. 3');
    $('#travelers').placeholder = tr('যেমন: ২', 'e.g. 2');
    $('#budget').placeholder = tr('যেমন: ১৫০০০', 'e.g. 15000');
    $$('[data-step]', form).forEach(button => {
      const [id, amount] = button.dataset.step.split(':');
      button.setAttribute('aria-label', id === 'days'
        ? Number(amount) > 0 ? tr('এক দিন বাড়ান', 'Add one day') : tr('এক দিন কমান', 'Remove one day')
        : Number(amount) > 0 ? tr('একজন বাড়ান', 'Add one traveler') : tr('একজন কমান', 'Remove one traveler'));
    });
    if (hasGeneratedPlan) renderPlan(); else renderEmpty();
  }

  // These examples are placeholders, never silently submitted as a real trip.
  numericIds.forEach(id => {
    const input = $('#' + id), value = draft[id];
    input.value = value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value))
      && Number(value) >= Number(input.min) && Number(value) <= Number(input.max) ? String(value) : '';
  });
  const savedOrigin = districtById.get(draft.origin);
  renderDivisionOptions(originDivision, savedOrigin?.division || draft.originDivision || '');
  renderOriginOptions(savedOrigin?.id || '');
  tripIds = tripIds.filter(id => id !== origin.value);
  renderDivisionOptions(destinationDivision, draft.destinationDivision || districtById.get(draft.destination)?.division || '');
  renderDestinationOptions(draft.destination || '');
  originDivision.required = true;
  origin.required = true;
  form.noValidate = true;

  originDivision.addEventListener('change', () => {
    renderOriginOptions('');
    renderDestinationOptions();
    saveTrip();
  });
  origin.addEventListener('change', () => {
    tripIds = tripIds.filter(id => id !== origin.value);
    renderTripChips();
    saveTrip();
  });
  destinationDivision.addEventListener('change', () => {
    renderDestinationOptions('');
    saveTrip();
  });
  destination.addEventListener('change', () => {
    updateAddButton();
    saveTrip();
  });
  $('#addDestination').addEventListener('click', () => addTrip(destination.value));
  $('#tripChips').addEventListener('click', event => {
    const button = event.target.closest('[data-remove-trip]');
    if (!button) return;
    tripIds = tripIds.filter(id => id !== button.dataset.removeTrip);
    renderTripChips();
    saveTrip();
  });
  numericIds.forEach(id => $('#' + id).addEventListener('input', () => {
    $('#' + id).removeAttribute('aria-invalid');
    saveTrip();
  }));
  $$('[data-step]', form).forEach(button => button.addEventListener('click', () => {
    const [id, amount] = button.dataset.step.split(':'), input = $('#' + id);
    const previous = numberValue(id), min = Number(input.min), max = Number(input.max);
    input.value = previous === null ? String(min) : String(Math.max(min, Math.min(max, previous + Number(amount))));
    input.removeAttribute('aria-invalid');
    saveTrip();
  }));
  form.addEventListener('submit', event => { event.preventDefault(); generatePlan(); });

  refreshLanguage();
  if (storage.get('planGenerated', false) && tripIds.length) generatePlan(false);
  return { addTrip, refreshLanguage };
};
