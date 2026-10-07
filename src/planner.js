export const destinations = [
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', tag: 'Culture & calm', emoji: '⛩', color: 'rose', activities: ['Wander the lanes of Higashiyama', 'Explore a temple garden', 'Take a riverside walk in Arashiyama', 'Browse a local craft shop', 'Walk through the torii gates at Fushimi Inari', 'Explore the Philosopher’s Path'], meals: 'Find a neighborhood spot for noodles or seasonal dishes' },
  { id: 'lisbon', name: 'Lisbon', country: 'Portugal', tag: 'City & sunshine', emoji: '☀', color: 'gold', activities: ['Explore the streets of Alfama', 'Walk along the waterfront in Belém', 'Discover a neighborhood viewpoint', 'Browse the shops in Chiado', 'Explore the tiled streets of Baixa', 'Take a relaxed walk by the Tagus'], meals: 'Try a local café and a pastel de nata' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', tag: 'Nature & recharge', emoji: '❋', color: 'sage', activities: ['Explore a rice terrace near Ubud', 'Visit a local art market', 'Enjoy a relaxed beach walk', 'Discover a tropical garden', 'Browse artisan workshops', 'Spend the afternoon at a café with a view'], meals: 'Try a local warung for a relaxed meal' },
  { id: 'paris', name: 'Paris', country: 'France', tag: 'Art & little cafés', emoji: '✧', color: 'blue', activities: ['Walk along the Seine', 'Explore the streets of Montmartre', 'Spend time in the Luxembourg Gardens', 'Browse a museum collection', 'Discover the covered passages', 'Explore the Marais on foot'], meals: 'Pause at a neighborhood bakery or bistro' },
];

export function makeTrip({ destination, days, pace, startDate }) {
  const place = destinations.find(item => item.id === destination);
  const count = Number(days);
  if (!place || !Number.isInteger(count) || count < 1 || count > 7) throw new Error('Choose a destination and a trip length from 1 to 7 days.');
  if (!['relaxed', 'balanced', 'packed'].includes(pace)) throw new Error('Choose a travel pace.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate))) throw new Error('Choose a start date.');
  const itinerary = Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    activities: [
      { time: 'Morning', text: place.activities[(index * 2) % place.activities.length] },
      { time: 'Lunch', text: place.meals },
      { time: 'Afternoon', text: pace === 'relaxed' ? 'Leave some time to wander, rest, and follow your curiosity' : place.activities[(index * 2 + 1) % place.activities.length] },
      ...(pace === 'packed' ? [{ time: 'Evening', text: 'Explore a lively neighborhood and find a local dinner spot' }] : []),
    ],
  }));
  return { destination, days: count, pace, startDate, itinerary };
}

export function tripText(trip) {
  const place = destinations.find(item => item.id === trip.destination);
  return `${place.name}, ${place.country}\n${trip.days} days · ${trip.pace} pace · Starts ${trip.startDate}\n\nSample itinerary — check opening hours, availability, and bookings before traveling.\n\n${trip.itinerary.map(day => `Day ${day.day}\n${day.activities.map(activity => `${activity.time}: ${activity.text}`).join('\n')}`).join('\n\n')}`;
}
