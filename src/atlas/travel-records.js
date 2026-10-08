// Travel-record adapter. The atlas UI talks only to this interface, so a real
// account-backed source can replace the demo one without touching the UI.
//
// interface TravelRecords {
//   source: 'demo' | 'account'
//   persistent: boolean          // false: changes are lost on reload
//   getStatus(cityId): 'explore' | 'wishlist' | 'visited'
//   setStatus(cityId, status): void
//   getJournal(cityId): { isDemo, entries: [{ startDate, endDate, note, photos }] } | null
//   visitedRoute(): cityId[]     // visited cities ordered by first visit
//   subscribe(listener): unsubscribe
// }

export const statuses = ['explore', 'wishlist', 'visited'];

const demoJournals = {
  'new-york': [{ startDate: '2024-10-11', endDate: '2024-10-15', note: 'Walked the Brooklyn Bridge at sunrise before the crowds, then spent a whole afternoon lost in the Met. Jazz in the Village on the last night.', photos: [{ caption: 'Bridge cables at sunrise', scene: 'skyline', hue: 28 }, { caption: 'West Village side street', scene: 'street', hue: 255 }] }],
  'new-orleans': [{ startDate: '2025-03-02', endDate: '2025-03-05', note: 'Beignets at midnight, a brass band on Frenchmen Street, and the streetcar all the way down St. Charles.', photos: [{ caption: 'Balconies in the French Quarter', scene: 'street', hue: 330 }, { caption: 'Mississippi at dusk', scene: 'river', hue: 20 }] }],
  'santa-fe': [{ startDate: '2025-06-18', endDate: '2025-06-21', note: 'The light really is different here. Galleries on Canyon Road, green chile everything, and a thunderstorm rolling over the Sangre de Cristos.', photos: [{ caption: 'High desert after rain', scene: 'desert', hue: 18 }, { caption: 'Adobe wall in late light', scene: 'desert', hue: 36 }] }],
  'san-francisco': [{ startDate: '2025-09-07', endDate: '2025-09-10', note: 'Fog rolled in every afternoon at four. Lands End trail, dumplings in the Richmond, and a long ferry ride across the bay.', photos: [{ caption: 'Fog over the headlands', scene: 'coast', hue: 210 }, { caption: 'Cable car hill', scene: 'skyline', hue: 265 }] }],
};

const demoWishlist = ['honolulu', 'anchorage', 'nashville'];

export function createDemoTravelRecords() {
  const status = new Map();
  for (const id of Object.keys(demoJournals)) status.set(id, 'visited');
  for (const id of demoWishlist) status.set(id, 'wishlist');
  const listeners = new Set();
  const emit = cityId => listeners.forEach(listener => listener(cityId));

  return {
    source: 'demo',
    persistent: false,
    getStatus: cityId => status.get(cityId) || 'explore',
    setStatus(cityId, next) {
      if (!statuses.includes(next)) throw new Error(`Unknown status: ${next}`);
      if (next === 'explore') status.delete(cityId); else status.set(cityId, next);
      emit(cityId);
    },
    getJournal(cityId) {
      if (status.get(cityId) !== 'visited') return null;
      const entries = demoJournals[cityId];
      return entries ? { isDemo: true, entries } : { isDemo: false, entries: [] };
    },
    visitedRoute() {
      const firstVisit = id => demoJournals[id]?.[0]?.startDate || '9999';
      return [...status].filter(([, value]) => value === 'visited').map(([id]) => id).sort((a, b) => firstVisit(a).localeCompare(firstVisit(b)));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
