/* Approved catalog only. Bundled destinations remain available offline. */
'use strict';
(() => {
  const data = window.DESH_DATA, originals = data.places.map(p => ({ ...p }));
  const originalIds = new Set(originals.map(p => p.id)), districtIds = new Set(data.districts.map(d => d.id));
  const cleanText = (value, max = 6000) => typeof value === 'string' ? value.slice(0, max) : '';
  function safeImage(value) {
    if (typeof value !== 'string') return '';
    if (/^assets\/[a-z0-9-]+\.(jpg|png|webp)$/.test(value)) return value;
    try {
      const url = new URL(value), base = new URL(window.DESH_CLOUD_CONFIG.url);
      return url.origin === base.origin && url.protocol === 'https:' && url.pathname.startsWith('/storage/v1/object/public/deshpath-public/') && !url.search && !url.hash ? url.href : '';
    } catch { return ''; }
  }
  function place(value) {
    if (!value || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value.id) || !districtIds.has(value.district) || !['nature', 'adventure', 'beach', 'heritage'].includes(value.category)) return null;
    const image = safeImage(value.image);
    if (!image || !cleanText(value.name, 160).trim()) return null;
    const result = { id: value.id, district: value.district, category: value.category, image, community: !originalIds.has(value.id), en: {} };
    for (const field of ['name', 'description', 'categoryLabel', 'season', 'duration', 'howTo', 'stay', 'cost', 'notes', 'credit', 'updatedAt']) result[field] = cleanText(value[field]);
    for (const field of ['name', 'description', 'categoryLabel', 'season', 'duration', 'howTo', 'stay', 'cost', 'notes']) result.en[field] = cleanText(value.en?.[field]);
    result.photos = (Array.isArray(value.photos) ? value.photos : []).slice(0, 3).map(p => ({ url: safeImage(p?.url), caption: cleanText(p?.caption, 200) })).filter(p => p.url);
    result.months = (Array.isArray(value.months) ? value.months : []).filter(m => Number.isInteger(m) && m >= 1 && m <= 12);
    if (Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= 20 && value.lat <= 27 && value.lng >= 88 && value.lng <= 93) { result.lat = value.lat; result.lng = value.lng; }
    return result;
  }
  let loading = null;
  async function refresh() {
    if (!window.DESH_CLOUD?.enabled) return { changed: false };
    if (loading) return loading;
    loading = (async () => {
      const result = await window.DESH_CLOUD.publicCommunity('catalog.list');
      if (!Array.isArray(result.places)) throw Error('Invalid catalog');
      const rows = result.places.slice(0, 1000).map(place).filter(Boolean), merged = new Map(originals.map(p => [p.id, { ...p }]));
      for (const row of rows) merged.set(row.id, { ...merged.get(row.id), ...row });
      data.places.splice(0, data.places.length, ...merged.values());
      document.dispatchEvent(new CustomEvent('deshpath:catalogchange'));
      return { changed: true, total: data.places.length };
    })().finally(() => { loading = null; });
    return loading;
  }
  window.DESH_CATALOG = Object.freeze({ refresh, safeImage, validate: place });
})();
