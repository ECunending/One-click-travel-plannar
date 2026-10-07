import { makeTrip } from './planner.js';

const columns = 'id,destination,days,pace,start_date,itinerary,created_at';
export const PAGE_SIZE = 30;

export function validateTrip(value) {
  const trip = makeTrip(value);
  if (!Array.isArray(value.itinerary) || value.itinerary.length !== trip.days) throw new Error('This saved itinerary is invalid.');
  trip.itinerary = value.itinerary.map((day, index) => {
    if (day.day !== index + 1 || !Array.isArray(day.activities) || day.activities.length < 1 || day.activities.length > 8) throw new Error('This saved itinerary is invalid.');
    return {
      day: day.day,
      activities: day.activities.map(activity => {
        if (typeof activity.time !== 'string' || typeof activity.text !== 'string' || activity.time.length > 40 || activity.text.length > 500) throw new Error('This saved itinerary is invalid.');
        return { time: activity.time, text: activity.text };
      }),
    };
  });
  return trip;
}

export function tripFromRow(row) {
  return { ...validateTrip({ ...row, startDate: row.start_date }), id: row.id, createdAt: row.created_at };
}

export function readLegacyTrips(storage) {
  try {
    const raw = JSON.parse(storage.getItem('oneclick-trips') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap(item => {
      try { return [validateTrip(item)]; } catch { return []; }
    });
  } catch { return []; }
}

export function createTripStore(client) {
  async function owner(expectedId) {
    if (!client) throw new Error('Cloud saving is not configured yet. You can still download your itinerary.');
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('Please sign in to save and manage your trips.');
    if (expectedId && data.user.id !== expectedId) throw new Error('Your account changed. Please try again.');
    return data.user.id;
  }
  return {
    async list(offset = 0, expectedId) {
      const userId = await owner(expectedId);
      const { data, error } = await client.from('trips').select(columns)
        .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE);
      if (error) throw error;
      return { trips: data.slice(0, PAGE_SIZE).map(tripFromRow), hasMore: data.length > PAGE_SIZE };
    },
    async save(value, expectedId) {
      const trip = validateTrip(value);
      const userId = await owner(expectedId);
      const { data, error } = await client.from('trips').insert({
        user_id: userId, destination: trip.destination, days: trip.days,
        pace: trip.pace, start_date: trip.startDate, itinerary: trip.itinerary,
      }).select(columns).single();
      if (error?.code === '23505') return { duplicate: true };
      if (error) throw error;
      return { trip: tripFromRow(data), duplicate: false };
    },
    async remove(id, expectedId) {
      const userId = await owner(expectedId);
      const { data, error } = await client.from('trips').delete().eq('id', id).eq('user_id', userId).select('id');
      if (error) throw error;
      if (data.length !== 1) throw new Error('This trip was already removed or is no longer accessible. Refresh your saved trips.');
    },
    // Import is retry-safe: the database unique constraint prevents duplicates.
    // Keep the original browser data until every record is confirmed saved.
    async importLegacy(storage, expectedId) {
      const userId = await owner(expectedId);
      const original = JSON.parse(storage.getItem('oneclick-trips') || '[]');
      if (!Array.isArray(original)) throw new Error('The browser trip data could not be imported.');
      original.forEach(validateTrip);
      const trips = readLegacyTrips(storage);
      for (const trip of trips) await this.save(trip, userId);
      await owner(userId);
      storage.removeItem('oneclick-trips');
      return trips.length;
    },
  };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
