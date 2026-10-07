import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTripStore, readLegacyTrips, escapeHtml, validateTrip } from '../src/trip-store.js';
import { makeTrip } from '../src/planner.js';

const trip = makeTrip({ destination: 'kyoto', days: 3, pace: 'balanced', startDate: '2026-11-10' });
function storage() {
  const values = new Map([['oneclick-trips', JSON.stringify([trip])]]);
  return { getItem: key => values.get(key), removeItem: key => values.delete(key) };
}
function client({ insertError = null, userId = 'owner-a', deleteRows = [{ id: 'trip-a' }] } = {}) {
  const calls = [];
  const db = {
    calls,
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table) {
      calls.push(['table', table]);
      return {
        insert(row) {
          calls.push(['insert', row]);
          return { select: () => ({ single: async () => ({ data: { ...row, id: 'trip-a' }, error: insertError }) }) };
        },
        delete() {
          const query = { eq: (key, value) => { calls.push(['filter', key, value]); return query; }, select: async () => ({ data: deleteRows, error: null }) };
          return query;
        },
      };
    },
  };
  return db;
}

test('unauthenticated users cannot read, save, or delete through the store', async () => {
  const db = client({ userId: null });
  const store = createTripStore(db);
  await assert.rejects(() => store.list(), /sign in/);
  await assert.rejects(() => store.save(trip), /sign in/);
  await assert.rejects(() => store.remove('trip-a'), /sign in/);
  assert.equal(db.calls.length, 0);
});
test('save uses the verified user and ignores caller-supplied ownership', async () => {
  const db = client();
  const result = await createTripStore(db).save({ ...trip, user_id: 'victim' });
  assert.equal(db.calls[1][1].user_id, 'owner-a');
  assert.deepEqual(result.trip.itinerary, trip.itinerary);
});
test('database uniqueness is treated as an already-saved trip', async () => {
  assert.deepEqual(await createTripStore(client({ insertError: { code: '23505' } })).save(trip), { duplicate: true });
});
test('failed import preserves browser data, successful retry clears it', async () => {
  const local = storage();
  await assert.rejects(() => createTripStore(client({ insertError: { code: 'offline' } })).importLegacy(local));
  assert.equal(readLegacyTrips(local).length, 1);
  assert.equal(await createTripStore(client()).importLegacy(local), 1);
  assert.equal(readLegacyTrips(local).length, 0);
});
test('account switching prevents a pending operation from targeting a different account', async () => {
  const db = client({ userId: 'owner-b' });
  const store = createTripStore(db);
  await assert.rejects(() => store.save(trip, 'owner-a'), /account changed/);
  await assert.rejects(() => store.importLegacy(storage(), 'owner-a'), /account changed/);
  assert.equal(db.calls.length, 0);
});
test('delete checks both owner and id and does not report success for missing rows', async () => {
  const db = client({ deleteRows: [] });
  await assert.rejects(() => createTripStore(db).remove('trip-a'), /already removed/);
  assert.deepEqual(db.calls.slice(1), [['filter', 'id', 'trip-a'], ['filter', 'user_id', 'owner-a']]);
});
test('invalid stored data is rejected and remote text is escaped for rendering', () => {
  assert.throws(() => validateTrip({ ...trip, itinerary: [] }));
  assert.throws(() => validateTrip({ ...trip, startDate: '2026-02-31' }));
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
