const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const app = path.resolve(__dirname, '..');
let currentSelect = '';
const listeners = {};
const root = { innerHTML: '', addEventListener: (type, fn) => listeners[type] = fn, querySelector: selector => selector === '[data-game-select]' ? { value: currentSelect } : { focus() {}, textContent: '' } };
const saved = {};
const changes = [];
const sandbox = { window: {dispatchEvent: event => changes.push(event.type)}, CustomEvent: class {constructor(type,options){this.type=type;this.detail=options.detail;}}, document: { querySelector: () => root }, setInterval: () => 1, clearInterval() {}, console };
vm.createContext(sandbox);
for (const file of ['data.js', 'map.js', 'games.js']) vm.runInContext(fs.readFileSync(path.join(app, file), 'utf8'), sandbox);
const w = sandbox.window, districts = w.DESH_DATA.districts, byId = new Map(districts.map(d => [d.id, d]));
const game = w.initDeshGames({ tr: (_bn, en) => en, bn: String, esc: value => String(value), icon: () => '', storage: { get: (key, fallback) => saved[key] || fallback, set: (key, value) => saved[key] = value }, districts, places: w.DESH_DATA.places, districtById: byId, districtName: d => d.en, placeText: (p, key) => p[key], toast() {} });
function click(selector, dataset) { listeners.click({ target: { closest: q => q === selector ? { dataset } : null } }); }
const action = command => click('[data-game-action]', { gameAction: command });
const answer = id => click('[data-game-answer]', { gameAnswer: id });
assert.equal(game.getSnapshot().questionPoolSize, 79);
click('[data-game-mode]', { gameMode: 'knowledge' });
action('next'); assert.equal(game.getSnapshot().index, 0, 'Unanswered question cannot be skipped');
for (let i = 0; i < 5; i++) {
  const id = root.innerHTML.match(/data-game-answer="([^"]+)"/)[1];
  answer(id); const scored = game.getSnapshot().score; answer(id); assert.equal(game.getSnapshot().score, scored, 'Repeated answer cannot score twice');
  action('next');
}
assert.equal(game.getSnapshot().done, true);
assert(game.getSnapshot().score >= 0 && game.getSnapshot().score <= 5);
assert.equal(saved.gamesRecords.knowledge, game.getSnapshot().score);
click('[data-game-mode]', { gameMode: 'photo' });
currentSelect = ''; action('photo-submit'); assert.equal(game.getSnapshot().index, 0);
for (let i = 0; i < 5; i++) {
  const photo = root.innerHTML.match(/class="dp-game-photo" src="([^"]+)"/)[1];
  const place = w.DESH_DATA.places.find(p => p.image === photo);
  currentSelect = place.district; action('photo-submit'); const score = game.getSnapshot().score; action('photo-submit'); assert.equal(game.getSnapshot().score, score);
  action('next');
}
assert.equal(game.getSnapshot().done, true); assert.equal(game.getSnapshot().score, 5000); assert.equal(saved.gamesRecords.photo, 5000);
click('[data-game-mode]', { gameMode: 'farthest' });
for (let i = 0; i < 5; i++) {
  const originName = root.innerHTML.match(/Starting point: <strong>([^<]+)/)[1];
  const origin = districts.find(d => d.en === originName);
  const candidates = [...root.innerHTML.matchAll(/data-game-answer="([^"]+)"/g)].map(match => byId.get(match[1]));
  const correct = candidates.sort((a, b) => w.DESH_GAME_MATH.distanceKm(origin, b) - w.DESH_GAME_MATH.distanceKm(origin, a))[0];
  answer(correct.id); action('next');
}
assert.equal(game.getSnapshot().score, 5); assert.equal(game.getSnapshot().done, true);
click('[data-game-mode]', { gameMode: 'puzzle' });
for (let i = 0; i < 6; i++) {
  const target = root.innerHTML.match(/data-game-piece="([^"]+)"/)[1];
  click('[data-game-district]', { gameDistrict: target });
}
assert.equal(game.getSnapshot().done, true); assert(Number.isFinite(saved.gamesRecords['puzzle-easy']));
click('[data-game-mode]', { gameMode: 'personality' });
for (let i = 0; i < 6; i++) click('[data-game-personality]', { gamePersonality: '2' });
assert.equal(game.getSnapshot().done, true); assert(root.innerHTML.includes('Story seeker'));
game.refreshLanguage(); assert.equal(game.getSnapshot().done, true);
console.log('All five game flows completed. Verified local best records, repeated-answer guards, unanswered-next guard, 79-question pool, 5,000-point perfect photo round, farthest-of-four correctness and personality result.');

assert.equal(changes.filter(type=>type==='deshpath:gameschange').length,4,'Each scored game completion refreshes the profile');
