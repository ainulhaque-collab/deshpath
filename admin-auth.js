/* Explicit, human-operated administrator account forms. No credential persistence. */
(function (global) {
  'use strict';
  let sequence = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(element, options = {}) {
    if (!element || typeof element.addEventListener !== 'function') throw new TypeError('Choose an administrator sign-in container.');
    const id = 'dpAdminAuth' + (++sequence), cloud = global.DESH_CLOUD;
    const tr = options.tr || ((bn, en) => global.DESH_I18N?.lang === 'en' ? en : bn), esc = options.esc || escape;
    const mode = options.mode === 'account' ? 'account' : 'login';
    let destroyed = false, busy = false, generation = 0, messageCode = '', user = null, role = '', email = '', checked = false;
    const alive = version => !destroyed && element.isConnected !== false && version === generation;
    const field = name => element.querySelector('[name="' + name + '"]');
    const clearSecrets = () => { for (const name of ['password','newPassword','confirmPassword','currentPassword']) { const node = field(name); if (node) node.value = ''; } };
    const messages = {
      'invalid-credentials': ['ইমেইল বা পাসওয়ার্ড যাচাই করা যায়নি। আবার চেষ্টা করুন।','The email or password could not be verified. Please try again.'],
      'invalid-email': ['সঠিক ইমেইল ঠিকানা লিখুন।','Enter a valid email address.'],
      'auth-not-ready': ['লগইনের সেটিংস এখনো সম্পূর্ণ হয়নি।','Sign-in setup is not complete yet.'],
      'cloud-disabled': ['অনলাইন লগইন এখন চালু নেই।','Online sign-in is not enabled.'],
      'auth-unavailable': ['লগইন সেবায় সংযোগ করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।','The sign-in service could not be reached. Please try again later.'],
      'sdk-unavailable': ['লগইনের প্রয়োজনীয় অংশ লোড হয়নি। পেজটি আবার খুলুন।','The sign-in library did not load. Please reload the page.'],
      'cloud-rate-limited': ['অনুরোধের সীমা পূর্ণ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।','The request limit has been reached. Please wait before trying again.'],
      'rate-limited': ['অনুরোধের সীমা পূর্ণ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।','The request limit has been reached. Please wait before trying again.'],
      'admin-required': ['এই অ্যাকাউন্টের দেশপথ পরিচালনার অনুমতি নেই। অনুমোদিত অ্যাকাউন্ট দিয়ে প্রবেশ করুন।','This account does not have Deshpath administrator access. Sign in with an approved account.'],
      'sign-in-required': ['আগে আপনার অ্যাকাউন্টে প্রবেশ করুন।','Sign in to your account first.'],
      'invalid-password': ['নতুন পাসওয়ার্ড ১২ থেকে ১২৮ অক্ষরের হতে হবে।','Choose a new password between 12 and 128 characters.'],
      'weak-password': ['আরও শক্তিশালী পাসওয়ার্ড দিন। দীর্ঘ ও সহজে অনুমান করা যায় না এমন পাসওয়ার্ড বেছে নিন।','Choose a stronger, longer password that is difficult to guess.'],
      'password-unchanged': ['বর্তমান পাসওয়ার্ডের চেয়ে আলাদা পাসওয়ার্ড দিন।','Choose a password different from the current one.'],
      'password-reauth-required': ['নতুন ইমেইল লিংক দিয়ে আবার প্রবেশ করে পাসওয়ার্ড সেভ করুন।','Sign in again with a fresh email link, then save the password.'],
      'password-current-required': ['অ্যাকাউন্টের বর্তমান পাসওয়ার্ড প্রয়োজন। নিচের অতিরিক্ত ঘরে সেটি দিয়ে আবার চেষ্টা করুন।','This account requires its current password. Enter it in the optional field below and try again.'],
      'password-update-failed': ['পাসওয়ার্ড সেভ হয়নি। ইমেইল লিংক দিয়ে আবার প্রবেশ করে চেষ্টা করুন।','The password was not saved. Sign in again with an email link and retry.'],
      'passwords-mismatch': ['দুই ঘরের নতুন পাসওয়ার্ড একই হতে হবে।','Both new password fields must match.'],
      'shared-account-confirmation-required': ['একই অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তনের বিষয়টি বুঝে নিচের সম্মতি দিন।','Acknowledge the shared account password change before saving.'],
      'password-saved': ['পাসওয়ার্ড সেভ হয়েছে। পরের বার এই ইমেইল ও নতুন পাসওয়ার্ড দিয়ে প্রবেশ করতে পারবেন।','Password saved. Next time, sign in with this email and the new password.'],
      'working': ['অনুরোধটি সম্পন্ন হচ্ছে…','Completing your request…'],
      'checking': ['পরিচালনার অনুমতি যাচাই হচ্ছে…','Checking administrator access…'],
      'generic': ['অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।','The request could not be completed. Please try again.']
    };
    function message(code) { const pair = messages[code] || messages.generic; return tr(pair[0],pair[1]); }
    function status(code) {
      messageCode = code;
      const node = element.querySelector('[data-admin-auth-status]');
      if (node) { node.textContent = code ? message(code) : ''; node.dataset.state = code === 'password-saved' ? 'success' : ['working','checking',''].includes(code) ? 'neutral' : 'error'; }
    }
    function setBusy(value) {
      busy = value;
      element.setAttribute('aria-busy', String(value));
      for (const node of element.querySelectorAll('button,input')) node.disabled = value;
    }
    const emailLink = () => '<button type="button" class="dp-admin-auth-link" data-admin-auth-action="email-link">' + tr('ইমেইল লিংক দিয়ে প্রবেশ করুন','Sign in with an email link') + '</button>';
    function render() {
      clearSecrets();
      const ready = cloud?.enabled === true && cloud.getStatus?.().authReady !== false;
      let body;
      if (!ready) body = '<p>' + tr('পরিচালক লগইন এই মুহূর্তে প্রস্তুত নেই।','Administrator sign-in is not ready yet.') + '</p>';
      else if (mode === 'account' && !checked) body = '<p>' + message('checking') + '</p>';
      else if (mode === 'account' && role !== 'owner') body = '<p>' + tr('শুধু যাচাইকৃত মালিক এই পাসওয়ার্ড সেটিং ব্যবহার করতে পারবেন।','Only the verified owner can use this password setting.') + '</p>' + emailLink();
      else if (mode === 'account') body = '<div class="dp-admin-auth-heading"><span class="dp-admin-auth-kicker">' + tr('অ্যাকাউন্টের নিরাপত্তা','Account security') + '</span><h3>' + tr('নিজের লগইন পাসওয়ার্ড','Your sign-in password') + '</h3><p class="dp-admin-auth-email">' + esc(user?.email || '') + '</p></div>' +
        '<p class="dp-admin-auth-disclosure">' + tr('এই পাসওয়ার্ড একই সাইন-ইন অ্যাকাউন্টের। এই প্রকল্পে যুক্ত অন্য সাইটেও একই অ্যাকাউন্ট থাকলে সেখানেও পাসওয়ার্ড বদলাবে। এটি আপনার Gmail বা Google পাসওয়ার্ড নয়।','This changes the password of this shared sign-in account. If the same account is used by another site connected to this project, its password changes there too. This is not your Gmail or Google password.') + '</p>' +
        '<form data-admin-auth-form="password"><div class="dp-admin-auth-fields"><label for="' + id + 'New">' + tr('নতুন পাসওয়ার্ড','New password') + '</label><input id="' + id + 'New" name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="' + id + 'Help"><small id="' + id + 'Help">' + tr('অন্তত ১২ অক্ষরের পাসওয়ার্ড বেছে নিন।','Choose a password of at least 12 characters.') + '</small><label for="' + id + 'Confirm">' + tr('নতুন পাসওয়ার্ড আবার লিখুন','Repeat new password') + '</label><input id="' + id + 'Confirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div>' +
        '<details class="dp-admin-auth-optional"><summary>' + tr('বর্তমান পাসওয়ার্ড প্রয়োজন হলে','If a current password is required') + '</summary><label for="' + id + 'Current">' + tr('এই অ্যাকাউন্টের বর্তমান পাসওয়ার্ড (ঐচ্ছিক)','Current password for this account (optional)') + '</label><input id="' + id + 'Current" name="currentPassword" type="password" autocomplete="current-password" maxlength="1024"></details>' +
        '<label class="dp-admin-auth-consent"><input name="sharedAccount" type="checkbox" required><span>' + tr('আমি বুঝেছি এবং এই অ্যাকাউন্টের পাসওয়ার্ড তৈরি বা পরিবর্তন করতে চাই।','I understand and want to create or change this account’s password.') + '</span></label><button class="dp-admin-auth-primary" type="submit">' + tr('পাসওয়ার্ড সেভ করুন','Save password') + '</button></form>' + emailLink();
      else body = '<div class="dp-admin-auth-heading"><span class="dp-admin-auth-kicker">' + tr('দেশপথ পরিচালনা','Deshpath administration') + '</span><h2>' + tr('পরিচালকের প্রবেশপথ','Administrator sign-in') + '</h2><p>' + tr('অনুমোদিত অ্যাকাউন্টের ইমেইল ও দেশপথের পাসওয়ার্ড দিন।','Use your approved account email and Deshpath sign-in password.') + '</p></div>' +
        '<form data-admin-auth-form="login"><div class="dp-admin-auth-fields"><label for="' + id + 'Email">' + tr('ইমেইল','Email') + '</label><input id="' + id + 'Email" name="email" type="email" autocomplete="username" maxlength="254" required value="' + esc(email) + '"><label for="' + id + 'Password">' + tr('পাসওয়ার্ড','Password') + '</label><input id="' + id + 'Password" name="password" type="password" autocomplete="current-password" maxlength="1024" required></div><button class="dp-admin-auth-primary" type="submit">' + tr('নিরাপদে প্রবেশ করুন','Sign in securely') + '</button></form><p class="dp-admin-auth-note">' + tr('এটি আপনার Gmail পাসওয়ার্ড নয়। প্রথমবার বা পাসওয়ার্ড ভুলে গেলে ইমেইল লিংক ব্যবহার করুন।','This is not your Gmail password. Use an email link for your first visit or if you forgot this password.') + '</p>' + emailLink();
      element.innerHTML = '<section class="dp-admin-auth-card">' + body + '<p class="dp-admin-auth-status" data-admin-auth-status role="status" aria-live="polite"></p>' + (user ? '<button type="button" class="dp-admin-auth-link" data-admin-auth-action="signout">' + tr('এই অ্যাকাউন্ট থেকে বের হন','Sign out of this account') + '</button>' : '') + '</section>';
      status(messageCode); setBusy(busy);
    }
    async function verifyOwner() {
      const version = ++generation;
      if (cloud?.enabled !== true || cloud.getStatus?.().authReady === false) { checked = true; render(); return; }
      try {
        const verified = await cloud.getUser();
        if (!alive(version)) return;
        user = verified;
        const membership = verified ? await cloud.community('admin.status') : null;
        if (!alive(version)) return;
        role = membership?.isAdmin === true ? membership.role : ''; checked = true;
        if (!verified) messageCode = 'sign-in-required';
        else if (role !== 'owner') messageCode = 'admin-required';
        render();
      } catch (error) { if (alive(version)) { checked = true; messageCode = Object.hasOwn(messages,error?.code) ? error.code : 'generic'; render(); } }
    }
    async function submit(event) {
      const form = event.target.closest?.('[data-admin-auth-form]');
      if (!form || !element.contains(form)) return;
      event.preventDefault(); if (busy || destroyed) return;
      const kind = form.dataset.adminAuthForm;
      if (kind !== (mode === 'account' ? 'password' : 'login')) return;
      let password = field(kind === 'login' ? 'password' : 'newPassword')?.value || '';
      let confirmation = field('confirmPassword')?.value || '', currentPassword = field('currentPassword')?.value || '';
      const agreed = field('sharedAccount')?.checked === true;
      email = field('email')?.value?.trim() || email;
      clearSecrets();
      let validation = '';
      if (kind === 'password') {
        if (role !== 'owner' || !user) validation = 'admin-required';
        else if (password.length < 12 || password.length > 128) validation = 'invalid-password';
        else if (password !== confirmation) validation = 'passwords-mismatch';
        else if (!agreed) validation = 'shared-account-confirmation-required';
      } else if (!password) validation = 'invalid-credentials';
      confirmation = '';
      if (validation) { password = ''; currentPassword = ''; status(validation); return; }
      const version = ++generation; setBusy(true); status('working');
      try {
        if (kind === 'login') {
          const verified = await cloud.signInWithPassword(email,password); password = '';
          if (!alive(version)) return;
          user = verified;
          const membership = await cloud.community('admin.status');
          if (!alive(version)) return;
          if (membership?.isAdmin !== true) { role = ''; messageCode = 'admin-required'; render(); return; }
          role = membership.role; status('');
          options.onAuthenticated?.({user,role});
        } else {
          await cloud.setMyAdminPassword(password,currentPassword ? {currentPassword} : {}); password = ''; currentPassword = '';
          if (!alive(version)) return;
          const consent = field('sharedAccount'); if (consent) consent.checked = false;
          status('password-saved'); options.onPasswordChanged?.();
        }
      } catch (error) { if (alive(version)) { status(Object.hasOwn(messages,error?.code) ? error.code : 'generic'); if (kind === 'login' && user) render(); } }
      finally { password = ''; currentPassword = ''; if (alive(version)) { clearSecrets(); setBusy(false); } }
    }
    async function click(event) {
      const button = event.target.closest?.('[data-admin-auth-action]');
      if (!button || !element.contains(button) || busy || destroyed) return;
      if (button.dataset.adminAuthAction === 'email-link') {
        clearSecrets();
        if (options.onNeedsEmailLink) options.onNeedsEmailLink();
        else global.location.hash = '#profile';
      } else if (button.dataset.adminAuthAction === 'signout') {
        const version = ++generation; clearSecrets(); setBusy(true); status('working');
        try { await cloud.signOut(); if (!alive(version)) return; user = null; role = ''; status(''); options.onSignedOut?.(); if (alive(version)) render(); }
        catch (error) { if (alive(version)) status(Object.hasOwn(messages,error?.code) ? error.code : 'generic'); }
        finally { if (alive(version)) setBusy(false); }
      }
    }
    element.addEventListener('submit',submit); element.addEventListener('click',click); render();
    if (mode === 'account') verifyOwner();
    return {
      destroy() { if (destroyed) return; clearSecrets(); destroyed = true; generation++; user = null; email = ''; element.removeEventListener('submit',submit); element.removeEventListener('click',click); },
      refreshLanguage() { if (!destroyed) render(); },
      getSnapshot() { return {mode,busy,messageCode,hasOwnerAccess:role === 'owner'}; }
    };
  }
  global.DESH_ADMIN_AUTH = Object.freeze({mount});
})(window);
