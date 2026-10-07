import './style.css';
import { destinations, makeTrip, tripText } from './planner.js';
import { database } from './database.js';
import { createTripStore, readLegacyTrips, escapeHtml } from './trip-store.js';
import { setupAccount } from './account.js';

const icon = (name) => ({ compass: '✳', arrow: '↗', plus: '+', bookmark: '♡', check: '✓' }[name]);
const today = new Date();
const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
let currentTrip;
let saved = [];
const tripStore = createTripStore(database);
let userId = null;
let loadVersion = 0;
let loading = false;
let loadError = '';
let hasMore = false;
let mutating = false;

document.querySelector('#app').innerHTML = `
  <header class="header"><a class="brand" href="#"><span class="brand-icon">${icon('compass')}</span> oneclick<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><a class="active" href="#planner">Plan a trip</a><button id="saved-nav">Saved trips <span id="saved-count">0</span></button><button id="account-nav">Sign in</button></nav></header>
  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><div class="eyebrow"><span></span> LESS PLANNING. MORE LIVING.</div><h1 id="hero-title">Your next adventure,<br>just <em>one click</em> away.</h1><p>Big adventures start with a little idea.<br>Pick a place. Find your pace. We’ll handle the first draft.</p><div class="hero-bottom"><span class="mini-compass">✳</span> A world of possibilities. A plan that feels like you.</div></div>
      <div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="mountain back"></div><div class="mountain front"></div><div class="hill"></div><div class="art-grain"></div><div class="floating-label"><span>↗</span> Somewhere new is calling.</div><span class="art-caption">TAKE THE SCENIC ROUTE</span></div>
    </section>
    <section class="planner" id="planner" aria-labelledby="planner-heading"><div class="section-top"><div><span class="step">01 / THE POSSIBILITIES</span><h2 id="planner-heading">Where are we heading?</h2></div><span class="small-note">A little inspiration to get you going</span></div>
      <div class="destination-grid">${destinations.map((d, index) => `<button class="destination ${d.color} ${index === 0 ? 'selected' : ''}" data-destination="${d.id}" aria-pressed="${index === 0}"><div class="destination-art"><span class="place-symbol">${d.emoji}</span><span class="selection-mark">✓</span><span class="art-lines"></span></div><div class="destination-info"><div><h3>${d.name}</h3><span>${d.country}</span></div><span class="tag">${d.tag}</span></div></button>`).join('')}</div>
      <form id="trip-form"><div class="form-top"><span class="step">02 / MAKE IT YOURS</span><button type="button" id="surprise">Surprise me <span>⤨</span></button></div><div class="form-row"><label>Departure date<input type="date" id="start-date" value="${dateValue}" min="${dateValue}" required></label><label>How long?<select id="days">${Array.from({length:7}, (_, i) => `<option value="${i + 1}" ${i === 2 ? 'selected' : ''}>${i + 1} ${i === 0 ? 'day' : 'days'}</option>`).join('')}</select></label><label>Your travel pace<select id="pace"><option value="relaxed">Slow & easy</option><option value="balanced" selected>A little of everything</option><option value="packed">See it all</option></select></label><button class="primary" type="submit">Plan my trip <span>↗</span></button></div><p class="form-note">✧ &nbsp; Free to explore. Sign in to keep your trips on any device.</p></form>
    </section>
    <section id="result" class="result" hidden aria-labelledby="result-title"></section>
    <section id="saved-section" class="saved-section" hidden aria-labelledby="saved-title"><div class="section-top"><div><span class="step">YOUR LITTLE COLLECTION</span><h2 id="saved-title">Adventures for another day</h2></div><button id="close-saved" class="quiet">Close ×</button></div><div id="account-panel"></div><div id="legacy-import"></div><div id="saved-list" aria-live="polite"></div><button id="load-more" class="secondary" hidden>Load more trips</button></section>
    <section class="bottom-note"><span>✧</span><p>The best part of a trip?<br><strong>The moments you didn’t plan.</strong></p><span class="note-right">We’ll help you get started.<br>You make it an adventure.</span></section>
  </main><footer><span>oneclick. <span class="footer-muted">A little less planning, a lot more world.</span></span><span>Built for the curious.</span></footer><div id="toast" role="status" aria-live="polite"></div>`;

