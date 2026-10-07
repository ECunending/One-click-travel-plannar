import './style.css';
import { destinations, makeTrip, tripText } from './planner.js';

const icon = (name) => ({ compass: '✳', arrow: '↗', plus: '+', bookmark: '♡', check: '✓' }[name]);
const today = new Date();
const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
let currentTrip;
let saved = [];
try { saved = JSON.parse(localStorage.getItem('oneclick-trips') || '[]').map(item => makeTrip(item)); } catch { saved = []; }

document.querySelector('#app').innerHTML = `
  <header class="header"><a class="brand" href="#"><span class="brand-icon">${icon('compass')}</span> oneclick<span class="brand-dot">.</span></a><nav aria-label="Main navigation"><a class="active" href="#planner">Plan a trip</a><button id="saved-nav">Saved trips <span id="saved-count">${saved.length}</span></button></nav><span class="header-note">Made for your next adventure <span>↗</span></span></header>
  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><div class="eyebrow"><span></span> LESS PLANNING. MORE LIVING.</div><h1 id="hero-title">Your next adventure,<br>just <em>one click</em> away.</h1><p>Big adventures start with a little idea.<br>Pick a place. Find your pace. We’ll handle the first draft.</p><div class="hero-bottom"><span class="mini-compass">✳</span> A world of possibilities. A plan that feels like you.</div></div>
      <div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="mountain back"></div><div class="mountain front"></div><div class="hill"></div><div class="art-grain"></div><div class="floating-label"><span>↗</span> Somewhere new is calling.</div><span class="art-caption">TAKE THE SCENIC ROUTE</span></div>
    </section>
    <section class="planner" id="planner" aria-labelledby="planner-heading"><div class="section-top"><div><span class="step">01 / THE POSSIBILITIES</span><h2 id="planner-heading">Where are we heading?</h2></div><span class="small-note">A little inspiration to get you going</span></div>
      <div class="destination-grid">${destinations.map((d, index) => `<button class="destination ${d.color} ${index === 0 ? 'selected' : ''}" data-destination="${d.id}" aria-pressed="${index === 0}"><div class="destination-art"><span class="place-symbol">${d.emoji}</span><span class="selection-mark">✓</span><span class="art-lines"></span></div><div class="destination-info"><div><h3>${d.name}</h3><span>${d.country}</span></div><span class="tag">${d.tag}</span></div></button>`).join('')}</div>
      <form id="trip-form"><div class="form-top"><span class="step">02 / MAKE IT YOURS</span><button type="button" id="surprise">Surprise me <span>⤨</span></button></div><div class="form-row"><label>Departure date<input type="date" id="start-date" value="${dateValue}" min="${dateValue}" required></label><label>How long?<select id="days">${Array.from({length:7}, (_, i) => `<option value="${i + 1}" ${i === 2 ? 'selected' : ''}>${i + 1} ${i === 0 ? 'day' : 'days'}</option>`).join('')}</select></label><label>Your travel pace<select id="pace"><option value="relaxed">Slow & easy</option><option value="balanced" selected>A little of everything</option><option value="packed">See it all</option></select></label><button class="primary" type="submit">Plan my trip <span>↗</span></button></div><p class="form-note">✧ &nbsp; Free to explore. No account needed. Just a little wanderlust.</p></form>
    </section>
    <section id="result" class="result" hidden aria-labelledby="result-title"></section>
    <section id="saved-section" class="saved-section" hidden aria-labelledby="saved-title"><div class="section-top"><div><span class="step">YOUR LITTLE COLLECTION</span><h2 id="saved-title">Adventures for another day</h2></div><button id="close-saved" class="quiet">Close ×</button></div><div id="saved-list"></div></section>
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
  result.innerHTML = `<div class="section-top"><div><span class="step">03 / YOUR NEXT CHAPTER</span><h2 id="result-title" tabindex="-1">${trip.days} ${trip.days === 1 ? 'day' : 'days'} in ${place.name}</h2><p class="trip-meta">${trip.startDate} · ${trip.pace} pace · ${place.country}</p></div><div class="actions"><button id="save-trip" class="secondary">♡ Save trip</button><button id="download-trip" class="secondary">↓ Download</button></div></div><div class="itinerary">${trip.itinerary.map(day => `<article class="day-card"><h3><span>${String(day.day).padStart(2, '0')}</span> Day ${day.day}</h3>${day.activities.map(activity => `<div class="activity"><span>${activity.time}</span><p>${activity.text}</p></div>`).join('')}</article>`).join('')}</div><p class="sample-note">This is a sample itinerary, not a live booking or availability check. Confirm opening hours, travel requirements, and reservations before you go.</p>`;
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
function persistTrips(next) {
  try {
    localStorage.setItem('oneclick-trips', JSON.stringify(next));
    saved = next;
    document.querySelector('#saved-count').textContent = saved.length;
    renderSaved();
    return true;
  } catch { toast('Your browser could not save this trip. You can download it instead.'); return false; }
}
function saveTrip() {
  if (saved.some(trip => JSON.stringify(trip) === JSON.stringify(currentTrip))) { toast('This adventure is already in your saved trips.'); return; }
  if (persistTrips([...saved, currentTrip])) toast('Trip saved on this browser. Adventure can wait a little.');
}
function renderSaved() {
  const list = document.querySelector('#saved-list');
  list.innerHTML = saved.length ? saved.map((trip, index) => `<article class="saved-card"><div><h3>${destinations.find(d => d.id === trip.destination).name}</h3><p>${trip.days} days · ${trip.startDate} · ${trip.pace}</p></div><div class="actions"><button class="secondary" data-open="${index}">View trip ↗</button><button class="quiet" data-remove="${index}" aria-label="Remove saved trip to ${destinations.find(d => d.id === trip.destination).name}">Remove</button></div></article>`).join('') : '<p class="empty">Your collection starts with a little curiosity. Plan a trip above, then save it here.</p>';
  list.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => renderTrip(saved[Number(button.dataset.open)])));
  list.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { if (persistTrips(saved.filter((_, index) => index !== Number(button.dataset.remove)))) toast('Trip removed from your collection.'); }));
}
document.querySelector('#saved-nav').addEventListener('click', () => {
  renderSaved();
  document.querySelector('#saved-section').hidden = false;
  document.querySelector('#saved-section').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#close-saved').addEventListener('click', () => { document.querySelector('#saved-section').hidden = true; document.querySelector('#saved-nav').focus(); });
