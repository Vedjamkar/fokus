// Painted backgrounds: flat shapes of colour drawn as SVG, like a screen print, instead of gradients.
// Made here in code, so they're crisp at any size and need no download. Each knows its own palette,
// which gives the app its accent and tells it whether text on top should be light or dark.
// Every colour is a named role, so the Aesthetic studio can repaint a scene in any palette.

// a repeatable "random" so a scene looks the same every time
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// a smooth line through points (Catmull-Rom turned into Bézier curves)
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
  }
  return d;
}
// a horizon line: a few slow waves plus a little roughness
function horizon(r, base, amp, step, rough) {
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3], pts = [];
  for (let x = -100; x <= 1700; x += step) {
    const y = base + amp * (Math.sin(x / 310 + ph[0]) * 0.6 + Math.sin(x / 140 + ph[1]) * 0.3 + Math.sin(x / 61 + ph[2]) * 0.1) + (r() - 0.5) * rough;
    pts.push([x, y]);
  }
  return pts;
}
const fill = (pts, c) => `<path d="${smooth(pts)} L1700,1100 L-100,1100 Z" fill="${c}"/>`;
const jag = (pts, c) => `<path d="M${pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L')} L1700,1100 L-100,1100 Z" fill="${c}"/>`;
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">${body}</svg>`;

