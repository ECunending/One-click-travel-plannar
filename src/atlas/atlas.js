import { cities, findCity, formatCoordinates } from './cities.js';
import { createDemoTravelRecords } from './travel-records.js';
import { demoPhotoSvg } from './demo-photo.js';
import { plannerDestinationNames } from '../planner.js';

const STATUS_LABEL = { explore: 'Explore', wishlist: 'Wishlist', visited: 'Visited' };
const STATUS_DESCRIPTION = { explore: 'Not yet', wishlist: 'On your wishlist', visited: 'Visited' };
const TIERS = {
  high: { name: 'high', particles: 16000, stars: 2600, texture: 4096, pixelRatio: 2 },
  medium: { name: 'medium', particles: 8000, stars: 1500, texture: 2048, pixelRatio: 1.5 },
  low: { name: 'low', particles: 3500, stars: 700, texture: 2048, pixelRatio: 1 },
};
// Flat-map window used when WebGL is unavailable: the US including Alaska and Hawaii.
const STATIC_BOUNDS = [-162, 17, -64, 66];

export function detectTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (navigator.connection?.saveData || cores <= 2 || memory <= 2) return TIERS.low;
  if (window.matchMedia('(max-width: 700px)').matches || cores <= 4) return TIERS.medium;
  return TIERS.high;
}

