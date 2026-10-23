// Ambient sounds made live with the Web Audio API: no audio files, no network.
// Each channel is a noise source shaped by filters; volumes go 0..1.

export const CHANNELS = [
  ['rain', 'Rain'], ['fire', 'Fireplace'], ['wind', 'Wind'], ['brown', 'Brown noise'], ['keys', 'Typing'],
];

let ac = null, master = null;
const ch = {};

function noiseBuffer(kind) {
  const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}
function loop(buf) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }

function build(id) {
  const out = ac.createGain(); out.gain.value = 0; out.connect(master);
  const white = noiseBuffer('white');
  if (id === 'rain') {
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    loop(white).connect(bp).connect(hp).connect(out);
    // heavier drops on the window
    const drops = ac.createGain(); drops.gain.value = 0.5; drops.connect(out);
    const drip = () => {
      if (!ch.rain) return;
      const s = ac.createBufferSource(); s.buffer = white;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 3000; f.Q.value = 8;
      const g = ac.createGain(); g.gain.setValueAtTime(0.4 * Math.random(), ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
      s.connect(f).connect(g).connect(drops); s.start(ac.currentTime, Math.random() * 3, 0.06);
      setTimeout(drip, 20 + Math.random() * 90);
    };
    setTimeout(drip, 50);
  }
  if (id === 'fire') {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const rumble = ac.createGain(); rumble.gain.value = 0.6;
    loop(noiseBuffer('brown')).connect(lp).connect(rumble).connect(out);
    const crackle = () => {
      if (!ch.fire) return;
      const s = ac.createBufferSource(); s.buffer = white;
      const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 2500;
      const g = ac.createGain(); const t = ac.currentTime;
      g.gain.setValueAtTime(0.7 * Math.random() ** 2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + Math.random() * 0.05);
      s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 3, 0.08);
      setTimeout(crackle, Math.random() < 0.2 ? 15 : 60 + Math.random() * 400);
    };
    setTimeout(crackle, 80);
  }
  if (id === 'wind') {
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 1.4;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.08;
    const depth = ac.createGain(); depth.gain.value = 320;
    lfo.connect(depth).connect(bp.frequency); lfo.start();
    loop(white).connect(bp).connect(out);
  }
  if (id === 'brown') {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    loop(noiseBuffer('brown')).connect(lp).connect(out);
  }
  if (id === 'keys') {
    const key = () => {
      if (!ch.keys) return;
      const s = ac.createBufferSource(); s.buffer = white;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000 + Math.random() * 2000; f.Q.value = 3;
      const g = ac.createGain(); const t = ac.currentTime;
      g.gain.setValueAtTime(0.5 + Math.random() * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 3, 0.04);
      // bursts of typing with pauses, like someone thinking
      const pause = Math.random() < 0.08 ? 900 + Math.random() * 1600 : 70 + Math.random() * 140;
      setTimeout(key, pause);
    };
    setTimeout(key, 100);
  }
  return out;
}

// One shared context. Everything (ambient + cat + toys) goes through master → analyser → speakers,
// so the visualiser can read what you actually hear. Browsers only allow audio after a user gesture.
let analyser = null, fx = null;
export function ensure() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.8;
    analyser = ac.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
    master.connect(analyser).connect(ac.destination);
    fx = ac.createGain(); fx.gain.value = 0.7; fx.connect(master);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
export const ready = () => !!ac && ac.state === 'running';
export function setVolume(id, v) {
  ensure();
  if (v > 0 && !ch[id]) ch[id] = build(id);
  if (ch[id]) ch[id].gain.setTargetAtTime(v * (id === 'keys' ? 0.35 : id === 'brown' ? 0.5 : 0.8), ac.currentTime, 0.2);
}
export const anyPlaying = (vols) => Object.values(vols || {}).some((v) => v > 0);

// ---------------------------------------------------------------- what the visualiser reads
const buf = new Uint8Array(128);
let tab = null; // { analyser, stream, src }
export function spectrum() {
  // the shared tab's audio (YouTube) when captured, otherwise everything this app plays
  const a = tab?.analyser || (ac && analyser);
  if (!a) return null;
  a.getByteFrequencyData(buf);
  return buf;
}
export const tabCaptured = () => !!tab;
// YouTube's audio lives in a cross-origin iframe, so it can't be read directly. Sharing this tab's
// audio (Chrome: pick this tab and tick "Share tab audio") hands the browser's own mix to an analyser.
export async function captureTab(onEnd) {
  ensure();
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include' });
  if (!stream.getAudioTracks().length) { stream.getTracks().forEach((t) => t.stop()); throw new Error('no-audio'); }
  stream.getVideoTracks().forEach((t) => t.stop()); // only the sound is needed
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.75;
  src.connect(an); // not to the speakers: the tab already plays it
  tab = { analyser: an, stream, src };
  stream.getAudioTracks()[0].addEventListener('ended', () => { stopCapture(); onEnd?.(); });
}
export function stopCapture() {
  if (!tab) return;
  tab.stream.getTracks().forEach((t) => t.stop()); try { tab.src.disconnect(); } catch {}
  tab = null;
}

