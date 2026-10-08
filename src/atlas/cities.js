// US atlas cities. Coordinates are decimal degrees (WGS84), west longitudes negative.
export const cities = [
  { id: 'seattle', name: 'Seattle', region: 'Washington', lat: 47.6062, lon: -122.3321, blurb: 'Ferries, rain-washed markets, and a mountain that appears on clear days.', highlights: ['Pike Place Market at opening', 'Ferry to Bainbridge Island', 'Discovery Park bluffs'] },
  { id: 'portland', name: 'Portland', region: 'Oregon', lat: 45.5152, lon: -122.6784, blurb: 'Bridges, bookshops, and forest trails inside the city limits.', highlights: ['Forest Park trails', 'Powell’s City of Books', 'Columbia River Gorge day trip'] },
  { id: 'san-francisco', name: 'San Francisco', region: 'California', lat: 37.7749, lon: -122.4194, blurb: 'Fog over steep hills, cable cars, and a bay that changes by the hour.', highlights: ['Lands End coastal trail', 'Mission District murals', 'Ferry Building on a Saturday'] },
  { id: 'los-angeles', name: 'Los Angeles', region: 'California', lat: 34.0522, lon: -118.2437, blurb: 'Canyon hikes, long boulevards, and evenings that end at the ocean.', highlights: ['Griffith Observatory at dusk', 'Venice canals', 'Grand Central Market'] },
  { id: 'las-vegas', name: 'Las Vegas', region: 'Nevada', lat: 36.1699, lon: -115.1398, blurb: 'Neon at night and red-rock desert less than an hour away.', highlights: ['Red Rock Canyon loop', 'The Neon Museum', 'Valley of Fire day trip'] },
  { id: 'salt-lake-city', name: 'Salt Lake City', region: 'Utah', lat: 40.7608, lon: -111.891, blurb: 'A wide valley city with mountain canyons at the end of every street.', highlights: ['Big Cottonwood Canyon', 'Great Salt Lake shoreline', 'Ninth and Ninth neighborhood'] },
  { id: 'denver', name: 'Denver', region: 'Colorado', lat: 39.7392, lon: -104.9903, blurb: 'A mile high, with the Front Range on the horizon and trailheads close by.', highlights: ['Red Rocks Amphitheatre', 'Union Station', 'RiNo art district'] },
  { id: 'santa-fe', name: 'Santa Fe', region: 'New Mexico', lat: 35.687, lon: -105.9378, blurb: 'Adobe walls, high-desert light, and galleries on every lane.', highlights: ['Canyon Road galleries', 'Georgia O’Keeffe Museum', 'Sunset from the Cross of the Martyrs'] },
  { id: 'austin', name: 'Austin', region: 'Texas', lat: 30.2672, lon: -97.7431, blurb: 'Live music, swimming holes, and a bat colony that leaves at sunset.', highlights: ['Barton Springs Pool', 'Congress Avenue bat flight', 'South Congress shops'] },
  { id: 'new-orleans', name: 'New Orleans', region: 'Louisiana', lat: 29.9511, lon: -90.0715, blurb: 'Brass bands, iron balconies, and long dinners in humid air.', highlights: ['Frenchmen Street music', 'Garden District walk', 'Streetcar along St. Charles'] },
  { id: 'chicago', name: 'Chicago', region: 'Illinois', lat: 41.8781, lon: -87.6298, blurb: 'Architecture along the river and a lakefront that feels like a coast.', highlights: ['Architecture river cruise', 'Lakefront Trail by bike', 'Art Institute of Chicago'] },
  { id: 'nashville', name: 'Nashville', region: 'Tennessee', lat: 36.1627, lon: -86.7816, blurb: 'Songwriter rooms, neon honky-tonks, and slow Southern mornings.', highlights: ['Ryman Auditorium', 'Bluebird Cafe songwriter night', 'Shelby Bottoms greenway'] },
  { id: 'miami', name: 'Miami', region: 'Florida', lat: 25.7617, lon: -80.1918, blurb: 'Pastel facades, Cuban coffee, and warm water all year.', highlights: ['Art Deco Historic District', 'Little Havana', 'Key Biscayne beaches'] },
  { id: 'savannah', name: 'Savannah', region: 'Georgia', lat: 32.0809, lon: -81.0912, blurb: 'Shaded squares, Spanish moss, and walkable history.', highlights: ['Forsyth Park', 'The historic squares', 'Tybee Island'] },
  { id: 'charleston', name: 'Charleston', region: 'South Carolina', lat: 32.7765, lon: -79.9311, blurb: 'Pastel rows, harbor breezes, and Lowcountry cooking.', highlights: ['Rainbow Row', 'The Battery promenade', 'Sullivan’s Island'] },
  { id: 'washington-dc', name: 'Washington', region: 'District of Columbia', lat: 38.9072, lon: -77.0369, blurb: 'Free museums, monuments at night, and cherry trees in spring.', highlights: ['National Mall after dark', 'Smithsonian museums', 'Georgetown waterfront'] },
  { id: 'new-york', name: 'New York', region: 'New York', lat: 40.7128, lon: -74.006, blurb: 'A city of neighborhoods, each one its own small world.', highlights: ['Walk the Brooklyn Bridge', 'The High Line', 'A night at a Village jazz club'] },
  { id: 'boston', name: 'Boston', region: 'Massachusetts', lat: 42.3601, lon: -71.0589, blurb: 'Brick lanes, harbor islands, and history on foot.', highlights: ['The Freedom Trail', 'Boston Public Garden', 'Harbor Islands ferry'] },
  { id: 'anchorage', name: 'Anchorage', region: 'Alaska', lat: 61.2181, lon: -149.9003, blurb: 'Mountains, tidal flats, and long summer light.', highlights: ['Tony Knowles Coastal Trail', 'Flattop Mountain', 'Turnagain Arm drive'] },
  { id: 'honolulu', name: 'Honolulu', region: 'Hawaii', lat: 21.3069, lon: -157.8583, blurb: 'Volcanic ridges, warm surf, and markets full of tropical fruit.', highlights: ['Diamond Head summit', 'Waikiki at sunrise', 'Manoa Falls trail'] },
];

export const findCity = id => cities.find(city => city.id === id);

// Unit vector for a latitude/longitude, matching the UV layout of THREE.SphereGeometry.
export function latLonToVector(lat, lon, radius = 1) {
  const phi = ((lon + 180) * Math.PI) / 180;
  const theta = ((90 - lat) * Math.PI) / 180;
  return { x: -radius * Math.cos(phi) * Math.sin(theta), y: radius * Math.cos(theta), z: radius * Math.sin(phi) * Math.sin(theta) };
}

// Globe rotation (Euler XY) that brings a coordinate to face a camera on +z.
export function rotationToFace(lat, lon) {
  const v = latLonToVector(lat, lon);
  return { x: (lat * Math.PI) / 180, y: -Math.atan2(v.x, v.z) };
}

export function formatCoordinates(lat, lon) {
  const part = (value, positive, negative) => {
    const totalMinutes = Math.round(Math.abs(value) * 60);
    const degrees = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${degrees}°${String(minutes).padStart(2, '0')}′ ${value >= 0 ? positive : negative}`;
  };
  return `${part(lat, 'N', 'S')}, ${part(lon, 'E', 'W')}`;
}
