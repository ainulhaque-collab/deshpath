/* Supabase adapter. Local mode makes no requests; public reads and sign-in have separate gates. */
(function (global) {
  'use strict';
  const config = global.DESH_CLOUD_CONFIG || {};
  const validURL = typeof config.url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url);
  const validKey = typeof config.publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  const enabled = config.enabled === true && validURL && validKey;
  const authReady = enabled && config.authReady !== false;
  const subscribers = new Set();
  let clientPromise = null, publicClientPromise = null, sdkPromise = null, callbackPromise = null;
  const routeKey = 'deshpath.cloud.returnRoute';
  class CloudError extends Error {
    constructor(code, message) { super(message); this.name = 'DeshpathCloudError'; this.code = code; }
  }
  const fail = (code, message) => { throw new CloudError(code, message); };
  function assertEnabled() {
    if (!enabled) fail('cloud-disabled', 'Cloud features are not configured. Your data is still stored only in this browser.');
  }
  function safeUser(user) { return user?.id && user.email && user.is_anonymous !== true ? { id: user.id, email: user.email } : null; }
  function check(result, operation) {
    if (result.error) {
      const duplicate = result.error.code === '23505';
      fail(duplicate ? 'already-submitted' : 'cloud-request-failed', duplicate ? 'You have already submitted a review for this place.' : operation + ': ' + (result.error.message || 'The request could not be completed.'));
    }
    return result.data;
  }
  function loadSDK() {
    if (typeof global.supabase?.createClient === 'function') return Promise.resolve(global.supabase);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/vendor/supabase-js-2.118.0.js';
      script.integrity = 'sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK';
      script.crossOrigin = 'anonymous'; script.async = true;
      script.onload = () => typeof global.supabase?.createClient === 'function' ? resolve(global.supabase) : reject(new CloudError('sdk-unavailable', 'The cloud library could not be initialised.'));
      script.onerror = () => { script.remove(); reject(new CloudError('sdk-unavailable', 'The cloud library could not be loaded. Try again when online.')); };
      document.head.appendChild(script);
    }).catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }
  function client() {
    assertEnabled();
    if (!clientPromise) {
      clientPromise = loadSDK().then(sdk => {
        const instance = sdk.createClient(config.url, config.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', storageKey: 'deshpath.cloud.auth' }
        });
        // Never await another auth call in the SDK's synchronous auth callback.
        instance.auth.onAuthStateChange((event, session) => {
          Promise.resolve().then(() => subscribers.forEach(callback => {
            try { callback(event, safeUser(session?.user)); } catch { /* A view callback must not break auth refresh. */ }
          }));
        });
        return instance;
      }).catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }
  function publicClient() {
    assertEnabled();
    if (!publicClientPromise) {
      publicClientPromise = loadSDK().then(sdk => sdk.createClient(config.url, config.publishableKey, {
        // An isolated, nonpersisted client must never read the signed-in user's session.
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'deshpath.cloud.public' }
      })).catch(error => { publicClientPromise = null; throw error; });
    }
    return publicClientPromise;
  }
  const safeRoute = value => typeof value === 'string' && /^#[a-z][a-z0-9-]{0,60}$/i.test(value) ? value : '';
  function rememberRoute() {
    try {
      const hash = safeRoute(global.location.hash);
      if (hash) global.localStorage.setItem(routeKey, JSON.stringify({ hash, at: Date.now() }));
      else global.localStorage.removeItem(routeKey);
    } catch { /* Route restoration is optional; browser privacy settings may block storage. */ }
  }
  function consumeRoute() {
    try {
      const saved = JSON.parse(global.localStorage.getItem(routeKey) || 'null');
      global.localStorage.removeItem(routeKey);
      if (saved && Date.now() - saved.at >= 0 && Date.now() - saved.at < 86400000) return safeRoute(saved.hash);
    } catch { /* Never fail authentication because an optional route could not be read. */ }
    return '';
  }
  function redirectURL() {
    let url;
    try { url = new URL(global.location.href); } catch { fail('invalid-redirect', 'A valid website URL is required for email sign-in.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) fail('invalid-redirect', 'Email sign-in requires HTTPS or a local development address.');
    return url.origin + url.pathname;
  }
  async function requestEmail(value) {
    assertEnabled();
    if (!authReady) fail('auth-not-ready', 'Email sign-in is waiting for the project owner to verify Deshpath redirect URLs and the shared email settings. Public browsing and local journals remain available.');
    const instance = await client(), email = emailValue(value), emailRedirectTo = redirectURL();
    check(await instance.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } }), 'Could not request a sign-in email');
    rememberRoute();
    return { accepted: true, email, method: 'email' }; // The shared project's existing template decides whether a link, code, or both are included.
  }
  function completeAuthCallback() {
    if (callbackPromise) return callbackPromise;
    let url;
    try { url = new URL(global.location.href); } catch { return Promise.resolve({ handled: false }); }
    const authKeys = ['code', 'sb_flow_id', 'error', 'error_code', 'error_description', 'token_hash', 'access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'type'];
    const fragment = new URLSearchParams(url.hash.slice(1));
    const code = url.searchParams.get('code');
    const flowId = url.searchParams.get('sb_flow_id');
    const hasCode = url.searchParams.has('code');
    const failed = url.searchParams.has('error') || url.searchParams.has('error_code') || url.searchParams.has('error_description') || fragment.has('error') || fragment.has('error_code') || fragment.has('error_description');
    const tokenFragment = fragment.has('access_token') || fragment.has('refresh_token') || fragment.has('token_hash');
    const unsupported = url.searchParams.has('token_hash') || url.searchParams.has('access_token') || url.searchParams.has('refresh_token') || tokenFragment;
    if (!hasCode && !failed && !unsupported) return Promise.resolve({ handled: false });
    // Remove credentials and auth errors before loading the SDK or making a request.
    // Keep all unrelated query parameters and valid hash-based application routes.
    for (const key of authKeys) url.searchParams.delete(key);
    const existingRoute = safeRoute(url.hash);
    const rememberedRoute = consumeRoute();
    if (tokenFragment || failed && !existingRoute) url.hash = '';
    if (!safeRoute(url.hash)) url.hash = existingRoute || rememberedRoute;
    global.history.replaceState(global.history.state, '', url.pathname + url.search + url.hash);
    callbackPromise = (async () => {
      assertEnabled();
      if (failed || unsupported || !code || code.length > 4096 || flowId && flowId.length > 256) fail('invalid-auth-link', 'This sign-in link is expired or unsupported. Request a new email, then open its link in the same browser and device.');
      const instance = await client();
      const exchanged = flowId ? await instance.auth.exchangeCodeForSession(code, { flowId }) : await instance.auth.exchangeCodeForSession(code);
      if (exchanged.error) fail('invalid-auth-link', 'The sign-in link could not be verified. Request a new email and use the same browser and device where you requested it.');
      const user = await getUser();
      if (!user) fail('invalid-auth-link', 'The sign-in session could not be verified. Request a new sign-in email.');
      return { handled: true, user };
    })();
    return callbackPromise;
  }
  function emailValue(value) {
    const email = String(value || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('invalid-email', 'Enter a valid email address.');
    return email;
  }
  function text(value, min, max, field) {
    const result = String(value ?? '').trim();
    if (result.length < min || result.length > max) fail('invalid-input', field + ' must contain ' + min + '–' + max + ' characters.');
    return result;
  }
  function dataId(value, collection, field) {
    const id = String(value || '');
    if (!global.DESH_DATA?.[collection]?.some(item => item.id === id)) fail('invalid-input', 'Choose a valid ' + field + '.');
    return id;
  }
  async function getUser() {
    const instance = await client();
    const result = await instance.auth.getUser();
    if (result.error?.name === 'AuthSessionMissingError') return null;
    const data = check(result, 'Could not verify your sign-in');
    return safeUser(data?.user);
  }
  async function requireUser() {
    const user = await getUser();
    if (!user) fail('sign-in-required', 'Sign in with a verified email before using cloud storage.');
    return user;
  }
  function journalSnapshot(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid-journal', 'The journal must be a JSON object.');
    let json;
    try { json = JSON.stringify(value); } catch { fail('invalid-journal', 'The journal could not be converted to JSON.'); }
    if (new TextEncoder().encode(json).length > 262144) fail('journal-too-large', 'This journal is too large for a cloud snapshot. Keep photos in the local gallery.');
    // Session credentials and image files belong outside a journal snapshot.
    const forbidden = new Set(['password', 'accesstoken', 'refreshtoken', 'servicerole', 'secretkey', 'photodata', 'dataurl', 'blob']);
    const walk = (item, depth = 0) => {
      if (!item || typeof item !== 'object') return;
      if (depth > 24) fail('invalid-journal', 'The journal contains too many nested objects.');
      for (const [key, child] of Object.entries(item)) {
        if (forbidden.has(key.replace(/[-_]/g, '').toLowerCase()) || (typeof child === 'string' && /^data:/i.test(child))) fail('invalid-journal', 'Do not include credentials or embedded files in a cloud journal.');
        walk(child, depth + 1);
      }
    };
    const clean = JSON.parse(json); walk(clean); return clean;
  }
  const api = {
    get enabled() { return enabled; },
    getStatus() { return { enabled, authReady, mode: enabled ? authReady ? 'cloud-ready' : 'cloud-public-only' : 'local', reason: enabled ? authReady ? null : 'auth-setup-pending' : config.enabled === true ? 'invalid-configuration' : 'not-configured' }; },
    getUser,
    requestOtp: requestEmail,
    requestMagicLink: requestEmail,
    completeAuthCallback,
    async verifyOtp(value, suppliedToken) {
      const instance = await client(), email = emailValue(value), token = String(suppliedToken || '').trim();
      if (!/^\d{6,10}$/.test(token)) fail('invalid-otp', 'Enter the code from your sign-in email, if it includes one.');
      check(await instance.auth.verifyOtp({ email, token, type: 'email' }), 'Could not verify the sign-in code');
      return getUser();
    },
    async refreshSession() {
      const instance = await client(); check(await instance.auth.refreshSession(), 'Could not refresh your sign-in'); return getUser();
    },
    async signOut() {
      const instance = await client(); check(await instance.auth.signOut({ scope: 'local' }), 'Could not sign out'); return { signedOut: true };
    },
    onAuthChange(callback) {
      if (typeof callback !== 'function') return () => {};
      subscribers.add(callback);
      if (enabled) client().catch(() => { try { callback('UNAVAILABLE', null); } catch {} });
      return () => subscribers.delete(callback);
    },
    async saveJournal(snapshot) {
      const instance = await client(), user = await requireUser(), clean = journalSnapshot(snapshot);
      const row = check(await instance.from('deshpath_journals').upsert({ user_id: user.id, snapshot: clean }, { onConflict: 'user_id' }).select('snapshot,updated_at').single(), 'Could not save your journal');
      return { snapshot: row.snapshot, updatedAt: row.updated_at };
    },
    async loadJournal() {
      const instance = await client(), user = await requireUser();
      const row = check(await instance.from('deshpath_journals').select('snapshot,updated_at').eq('user_id', user.id).maybeSingle(), 'Could not load your journal');
      return row ? { snapshot: row.snapshot, updatedAt: row.updated_at } : null;
    },
    async submitContribution(input = {}) {
      const instance = await client(), user = await requireUser();
      const payload = { user_id: user.id, district_id: dataId(input.districtId, 'districts', 'district'), title: text(input.title, 3, 120, 'Title'), body: text(input.body, 20, 4000, 'Story') };
      const row = check(await instance.from('deshpath_contributions').insert(payload).select('id,district_id,title,body,status,created_at').single(), 'Could not submit your story');
      return row;
    },
    async submitReview(input = {}) {
      const instance = await client(), user = await requireUser(), rating = Number(input.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('invalid-input', 'Choose a rating from 1 to 5.');
      const payload = { user_id: user.id, place_id: dataId(input.placeId, 'places', 'destination'), rating, body: text(input.body, 10, 2000, 'Review') };
      return check(await instance.from('deshpath_reviews').insert(payload).select('id,place_id,rating,body,status,created_at').single(), 'Could not submit your review');
    },
    async listApprovedContributions() {
      const instance = await publicClient();
      return check(await instance.from('deshpath_contributions').select('id,district_id,title,body,published_at').eq('status', 'approved').order('published_at', { ascending: false }).limit(100), 'Could not load published stories') || [];
    },
    async listApprovedReviews(placeId) {
      const instance = await publicClient();
      let query = instance.from('deshpath_reviews').select('id,place_id,rating,body,published_at').eq('status', 'approved');
      if (placeId) query = query.eq('place_id', dataId(placeId, 'places', 'destination'));
      return check(await query.order('published_at', { ascending: false }).limit(100), 'Could not load published reviews') || [];
    },
    async listMySubmissions() {
      const instance = await client(), user = await requireUser();
      const [stories, reviews] = await Promise.all([
        instance.from('deshpath_contributions').select('id,district_id,title,body,status,created_at,published_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        instance.from('deshpath_reviews').select('id,place_id,rating,body,status,created_at,published_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      ]);
      return { contributions: check(stories, 'Could not load your stories') || [], reviews: check(reviews, 'Could not load your reviews') || [] };
    }
  };
  global.DESH_CLOUD = Object.freeze(api);
})(window);
