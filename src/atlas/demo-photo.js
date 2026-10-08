// Generated stand-in imagery for demo journal entries. These are illustrations,
// not photographs, and the UI labels them as demo photos.
function seeded(text) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

let count = 0;

export function demoPhotoSvg({ caption, scene, hue }) {
  const random = seeded(caption);
  const id = `demo-sky-${count += 1}`;
  const sky = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue + 220} 45% 14%)"/><stop offset=".62" stop-color="hsl(${hue} 55% 52%)"/><stop offset="1" stop-color="hsl(${hue + 20} 70% 74%)"/></linearGradient>`;
  const sunX = 60 + random() * 200;
  let ground = '';
  if (scene === 'skyline' || scene === 'street') {
    let x = -4;
    while (x < 324) {
      const w = 14 + random() * (scene === 'street' ? 46 : 28);
      const h = scene === 'street' ? 90 + random() * 60 : 40 + random() * 110;
      ground += `<rect x="${x.toFixed(1)}" y="${(220 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="hsl(${hue + 230} 35% ${8 + random() * 8}%)"/>`;
      for (let wy = 220 - h + 8; wy < 214; wy += 11) if (random() > 0.72) ground += `<rect x="${(x + 4 + random() * (w - 10)).toFixed(1)}" y="${wy.toFixed(1)}" width="3" height="4" fill="hsl(42 90% 72%)" opacity=".8"/>`;
      x += w + 2;
    }
  } else {
    const layers = scene === 'river' || scene === 'coast' ? 2 : 3;
    for (let i = 0; i < layers; i += 1) {
      const base = 130 + i * 28;
      let d = `M0 220 L0 ${base}`;
      for (let px = 0; px <= 320; px += 40) d += ` Q${px + 20} ${(base - 10 - random() * (scene === 'desert' ? 46 : 26)).toFixed(1)} ${px + 40} ${(base + random() * 8).toFixed(1)}`;
      ground += `<path d="${d} L320 220 Z" fill="hsl(${hue + 230 - i * 8} 30% ${20 - i * 5}%)"/>`;
    }
    if (scene === 'river' || scene === 'coast') ground += `<rect y="186" width="320" height="34" fill="hsl(${hue + 200} 40% 22%)"/><path d="M0 196 H320 M40 206 H280" stroke="hsl(${hue + 20} 70% 74%)" stroke-opacity=".35"/>`;
  }
  return `<svg viewBox="0 0 320 220" role="img" aria-label="Demo illustration: ${caption}" preserveAspectRatio="xMidYMid slice"><defs>${sky}</defs><rect width="320" height="220" fill="url(#${id})"/><circle cx="${sunX.toFixed(1)}" cy="${(110 + random() * 30).toFixed(1)}" r="18" fill="hsl(${hue + 30} 90% 86%)" opacity=".85"/>${ground}</svg>`;
}
