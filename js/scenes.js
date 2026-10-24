// Painted backgrounds: flat shapes of colour drawn as SVG, like a screen print, instead of gradients.
// Made here in code, so they're crisp at any size and need no download. Each knows its own palette,
// which gives the app its accent and tells it whether text on top should be light or dark.

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

export const SCENES = [
  {
    id: 'ridges', name: 'Dusk ridges', ink: 'dark', accent: '#c4472c',
    palette: ['#efdcc0', '#d9573a', '#a8705a', '#4d2f3b', '#2a1c27'],
    draw() {
      const r = rng(7);
      const layers = [[640, 70, '#cfa283'], [700, 80, '#a8705a'], [780, 70, '#7a4a45'], [860, 60, '#4d2f3b'], [945, 40, '#2a1c27']];
      return wrap(`<rect width="1600" height="1000" fill="#efdcc0"/><rect y="330" width="1600" height="700" fill="#ead0ab"/><rect y="520" width="1600" height="500" fill="#e4c296"/>
        <circle cx="1130" cy="600" r="125" fill="#d9573a"/>
        ${layers.map(([b, a, c], i) => (i < 2 ? jag(horizon(r, b, a, 34, 26), c) : fill(horizon(r, b, a, 90, 0), c))).join('')}`);
    },
  },
  {
    id: 'tide', name: 'Night tide', ink: 'light', accent: '#e3a446',
    palette: ['#121a2e', '#f1e6cc', '#e3a446', '#22305a', '#0a0f1c'],
    draw() {
      const r = rng(21);
      let stars = '';
      for (let i = 0; i < 90; i++) { const x = r() * 1600, y = r() * 560, s = r(); stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.8 + s * 1.6).toFixed(1)}" fill="#f1e6cc" opacity="${(0.25 + s * 0.6).toFixed(2)}"/>`; }
      let glints = '';
      for (let y = 660; y < 1000; y += 9 + r() * 9) {
        const w = (40 + r() * 160) * (1 + (y - 640) / 260), x = 1150 + (r() - 0.5) * 90 * (1 + (y - 640) / 200);
        glints += `<rect x="${(x - w / 2).toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(2 + r() * 3).toFixed(1)}" rx="2" fill="#f1e6cc" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`;
      }
      // a dark headland on the left, sinking into the sea before the moon's path
      const head = horizon(r, 600, 45, 40, 18).filter(([x]) => x <= 760).map(([x, y]) => [x, x > 520 ? y + (x - 520) * 0.2 : y]);
      const land = `<path d="M${head.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L')} L760,660 L-100,660 Z" fill="#0a0f1c"/>`;
      return wrap(`<rect width="1600" height="1000" fill="#121a2e"/><rect y="440" width="1600" height="220" fill="#16203a"/>${stars}
        <circle cx="1150" cy="330" r="74" fill="#f1e6cc"/><circle cx="1150" cy="330" r="118" fill="#f1e6cc" opacity=".06"/>
        ${land}<rect y="640" width="1600" height="360" fill="#0f1730"/>${glints}`);
    },
  },
  {
    id: 'fields', name: 'Field study', ink: 'dark', accent: '#b5562d',
    palette: ['#dfe4d2', '#b9c48f', '#c9a54e', '#5f7d4f', '#b5562d'],
    draw() {
      const r = rng(3);
      const rows = [[600, 40, '#b9c48f'], [670, 50, '#c9a54e'], [750, 45, '#8fa66a'], [830, 50, '#5f7d4f'], [920, 35, '#3b5640']];
      // furrows: thin lines following each field
      const furrows = (b, c) => { let s = ''; for (let k = 1; k < 4; k++) s += `<path d="${smooth(horizon(rng(b + k), b + k * 22, 18, 120, 0))}" fill="none" stroke="${c}" stroke-width="3" opacity=".35"/>`; return s; };
      // two trees standing in the first field; the next field covers their roots
      const trees = '<g fill="#2f4634"><rect x="1210" y="640" width="9" height="90"/><circle cx="1214" cy="622" r="36"/><rect x="1292" y="660" width="7" height="70"/><circle cx="1295" cy="646" r="25"/></g>';
      return wrap(`<rect width="1600" height="1000" fill="#dfe4d2"/><rect y="400" width="1600" height="600" fill="#d6dcc4"/>
        <circle cx="360" cy="430" r="80" fill="#f2eedb"/>
        ${rows.map(([b, a, c], i) => fill(horizon(r, b, a, 160, 0), c) + (i === 1 || i === 3 ? furrows(b + 30, '#3b5640') : '') + (i === 0 ? trees : '')).join('')}`);
    },
  },
];
const cache = new Map();
export const sceneById = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
export function sceneUrl(id) {
  if (!cache.has(id)) cache.set(id, `url('data:image/svg+xml,${encodeURIComponent(sceneById(id).draw())}')`);
  return cache.get(id);
}
