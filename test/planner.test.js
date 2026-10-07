import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrip, tripText, destinations } from '../src/planner.js';

test('all destinations generate the requested number of days for each pace', () => {
  for (const destination of destinations) for (const pace of ['relaxed', 'balanced', 'packed']) {
    const trip = makeTrip({ destination: destination.id, days: 7, pace, startDate: '2026-11-10' });
    assert.equal(trip.itinerary.length, 7);
    assert.equal(trip.itinerary[0].activities.length, pace === 'packed' ? 4 : 3);
    assert.match(tripText(trip), new RegExp(destination.name));
    assert.match(tripText(trip), /Day 7/);
  }
});
test('invalid planner input is rejected', () => {
  const valid = { destination: 'kyoto', days: 3, pace: 'balanced', startDate: '2026-11-10' };
  for (const override of [{ destination: 'invalid' }, { days: 0 }, { days: 8 }, { days: 1.5 }, { pace: 'invalid' }, { startDate: '' }]) {
    assert.throws(() => makeTrip({ ...valid, ...override }));
  }
});
