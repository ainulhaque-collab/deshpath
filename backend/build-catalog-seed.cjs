'use strict';
// Only the existing editorial catalog; never seeds users, reviews or activity.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), context = { window: {} };
for (const name of ['data.js', 'content-en.js', 'discovery-data.js']) vm.runInNewContext(fs.readFileSync(path.join(root, name), 'utf8'), context);
const values = context.window.DESH_DATA.places.map(place => {
  const guide = context.window.DESH_DISCOVERY.places[place.id], english = context.window.DESH_EN.places[place.id];
  const payload = { ...place, en: { ...english }, months: guide?.months || [] };
  for (const key of ['howTo', 'stay', 'cost']) if (guide?.[key]) { payload[key] = guide[key].bn; payload.en[key] = guide[key].en; }
  return `('${place.id}', '${JSON.stringify(payload).replace(/'/g, "''")}'::jsonb, true, 'published')`;
});
fs.writeFileSync(path.join(__dirname, 'catalog-seed.sql'), `-- Preserves the original 16 editorial destination identifiers.\ninsert into public.deshpath_places(id,payload,builtin,status) values\n${values.join(',\n')}\non conflict(id) do nothing;\n`);
console.log(`Prepared ${values.length} existing destinations.`);
