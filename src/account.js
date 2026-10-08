export function setupAccount(client, onUserChange, showSaved) {
  const panel = document.querySelector('#account-panel');
  const nav = document.querySelector('#account-nav');
  let currentId;

  function render(user) {
    nav.textContent = user ? 'Account' : 'Sign in';
    if (!client) {
      panel.innerHTML = '<p class="empty">Cloud saving is not configured yet. Your itinerary can still be downloaded.</p>';
      return;
    }
    if (user) {
      panel.innerHTML = '<div class="account-summary"><div><strong>Your private travel collection</strong><p id="account-email"></p></div><button id="sign-out" class="secondary">Sign out</button></div><p id="auth-status" role="status"></p>';
      document.querySelector('#account-email').textContent = user.email || 'Signed in';
      document.querySelector('#sign-out').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) {
          document.querySelector('#auth-status').textContent = 'Could not sign out. Please try again.';
          document.querySelector('#sign-out').disabled = false;
        }
      });
      return;
    }
    panel.innerHTML = `<form id="sign-in-form" class="account-form"><h3>Keep your adventures with you</h3><p>Sign in to save trips privately and find them on any device.</p><label>Email address<input id="account-email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button type="submit" class="primary">Email me a sign-in link</button><p id="auth-status" role="status"></p></form>`;
    document.querySelector('#sign-in-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      const status = form.querySelector('#auth-status');
      button.disabled = true;
      status.textContent = 'Sending your sign-in link…';
      try {
        const { error } = await client.auth.signInWithOtp({
          email: form.querySelector('input').value.trim(),
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        status.textContent = 'Check your inbox for a sign-in link. You can close this form while you wait.';
      } catch {
        status.textContent = 'The sign-in email could not be sent. Please try again later or contact the site owner.';
      } finally { button.disabled = false; }
    });
  }

  nav.addEventListener('click', showSaved);
  render(null);
  if (!client) { onUserChange(null); return; }
  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user || null;
    if (currentId === (user?.id || null)) return;
    currentId = user?.id || null;
    render(user);
    // Callback stays synchronous; database queries run after Auth releases its lock.
    onUserChange(currentId);
  });
}
