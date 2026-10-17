'use strict';
(() => {
  let language = 'bn';
  try { if (JSON.parse(localStorage.getItem('deshpath.lang')) === 'en') language = 'en'; } catch {}
  const textNodes = [], attributes = [], listeners = [];
  const dictionary = window.DESH_EN?.static || {};
  const translation = value => {
    const clean = value.trim();
    return dictionary[clean] ? value.replace(clean, dictionary[clean]) : value;
  };
  // Remember the static document once. Form values and user content are never translated.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('script,style,textarea,[data-no-translate]') && dictionary[node.textContent.trim()]) {
      textNodes.push({node, original: node.textContent});
    }
  }
  for (const element of document.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
    for (const name of ['aria-label','placeholder','title','alt']) {
      const original = element.getAttribute(name);
      if (original && dictionary[original.trim()]) attributes.push({element,name,original});
    }
  }
  function apply() {
    document.documentElement.lang = language;
    for (const {node,original} of textNodes) if (node.isConnected) node.textContent = language === 'en' ? translation(original) : original;
    for (const {element,name,original} of attributes) if (element.isConnected) element.setAttribute(name, language === 'en' ? translation(original) : original);
    document.title = language === 'en' ? 'Deshpath — Your Bangladesh travel journal' : 'দেশপথ — আপনার ভ্রমণের খাতা';
    document.querySelector('meta[name="description"]').content = language === 'en' ? 'Explore Bangladesh through a personal food photo map, local flavours, real destinations and a trip planner.' : 'দেশপথ — নিজের বাংলাদেশ ভ্রমণ মানচিত্র, স্থানীয় খাবার, নতুন গন্তব্য ও ব্যক্তিগত ট্রিপ প্ল্যানার।';
    const button = document.querySelector('#languageToggle');
    if (button) {
      button.querySelector('span').textContent = language === 'en' ? 'বাংলা' : 'English';
      button.setAttribute('aria-label', language === 'en' ? 'বাংলা ভাষায় দেখুন' : 'View this website in English');
      button.setAttribute('lang', language === 'en' ? 'bn' : 'en');
    }
  }
  window.DESH_I18N = {
    get lang() { return language; },
    tr(bengali, english) { return language === 'en' ? (english ?? translation(bengali)) : bengali; },
    onChange(callback) { listeners.push(callback); },
    setLanguage(value) {
      language = value === 'en' ? 'en' : 'bn';
      try { localStorage.setItem('deshpath.lang', JSON.stringify(language)); } catch {}
      apply();
      listeners.forEach(callback => callback());
    },
    apply
  };
  apply();
})();