const hx = (h) => { const x = h.length === 4 ? h.slice(1).replace(/./g, '$&$&') : h.slice(1), n = parseInt(x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }; // #abc or #aabbcc
const mix = (a, b, t) => `#${hx(a).map((v, i) => Math.round(v + (hx(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
const lum = (h) => { const [r, g, b] = hx(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// n steps from one colour to another
const ramp = (a, b, n) => Array.from({ length: n }, (_, i) => mix(a, b, n === 1 ? 0 : i / (n - 1)));

export const SCENES = [
  {
    id: 'ridges', name: 'Dusk ridges', ink: 'dark', accent: '#c4472c',
    colors: { sky: ['#efdcc0', '#ead0ab', '#e4c296'], sun: '#d9573a', hills: ['#cfa283', '#a8705a', '#7a4a45', '#4d2f3b', '#2a1c27'] },
    // from a studio palette: a pale sky made from the lightest colour, the accent as the sun, hills falling to the darkest
    from: (p, accent, night) => night
      ? { sky: [mix(p[0], '#000', 0.35), mix(p[0], p[1], 0.25), mix(p[0], p[2], 0.35)], sun: mix(p.at(-1), '#fff', 0.2), hills: ramp(mix(p[2], p[0], 0.3), mix(p[0], '#000', 0.6), 5), ink: 'light' }
      : { sky: [mix(p.at(-1), '#fff', 0.6), mix(p.at(-1), '#fff', 0.45), mix(p.at(-1), '#fff', 0.3)], sun: accent, hills: ramp(mix(p.at(-2), '#fff', 0.25), mix(p[0], '#000', 0.45), 5), ink: 'dark' },
    draw(c) {
      const r = rng(7);
      const layers = [[640, 70], [700, 80], [780, 70], [860, 60], [945, 40]];
      return wrap(`<rect width="1600" height="1000" fill="${c.sky[0]}"/><rect y="330" width="1600" height="700" fill="${c.sky[1]}"/><rect y="520" width="1600" height="500" fill="${c.sky[2]}"/>
        <circle cx="1130" cy="600" r="125" fill="${c.sun}"/>
        ${layers.map(([b, a], i) => (i < 2 ? jag(horizon(r, b, a, 34, 26), c.hills[i]) : fill(horizon(r, b, a, 90, 0), c.hills[i]))).join('')}`);
    },
  },
  {
    id: 'tide', name: 'Night tide', ink: 'light', accent: '#e3a446',
    colors: { sky: '#121a2e', band: '#16203a', moon: '#f1e6cc', sea: '#0f1730', land: '#0a0f1c' },
    from: (p) => ({ sky: mix(p[0], '#000', 0.45), band: mix(mix(p[0], '#000', 0.45), p[1], 0.18), moon: mix(p.at(-1), '#fff', 0.45), sea: mix(p[0], '#000', 0.55), land: mix(p[0], '#000', 0.78), ink: 'light' }),
    draw(c) {
      const r = rng(21);
      let stars = '';
      for (let i = 0; i < 90; i++) { const x = r() * 1600, y = r() * 560, s = r(); stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.8 + s * 1.6).toFixed(1)}" fill="${c.moon}" opacity="${(0.25 + s * 0.6).toFixed(2)}"/>`; }
      let glints = '';
      for (let y = 660; y < 1000; y += 9 + r() * 9) {
        const w = (40 + r() * 160) * (1 + (y - 640) / 260), x = 1150 + (r() - 0.5) * 90 * (1 + (y - 640) / 200);
        glints += `<rect x="${(x - w / 2).toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(2 + r() * 3).toFixed(1)}" rx="2" fill="${c.moon}" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`;
      }
      // a dark headland on the left, sinking into the sea before the moon's path
      const head = horizon(r, 600, 45, 40, 18).filter(([x]) => x <= 760).map(([x, y]) => [x, x > 520 ? y + (x - 520) * 0.2 : y]);
      const land = `<path d="M${head.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L')} L760,660 L-100,660 Z" fill="${c.land}"/>`;
      return wrap(`<rect width="1600" height="1000" fill="${c.sky}"/><rect y="440" width="1600" height="220" fill="${c.band}"/>${stars}
        <circle cx="1150" cy="330" r="74" fill="${c.moon}"/><circle cx="1150" cy="330" r="118" fill="${c.moon}" opacity=".06"/>
        ${land}<rect y="640" width="1600" height="360" fill="${c.sea}"/>${glints}`);
    },
  },
  {
    id: 'fields', name: 'Field study', ink: 'dark', accent: '#b5562d',
    colors: { sky: '#dfe4d2', sky2: '#d6dcc4', sun: '#f2eedb', rows: ['#b9c48f', '#c9a54e', '#8fa66a', '#5f7d4f', '#3b5640'], tree: '#2f4634' },
    // the palette's middle colours become the fields, alternating light and dark so the rows stay apart
    from: (p) => {
      const mid = p.length > 2 ? p.slice(1, -1) : p;
      const rows = [0, 1, 2, 3, 4].map((i) => mix(mid[(i * 2) % mid.length], '#000', i * 0.09));
      return { sky: mix(p.at(-1), '#fff', 0.62), sky2: mix(p.at(-1), '#fff', 0.5), sun: mix(p.at(-1), '#fff', 0.85), rows, tree: mix(p[0], '#000', 0.35), ink: 'dark' };
    },
    draw(c) {
      const r = rng(3);
      const rows = [[600, 40], [670, 50], [750, 45], [830, 50], [920, 35]];
      // furrows: thin lines following each field
      const furrows = (b, col) => { let s = ''; for (let k = 1; k < 4; k++) s += `<path d="${smooth(horizon(rng(b + k), b + k * 22, 18, 120, 0))}" fill="none" stroke="${col}" stroke-width="3" opacity=".35"/>`; return s; };
      // two trees standing in the first field; the next field covers their roots
      const trees = `<g fill="${c.tree}"><rect x="1210" y="640" width="9" height="90"/><circle cx="1214" cy="622" r="36"/><rect x="1292" y="660" width="7" height="70"/><circle cx="1295" cy="646" r="25"/></g>`;
      return wrap(`<rect width="1600" height="1000" fill="${c.sky}"/><rect y="400" width="1600" height="600" fill="${c.sky2}"/>
        <circle cx="360" cy="430" r="80" fill="${c.sun}"/>
        ${rows.map(([b, a], i) => fill(horizon(r, b, a, 160, 0), c.rows[i]) + (i === 1 || i === 3 ? furrows(b + 30, c.rows[4]) : '') + (i === 0 ? trees : '')).join('')}`);
    },
  },
];
const cache = new Map();
export const sceneById = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
// a scene in a palette from the studio: { colors, ink } (palette sorted dark → light)
export function sceneColors(id, palette, accent, night) {
  const p = [...palette].sort((a, b) => lum(a) - lum(b));
  if (p.length < 2) return null;
  const { ink, ...colors } = sceneById(id).from(p, accent || p[Math.floor(p.length / 2)], night);
  return { colors, ink };
}
// spec is a background spec ({ value, colors? }) or just a scene id
export function sceneUrl(spec) {
  const id = typeof spec === 'string' ? spec : spec.value, colors = typeof spec === 'string' ? null : spec.colors;
  const key = colors ? `${id}:${JSON.stringify(colors)}` : id;
  if (!cache.has(key)) cache.set(key, `url('data:image/svg+xml,${encodeURIComponent(sceneById(id).draw({ ...sceneById(id).colors, ...(colors || {}) }))}')`);
  return cache.get(key);
}
// the colours a scene spec is painted in, for the room's poster and the like
export const scenePalette = (spec) => { const c = { ...sceneById(spec.value).colors, ...(spec.colors || {}) }; return Object.values(c).flat().filter((v) => typeof v === 'string'); };
