const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'cloud.js'), 'utf8');
function environment(enabled, session = true) {
  const calls = [], pending = [], own = { id: 'owner-a', email: 'a@example.com' };
  const client = {
    auth: {
      onAuthStateChange(callback) { calls.push(['auth-listener']); this.callback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      async getUser() { calls.push(['getUser']); return session ? { data: { user: own }, error: null } : { data: { user: null }, error: { name: 'AuthSessionMissingError' } }; },
      async signInWithOtp(args) { calls.push(['requestOtp', args]); return { data: { user: null, session: null }, error: null }; },
      async verifyOtp(args) { calls.push(['verifyOtp', args]); return { data: { user: own, session: {} }, error: null }; },
      async refreshSession() { calls.push(['refresh']); return { data: { user: own }, error: null }; },
      async signOut(args) { calls.push(['signOut', args]); return { error: null }; }
    },
    from(table) {
      const query = { table, filters: [], op: 'read' }; calls.push(query);
      const chain = {
        upsert(payload, options) { query.op = 'upsert'; query.payload = payload; query.options = options; return this; },
        insert(payload) { query.op = 'insert'; query.payload = payload; return this; },
        select(columns) { query.columns = columns; return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        order(key, options) { query.order = [key, options]; return this; },
        limit(count) { query.limit = count; return this; },
        async single() { return { data: { ...query.payload, id: 'row-1', status: 'pending', updated_at: '2026-10-18T00:00:00Z' }, error: null }; },
        async maybeSingle() { return { data: { snapshot: { visited: ['dhaka'] }, updated_at: '2026-10-18T00:00:00Z' }, error: null }; },
        then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
      };
      return chain;
    }
  };
  const window = { DESH_CLOUD_CONFIG: { enabled, url: enabled ? 'https://dedicated-project.supabase.co' : '', publishableKey: enabled ? 'sb_publishable_testkey' : '' }, supabase: { createClient(url, key, options) { calls.push(['createClient', url, key, options]); return client; } }, DESH_DATA: { districts: [{ id: 'dhaka' }], places: [{ id: 'sajek' }] } };
  const context = { window, TextEncoder, document: { createElement() { pending.push('script'); return {}; }, head: { appendChild() { pending.push('network'); } } }, console };
  vm.runInNewContext(source, context);
  return { api: window.DESH_CLOUD, calls, pending, client };
}
(async () => {
  const off = environment(false);
  assert.equal(off.api.enabled, false); assert.equal(off.api.getStatus().mode, 'local');
  await assert.rejects(off.api.getUser(), error => error.code === 'cloud-disabled');
  await assert.rejects(off.api.requestOtp('a@example.com'), error => error.code === 'cloud-disabled');
  off.api.onAuthChange(() => {}); assert.equal(off.calls.length, 0); assert.equal(off.pending.length, 0);
  const e = environment(true), api = e.api;
  assert.equal(api.enabled, true);
  const request = await api.requestOtp('A@EXAMPLE.COM'); assert.equal(request.accepted, true); assert.equal(request.email, 'a@example.com');
  assert.equal(e.calls.find(c => c[0] === 'requestOtp')[1].options.shouldCreateUser, true);
  await assert.rejects(api.verifyOtp('a@example.com', '12'), error => error.code === 'invalid-otp');
  assert.equal((await api.verifyOtp('a@example.com', '123456')).id, 'owner-a');
  assert(e.calls.some(c => c[0] === 'getUser'), 'OTP result is verified by the Auth server');
  await api.refreshSession(); await api.signOut();
  assert.equal(e.calls.find(c => c[0] === 'signOut')[1].scope, 'local');
  await assert.rejects(api.saveJournal({ refresh_token: 'never-upload' }), error => error.code === 'invalid-journal');
  await assert.rejects(api.saveJournal({ image: 'data:image/png;base64,AAAA' }), error => error.code === 'invalid-journal');
  await assert.rejects(api.saveJournal({ body: 'x'.repeat(270000) }), error => error.code === 'journal-too-large');
  const save = await api.saveJournal({ visited: ['dhaka'] }); assert.equal(save.snapshot.visited[0], 'dhaka');
  const journalQuery = e.calls.find(c => c.table === 'deshpath_journals' && c.op === 'upsert');
  assert.equal(journalQuery.payload.user_id, 'owner-a'); assert.equal(journalQuery.options.onConflict, 'user_id');
  assert.equal((await api.loadJournal()).snapshot.visited[0], 'dhaka');
  const story = await api.submitContribution({ districtId: 'dhaka', title: 'An original story', body: 'A twenty character story, ready for review.', status: 'approved', user_id: 'someone-else' });
  assert.equal(story.status, 'pending');
  const storyPayload = e.calls.find(c => c.table === 'deshpath_contributions' && c.op === 'insert').payload;
  assert.equal(storyPayload.user_id, 'owner-a'); assert(!('status' in storyPayload)); assert(!('published_at' in storyPayload));
  await assert.rejects(api.submitReview({ placeId: 'sajek', rating: 6, body: 'A good destination' }), error => error.code === 'invalid-input');
  await api.submitReview({ placeId: 'sajek', rating: 4, body: 'A thoughtful review' });
  await api.listApprovedContributions(); await api.listApprovedReviews('sajek'); await api.listMySubmissions();
  assert(e.calls.filter(c => c.table && c.op === 'read' && c.columns.includes('published_at') && !c.filters.some(f => f[0] === 'user_id')).every(c => c.filters.some(f => f[0] === 'status' && f[1] === 'approved')));
  const absent = environment(true, false); assert.equal(await absent.api.getUser(), null); await assert.rejects(absent.api.saveJournal({}), error => error.code === 'sign-in-required');
  const sql = fs.readFileSync(path.join(app, 'backend/setup.sql'), 'utf8');
  for (const table of ['deshpath_journals', 'deshpath_contributions', 'deshpath_reviews']) {
    assert(sql.includes('alter table public.' + table + ' enable row level security;'));
  }
  assert(!/security\s+definer/i.test(sql)); assert(!/grant\s+update[^;]*deshpath_(?:contributions|reviews)/i.test(sql));
  assert(!/user_metadata/.test(sql)); assert(/journals_owner_update[\s\S]+using[\s\S]+with check/i.test(sql));
  const metadata = JSON.parse(fs.readFileSync(path.join(app, 'assets/vendor/supabase-js-2.118.0.metadata.json'), 'utf8'));
  const sdk = fs.readFileSync(path.join(app, 'assets/vendor/supabase-js-2.118.0.js'));
  assert.equal('sha384-' + crypto.createHash('sha384').update(sdk).digest('base64'), metadata.assetIntegrity);
  assert(source.includes(metadata.assetIntegrity));
  console.log('Cloud adapter mock/security assertions passed: disabled-mode inactivity, verified auth flow, input/file/credential rejection, owner payload, pending-only insert, approved query filters, RLS/grant structure and pinned SDK integrity. No live database or email test was performed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