let selected = 'kyoto';
let toastTimeout;
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 3500);
}
function selectDestination(id) {
  selected = id;
  document.querySelectorAll('[data-destination]').forEach(button => {
    const active = button.dataset.destination === id;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('[data-destination]').forEach(button => button.addEventListener('click', () => selectDestination(button.dataset.destination)));
document.querySelector('#surprise').addEventListener('click', () => {
  const alternatives = destinations.filter(d => d.id !== selected);
  const destination = alternatives[Math.floor(Math.random() * alternatives.length)];
  selectDestination(destination.id);
  toast(`${destination.name} is calling. Ready when you are!`);
});

function renderTrip(trip) {
  currentTrip = trip;
  const place = destinations.find(d => d.id === trip.destination);
  const result = document.querySelector('#result');
  result.hidden = false;
  result.innerHTML = `<div class="section-top"><div><span class="step">03 / YOUR NEXT CHAPTER</span><h2 id="result-title" tabindex="-1">${trip.days} ${trip.days === 1 ? 'day' : 'days'} in ${place.name}</h2><p class="trip-meta">${trip.startDate} · ${trip.pace} pace · ${place.country}</p></div><div class="actions"><button id="save-trip" class="secondary">♡ Save trip</button><button id="download-trip" class="secondary">↓ Download</button></div></div><div class="itinerary">${trip.itinerary.map(day => `<article class="day-card"><h3><span>${String(day.day).padStart(2, '0')}</span> Day ${day.day}</h3>${day.activities.map(activity => `<div class="activity"><span>${escapeHtml(activity.time)}</span><p>${escapeHtml(activity.text)}</p></div>`).join('')}</article>`).join('')}</div><p class="sample-note">This is a sample itinerary, not a live booking or availability check. Confirm opening hours, travel requirements, and reservations before you go.</p>`;
  document.querySelector('#save-trip').addEventListener('click', saveTrip);
  document.querySelector('#download-trip').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([tripText(currentTrip)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `oneclick-${currentTrip.destination}-itinerary.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Your itinerary is ready to download.');
  });
  document.querySelector('#result-title').focus({ preventScroll: true });
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelector('#trip-form').addEventListener('submit', event => {
  event.preventDefault();
  try { renderTrip(makeTrip({ destination: selected, days: document.querySelector('#days').value, pace: document.querySelector('#pace').value, startDate: document.querySelector('#start-date').value })); }
  catch (error) { toast(error.message); }
});
function showSaved() {
  document.querySelector('#saved-section').hidden = false;
  document.querySelector('#saved-section').scrollIntoView({ behavior: 'smooth' });
}

async function loadTrips(append = false) {
  if (!userId) return;
  const version = ++loadVersion;
  loading = true;
  loadError = '';
  renderSaved();
  try {
    const page = await tripStore.list(append ? saved.length : 0, userId);
    if (version !== loadVersion) return;
    saved = append ? [...saved, ...page.trips.filter(trip => !saved.some(item => item.id === trip.id))] : page.trips;
    hasMore = page.hasMore;
  } catch {
    if (version !== loadVersion) return;
    loadError = 'Could not load your saved trips. Please check your connection and try again.';
  } finally {
    if (version === loadVersion) { loading = false; renderSaved(); }
  }
}

async function saveTrip() {
  if (!database) { showSaved(); toast('Cloud saving is not configured yet. You can download your itinerary.'); return; }
  if (!userId) { showSaved(); toast('Sign in to save your trip privately.'); return; }
  if (mutating) return;
  const ownerAtStart = userId;
  const trip = currentTrip;
  mutating = true;
  const button = document.querySelector('#save-trip');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const result = await tripStore.save(trip, ownerAtStart);
    if (ownerAtStart !== userId) return;
    toast(result.duplicate ? 'This adventure is already saved in your account.' : 'Trip saved to your account.');
    await loadTrips();
  } catch { if (ownerAtStart === userId) toast('Could not save your trip. Please try again. Your itinerary is still here.'); }
  finally { mutating = false; button.disabled = false; button.textContent = '♡ Save trip'; }
}

async function removeTrip(id) {
  if (mutating) return;
  const ownerAtStart = userId;
  mutating = true;
  renderSaved();
  try {
    await tripStore.remove(id, ownerAtStart);
    if (ownerAtStart !== userId) return;
    saved = saved.filter(trip => trip.id !== id);
    toast('Trip removed from your account.');
    await loadTrips();
  } catch { if (ownerAtStart === userId) toast('Could not remove this trip. Refresh the list and try again.'); }
  finally { mutating = false; renderSaved(); }
}

function renderSaved() {
  document.querySelector('#saved-count').textContent = saved.length + (hasMore ? '+' : '');
  const list = document.querySelector('#saved-list');
  list.setAttribute('aria-busy', String(loading));
  let status = '';
  if (loadError) status = `<p class="empty">${loadError} <button id="retry-trips" class="secondary">Retry</button></p>`;
  else if (loading) status = '<p class="empty">Loading your adventures…</p>';
  else if (userId && !saved.length) status = '<p class="empty">Your collection starts with a little curiosity. Plan a trip above, then save it here.</p>';
  list.innerHTML = status + saved.map((trip, index) => `<article class="saved-card"><div><h3>${destinations.find(d => d.id === trip.destination).name}</h3><p>${trip.days} days · ${trip.startDate} · ${trip.pace}</p></div><div class="actions"><button class="secondary" data-open="${index}">View trip ↗</button><button class="quiet" data-remove="${index}" ${mutating ? 'disabled' : ''} aria-label="Remove saved trip to ${destinations.find(d => d.id === trip.destination).name}">Remove</button></div></article>`).join('');
  list.querySelector('#retry-trips')?.addEventListener('click', () => loadTrips());
  list.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => renderTrip(saved[Number(button.dataset.open)])));
  list.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => removeTrip(saved[Number(button.dataset.remove)].id)));
  const more = document.querySelector('#load-more');
  more.hidden = !hasMore || !userId;
  more.disabled = loading || mutating;
  renderImport();
}

function renderImport() {
  const element = document.querySelector('#legacy-import');
  let count = 0;
  try { count = readLegacyTrips(localStorage).length; } catch { /* Storage may be unavailable. */ }
  element.innerHTML = count ? `<p class="legacy-note">${count} trip${count === 1 ? '' : 's'} saved in this browser. ${userId ? '<button id="import-trips" class="secondary">Import into this account</button>' : 'Sign in to import them into your account.'}</p>` : '';
  element.querySelector('button')?.addEventListener('click', async event => {
    if (mutating) return;
    mutating = true;
    event.currentTarget.disabled = true;
    const ownerAtStart = userId;
    try {
      await tripStore.importLegacy(localStorage, ownerAtStart);
      if (ownerAtStart !== userId) return;
      toast('Browser trips imported into your account.');
      await loadTrips();
    } catch { toast('Import could not finish. Your browser copy is preserved; you can safely retry.'); }
    finally { mutating = false; renderSaved(); }
  });
}

document.querySelector('#load-more').addEventListener('click', () => loadTrips(true));
document.querySelector('#saved-nav').addEventListener('click', () => { showSaved(); if (userId && !loading) void loadTrips(); });
document.querySelector('#close-saved').addEventListener('click', () => { document.querySelector('#saved-section').hidden = true; document.querySelector('#saved-nav').focus(); });
setupAccount(database, nextUserId => {
  userId = nextUserId;
  ++loadVersion; // Ignore any response belonging to the previous account.
  saved = [];
  hasMore = false;
  loading = false;
  loadError = '';
  if (currentTrip?.id) { currentTrip = null; document.querySelector('#result').hidden = true; document.querySelector('#result').innerHTML = ''; }
  renderSaved();
  if (userId) setTimeout(() => { void loadTrips(); }, 0);
}, showSaved);
