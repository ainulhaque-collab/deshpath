/* =========================================================
   দেশপথ · upgrades.js — 5 UI Enhancement Pack
   Runs after all existing scripts (deferred, last).
   Depends on: window.DESH_DATA, window.DESH_I18N,
               window.DESH_FOODS (for food kind tabs)
   ========================================================= */
'use strict';
(() => {
  /* ── helpers ─────────────────────────────────────── */
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr = (bn, en) => {
    try { return window.DESH_I18N?.lang === 'en' ? en : bn; } catch { return bn; }
  };

  /* Wait until DOM is interactive */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ══════════════════════════════════════════════════════
     1. TRAVEL ADVISORY & EMERGENCY BAR
     ══════════════════════════════════════════════════════ */
  function initAdvisoryBar() {
    const STORAGE_KEY = 'deshpath.advisory_dismissed';
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const messages = [
      { bn: '<strong>বর্ষা মৌসুম:</strong> পার্বত্য এলাকায় যাওয়ার আগে সড়ক পরিস্থিতি যাচাই করুন।', en: '<strong>Monsoon season:</strong> Check road conditions before visiting hill areas.' },
      { bn: '<strong>সুন্দরবন:</strong> ডিসেম্বর–ফেব্রুয়ারি ভ্রমণের সেরা সময়। নির্ধারিত গাইড ও অনুমতি নিন।', en: '<strong>Sundarbans:</strong> Dec–Feb is best. Use registered guides and obtain permits.' },
      { bn: '<strong>কক্সবাজার:</strong> সমুদ্রে সাঁতারের আগে লাইফগার্ড পোস্ট চিহ্নিত করুন।', en: '<strong>Cox\'s Bazar:</strong> Identify lifeguard posts before swimming in the sea.' },
    ];
    let msgIndex = 0;

    const bar = document.createElement('div');
    bar.id = 'advisoryBar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', tr('ভ্রমণ পরামর্শ', 'Travel advisory'));
    bar.innerHTML = `
      <div class="container advisory-inner">
        <div class="advisory-ticker">
          <span class="advisory-pulse" aria-hidden="true"></span>
          <span class="advisory-label">${tr('ভ্রমণ পরামর্শ', 'Advisory')}</span>
          <span class="advisory-message" id="advMsg"></span>
        </div>
        <div class="advisory-contacts">
          <a class="advisory-contact-btn" href="tel:999" aria-label="${tr('জাতীয় জরুরি হেল্পলাইন ৯৯৯-এ কল করুন','Call national emergency 999')}">
            🚨 ${tr('জরুরি: ৯৯৯', 'Emergency: 999')}
          </a>
          <span class="advisory-divider" aria-hidden="true"></span>
          <a class="advisory-contact-btn" href="tel:01320100225" aria-label="${tr('পর্যটন পুলিশ হেল্পলাইনে কল করুন','Call Tourist Police helpline')}">
            👮 ${tr('পর্যটন পুলিশ', 'Tourist Police')}
          </a>
        </div>
        <button class="advisory-dismiss" id="advDismiss" aria-label="${tr('বার্তা বন্ধ করুন','Dismiss advisory')}" title="${tr('বন্ধ করুন','Dismiss')}">×</button>
      </div>
    `;

    /* Insert before site-header */
    const header = $('.site-header');
    if (header) header.parentNode.insertBefore(bar, header);
    else document.body.prepend(bar);

    /* Rotate messages */
    const msgEl = $('#advMsg');
    function showMsg() { if (msgEl) msgEl.innerHTML = messages[msgIndex].bn; }
    showMsg();
    const rotateInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      showMsg();
    }, 5000);

    /* Dismiss */
    $('#advDismiss')?.addEventListener('click', () => {
      bar.classList.add('adv-hidden');
      sessionStorage.setItem(STORAGE_KEY, '1');
      clearInterval(rotateInterval);
    });

    /* Language sync */
    try {
      window.DESH_I18N?.onChange(() => {
        if (!msgEl) return;
        const m = messages[msgIndex];
        msgEl.innerHTML = window.DESH_I18N.lang === 'en' ? m.en : m.bn;
      });
    } catch (e) { /* graceful */ }
  }

  /* ══════════════════════════════════════════════════════
     2. HERITAGE CRAFTS & MARKETPLACE
     ══════════════════════════════════════════════════════ */

  /* --- GI Crafts data --- */
  const GI_CRAFTS = [
    { id: 'jamdani', district: 'dhaka', name: 'ঢাকাই জামদানি', nameEn: 'Dhakai Jamdani', giTag: 'GI #01', region: 'ঢাকা', emoji: '🥻', desc: 'ইউনেস্কো স্বীকৃত অনন্য হাতে বোনা মসলিন শাড়ি।', descEn: 'UNESCO-recognised handwoven muslin saree.' },
    { id: 'shataranji', district: 'rangpur', name: 'রংপুর শতরঞ্জি', nameEn: 'Rangpur Shataranji', giTag: 'GI #07', region: 'রংপুর', emoji: '🏮', desc: 'রংপুরের ঐতিহ্যবাহী হাতে বোনা সুতার কার্পেট।', descEn: 'Traditional hand-woven cotton rug of Rangpur.' },
    { id: 'shitalpati', district: 'sylhet', name: 'সিলেটি শীতলপাটি', nameEn: 'Sylheti Shitalpati', giTag: 'GI #04', region: 'সিলেট', emoji: '🌿', desc: 'মুর্তা বেত দিয়ে তৈরি বাতাস শীতল করা মাদুর।', descEn: 'Cool-to-touch mat woven from murta cane.' },
    { id: 'nakshikantha', district: 'jamalpur', name: 'জামালপুর নকশিকাঁথা', nameEn: 'Jamalpur Nakshi Kantha', giTag: 'GI #12', region: 'জামালপুর', emoji: '🪡', desc: 'পুরনো কাপড়ে হাতের সূচিকর্মে তৈরি ঐতিহ্যবাহী কাঁথা।', descEn: 'Traditional embroidered quilt of old cloth.' },
    { id: 'rajshahi-silk', district: 'rajshahi', name: 'রাজশাহী সিল্ক', nameEn: 'Rajshahi Silk', giTag: 'GI #02', region: 'রাজশাহী', emoji: '🎎', desc: 'প্রাকৃতিক সিল্কের রেশম কাপড়ের ঐতিহ্যবাহী কেন্দ্র।', descEn: 'Traditional centre of natural silk weaving.' },
    { id: 'muslin', district: 'dhaka', name: 'বাংলাদেশ মসলিন', nameEn: 'Bangladesh Muslin', giTag: 'GI #03', region: 'ঢাকা', emoji: '🧵', desc: 'পুনরুদ্ধৃত ঐতিহাসিক মসলিন কাপড়ের নতুন উদ্যোগ।', descEn: 'Revived historic fine muslin weaving.' },
  ];

  /* Craft card HTML */
  function craftCardHTML(craft) {
    return `
      <div class="food-card district-food-item craft-item-card" data-craft="${esc(craft.id)}" data-district="${esc(craft.district)}">
        <div style="font-size:32px;margin-bottom:8px">${craft.emoji}</div>
        <div class="craft-meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          <span class="craft-gi-tag">${esc(craft.giTag)}</span>
          <span class="craft-region-tag" style="font-size:9px;color:var(--text-subtle);background:var(--surface-soft);padding:2px 7px;border-radius:100px">${esc(craft.region)}</span>
        </div>
        <strong style="font-size:13px;display:block;margin-bottom:4px">${esc(tr(craft.name, craft.nameEn))}</strong>
        <p style="font-size:11px;color:var(--text-muted);line-height:1.7;margin-bottom:6px">${esc(tr(craft.desc, craft.descEn))}</p>
        <span class="verified-badge">✓ ${tr('যাচাইকৃত স্থানীয় বিশেষত্ব', 'Verified Local Special')}</span>
        <div class="food-card-actions">
          <button class="food-card-btn order-btn" data-craft-order="${esc(craft.id)}" data-craft-name="${esc(tr(craft.name, craft.nameEn))}">
            🛒 ${tr('অর্ডার / প্রি-বুকিং', 'Order / Pre-Book')}
          </button>
          <button class="food-card-btn seller-btn" data-craft-seller="${esc(craft.id)}" data-craft-name="${esc(tr(craft.name, craft.nameEn))}">
            🏪 ${tr('শপ খুলুন', 'Open Shop')}
          </button>
        </div>
      </div>
    `;
  }

  /* Add verified badge + action buttons to existing food cards */
  function upgradeExistingFoodCards() {
    $$('.district-food-item').forEach(card => {
      if (card.querySelector('.verified-badge')) return; /* already done */
      const badge = document.createElement('span');
      badge.className = 'verified-badge';
      badge.innerHTML = `✓ ${tr('যাচাইকৃত স্থানীয় বিশেষত্ব', 'Verified Local Special')}`;
      const actions = document.createElement('div');
      actions.className = 'food-card-actions';
      const itemName = card.querySelector('strong')?.textContent?.trim() || '';
      actions.innerHTML = `
        <button class="food-card-btn order-btn" data-food-order="${esc(itemName)}">
          🛒 ${tr('অর্ডার / প্রি-বুকিং করুন', 'Order / Pre-Book')}
        </button>
        <button class="food-card-btn seller-btn" data-food-seller="${esc(itemName)}">
          🏪 ${tr('আপনার জেলার শপ খুলুন', 'Open Your Shop')}
        </button>
      `;
      card.appendChild(badge);
      card.appendChild(actions);
    });
  }

  /* Kind filter tabs */
  const FOOD_KINDS = [
    { id: 'all', bn: 'সব', en: 'All' },
    { id: 'sweet', bn: '🍮 মিষ্টি', en: '🍮 Sweets' },
    { id: 'dish', bn: '🍛 স্থানীয় পদ', en: '🍛 Local Dishes' },
    { id: 'fish', bn: '🐟 মাছ', en: '🐟 Fish' },
    { id: 'dairy', bn: '🥛 দুগ্ধপণ্য', en: '🥛 Dairy' },
    { id: 'produce', bn: '🌾 ফল/ফসল', en: '🌾 Produce' },
    { id: 'craft', bn: '🧵 হস্তশিল্প', en: '🧵 GI Crafts' },
  ];

  let activeKind = 'all';

  function initFoodKindTabs() {
    const foodSection = $('#districtFoods');
    if (!foodSection) return;

    const toolbar = foodSection.previousElementSibling;
    if (!toolbar) return;

    /* Build tabs row */
    const tabsRow = document.createElement('div');
    tabsRow.className = 'food-kind-tabs';
    tabsRow.setAttribute('role', 'group');
    tabsRow.setAttribute('aria-label', tr('খাবার ও পণ্যের ধরন', 'Food and product type'));
    tabsRow.innerHTML = FOOD_KINDS.map(k =>
      `<button class="food-kind-tab${k.id === activeKind ? ' active' : ''}" data-kind="${k.id}" aria-pressed="${k.id === activeKind}">
        ${tr(k.bn, k.en)}
      </button>`
    ).join('');
    toolbar.insertAdjacentElement('afterend', tabsRow);

    tabsRow.addEventListener('click', e => {
      const btn = e.target.closest('[data-kind]');
      if (!btn) return;
      activeKind = btn.dataset.kind;
      $$('.food-kind-tab', tabsRow).forEach(t => {
        t.classList.toggle('active', t.dataset.kind === activeKind);
        t.setAttribute('aria-pressed', String(t.dataset.kind === activeKind));
      });
      filterFoodCards();
    });

    /* Watch for food grid mutations to apply upgrades */
    const observer = new MutationObserver(() => {
      upgradeExistingFoodCards();
      filterFoodCards();
    });
    observer.observe(foodSection, { childList: true, subtree: true });
  }

  function filterFoodCards() {
    const grid = $('#districtFoods');
    if (!grid) return;

    if (activeKind === 'craft') {
      /* Show GI crafts in the grid */
      const visitedDistricts = getVisitedDistricts();
      const craftsToShow = visitedDistricts.length
        ? GI_CRAFTS.filter(c => visitedDistricts.includes(c.district))
        : GI_CRAFTS;

      if (craftsToShow.length === 0) {
        grid.innerHTML = `<p style="font-size:12px;color:var(--text-subtle);padding:16px 0">${tr('বাছাই করা জেলায় নিবন্ধিত হস্তশিল্প পণ্য নেই।', 'No registered craft products found for selected districts.')}</p>`;
        return;
      }
      grid.innerHTML = craftsToShow.map(craftCardHTML).join('');
      return;
    }

    /* For food kinds, show/hide based on data-kind attr added by food rendering */
    $$('.district-food-item, .craft-item-card', grid).forEach(card => {
      if (card.classList.contains('craft-item-card')) {
        card.style.display = activeKind === 'all' ? '' : 'none';
        return;
      }
      const kind = card.dataset.kind;
      card.style.display = (activeKind === 'all' || kind === activeKind) ? '' : 'none';
    });
  }

  function getVisitedDistricts() {
    try {
      const raw = localStorage.getItem('deshpath.visited');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  /* ── Modals: Order & Seller KYC ─────────────────────── */
  function createModalBackdrop(id) {
    const existing = $(`#${id}`);
    if (existing) return existing;
    const el = document.createElement('div');
    el.id = id;
    el.className = 'upgrade-modal-backdrop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeModal(el); });
    return el;
  }

  function openModal(backdrop, html) {
    backdrop.innerHTML = `<div class="upgrade-modal">${html}</div>`;
    backdrop.classList.add('open');
    backdrop.querySelector('.upgrade-modal-close')?.addEventListener('click', () => closeModal(backdrop));
    backdrop.querySelector('.upgrade-modal')?.focus?.();
  }

  function closeModal(backdrop) {
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.innerHTML = ''; }, 250);
  }

  function buildOrderModalHTML(itemName) {
    return `
      <div class="upgrade-modal-header">
        <h3>🛒 ${tr('অর্ডার ও প্রি-বুকিং', 'Order & Pre-Booking')}</h3>
        <button class="upgrade-modal-close" aria-label="${tr('বন্ধ করুন', 'Close')}">×</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${esc(itemName)} — ${tr('আপনার তথ্য দিন, বিক্রেতা যোগাযোগ করবেন।', 'Enter your details and the seller will contact you.')}</p>
      <div id="orderFormWrap">
        <div class="form-field"><label>${tr('ক্রেতার নাম', 'Buyer Name')} *</label><input id="orderName" placeholder="${tr('আপনার পুরো নাম', 'Your full name')}" required></div>
        <div class="form-field"><label>${tr('পরিমাণ', 'Quantity')} *</label><input id="orderQty" type="number" min="1" placeholder="${tr('কতটি চাই?', 'How many?')}" required></div>
        <div class="form-field"><label>${tr('মোবাইল নম্বর', 'Phone Number')} *</label><input id="orderPhone" type="tel" placeholder="${tr('০১XXXXXXXXX', '01XXXXXXXXX')}" required></div>
        <div class="form-field"><label>${tr('ডেলিভারি ঠিকানা', 'Delivery Address')} *</label><textarea id="orderAddr" placeholder="${tr('জেলা, থানা ও পূর্ণ ঠিকানা লিখুন', 'Include district, thana and full address')}"></textarea></div>
        <button class="modal-submit" id="orderSubmit">${tr('অর্ডার পাঠান', 'Send Order')} ✓</button>
        <p class="form-note">${tr('এটি একটি প্রি-বুকিং অনুরোধ। বিক্রেতা ২৪ ঘণ্টার মধ্যে ফোনে নিশ্চিত করবেন। পেমেন্ট পরে নির্ধারিত হবে।', 'This is a pre-booking request. The seller will confirm by phone within 24 hours. Payment to be agreed separately.')}</p>
      </div>
    `;
  }

  function buildSellerKYCHTML() {
    return `
      <div class="upgrade-modal-header">
        <h3>🏪 ${tr('আপনার জেলার শপ খুলুন', 'Open Your District Shop')}</h3>
        <button class="upgrade-modal-close" aria-label="${tr('বন্ধ করুন', 'Close')}">×</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${tr('স্থানীয় কারিগর ও বিক্রেতারা নিজের পণ্য নথিভুক্ত করতে পারবেন।', 'Local artisans and sellers can register their products.')}</p>
      <div id="sellerFormWrap">
        <div class="form-field"><label>${tr('শপ / প্রতিষ্ঠানের নাম', 'Shop / Business Name')} *</label><input id="sellerShop" placeholder="${tr('যেমন: আনোয়ার হস্তশিল্প', 'e.g. Anwar Handicrafts')}" required></div>
        <div class="form-field"><label>${tr('জেলা', 'District')} *</label>
          <select id="sellerDistrict">
            <option value="">${tr('জেলা বাছুন', 'Select District')}</option>
            ${(window.DESH_DATA?.districts || []).map(d =>
              `<option value="${esc(d.id)}">${esc(d.name)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field"><label>${tr('থানা', 'Thana')} *</label><input id="sellerThana" placeholder="${tr('থানার নাম', 'Thana name')}" required></div>
        <div class="form-field"><label>${tr('মোবাইল নম্বর', 'Phone Number')} *</label><input id="sellerPhone" type="tel" placeholder="${tr('০১XXXXXXXXX', '01XXXXXXXXX')}" required></div>
        <div class="form-field"><label>${tr('পণ্যের বিবরণ', 'Product Description')}</label><textarea id="sellerDesc" placeholder="${tr('কী ধরনের পণ্য তৈরি বা বিক্রি করেন?', 'What type of products do you make/sell?')}"></textarea></div>
        <div class="form-field">
          <label>${tr('NID / দোকানের ছবি (ঐচ্ছিক)', 'NID / Shop Photo (Optional)')}</label>
          <div class="photo-upload-zone" id="sellerPhotoZone" tabindex="0" role="button" aria-label="${tr('ছবি আপলোড করুন','Upload photo')}">
            <input type="file" id="sellerPhotoInput" accept="image/*">
            <span class="upload-icon">📷</span>
            <p>${tr('ক্লিক করে ছবি বেছে নিন', 'Click to select photo')}</p>
            <small>${tr('JPG বা PNG, সর্বোচ্চ ৫ MB', 'JPG or PNG, max 5 MB')}</small>
          </div>
        </div>
        <button class="modal-submit" id="sellerSubmit">${tr('নথিভুক্তির অনুরোধ পাঠান', 'Send Registration Request')} ✓</button>
        <p class="form-note">${tr('তথ্য যাচাই করে আমরা আপনার সাথে যোগাযোগ করব। NID ও ছবি শুধু যাচাইয়ের জন্য ব্যবহার করা হবে।', 'We will verify the details and contact you. NID and photo are used only for verification.')}</p>
      </div>
    `;
  }

  function handleOrderSubmit(backdrop, itemName) {
    const name = $('#orderName', backdrop)?.value?.trim();
    const qty = $('#orderQty', backdrop)?.value?.trim();
    const phone = $('#orderPhone', backdrop)?.value?.trim();
    const addr = $('#orderAddr', backdrop)?.value?.trim();
    if (!name || !qty || !phone || !addr) {
      alert(tr('সব তারকা চিহ্নিত তথ্য দেওয়া আবশ্যক।', 'All starred fields are required.'));
      return;
    }
    const wrap = $('#orderFormWrap', backdrop);
    if (wrap) {
      wrap.innerHTML = `<div class="modal-success">
        <span class="success-icon">✅</span>
        <h4>${tr('অর্ডার পাঠানো হয়েছে!', 'Order Sent!')}</h4>
        <p>${tr(`${esc(itemName)} – ${esc(name)} এর অনুরোধ পেয়েছি। বিক্রেতা শীঘ্রই ০${esc(phone)}-এ যোগাযোগ করবেন।`, `We received your request for ${esc(itemName)}. The seller will contact you soon.`)}</p>
      </div>`;
    }
    /* In a real app, this would POST to an API / Supabase edge function */
    console.info('[DeshPath Upgrades] Order request (local-first, not sent):', { itemName, name, qty, phone, addr });
  }

  function handleSellerSubmit(backdrop) {
    const shop = $('#sellerShop', backdrop)?.value?.trim();
    const district = $('#sellerDistrict', backdrop)?.value;
    const thana = $('#sellerThana', backdrop)?.value?.trim();
    const phone = $('#sellerPhone', backdrop)?.value?.trim();
    if (!shop || !district || !thana || !phone) {
      alert(tr('সব তারকা চিহ্নিত তথ্য দেওয়া আবশ্যক।', 'All starred fields are required.'));
      return;
    }
    const wrap = $('#sellerFormWrap', backdrop);
    if (wrap) {
      wrap.innerHTML = `<div class="modal-success">
        <span class="success-icon">🎉</span>
        <h4>${tr('নথিভুক্তির অনুরোধ পাঠানো হয়েছে!', 'Registration Request Sent!')}</h4>
        <p>${tr(`${esc(shop)} – আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।`, `${esc(shop)} – We will contact you soon.`)}</p>
      </div>`;
    }
    console.info('[DeshPath Upgrades] Seller KYC (local-first, not sent):', { shop, district, thana, phone });
  }

  /* Listen for clicks on order/seller buttons (delegated) */
  function initFoodCardModalDelegation() {
    const orderBackdrop = createModalBackdrop('upgradeOrderModal');
    const sellerBackdrop = createModalBackdrop('upgradeSellerModal');

    document.addEventListener('click', e => {
      const orderBtn = e.target.closest('[data-craft-order], [data-food-order]');
      if (orderBtn) {
        const name = orderBtn.dataset.craftOrder || orderBtn.dataset.foodOrder || '';
        openModal(orderBackdrop, buildOrderModalHTML(name));
        $('#orderSubmit', orderBackdrop)?.addEventListener('click', () => handleOrderSubmit(orderBackdrop, name));
        return;
      }
      const sellerBtn = e.target.closest('[data-craft-seller], [data-food-seller]');
      if (sellerBtn) {
        openModal(sellerBackdrop, buildSellerKYCHTML());
        $('#sellerPhotoZone', sellerBackdrop)?.addEventListener('click', () => {
          $('#sellerPhotoInput', sellerBackdrop)?.click();
        });
        $('#sellerSubmit', sellerBackdrop)?.addEventListener('click', () => handleSellerSubmit(sellerBackdrop));
        return;
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     3. EXPLORE SECTION — NEW FILTER CHIPS + FESTIVAL CALENDAR
     ══════════════════════════════════════════════════════ */

  const FESTIVALS = [
    { id: 'lalon', emoji: '🎵', month: tr('অক্টোবর', 'October'), monthNum: 10, name: tr('লালন মেলা', 'Lalon Mela'), loc: tr('কুষ্টিয়া', 'Kushtia'), desc: tr('বাউল সাধক লালন শাহর স্মরণে বার্ষিক উৎসব।', 'Annual festival commemorating Baul mystic Lalon Shah.'), district: 'kushtia' },
    { id: 'rash', emoji: '🌸', month: tr('নভেম্বর', 'November'), monthNum: 11, name: tr('রাস মেলা', 'Rash Mela'), loc: tr('দিনাজপুর / সুন্দরবন', 'Dinajpur / Sundarbans'), desc: tr('বৈষ্ণব উৎসব; দিনাজপুর ও সুন্দরবনে বিশেষভাবে পালিত হয়।', 'Vaishnava festival celebrated in Dinajpur and the Sundarbans.'), district: 'dinajpur' },
    { id: 'baisabi', emoji: '🏔️', month: tr('এপ্রিল', 'April'), monthNum: 4, name: tr('বৈসাবি উৎসব', 'Baisabi Festival'), loc: tr('পার্বত্য চট্টগ্রাম', 'Chittagong Hill Tracts'), desc: tr('ক্ষুদ্র নৃগোষ্ঠীর বর্ষবরণ উৎসব। বৈসু, সাংগ্রাই ও বিজু।', 'Indigenous New Year festival of CHT. Baisu, Sangrai & Bizu.'), district: 'rangamati' },
    { id: 'shakrain', emoji: '🪁', month: tr('জানুয়ারি', 'January'), monthNum: 1, name: tr('সাকরাইন / পৌষ সংক্রান্তি', 'Shakrain / Poush Sankranti'), loc: tr('পুরান ঢাকা', 'Old Dhaka'), desc: tr('ঘুড়ি উৎসব ও আতশবাজিতে পুরান ঢাকার অন্যতম উৎসব।', 'Kite festival and fireworks; one of Old Dhaka\'s biggest events.'), district: 'dhaka' },
    { id: 'nabanna', emoji: '🌾', month: tr('নভেম্বর', 'November'), monthNum: 11, name: tr('নবান্ন উৎসব', 'Nabanna Festival'), loc: tr('সারা বাংলাদেশ', 'Across Bangladesh'), desc: tr('নতুন ধান কাটার উৎসব। পিঠাপুলি ও গ্রামীণ আনন্দ।', 'New rice harvest festival with pithas and rural celebrations.'), district: 'dhaka' },
    { id: 'baishakh', emoji: '🎊', month: tr('এপ্রিল', 'April'), monthNum: 4, name: tr('বাংলা নববর্ষ', 'Bangla New Year'), loc: tr('ঢাকা, টিএসসি', 'Dhaka, TSC'), desc: tr('১লা বৈশাখ; মঙ্গল শোভাযাত্রা, আনন্দ মেলা।', '1st Baishakh; Mangal Shobhajatra and fair.'), district: 'dhaka' },
    { id: 'sitakund', emoji: '🔥', month: tr('মার্চ', 'March'), monthNum: 3, name: tr('শিবচতুর্দশী মেলা', 'Shib Chaturdashi Mela'), loc: tr('সীতাকুণ্ড, চট্টগ্রাম', 'Sitakunda, Chattogram'), desc: tr('সীতাকুণ্ড মন্দির প্রাঙ্গণে বার্ষিক হিন্দু মেলা।', 'Annual Hindu fair at Sitakunda temple grounds.'), district: 'chattogram' },
    { id: 'eid-jamat', emoji: '🕌', month: tr('বছর ভেদে', 'Annually Varies'), monthNum: 0, name: tr('শোলাকিয়া ঈদ জামাত', 'Sholakia Eid Jamaat'), loc: tr('কিশোরগঞ্জ', 'Kishoreganj'), desc: tr('বিশ্বের বৃহত্তম ঈদ জামাতগুলোর একটি।', 'One of the world\'s largest Eid congregational prayers.'), district: 'kishoreganj' },
  ];

  function initNewExploreFilters() {
    const filterGroup = $('[aria-label="গন্তব্যের ধরন"]');
    if (!filterGroup) return;

    const newChips = [
      { cat: 'unesco', bn: '🏛️ বিশ্ব ঐতিহ্য (UNESCO)', en: '🏛️ UNESCO Heritage' },
      { cat: 'protected', bn: '🌳 সংরক্ষিত বন ও উদ্যান', en: '🌳 Protected Areas' },
      { cat: 'seasonal', bn: '⭐ এই মাসে সেরা', en: '⭐ Seasonal Picks' },
    ];

    newChips.forEach(chip => {
      if (filterGroup.querySelector(`[data-category="${chip.cat}"]`)) return;
      const btn = document.createElement('button');
      btn.className = 'filter-tab';
      btn.dataset.category = chip.cat;
      btn.textContent = tr(chip.bn, chip.en);
      filterGroup.appendChild(btn);
      btn.addEventListener('click', () => {
        $$('[data-category]').forEach(x => x.classList.toggle('active', x === btn));
      });
    });
  }

  function initFestivalCalendar() {
    const exploreSection = $('#explore');
    if (!exploreSection) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    /* Sort: upcoming months first */
    const sorted = [...FESTIVALS].sort((a, b) => {
      if (!a.monthNum) return 1;
      if (!b.monthNum) return -1;
      const aDiff = (a.monthNum - currentMonth + 12) % 12;
      const bDiff = (b.monthNum - currentMonth + 12) % 12;
      return aDiff - bDiff;
    });

    const section = document.createElement('div');
    section.className = 'festival-section';
    section.innerHTML = `
      <div class="festival-section-heading">
        <div class="fsh-text">
          <div class="eyebrow"><span class="eyebrow-line" aria-hidden="true"></span> ${tr('উৎসব ও সংস্কৃতি', 'Festivals & Culture')}</div>
          <h3>${tr('উৎসব ও ঐতিহ্যের ক্যালেন্ডার', 'Festivals & Cultural Events Calendar')}</h3>
        </div>
        <div class="festival-nav-arrows">
          <button class="festival-arrow" id="festPrev" aria-label="${tr('আগে', 'Previous')}">‹</button>
          <button class="festival-arrow" id="festNext" aria-label="${tr('পরে', 'Next')}">›</button>
        </div>
      </div>
      <div class="festival-scroll" id="festivalScroll">
        ${sorted.map(f => `
          <div class="festival-card" data-festival="${esc(f.id)}">
            <div class="festival-card-top" style="background:linear-gradient(135deg,var(--brand-soft),var(--accent-soft))">
              <span class="festival-emoji" aria-hidden="true">${f.emoji}</span>
              <span class="festival-month-chip">${esc(f.month)}</span>
            </div>
            <div class="festival-card-body">
              <h4>${esc(f.name)}</h4>
              <div class="festival-loc">📍 ${esc(f.loc)}</div>
              <p>${esc(f.desc)}</p>
            </div>
            <div class="festival-card-footer">
              <button class="festival-district-link" data-festival-district="${esc(f.district)}">${tr('জেলায় যান →', 'Go to District →')}</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    /* Append inside explore section, after the places grid */
    const exploreMore = $('.explore-more', exploreSection);
    if (exploreMore) exploreMore.insertAdjacentElement('afterend', section);
    else exploreSection.appendChild(section);

    /* Arrow navigation */
    const scroll = $('#festivalScroll');
    $('#festPrev')?.addEventListener('click', () => { scroll.scrollBy({ left: -260, behavior: 'smooth' }); });
    $('#festNext')?.addEventListener('click', () => { scroll.scrollBy({ left: 260, behavior: 'smooth' }); });

    /* Festival district click */
    section.addEventListener('click', e => {
      const btn = e.target.closest('[data-festival-district]');
      if (!btn) return;
      const districtId = btn.dataset.festivalDistrict;
      /* Navigate to my-map and pre-select district */
      location.hash = 'my-map';
      try {
        const distBtn = document.querySelector(`[data-district="${districtId}"]`) ||
                        document.querySelector(`#districtList [data-id="${districtId}"]`);
        if (distBtn) { setTimeout(() => distBtn.click(), 400); }
      } catch { /* graceful */ }
    });
  }

  /* ══════════════════════════════════════════════════════
     4. COMMUNITY — VISUAL STORY & HIDDEN GEM PORTAL
     ══════════════════════════════════════════════════════ */

  const STORY_STORAGE_KEY = 'deshpath.community_stories';

  function getStories() {
    try {
      const raw = localStorage.getItem(STORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveStories(arr) {
    try { localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(arr)); } catch { /* quota */ }
  }

  /* Compress image to WebP < 150KB using canvas, strip EXIF */
  async function compressToWebP(file, maxKB = 150) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        /* Try WebP, fallback JPEG */
        let quality = 0.82;
        function tryEncode() {
          canvas.toBlob(blob => {
            if (!blob) { reject(new Error('encode failed')); return; }
            if (blob.size > maxKB * 1024 && quality > 0.3) {
              quality -= 0.12;
              tryEncode();
            } else {
              resolve(blob);
            }
          }, 'image/webp', quality);
        }
        tryEncode();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function storyCardHTML(story) {
    const pts = story.points || 10;
    const districtName = story.district
      ? (window.DESH_DATA?.districts?.find(d => d.id === story.district)?.name || story.district)
      : '';
    return `
      <div class="story-masonry-item">
        ${story.imgDataUrl
          ? `<img class="story-img" src="${esc(story.imgDataUrl)}" alt="${esc(story.spotName)}" loading="lazy">`
          : `<div class="story-img-placeholder" aria-hidden="true">${story.emoji || '📷'}</div>`
        }
        <div class="story-masonry-body">
          <h4>${esc(story.spotName)}</h4>
          ${districtName ? `<span class="story-district-chip">📍 ${esc(districtName)}</span>` : ''}
          <p>${esc(story.experience)}</p>
          <div class="story-attribution">
            <span class="attr-name">📸 ${tr('গল্প ও ছবি:', 'Story & Photo:')} ${esc(story.contributorName)}</span>
            <span class="story-points-badge">+${pts} ${tr('পয়েন্ট', 'pts')}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderStoryPortal() {
    const communityRoot = $('#communityRoot');
    if (!communityRoot) return;

    /* Don't override if communityRoot has already been set up by community-online.js */
    if (!$('.community-story-portal', communityRoot)) {
      const portal = document.createElement('div');
      portal.className = 'community-story-portal';
      communityRoot.appendChild(portal);
    }

    const portal = $('.community-story-portal', communityRoot);
    const stories = getStories();

    portal.innerHTML = `
      <div class="community-portal-header">
        <h3>📸 ${tr('অজানা স্থানের গল্প ও ছবি', 'Hidden Gem Stories & Photos')}</h3>
        <button class="add-story-btn" id="addStoryBtn">
          + ${tr('নতুন স্থান ও ছবি যোগ করুন', 'Add New Place & Photo')}
        </button>
      </div>
      ${stories.length === 0 ? `
        <div class="story-empty-portal">
          <span class="empty-emoji">🗺️</span>
          <h4>${tr('এখনো কোনো গল্প নেই', 'No stories yet')}</h4>
          <p>${tr('আপনি প্রথম হোন! একটি অজানা স্থান বা অভিজ্ঞতা শেয়ার করুন।', 'Be the first! Share a hidden gem or travel experience.')}</p>
        </div>
      ` : `
        <div class="story-masonry" id="storyMasonry">
          ${stories.map(storyCardHTML).join('')}
        </div>
      `}
    `;

    $('#addStoryBtn', portal)?.addEventListener('click', openStoryModal);
  }

  function buildStoryModalHTML() {
    const districts = window.DESH_DATA?.districts || [];
    const categories = [
      { bn: 'প্রকৃতি', en: 'Nature' },
      { bn: 'ঐতিহাসিক স্থান', en: 'Historical Site' },
      { bn: 'গ্রামীণ জীবন', en: 'Rural Life' },
      { bn: 'খাবারের অভিজ্ঞতা', en: 'Food Experience' },
      { bn: 'উৎসব ও সংস্কৃতি', en: 'Festival & Culture' },
      { bn: 'অন্যান্য', en: 'Other' },
    ];
    return `
      <div class="upgrade-modal-header">
        <h3>📸 ${tr('নতুন স্থান ও ছবি যোগ করুন', 'Add New Place & Photo')}</h3>
        <button class="upgrade-modal-close" aria-label="${tr('বন্ধ করুন', 'Close')}">×</button>
      </div>
      <div id="storyFormWrap">
        <div class="form-field">
          <label>${tr('আপনার নাম', 'Your Name')} *</label>
          <input id="storyContributor" placeholder="${tr('যেমন: রিফাত হাসান', 'e.g. Rifat Hasan')}" required>
        </div>
        <div class="form-field">
          <label>${tr('জেলা', 'District')} *</label>
          <select id="storyDistrict">
            <option value="">${tr('জেলা বাছুন', 'Select District')}</option>
            ${districts.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>${tr('স্থানের নাম', 'Spot Name')} *</label>
          <input id="storySpot" placeholder="${tr('যেমন: লুকানো ঝরনা, নদীর পাড়ের গ্রাম', 'e.g. Hidden waterfall, riverside village')}" required>
        </div>
        <div class="form-field">
          <label>${tr('বিভাগ', 'Category')}</label>
          <select id="storyCategory">
            ${categories.map(c => `<option value="${esc(c.en)}">${esc(tr(c.bn, c.en))}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>${tr('আপনার ছোট অভিজ্ঞতা বা গল্প', 'Your Short Experience / Story')} *</label>
          <textarea id="storyText" placeholder="${tr('এই জায়গাটি কেন বিশেষ? আপনার অনুভূতি লিখুন…', 'Why is this place special? Write your feeling…')}"></textarea>
        </div>
        <div class="form-field">
          <label>${tr('ছবি আপলোড করুন (ঐচ্ছিক)', 'Upload Photo (Optional)')}</label>
          <label class="photo-upload-zone" for="storyPhotoInput" tabindex="0">
            <span class="upload-icon">🖼️</span>
            <p>${tr('ক্লিক করে ছবি বেছে নিন', 'Click to select a photo')}</p>
            <small>${tr('ছবি স্বয়ংক্রিয়ভাবে কম্প্রেস হবে (<150KB WebP). GPS ডেটা সরানো হবে।', 'Photo auto-compressed to <150KB WebP. GPS metadata stripped.')}</small>
            <input type="file" id="storyPhotoInput" accept="image/*">
          </label>
          <div id="storyPreviewGrid" class="photo-preview-grid" style="display:none"></div>
          <div id="compressNote" class="compress-note" style="display:none">✅ ${tr('ছবি কম্প্রেস করা হয়েছে', 'Photo compressed')}</div>
        </div>
        <button class="modal-submit" id="storySubmit">${tr('গল্প প্রকাশ করুন', 'Publish Story')} 🚀</button>
        <p class="form-note">${tr('গল্প ও ছবি শুধু এই ব্রাউজারে সেভ থাকে। অ্যাডমিন অনুমোদনের পরে সবার জন্য প্রকাশিত হবে।', 'Story and photo are saved locally. Published after admin approval.')}</p>
      </div>
    `;
  }

  let compressedPhotoBlob = null;

  function openStoryModal() {
    const backdrop = createModalBackdrop('upgradeStoryModal');
    compressedPhotoBlob = null;
    openModal(backdrop, buildStoryModalHTML());

    /* Photo upload + compression */
    $('#storyPhotoInput', backdrop)?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const blob = await compressToWebP(file);
        compressedPhotoBlob = blob;
        const url = URL.createObjectURL(blob);
        const grid = $('#storyPreviewGrid', backdrop);
        if (grid) {
          grid.style.display = 'grid';
          grid.innerHTML = `<img src="${url}" alt="${tr('প্রিভিউ','Preview')}">`;
        }
        const note = $('#compressNote', backdrop);
        if (note) {
          note.style.display = 'flex';
          note.textContent = `✅ ${tr('ছবি কম্প্রেস', 'Compressed')}: ${(blob.size / 1024).toFixed(0)} KB`;
        }
      } catch (err) {
        console.warn('[DeshPath Upgrades] Image compression failed:', err);
      }
    });

    /* Submit */
    $('#storySubmit', backdrop)?.addEventListener('click', async () => {
      const contributor = $('#storyContributor', backdrop)?.value?.trim();
      const district = $('#storyDistrict', backdrop)?.value;
      const spot = $('#storySpot', backdrop)?.value?.trim();
      const exp = $('#storyText', backdrop)?.value?.trim();
      const category = $('#storyCategory', backdrop)?.value;
      if (!contributor || !district || !spot || !exp) {
        alert(tr('সব তারকা চিহ্নিত তথ্য দেওয়া আবশ্যক।', 'All starred fields are required.'));
        return;
      }
      let imgDataUrl = null;
      if (compressedPhotoBlob) {
        imgDataUrl = await new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(compressedPhotoBlob);
        });
      }
      const story = {
        id: Date.now().toString(36),
        contributorName: contributor,
        district, spotName: spot,
        experience: exp, category, imgDataUrl,
        emoji: '📷', points: 15,
        ts: Date.now(),
      };
      const stories = getStories();
      stories.unshift(story);
      saveStories(stories);

      const wrap = $('#storyFormWrap', backdrop);
      if (wrap) {
        wrap.innerHTML = `<div class="modal-success">
          <span class="success-icon">🎉</span>
          <h4>${tr('গল্প সেভ হয়েছে!', 'Story Saved!')}</h4>
          <p>${tr(`${esc(spot)} – আপনার গল্প যোগ হয়েছে। ধন্যবাদ!`, `${esc(spot)} – Your story has been added. Thank you!`)}</p>
        </div>`;
      }
      setTimeout(() => {
        closeModal(backdrop);
        renderStoryPortal();
      }, 2000);
    });
  }

  function initCommunityPortal() {
    /* Observe communityRoot for when community-online.js renders it */
    const communityRoot = $('#communityRoot');
    if (!communityRoot) return;

    const observer = new MutationObserver(() => {
      if (!$('.community-story-portal', communityRoot)) {
        renderStoryPortal();
      }
    });
    observer.observe(communityRoot, { childList: true });

    /* If already has content, append portal */
    if (communityRoot.children.length > 0) {
      renderStoryPortal();
    }
  }

  /* ══════════════════════════════════════════════════════
     5. MAP CARD PERSONALIZATION & EXPORT
     ══════════════════════════════════════════════════════ */

  const AVATAR_STORAGE = 'deshpath.avatar_dataurl';

  function getVisitedCount() {
    try {
      const raw = localStorage.getItem('deshpath.visited');
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    } catch { return 0; }
  }

  function calcPercentile(visited) {
    /* Simple percentile: 64 total districts */
    const pct = Math.round((visited / 64) * 100);
    if (pct >= 80) return `${tr('শীর্ষ', 'Top')} 5%`;
    if (pct >= 60) return `${tr('শীর্ষ', 'Top')} 15%`;
    if (pct >= 40) return `${tr('শীর্ষ', 'Top')} 35%`;
    if (pct >= 20) return `${tr('শীর্ষ', 'Top')} 55%`;
    if (pct >= 5)  return `${tr('শীর্ষ', 'Top')} 75%`;
    return tr('নতুন যাত্রী', 'New Explorer');
  }

  function initMapCardPersonalization() {
    const mapControls = $('.map-controls');
    if (!mapControls) return;

    /* Insert avatar section at top of map controls */
    const avatarSection = document.createElement('div');
    avatarSection.className = 'map-avatar-section';
    avatarSection.id = 'mapAvatarSection';

    const savedAvatar = localStorage.getItem(AVATAR_STORAGE) || '';
    const visitedCount = getVisitedCount();
    const percentile = calcPercentile(visitedCount);

    avatarSection.innerHTML = `
      <div class="avatar-upload-row">
        <div class="avatar-preview" id="avatarPreview" title="${tr('ছবি পরিবর্তন করুন', 'Change photo')}" tabindex="0" role="button" aria-label="${tr('প্রোফাইল ছবি আপলোড করুন', 'Upload profile photo')}">
          ${savedAvatar ? `<img src="${esc(savedAvatar)}" id="avatarImg" alt="${tr('প্রোফাইল ছবি', 'Profile photo')}">` : '👤'}
        </div>
        <div>
          <label class="avatar-upload-label" for="avatarFileInput">
            ${tr('প্রোফাইল ছবি', 'Profile Photo')}
            <small>${tr('ঐচ্ছিক · মানচিত্র কার্ডে যোগ হবে', 'Optional · Added to map card')}</small>
          </label>
          <input type="file" id="avatarFileInput" accept="image/*" aria-label="${tr('প্রোফাইল ছবি বাছুন', 'Select profile photo')}">
        </div>
      </div>
      <div class="traveler-percentile" id="travelerPercentile">
        <span class="percentile-badge" id="percentileBadge">${esc(percentile)}</span>
        <span class="percentile-label" id="percentileLabel">${tr('ভ্রমণকারীদের মধ্যে', 'Among Bangladesh Travellers')}</span>
      </div>
    `;

    mapControls.prepend(avatarSection);

    /* Add download card button below existing download button */
    const downloadBtn = $('#downloadMap', mapControls);
    if (downloadBtn) {
      const cardBtn = document.createElement('button');
      cardBtn.className = 'download-card-btn';
      cardBtn.id = 'downloadFieldCard';
      cardBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 7h8M8 12h5M8 17h3"/></svg>
        ${tr('ফিল্ড নোটস কার্ড ডাউনলোড', 'Download Field Notes Card')}
      `;
      downloadBtn.insertAdjacentElement('afterend', cardBtn);
      cardBtn.addEventListener('click', generateFieldNotesCard);
    }

    /* Avatar upload */
    const avatarInput = $('#avatarFileInput', avatarSection);
    const avatarPreview = $('#avatarPreview', avatarSection);

    function updateAvatar(dataUrl) {
      localStorage.setItem(AVATAR_STORAGE, dataUrl);
      if (avatarPreview) {
        avatarPreview.innerHTML = `<img src="${esc(dataUrl)}" id="avatarImg" alt="${tr('প্রোফাইল ছবি','Profile photo')}">`;
      }
    }

    avatarInput?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => updateAvatar(ev.target.result);
      reader.readAsDataURL(file);
    });

    avatarPreview?.addEventListener('click', () => avatarInput?.click());
    avatarPreview?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') avatarInput?.click(); });

    /* Update percentile when visited changes */
    function refreshPercentile() {
      const v = getVisitedCount();
      const p = calcPercentile(v);
      const badge = $('#percentileBadge');
      if (badge) badge.textContent = p;
    }

    /* Observe localStorage changes via storage event */
    window.addEventListener('storage', e => {
      if (e.key === 'deshpath.visited') refreshPercentile();
    });

    /* Also poll after map interactions */
    document.addEventListener('click', e => {
      if (e.target.closest('.district-button') || e.target.closest('.district-path')) {
        setTimeout(refreshPercentile, 300);
      }
    });
  }

  /* Canvas-based Field Notes Card export */
  async function generateFieldNotesCard() {
    const W = 900, H = 540;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const brandBlue = '#2855C7';
    const darkBlue  = '#18377E';
    const cream     = '#F7F9FC';
    const ink       = '#202733';
    const orange    = '#F28A63';

    /* Background gradient */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, cream);
    bg.addColorStop(1, '#EDF3FF');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Top stripe */
    ctx.fillStyle = darkBlue;
    ctx.fillRect(0, 0, W, 8);

    /* Bottom stripe */
    ctx.fillStyle = orange;
    ctx.fillRect(0, H - 8, W, 8);

    /* Decorative dot grid */
    ctx.fillStyle = 'rgba(40,85,199,0.06)';
    for (let x = 20; x < W; x += 24) {
      for (let y = 20; y < H; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Left panel */
    ctx.fillStyle = brandBlue;
    ctx.beginPath();
    ctx.roundRect(28, 28, 200, H - 56, 14);
    ctx.fill();

    /* Brand name */
    ctx.fillStyle = '#F7FAFF';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('দেশপথ', 44, 64);
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('DESHPATH FIELD NOTES', 44, 80);

    /* Avatar circle */
    const avatarDataUrl = localStorage.getItem(AVATAR_STORAGE);
    const avatarX = 128, avatarY = 175, avatarR = 44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();
    if (avatarDataUrl) {
      try {
        const img = await loadImage(avatarDataUrl);
        ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      } catch {
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    }
    ctx.restore();

    /* Traveler name */
    const userName = $('#mapName')?.value?.trim() || tr('আপনার নাম', 'Your Name');
    ctx.fillStyle = '#F7FAFF';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userName, avatarX, avatarY + avatarR + 20);

    /* Percentile badge */
    const visitedCount = getVisitedCount();
    const percentile = calcPercentile(visitedCount);
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = orange;
    ctx.fillText(percentile + ' ভ্রমণকারী', avatarX, avatarY + avatarR + 36);

    /* Stats on left panel */
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(40, 260, 176, 1);
    ctx.fillStyle = '#F7FAFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(visitedCount), 128, 310);
    ctx.font = '10px Arial';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(tr('জেলা ভ্রমণ', 'Districts Visited'), 128, 328);

    ctx.font = '9px Arial';
    ctx.fillText(`/ ৬৪ জেলা`, 128, 345);

    /* Right panel content */
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText(tr('আমার বাংলাদেশ', 'My Bangladesh'), 256, 68);

    ctx.font = '12px Arial';
    ctx.fillStyle = '#596778';
    ctx.fillText(tr('ব্যক্তিগত ভ্রমণ মানচিত্র', 'Personal Travel Map'), 256, 88);

    /* Date */
    const dateStr = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.font = '10px Arial';
    ctx.fillStyle = '#8A94A3';
    ctx.fillText(dateStr, 256, 108);

    /* Visited districts list */
    const visited = getVisitedDistricts();
    const allDistricts = window.DESH_DATA?.districts || [];
    const names = visited.slice(0, 20).map(id => {
      const d = allDistricts.find(x => x.id === id);
      return d ? d.name : id;
    });

    if (names.length > 0) {
      ctx.fillStyle = ink;
      ctx.font = 'bold 11px Arial';
      ctx.fillText(tr('ঘুরে আসা জেলা:', 'Visited Districts:'), 256, 140);
      ctx.font = '10px Arial';
      ctx.fillStyle = '#596778';
      const cols = 3, rows = Math.ceil(names.length / cols);
      names.forEach((n, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        ctx.fillText('• ' + n, 256 + col * 200, 158 + row * 18);
      });
      if (visited.length > 20) {
        ctx.fillStyle = brandBlue;
        ctx.fillText(`+ ${visited.length - 20} ${tr('আরও', 'more')}`, 256, 158 + rows * 18);
      }
    } else {
      ctx.fillStyle = '#8A94A3';
      ctx.font = '12px Arial';
      ctx.fillText(tr('এখনো কোনো জেলা বাছাই করা হয়নি', 'No districts selected yet'), 256, 160);
    }

    /* Watermark */
    ctx.fillStyle = 'rgba(40,85,199,0.12)';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('দেশপথ · deshpath.vercel.app', W - 28, H - 24);

    /* Vol badge */
    ctx.textAlign = 'left';
    ctx.fillStyle = orange;
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.fillText('FIELD NOTES · VOL.01 / BD', 256, H - 24);

    /* Download */
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deshpath-field-notes-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ══════════════════════════════════════════════════════
     INIT — run everything when DOM is ready
     ══════════════════════════════════════════════════════ */
  ready(() => {
    initAdvisoryBar();
    initFoodKindTabs();
    initFoodCardModalDelegation();
    initNewExploreFilters();
    initFestivalCalendar();
    initCommunityPortal();
    initMapCardPersonalization();

    /* Re-run upgrades on food grid updates */
    const foodGrid = $('#districtFoods');
    if (foodGrid) {
      new MutationObserver(() => {
        upgradeExistingFoodCards();
      }).observe(foodGrid, { childList: true, subtree: true });
    }
  });
})();
