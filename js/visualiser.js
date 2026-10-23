// Turns what's playing into 32 smooth bars (0..1) for the room's speaker, the fairy lights and the stage.
// Sources, best first: the shared tab's audio → this app's own sounds → a made-up groove while YouTube
// plays (its audio can't be read without sharing the tab), so the bars never pretend to be more than they are.
import * as SND from './sounds.js';

export const BINS = 32;
const out = new Float32Array(BINS);
const sm = new Float32Array(BINS);
let source = 'none';

export function sample(t, musicPlaying) {
  const spec = SND.spectrum();
  let live = false;
  if (spec) {
    // log-spaced bands over the useful part of the spectrum (the top bins are mostly empty)
    for (let i = 0; i < BINS; i++) {
      const a = Math.floor(1 + (i / BINS) ** 1.6 * 90), b = Math.max(a + 1, Math.floor(1 + ((i + 1) / BINS) ** 1.6 * 90));
      let m = 0; for (let k = a; k < b; k++) m = Math.max(m, spec[k]);
      out[i] = (m / 255) ** 1.4;
      if (m > 8) live = true;
    }
  }
  if (live) source = SND.tabCaptured() ? 'tab' : 'live';
  else if (musicPlaying) {
    source = 'sim';
    const beat = (t * 1.4) % 1, kick = Math.exp(-beat * 7), snare = Math.exp(-(((t * 1.4) + 0.5) % 1) * 9);
    for (let i = 0; i < BINS; i++) {
      const x = i / BINS;
      out[i] = Math.max(0, kick * (1 - x) ** 2 * 0.9 + snare * Math.exp(-((x - 0.5) ** 2) * 18) * 0.45
        + (0.22 + 0.12 * Math.sin(t * 2.1 + i * 0.7) + 0.08 * Math.sin(t * 5.3 + i * 1.9)) * (1 - x * 0.7));
    }
  } else { source = 'none'; out.fill(0); }
  let lvl = 0;
  for (let i = 0; i < BINS; i++) { sm[i] += (out[i] - sm[i]) * (out[i] > sm[i] ? 0.55 : 0.18); lvl += sm[i]; }
  return { bins: sm, level: Math.min(1, (lvl / BINS) * 2.2), bass: (sm[0] + sm[1] + sm[2]) / 3, source };
}

// ---------------------------------------------------------------- the stage strip along the bottom
let cv = null, raf = 0, getState = null;
export function mountStage(canvas, state) {
  cv = canvas; getState = state;
  if (!raf) raf = requestAnimationFrame(draw);
}
let idle = 0;
function draw(now) {
  raf = requestAnimationFrame(draw);
  const st = getState();
  if (st.style === 'off' || st.hidden || document.hidden) { if (cv.style.opacity !== '0') cv.style.opacity = '0'; return; }
  const v = sample(now / 1000, st.musicPlaying);
  idle = v.source === 'none' ? idle + 1 : 0;
  cv.style.opacity = idle > 40 ? '0' : '1';
  if (idle > 60) return;
  const dpr = Math.min(2, devicePixelRatio), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.fillStyle = st.accent; g.strokeStyle = st.accent;
  if (st.style === 'wave') {
    g.globalAlpha = 0.55; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const x = (i / 96) * w, b = v.bins[Math.floor((Math.abs(i - 48) / 48) * (BINS - 1))];
      const y = h * 0.6 - Math.sin(i * 0.42 + now / 260) * b * h * 0.45;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  } else {
    // mirrored bars, bass in the middle, like a calm equaliser
    const n = BINS * 2, gap = 4, bw = Math.max(2, (w - gap * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      const b = v.bins[Math.abs(i - (n - 1) / 2) | 0];
      const bh = Math.max(2, b * h * 0.9);
      g.globalAlpha = 0.18 + b * 0.5;
      const x = i * (bw + gap);
      g.beginPath(); g.roundRect ? g.roundRect(x, h - bh, bw, bh, Math.min(3, bw / 2)) : g.rect(x, h - bh, bw, bh); g.fill();
    }
  }
  g.globalAlpha = 1;
}