// ---------------------------------------------------------------- cat and toy sounds
let muted = false;
export const setMuted = (m) => { muted = m; if (m) purr(false); };
const now = () => ac.currentTime;
function env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
let white = null;
const noise = () => (white ||= noiseBuffer('white'));

// a meow is a glottal buzz (sawtooth) gliding up then down, shaped by two vowel formants: "mi-aow"
export function meow(kind = 'meow') {
  if (muted || !ensure()) return;
  const t = now() + 0.01, len = kind === 'mrrp' ? 0.32 : kind === 'small' ? 0.38 : 0.7;
  const base = (kind === 'small' ? 620 : 470) * (0.92 + Math.random() * 0.16);
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(base * 0.8, t);
  o.frequency.linearRampToValueAtTime(base * 1.35, t + len * 0.35);
  o.frequency.linearRampToValueAtTime(base * 0.75, t + len);
  if (kind === 'mrrp') { const trill = ac.createOscillator(); trill.frequency.value = 28; const tg = ac.createGain(); tg.gain.value = base * 0.12; trill.connect(tg).connect(o.frequency); trill.start(t); trill.stop(t + len); }
  const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
  f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(1100, t + len * 0.4); f1.frequency.linearRampToValueAtTime(700, t + len);
  const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7;
  f2.frequency.setValueAtTime(1600, t); f2.frequency.linearRampToValueAtTime(2300, t + len * 0.4); f2.frequency.linearRampToValueAtTime(1300, t + len);
  const g = ac.createGain(); env(g, t, 0.55, 0.06, len);
  const g2 = ac.createGain(); g2.gain.value = 0.5;
  o.connect(f1).connect(g); o.connect(f2).connect(g2).connect(g); g.connect(fx);
  o.start(t); o.stop(t + len + 0.1);
}

// purring: low rumble pulsed ~25 times a second, swelling with each breath
let purrNode = null;
export function purr(on) {
  if (on && (muted || purrNode)) return;
  if (!on) { if (purrNode && ac) { const p = purrNode; purrNode = null; p.out.gain.setTargetAtTime(0, now(), 0.15); setTimeout(() => { try { p.src.stop(); p.lfo.stop(); p.breath.stop(); } catch {} }, 600); } return; }
  ensure();
  const src = ac.createBufferSource(); src.buffer = noiseBuffer('brown'); src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  const am = ac.createGain(); am.gain.value = 0.5;
  const lfo = ac.createOscillator(); lfo.frequency.value = 24; const depth = ac.createGain(); depth.gain.value = 0.5; lfo.connect(depth).connect(am.gain);
  const breathG = ac.createGain(); breathG.gain.value = 0.6;
  const breath = ac.createOscillator(); breath.frequency.value = 0.45; const bd = ac.createGain(); bd.gain.value = 0.4; breath.connect(bd).connect(breathG.gain);
  const out = ac.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(1.6, now(), 0.2);
  src.connect(lp).connect(am).connect(breathG).connect(out).connect(fx);
  src.start(); lfo.start(); breath.start();
  purrNode = { src, lfo, breath, out };
}

// a struck tube: a few inharmonic partials with long exponential decays
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
export function chime(i = 0, vol = 0.25) {
  if (muted || !ensure()) return;
  const t = now() + 0.005, f = PENTA[i % PENTA.length];
  [[1, 1, 2.6], [2.76, 0.35, 1.4], [5.4, 0.15, 0.7]].forEach(([m, a, d]) => {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
    const g = ac.createGain(); env(g, t, vol * a, 0.004, d); o.connect(g).connect(fx); o.start(t); o.stop(t + d + 0.1);
  });
}
// steel balls knocking: a very short bright click with a ringing ping
export function clack(vol = 0.5) {
  if (muted || !ensure()) return;
  const t = now() + 0.003;
  const s = ac.createBufferSource(); s.buffer = noise();
  const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3800; hp.Q.value = 2;
  const g = ac.createGain(); env(g, t, vol, 0.001, 0.035); s.connect(hp).connect(g).connect(fx); s.start(t, Math.random(), 0.06);
  const o = ac.createOscillator(); o.frequency.value = 2900; const og = ac.createGain(); env(og, t, vol * 0.18, 0.001, 0.12); o.connect(og).connect(fx); o.start(t); o.stop(t + 0.15);
}
// soft landing (yarn bouncing, a cat pouncing)
export function thump(vol = 0.5) {
  if (muted || !ensure()) return;
  const t = now() + 0.003;
  const o = ac.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  const g = ac.createGain(); env(g, t, vol, 0.004, 0.16); o.connect(g).connect(fx); o.start(t); o.stop(t + 0.2);
}
// air moving: the globe spinning, a toss
export function whoosh(vol = 0.3, len = 0.6) {
  if (muted || !ensure()) return;
  const t = now() + 0.005;
  const s = ac.createBufferSource(); s.buffer = noise();
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1800, t + len * 0.4); bp.frequency.exponentialRampToValueAtTime(500, t + len);
  const g = ac.createGain(); env(g, t, vol, len * 0.3, len * 0.7); s.connect(bp).connect(g).connect(fx); s.start(t, Math.random(), len + 0.1);
}
