const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(app, 'cloud.js'), 'utf8');
function environment(enabled, session = true, href = 'https://deshpath.vercel.app/#passport', options = {}) {
  const calls = [], pending = [], own = { id: 'owner-a', email: 'a@example.com' };
  const values = new Map(), history = [];
  if (options.returnRoute) values.set('deshpath.cloud.returnRoute', JSON.stringify({ hash: options.returnRoute, at: Date.now() }));
  const location = { href, get hash() { return new URL(this.href).hash; } };
  const client = {
    auth: {
      onAuthStateChange(callback) { calls.push(['auth-listener']); this.callback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      async getUser() { calls.push(['getUser']); return session ? { data: { user: own }, error: null } : { data: { user: null }, error: { name: 'AuthSessionMissingError' } }; },
      async signInWithOtp(args) { calls.push(['requestOtp', args]); return { data: { user: null, session: null }, error: null }; },
      async verifyOtp(args) { calls.push(['verifyOtp', args]); return { data: { user: own, session: {} }, error: null }; },
      async exchangeCodeForSession(code, flow) { calls.push(['exchange', code, flow]); return options.exchangeError ? { data: null, error: { message: 'An error containing sensitive-code-DO-NOT-ECHO' } } : { data: { user: own, session: {} }, error: null }; },
      async refreshSession() { calls.push(['refresh']); return { data: { user: own }, error: null }; },
      async signOut(args) { calls.push(['signOut', args]); return { error: null }; }
    },
    from(table, kind = 'private') {
      const query = { table, filters: [], op: 'read', client: kind }; calls.push(query);
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
  const publicClient = { from: table => client.from(table, 'public') };
  const window = { location, history: { state: { keep: true }, replaceState(state, title, url) { history.push({ state, title, url }); location.href = new URL(url, location.href).href; } }, localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, DESH_CLOUD_CONFIG: { enabled, url: enabled ? 'https://dedicated-project.supabase.co' : '', publishableKey: enabled ? 'sb_publishable_testkey' : '' }, supabase: { createClient(url, key, config) { calls.push(['createClient', url, key, config]); return config.auth.storageKey === 'deshpath.cloud.public' ? publicClient : client; } }, DESH_DATA: { districts: [{ id: 'dhaka' }], places: [{ id: 'sajek' }] } };
  if (options.authReady === false) window.DESH_CLOUD_CONFIG.authReady = false;
  const context = { window, URL, URLSearchParams, TextEncoder, document: { createElement() { pending.push('script'); return {}; }, head: { appendChild() { pending.push('network'); } } }, console };
  vm.runInNewContext(source, context);
  return { api: window.DESH_CLOUD, calls, pending, client, location, history, values };
}
(async () => {
  const off = environment(false);
  assert.equal(off.api.enabled, false); assert.equal(off.api.getStatus().mode, 'local');
  assert.equal(off.api.getStatus().authReady, false);
  await assert.rejects(off.api.getUser(), error => error.code === 'cloud-disabled');
  await assert.rejects(off.api.requestOtp('a@example.com'), error => error.code === 'cloud-disabled');
  off.api.onAuthChange(() => {}); assert.equal(off.calls.length, 0); assert.equal(off.pending.length, 0);
  assert.equal((await off.api.completeAuthCallback()).handled, false);
  const e = environment(true), api = e.api;
  assert.equal(api.enabled, true);
  assert.equal(api.getStatus().authReady, true);
  const setupPending = environment(true, true, 'https://deshpath.vercel.app/', { authReady: false });
  assert.equal(setupPending.api.getStatus().mode, 'cloud-public-only');
  await assert.rejects(setupPending.api.requestOtp('a@example.com'), error => error.code === 'auth-not-ready');
  await assert.rejects(setupPending.api.requestMagicLink('a@example.com'), error => error.code === 'auth-not-ready');
  assert.equal(setupPending.calls.length, 0, 'Pending Auth setup never sends email or initializes the private client');
  await setupPending.api.listApprovedContributions(); assert(setupPending.calls.some(c => c.client === 'public'));
  assert.equal((await setupPending.api.getUser()).id, 'owner-a', 'Existing verified sessions can still be inspected while new-email requests are paused');
  const request = await api.requestOtp('A@EXAMPLE.COM'); assert.equal(request.accepted, true); assert.equal(request.email, 'a@example.com');
  assert.equal(e.calls.find(c => c[0] === 'requestOtp')[1].options.shouldCreateUser, true);
  assert.equal(e.calls.find(c => c[0] === 'requestOtp')[1].options.emailRedirectTo, 'https://deshpath.vercel.app/');
  assert.equal(e.calls.find(c => c[0] === 'createClient')[3].auth.flowType, 'pkce');
  assert.equal(JSON.parse(e.values.get('deshpath.cloud.returnRoute')).hash, '#passport');
  assert.equal((await api.requestMagicLink('a@example.com')).method, 'email');
  await assert.rejects(api.verifyOtp('a@example.com', '12'), error => error.code === 'invalid-otp');
  assert.equal((await api.verifyOtp('a@example.com', '123456')).id, 'owner-a');
  assert.equal((await api.verifyOtp('a@example.com', '12345678')).id, 'owner-a');
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
  assert(e.calls.filter(c => c.table && c.filters.some(f => f[0] === 'status' && f[1] === 'approved')).every(c => c.client === 'public'));
  assert(e.calls.filter(c => c.table && c.filters.some(f => f[0] === 'user_id')).every(c => c.client === 'private'));
  const publicOptions = e.calls.find(c => c[0] === 'createClient' && c[3].auth.storageKey === 'deshpath.cloud.public')[3].auth;
  assert.equal(publicOptions.persistSession, false); assert.equal(publicOptions.autoRefreshToken, false); assert.equal(publicOptions.detectSessionInUrl, false);
  const publicOnly = environment(true); await publicOnly.api.listApprovedContributions();
  assert(!publicOnly.calls.some(c => c[0] === 'getUser' || c[0] === 'auth-listener'));
  const absent = environment(true, false); assert.equal(await absent.api.getUser(), null); await assert.rejects(absent.api.saveJournal({}), error => error.code === 'sign-in-required');
  const callback = environment(true, true, 'https://deshpath.vercel.app/?utm_source=email&code=sensitive-code&sb_flow_id=flow-a#planner');
  const firstCallback = callback.api.completeAuthCallback(), secondCallback = callback.api.completeAuthCallback();
  assert.equal(firstCallback, secondCallback, 'Callback is consumed once even when called concurrently');
  assert.equal(callback.location.href, 'https://deshpath.vercel.app/?utm_source=email#planner', 'URL is cleaned synchronously before auth requests');
  assert.equal((await firstCallback).user.id, 'owner-a');
  assert.equal(callback.calls.filter(c => c[0] === 'exchange').length, 1);
  assert.equal(callback.calls.find(c => c[0] === 'exchange')[2].flowId, 'flow-a');
  assert(callback.calls.findIndex(c => c[0] === 'getUser') > callback.calls.findIndex(c => c[0] === 'exchange'));
  assert.equal(callback.history[0].state.keep, true);
  const restore = environment(true, true, 'https://deshpath.vercel.app/?code=valid', { returnRoute: '#community' });
  await restore.api.completeAuthCallback(); assert.equal(restore.location.href, 'https://deshpath.vercel.app/#community'); assert(!restore.values.has('deshpath.cloud.returnRoute'));
  const noVerifiedUser = environment(true, false, 'https://deshpath.vercel.app/?code=unverified#passport');
  await assert.rejects(noVerifiedUser.api.completeAuthCallback(), error => error.code === 'invalid-auth-link');
  assert.equal(noVerifiedUser.location.href, 'https://deshpath.vercel.app/#passport');
  const failedCallback = environment(true, true, 'https://deshpath.vercel.app/?code=sensitive-code-DO-NOT-ECHO#passport', { exchangeError: true });
  await assert.rejects(failedCallback.api.completeAuthCallback(), error => error.code === 'invalid-auth-link' && !error.message.includes('sensitive-code'));
  assert.equal(failedCallback.location.href, 'https://deshpath.vercel.app/#passport');
  assert.equal((await failedCallback.api.getUser()).id, 'owner-a', 'A failed callback does not permanently block later auth operations');
  const errorURL = environment(true, true, 'https://deshpath.vercel.app/?utm=kept#error=access_denied&error_description=unsafe');
  await assert.rejects(errorURL.api.completeAuthCallback(), error => error.code === 'invalid-auth-link'); assert.equal(errorURL.location.href, 'https://deshpath.vercel.app/?utm=kept');
  assert(!errorURL.calls.some(c => c[0] === 'exchange'));
  const implicit = environment(true, true, 'https://deshpath.vercel.app/#access_token=secret&refresh_token=secret');
  await assert.rejects(implicit.api.completeAuthCallback(), error => error.code === 'invalid-auth-link'); assert.equal(implicit.location.href, 'https://deshpath.vercel.app/');
  const emptyCode = environment(true, true, 'https://deshpath.vercel.app/?code=#games'); await assert.rejects(emptyCode.api.completeAuthCallback(), error => error.code === 'invalid-auth-link'); assert.equal(emptyCode.location.href, 'https://deshpath.vercel.app/#games');
  const local = environment(true, true, 'http://127.0.0.1:4173/#explore'); await local.api.requestMagicLink('a@example.com'); assert.equal(local.calls.find(c => c[0] === 'requestOtp')[1].options.emailRedirectTo, 'http://127.0.0.1:4173/');
  const insecure = environment(true, true, 'http://example.com/'); await assert.rejects(insecure.api.requestMagicLink('a@example.com'), error => error.code === 'invalid-redirect'); assert(!insecure.calls.some(c => c[0] === 'requestOtp'));
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
  console.log('Cloud adapter mock/security assertions passed: disabled mode, OTP+PKCE auth contracts, one-time callback+flow ID, immediate URL cleanup, safe route restoration, verified user, anonymous public-client isolation, owner payloads, pending inserts, input rejection, SQL structure and pinned SDK integrity. No live database or email test was performed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
