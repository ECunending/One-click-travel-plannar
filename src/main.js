import './style.css';
import { destinations, makeTrip, tripText, plannerDestinationNames } from './planner.js';
import { setupAtlas } from './atlas/atlas.js';
import { database } from './database.js';
import { createTripStore, readLegacyTrips, escapeHtml } from './trip-store.js';
import { setupAccount } from './account.js';

const today = new Date();
const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const scrollBehavior = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
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
  <a class="skip-link" href="#planner">Skip to the trip planner</a>
  <header class="header"><a class="brand" href="#atlas" aria-label="oneclick atlas, home"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="6.5"/><ellipse cx="16" cy="16" rx="14" ry="5.2" transform="rotate(-24 16 16)"/><circle cx="27.6" cy="10.4" r="1.7"/></svg>oneclick</a><nav aria-label="Main navigation"><a href="#atlas">Atlas</a><a href="#planner">Plan a trip</a><button id="saved-nav" type="button">Saved trips <span id="saved-count">0</span></button><button id="account-nav" type="button">Sign in</button></nav></header>
  <main>
    <section class="atlas" id="atlas" aria-labelledby="hero-title">
      <button type="button" id="skip-intro" class="skip-intro" hidden>Skip intro</button>
      <div class="hero-copy">
        <h1 id="hero-title">There’s a whole world beyond your orbit.</h1>
        <p class="hero-lede">Find your next destination. Turn your travels into a constellation.</p>
        <div class="hero-actions"><button class="primary" id="explore-atlas" type="button">Explore the atlas</button><a class="text-link" href="#city-index">Browse the city index</a></div>
      </div>
      <div class="atlas-stage" id="atlas-stage" tabindex="0" role="group" aria-label="Interactive globe of US cities" aria-describedby="globe-help">
        <div class="marker-layer" id="marker-layer"></div>
      </div>
      <p id="globe-help" class="visually-hidden">Drag to rotate the globe. When the globe is focused, use the arrow keys to rotate, plus and minus to zoom, and zero to reset. Every city is also listed in the city index below.</p>
      <p class="atlas-hint" aria-hidden="true">Choose a point of light, or drag to turn the globe.</p>
      <div class="atlas-legend"><span data-status="visited">Visited</span><span data-status="wishlist">Wishlist</span><span data-status="explore">Not yet</span><span class="legend-demo">Demo travel records</span><span class="static-note">Showing a flat map because 3D graphics aren’t available here.</span></div>
      <div class="globe-controls" role="toolbar" aria-label="Globe view">
        <button type="button" id="zoom-in" class="icon-button" aria-label="Zoom in"><span aria-hidden="true">+</span></button>
        <button type="button" id="zoom-out" class="icon-button" aria-label="Zoom out"><span aria-hidden="true">−</span></button>
        <button type="button" id="reset-view" class="icon-button" aria-label="Reset view"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4"/></svg></button>
      </div>
      <aside id="city-panel" class="city-panel" hidden aria-labelledby="city-name"></aside>
    </section>

    <section class="city-index" id="city-index" aria-labelledby="index-title">
      <div class="index-head"><div><h2 id="index-title">City index</h2><p>Twenty US cities, each placed by its latitude and longitude. Choose one to turn the globe toward it.</p></div>
        <div class="index-filter" role="group" aria-label="Filter cities"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="visited" aria-pressed="false">Visited</button><button type="button" data-filter="wishlist" aria-pressed="false">Wishlist</button></div></div>
      <ul class="index-list" id="city-index-list"></ul>
      <p class="index-demo">Visited and wishlist cities are demo records for this prototype. They aren’t saved to your account.</p>
    </section>

    <section class="planner" id="planner" aria-labelledby="planner-heading"><div class="section-top"><div><h2 id="planner-heading" tabindex="-1">Plan a trip</h2><p class="section-lede">Pick a place and a pace for a first-draft itinerary. Sample itineraries are available for ${plannerDestinationNames()}.</p></div></div>
      <div class="destination-grid">${destinations.map((d, index) => `<button type="button" class="destination ${d.color} ${index === 0 ? 'selected' : ''}" data-destination="${d.id}" aria-pressed="${index === 0}"><span class="place-symbol" aria-hidden="true">${d.emoji}</span><span class="destination-info"><span class="destination-name">${d.name}</span><span class="destination-country">${d.country}</span><span class="tag">${d.tag}</span></span></button>`).join('')}</div>
      <form id="trip-form"><div class="form-row"><label>Departure date<input type="date" id="start-date" value="${dateValue}" min="${dateValue}" required></label><label>How long?<select id="days">${Array.from({length:7}, (_, i) => `<option value="${i + 1}" ${i === 2 ? 'selected' : ''}>${i + 1} ${i === 0 ? 'day' : 'days'}</option>`).join('')}</select></label><label>Your travel pace<select id="pace"><option value="relaxed">Slow & easy</option><option value="balanced" selected>A little of everything</option><option value="packed">See it all</option></select></label><button class="primary" type="submit">Plan my trip</button></div><div class="form-foot"><button type="button" id="surprise" class="text-link">Surprise me</button><p class="form-note">Free to explore. Sign in to keep your trips on any device.</p></div></form>
    </section>
    <section id="result" class="result" hidden aria-labelledby="result-title"></section>
    <section id="saved-section" class="saved-section" hidden aria-labelledby="saved-title"><div class="section-top"><div><h2 id="saved-title">Saved trips</h2><p class="section-lede">Itineraries saved to your account.</p></div><button id="close-saved" type="button" class="quiet">Close</button></div><div id="account-panel"></div><div id="legacy-import"></div><div id="saved-list" aria-live="polite"></div><button id="load-more" type="button" class="secondary" hidden>Load more trips</button></section>
  </main><footer><span class="brand-foot">oneclick</span><span class="footer-muted">Sample itineraries and demo travel records. No bookings, prices, or availability.</span></footer><div id="toast" role="status" aria-live="polite"></div>`;

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
  result.innerHTML = `<div class="section-top"><div><h2 id="result-title" tabindex="-1">${trip.days} ${trip.days === 1 ? 'day' : 'days'} in ${place.name}</h2><p class="trip-meta">${place.country}, starting ${trip.startDate}, ${trip.pace} pace</p></div><div class="actions"><button id="save-trip" type="button" class="secondary">Save trip</button><button id="download-trip" type="button" class="secondary">Download</button></div></div><div class="itinerary">${trip.itinerary.map(day => `<article class="day-card"><h3>Day ${day.day}</h3>${day.activities.map(activity => `<div class="activity"><span>${escapeHtml(activity.time)}</span><p>${escapeHtml(activity.text)}</p></div>`).join('')}</article>`).join('')}</div><p class="sample-note">This is a sample itinerary, not a live booking or availability check. Confirm opening hours, travel requirements, and reservations before you go.</p>`;
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
  result.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}
document.querySelector('#trip-form').addEventListener('submit', event => {
  event.preventDefault();
  try { renderTrip(makeTrip({ destination: selected, days: document.querySelector('#days').value, pace: document.querySelector('#pace').value, startDate: document.querySelector('#start-date').value })); }
  catch (error) { toast(error.message); }
});
function showSaved() {
  document.querySelector('#saved-section').hidden = false;
  document.querySelector('#saved-section').scrollIntoView({ behavior: scrollBehavior() });
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
  finally { mutating = false; button.disabled = false; button.textContent = 'Save trip'; }
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
  list.innerHTML = status + saved.map((trip, index) => `<article class="saved-card"><div><h3>${destinations.find(d => d.id === trip.destination).name}</h3><p>${trip.days} days from ${trip.startDate}, ${trip.pace} pace</p></div><div class="actions"><button class="secondary" data-open="${index}">View trip</button><button class="quiet" data-remove="${index}" ${mutating ? 'disabled' : ''} aria-label="Remove saved trip to ${destinations.find(d => d.id === trip.destination).name}">Remove</button></div></article>`).join('');
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

setupAtlas({
  toast,
  openPlanner() {
    const heading = document.querySelector('#planner-heading');
    document.querySelector('#planner').scrollIntoView({ behavior: scrollBehavior() });
    heading.focus({ preventScroll: true });
  },
});
