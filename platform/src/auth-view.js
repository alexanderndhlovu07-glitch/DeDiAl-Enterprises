const escapeAuth = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const eye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const googleMark = '<svg class="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>';

function field(name, label, type, autocomplete, options = '') {
  return `<div class="auth-field auth-field--${name}">
    <div class="auth-field-control">
      <input id="auth-${name}" name="${name}" type="${type}" placeholder=" " autocomplete="${autocomplete}" aria-describedby="auth-${name}-error${name === 'password' ? ' auth-password-hint' : ''}" required ${options}>
      <label for="auth-${name}">${label}</label>
      ${name === 'password' ? `<button type="button" class="auth-password-toggle" data-action="toggle-password" aria-label="Show password" aria-pressed="false">${eye}</button>` : '<span class="auth-field-dot" aria-hidden="true"></span>'}
    </div>
    <p class="auth-field-error" id="auth-${name}-error" data-field-error="${name}"></p>
  </div>`;
}

export function authScreen(mode = 'signup') {
  const signup = mode !== 'login';
  return `<section class="auth-screen${signup ? '' : ' auth-screen--login'}" aria-labelledby="auth-title">
    <div class="auth-story">
      <div class="auth-story-top"><span class="eyebrow"><i class="dot"></i> YOUR WORLD. BETTER CONNECTED.</span><span class="auth-story-index" aria-hidden="true">01 — ∞</span></div>
      <div class="auth-story-copy"><h2>One account.<br><span>More possibilities.</span></h2><p>From a service around the corner<br>to your next opportunity across the world.</p></div>
      <div class="auth-art" aria-hidden="true"><i class="auth-orbit auth-orbit--one"></i><i class="auth-orbit auth-orbit--two"></i><i class="auth-orbit auth-orbit--three"></i><div class="auth-art-glass"><img src="public/assets/lex-auth-orb.png" alt="" width="1280" height="1280" decoding="async"></div><span class="auth-art-spark auth-art-spark--one"></span><span class="auth-art-spark auth-art-spark--two"></span></div>
      <div class="auth-story-bottom"><span>LOCAL ROOTS. LIMITLESS REACH.</span><span class="auth-story-arrow" aria-hidden="true">${arrow}</span></div>
    </div>
    <div class="auth-card">
      <a class="auth-back" href="${escapeAuth(window.DEDIAL_CONFIG?.landingUrl||'http://127.0.0.1:4174/')}">${arrow}<span>Back to DeDiAl</span></a>
      <div class="auth-card-heading"><span class="eyebrow">${signup ? 'YOUR NEXT CHAPTER' : 'GOOD TO SEE YOU AGAIN'}</span><h1 id="auth-title">${signup ? 'Welcome to DeDiAl.' : 'Welcome back.'}</h1><p>${signup ? 'Create an account. Make room for more.' : 'Log in and pick up where you left off.'}</p></div>
      <div id="google-signin" class="auth-google"><button type="button" class="google-button" data-action="google-signin">${googleMark}<span>Continue with Google</span></button></div>
      <div class="auth-divider"><span></span><p>or continue with email</p><span></span></div>
      <form id="auth-form" class="auth-form" data-mode="${signup ? 'signup' : 'login'}" novalidate>
        ${signup ? field('name', 'Full name', 'text', 'name', 'maxlength="100"') : ''}
        ${field('email', 'Email address', 'email', 'email', 'maxlength="254" inputmode="email" autocapitalize="none" spellcheck="false"')}
        ${field('password', 'Password', 'password', signup ? 'new-password' : 'current-password', `maxlength="128"${signup ? ' minlength="12"' : ''}`)}
        ${signup ? '<div class="auth-password-help"><div class="auth-strength" data-password-strength data-level="0" aria-hidden="true"><span></span><span></span><span></span></div><p id="auth-password-hint"><span data-password-label>At least 12 characters.</span></p></div>' : '<span id="auth-password-hint" class="auth-visually-hidden">Enter your account password.</span>'}
        <div id="auth-message" class="auth-message" role="alert" hidden></div>
        <button type="submit" class="auth-submit"><span class="auth-submit-label">${signup ? 'Create account' : 'Log in'}</span><span class="auth-submit-motion" aria-hidden="true">${arrow}<i class="auth-spinner"></i></span></button>
        <p class="auth-status" data-auth-status role="status" aria-live="polite"></p>
      </form>
      <p class="auth-switch">${signup ? 'Already have an account?' : 'New to DeDiAl?'} <a href="#${signup ? 'login' : 'signup'}">${signup ? 'Log in' : 'Create an account'} <span aria-hidden="true">↗</span></a></p>
    </div>
  </section>`;
}

export function accountScreen(user) {
  const name = escapeAuth(user?.name || 'Your account');
  const email = escapeAuth(user?.email || '');
  const provider = String(user?.provider || '').toLowerCase() === 'google' ? 'Google' : 'Email';
  const initial = escapeAuth(Array.from(String(user?.name || user?.email || 'D'))[0].toUpperCase());
  return `<section class="account-screen" aria-labelledby="account-title"><div class="account-welcome"><span class="eyebrow"><i class="dot"></i> YOUR WORLD. BETTER CONNECTED.</span><h1 id="account-title">You’re connected.</h1><p>Your next move starts here.</p></div><div class="account-card"><span class="account-avatar" aria-hidden="true">${initial}</span><div class="account-identity"><h2>${name}</h2><p>${email}</p></div><dl class="account-details"><div><dt>Signed in with</dt><dd>${provider}</dd></div><div><dt>Account</dt><dd>Connected <i class="dot" aria-hidden="true"></i></dd></div></dl><a class="auth-submit account-discover" href="#home"><span>Explore DeDiAl</span>${arrow}</a><button type="button" class="account-logout" data-action="logout">Log out ${arrow}</button><p class="auth-status" data-auth-status role="status" aria-live="polite"></p><div id="auth-message" class="auth-message" role="alert" hidden></div></div></section>`;
}

