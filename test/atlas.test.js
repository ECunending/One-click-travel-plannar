import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cities, latLonToVector, rotationToFace, formatCoordinates } from '../src/atlas/cities.js';
import { createDemoTravelRecords } from '../src/atlas/travel-records.js';
import { isPlannerDestination, plannerDestinationNames } from '../src/planner.js';

test('atlas has twenty uniquely identified US cities with valid coordinates', () => {
  assert.equal(cities.length, 20);
  assert.equal(new Set(cities.map(city => city.id)).size, 20);
  for (const city of cities) {
    assert.ok(city.lat > 18 && city.lat < 72, `${city.name} latitude`);
    assert.ok(city.lon > -170 && city.lon < -65, `${city.name} longitude`);
    assert.equal(city.highlights.length, 3);
  }
});

test('US cities are not planner destinations, so they cannot produce unrelated itineraries', () => {
  for (const city of cities) assert.equal(isPlannerDestination(city.id), false);
  assert.equal(plannerDestinationNames(), 'Kyoto, Lisbon, Bali, and Paris');
});

test('geographic projection matches the sphere texture layout', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  const northPole = latLonToVector(90, 0);
  close(northPole.y, 1);
  const greenwich = latLonToVector(0, 0);
  close(greenwich.x, 1); close(greenwich.z, 0);
  for (const city of cities) {
    const v = latLonToVector(city.lat, city.lon);
    close(Math.hypot(v.x, v.y, v.z), 1);
    // Applying the facing rotation (Y, then X) must bring the city to +z.
    const r = rotationToFace(city.lat, city.lon);
    const x1 = v.x * Math.cos(r.y) + v.z * Math.sin(r.y);
    const z1 = -v.x * Math.sin(r.y) + v.z * Math.cos(r.y);
    const y2 = v.y * Math.cos(r.x) - z1 * Math.sin(r.x);
    const z2 = v.y * Math.sin(r.x) + z1 * Math.cos(r.x);
    close(x1, 0); close(y2, 0); close(z2, 1);
  }
});

test('coordinates format with hemispheres and carried minutes', () => {
  assert.equal(formatCoordinates(40.7128, -74.006), '40°43′ N, 74°00′ W');
  assert.equal(formatCoordinates(-33.99999, 151.2), '34°00′ S, 151°12′ E');
});

test('demo travel records are labelled as non-persistent demo data', () => {
  const records = createDemoTravelRecords();
  assert.equal(records.source, 'demo');
  assert.equal(records.persistent, false);
  const journal = records.getJournal('new-york');
  assert.equal(journal.isDemo, true);
  assert.ok(journal.entries[0].photos.length > 0);
  assert.equal(records.getJournal('seattle'), null);
});

test('status changes notify subscribers and update the visited constellation', () => {
  const records = createDemoTravelRecords();
  const changes = [];
  const unsubscribe = records.subscribe(id => changes.push(id));
  assert.deepEqual(records.visitedRoute(), ['new-york', 'new-orleans', 'santa-fe', 'san-francisco']);
  records.setStatus('seattle', 'visited');
  records.setStatus('new-orleans', 'wishlist');
  assert.deepEqual(records.visitedRoute(), ['new-york', 'santa-fe', 'san-francisco', 'seattle']);
  assert.deepEqual(records.getJournal('seattle'), { isDemo: false, entries: [] });
  records.setStatus('seattle', 'explore');
  assert.equal(records.getStatus('seattle'), 'explore');
  assert.throws(() => records.setStatus('seattle', 'booked'));
  unsubscribe();
  records.setStatus('boston', 'wishlist');
  assert.deepEqual(changes, ['seattle', 'new-orleans', 'seattle']);
});