function webglAvailable() {
  if (new URLSearchParams(location.search).get('atlas') === 'static') return false;
  try { const canvas = document.createElement('canvas'); return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')); } catch { return false; }
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const formatRange = (start, end) => dateFormat.formatRange(new Date(start), new Date(end));

export function setupAtlas({ toast, openPlanner, records = createDemoTravelRecords() }) {
  const root = document.querySelector('#atlas');
  const stage = document.querySelector('#atlas-stage');
  const markerLayer = document.querySelector('#marker-layer');
  const panel = document.querySelector('#city-panel');
  const index = document.querySelector('#city-index-list');
  const skip = document.querySelector('#skip-intro');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 860px)');
  let globe = null;
  let selectedId = null;
  let filter = 'all';
  let exploring = false;

  // DOM markers: real buttons over the 3D points, so hover, focus, and screen readers all work.
  markerLayer.innerHTML = cities.map(city => `<button type="button" class="city-marker" data-city="${city.id}" tabindex="-1"><span class="marker-dot" aria-hidden="true"></span><span class="marker-label">${city.name}</span></button>`).join('');
  const markerButtons = new Map([...markerLayer.querySelectorAll('[data-city]')].map(button => [button.dataset.city, button]));
  markerButtons.forEach((button, id) => {
    button.addEventListener('click', () => selectCity(id, { from: 'globe' }));
    button.addEventListener('pointerenter', () => globe?.setHovered(id));
    button.addEventListener('pointerleave', () => globe?.setHovered(null));
    button.addEventListener('focus', () => globe?.setHovered(id));
    button.addEventListener('blur', () => globe?.setHovered(null));
  });

  function refreshMarkerStates() {
    markerButtons.forEach((button, id) => {
      const status = records.getStatus(id);
      const city = findCity(id);
      button.dataset.status = status;
      button.classList.toggle('is-selected', id === selectedId);
      button.setAttribute('aria-label', `${city.name}, ${city.region}. ${STATUS_DESCRIPTION[status]}.`);
    });
  }

  function placeMarkers(projected) {
    for (const point of projected) {
      const button = markerButtons.get(point.id);
      const visible = point.facing > 0.12;
      button.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
      if (button.classList.contains('is-visible') !== visible) {
        button.classList.toggle('is-visible', visible);
        button.tabIndex = visible ? 0 : -1;
        if (!visible && document.activeElement === button) stage.focus({ preventScroll: true });
      }
    }
  }

  // City index: the complete, non-3D way to browse every city.
  function renderIndex() {
    const visible = cities.filter(city => filter === 'all' || records.getStatus(city.id) === filter);
    index.innerHTML = visible.length ? visible.map(city => {
      const status = records.getStatus(city.id);
      return `<li><button type="button" class="index-city" data-index-city="${city.id}" data-status="${status}" aria-current="${city.id === selectedId}"><span class="index-dot" aria-hidden="true"></span><span class="index-name">${city.name}</span><span class="index-region">${city.region}</span><span class="index-coords">${formatCoordinates(city.lat, city.lon)}</span><span class="index-status">${STATUS_DESCRIPTION[status]}</span></button></li>`;
    }).join('') : `<li class="index-empty">No ${filter === 'visited' ? 'visited cities' : 'wishlist cities'} yet. Open a city and mark it ${STATUS_LABEL[filter]}.</li>`;
    index.querySelectorAll('[data-index-city]').forEach(button => button.addEventListener('click', () => selectCity(button.dataset.indexCity, { from: 'index' })));
  }
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderIndex();
  }));

  function journalMarkup(cityId) {
    const journal = records.getJournal(cityId);
    if (!journal) return '';
    if (!journal.entries.length) return `<section class="journal" aria-labelledby="journal-title"><h3 id="journal-title">Travel journal</h3><p class="journal-empty">You marked this city as visited. Writing your own journal entries isn’t available in this prototype yet.</p></section>`;
    return `<section class="journal" aria-labelledby="journal-title"><div class="journal-head"><h3 id="journal-title">Travel journal</h3>${journal.isDemo ? '<span class="demo-badge">Demo record</span>' : ''}</div>${journal.entries.map(entry => `<article class="journal-entry"><p class="journal-dates"><time datetime="${entry.startDate}">${formatRange(entry.startDate, entry.endDate)}</time></p><div class="journal-photos">${entry.photos.map(photo => `<figure><div class="photo-frame">${demoPhotoSvg(photo)}<span class="demo-badge">Demo photo</span></div><figcaption>${photo.caption}</figcaption></figure>`).join('')}</div><p class="journal-note">${entry.note}</p></article>`).join('')}</section>`;
  }

  function renderPanel() {
    const city = findCity(selectedId);
    root.classList.toggle('has-city', Boolean(city));
    if (!city) { panel.hidden = true; return; }
    const status = records.getStatus(city.id);
    panel.hidden = false;
    panel.dataset.status = status;
    panel.innerHTML = `
      <div class="panel-head"><div><p class="panel-region">${city.region}</p><h2 id="city-name" tabindex="-1">${city.name}</h2><p class="panel-coords">${formatCoordinates(city.lat, city.lon)}</p></div><button type="button" class="icon-button" id="close-city" aria-label="Close ${city.name}"><span aria-hidden="true">×</span></button></div>
      <div class="status-switch" role="group" aria-label="Your status for ${city.name}">${Object.entries(STATUS_LABEL).map(([value, label]) => `<button type="button" data-status-value="${value}" aria-pressed="${value === status}">${label}</button>`).join('')}</div>
      <p class="panel-blurb">${city.blurb}</p>
      ${status === 'visited' ? journalMarkup(city.id) : `<h3 class="panel-subhead">${status === 'wishlist' ? 'Saved for someday' : 'Places to begin'}</h3><ul class="highlights">${city.highlights.map(item => `<li>${item}</li>`).join('')}</ul>`}
      <div class="panel-planner"><p>Sample itineraries aren’t available for ${city.name} yet. The planner currently covers ${plannerDestinationNames()}.</p><button type="button" class="secondary" id="open-planner">Open the planner</button></div>
      <p class="panel-demo">Demo data: statuses and journals here are examples. Changes stay on this page and reset when you reload.</p>`;
    panel.querySelector('#close-city').addEventListener('click', closeCity);
    panel.querySelector('#open-planner').addEventListener('click', openPlanner);
    panel.querySelectorAll('[data-status-value]').forEach(button => button.addEventListener('click', () => {
      const next = button.dataset.statusValue;
      if (next === records.getStatus(city.id)) return;
      records.setStatus(city.id, next);
      toast(next === 'visited' ? `${city.name} marked as visited in this demo. It now glows gold.` : next === 'wishlist' ? `${city.name} added to your demo wishlist.` : `${city.name} is back to Explore.`);
      panel.querySelector(`[data-status-value="${next}"]`)?.focus();
    }));
  }

  records.subscribe(() => {
    refreshMarkerStates();
    renderIndex();
    globe?.refreshStatuses();
    const focused = document.activeElement?.dataset?.statusValue;
    renderPanel();
    if (focused) panel.querySelector(`[data-status-value="${focused}"]`)?.focus();
  });

  function updateFrame() {
    if (!globe) return;
    if (!exploring) globe.setFrame(narrow.matches ? { y: -0.2 } : { x: 0.2 });
    else if (selectedId) globe.setFrame(narrow.matches ? { y: -0.24 } : { x: -0.17 });
    else globe.setFrame({});
  }
  narrow.addEventListener('change', updateFrame);

  function selectCity(id, { from } = {}) {
    if (!findCity(id)) return;
    enterAtlas({ scroll: from === 'index' });
    selectedId = id;
    globe?.skipIntro();
    globe?.focusCity(id);
    globe?.setSelected(id);
    refreshMarkerStates();
    renderIndex();
    renderPanel();
    updateFrame();
    panel.querySelector('#city-name').focus({ preventScroll: true });
  }

  function closeCity() {
    const previous = selectedId;
    selectedId = null;
    globe?.setSelected(null);
    refreshMarkerStates();
    renderIndex();
    renderPanel();
    updateFrame();
    const marker = markerButtons.get(previous);
    (marker?.classList.contains('is-visible') ? marker : stage).focus({ preventScroll: true });
  }

  function enterAtlas({ scroll = true } = {}) {
    if (!exploring) {
      exploring = true;
      root.classList.add('is-exploring');
      globe?.skipIntro();
      globe?.reset();
      updateFrame();
    }
    if (scroll) root.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  document.querySelector('#explore-atlas').addEventListener('click', () => { enterAtlas(); stage.focus({ preventScroll: true }); });
  document.querySelector('#zoom-in').addEventListener('click', () => globe?.zoomIn());
  document.querySelector('#zoom-out').addEventListener('click', () => globe?.zoomOut());
  document.querySelector('#reset-view').addEventListener('click', () => { globe?.reset(); if (selectedId) closeCity(); });
  skip.addEventListener('click', () => globe?.skipIntro());

  stage.addEventListener('keydown', event => {
    if (event.target !== stage || !globe) return;
    const step = 0.12;
    const actions = { ArrowLeft: () => globe.rotate(step, 0), ArrowRight: () => globe.rotate(-step, 0), ArrowUp: () => globe.rotate(0, step), ArrowDown: () => globe.rotate(0, -step), '+': globe.zoomIn, '=': globe.zoomIn, '-': globe.zoomOut, '0': globe.reset };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (globe && !globe.introDone) globe.skipIntro();
    else if (selectedId && root.contains(document.activeElement)) closeCity();
  });

  if (!reducedMotion.matches) skip.hidden = false;

  function endIntro() { skip.hidden = true; root.classList.add('intro-done'); }

  function startStatic(geography) {
    root.classList.add('is-static');
    endIntro();
    const canvas = document.createElement('canvas');
    canvas.className = 'static-map';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = 1960; canvas.height = 980;
    stage.prepend(canvas);
    if (geography) import('./geo.js').then(({ drawMap }) => drawMap(canvas, geography, { bounds: STATIC_BOUNDS }));
    const [west, south, east, north] = STATIC_BOUNDS;
    const place = () => {
      const rect = canvas.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      placeMarkers(cities.map(city => ({ id: city.id, facing: 1, x: rect.left - stageRect.left + ((city.lon - west) / (east - west)) * rect.width, y: rect.top - stageRect.top + ((north - city.lat) / (north - south)) * rect.height })));
    };
    new ResizeObserver(place).observe(stage);
    place();
  }

  refreshMarkerStates();
  renderIndex();

  // Load geography and Three.js after first paint; the page is usable meanwhile.
  (async () => {
    let geography = null;
    try { geography = await (await import('./geo.js')).loadGeography(); } catch { /* Fall through to the flat fallback without a map. */ }
    if (!geography || !webglAvailable()) { startStatic(geography); return; }
    try {
      const { createGlobe } = await import('./globe.js');
      globe = createGlobe({ container: stage, geography, cities, records, tier: detectTier(), reducedMotion: reducedMotion.matches, onFrame: placeMarkers, onIntroEnd: endIntro });
      root.classList.add('is-3d');
      if (reducedMotion.matches) endIntro();
      updateFrame();
      if (exploring) { globe.skipIntro(); globe.reset(); }
      if (selectedId) { globe.focusCity(selectedId); globe.setSelected(selectedId); }
    } catch {
      globe = null;
      startStatic(geography);
    }
  })();

  return { selectCity };
}
