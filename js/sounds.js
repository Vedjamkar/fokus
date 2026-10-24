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

// A meow is a voice, not a buzzer: a soft harmonic source (falling off like a real throat) with a
// little vibrato and wobble, sent through three vowel formants that slide "m-i-a-o-w". The "m" is the
// mouth opening: a low-pass that starts nearly closed and opens in the first tenth of a second.
const VOICES = new WeakMap();
function voiceWave(ctx) {
  if (!VOICES.has(ctx)) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = 1 / k ** 1.5;
    VOICES.set(ctx, ctx.createPeriodicWave(re, im));
  }
  return VOICES.get(ctx);
}
// [time 0..1, value] points for pitch (× base), formants (Hz) and how open the mouth is (Hz)
const CALLS = {
  meow: { len: 0.7, f0: 560, pitch: [[0, 0.8], [0.3, 1.2], [0.62, 1.1], [1, 0.72]], f1: [[0, 380], [0.28, 760], [0.6, 920], [1, 520]], f2: [[0, 2300], [0.28, 2000], [0.6, 1450], [1, 900]], mouth: [[0, 650], [0.14, 6000], [0.8, 4000], [1, 1400]] },
  small: { len: 0.4, f0: 820, pitch: [[0, 0.85], [0.35, 1.18], [1, 0.9]], f1: [[0, 480], [0.35, 980], [1, 700]], f2: [[0, 2700], [0.35, 2200], [1, 1500]], mouth: [[0, 900], [0.15, 7000], [1, 2500]] },
  // the little rolling "mrrp?" cats make when they greet you: closed mouth, trilled, rising at the end
  mrrp: { len: 0.38, f0: 500, pitch: [[0, 0.92], [0.55, 1.02], [1, 1.32]], f1: [[0, 320], [0.55, 420], [1, 720]], f2: [[0, 1600], [0.55, 1750], [1, 2000]], mouth: [[0, 700], [0.5, 1300], [1, 4500]], trill: 0.6 },
};
const curve = (param, pts, t, len, k = 1) => pts.forEach(([at, v], i) => (i ? param.linearRampToValueAtTime(v * k, t + at * len) : param.setValueAtTime(v * k, t)));

export function meowInto(ctx, dest, t, kind = 'meow', noiseBuf) {
  const c = CALLS[kind] || CALLS.meow;
  const len = c.len * (0.9 + Math.random() * 0.2), f0 = c.f0 * (0.9 + Math.random() * 0.2);
  const end = t + len + 0.05;
  const src = ctx.createOscillator(); src.setPeriodicWave(voiceWave(ctx));
  curve(src.frequency, c.pitch, t, len, f0);
  // vibrato and a faster irregular wobble so it doesn't sound like a synth note
  [[5.5, 0.022], [13.7, 0.009]].forEach(([hz, depth]) => {
    const l = ctx.createOscillator(); l.frequency.value = hz * (0.9 + Math.random() * 0.2);
    const g = ctx.createGain(); g.gain.value = f0 * depth; l.connect(g).connect(src.frequency); l.start(t); l.stop(end);
  });
  const amp = ctx.createGain(); amp.gain.value = 1;
  src.connect(amp);
  // breath: a little air in the voice
  const air = ctx.createBufferSource(); air.buffer = noiseBuf; air.loop = true;
  const airF = ctx.createBiquadFilter(); airF.type = 'bandpass'; airF.frequency.value = 2800; airF.Q.value = 0.8;
  const airG = ctx.createGain(); airG.gain.value = 0.12; air.connect(airF).connect(airG).connect(amp); air.start(t, Math.random() * 2); air.stop(end);
  if (c.trill) {
    const l = ctx.createOscillator(); l.frequency.value = 24 + Math.random() * 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.45, t); g.gain.linearRampToValueAtTime(0.45, t + len * c.trill * 0.8); g.gain.linearRampToValueAtTime(0, t + len * c.trill);
    amp.gain.setValueAtTime(0.55, t); amp.gain.linearRampToValueAtTime(0.55, t + len * c.trill * 0.8); amp.gain.linearRampToValueAtTime(1, t + len * c.trill);
    l.connect(g).connect(amp.gain); l.start(t); l.stop(end);
  }
  const mix = ctx.createGain();
  [['f1', 3.5, 1], ['f2', 6, 0.55], [null, 9, 0.22]].forEach(([key, q, level]) => {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    if (key) curve(f.frequency, c[key], t, len); else f.frequency.value = 3300;
    const g = ctx.createGain(); g.gain.value = level; amp.connect(f).connect(g).connect(mix);
  });
  const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 1100;
  const bodyG = ctx.createGain(); bodyG.gain.value = 0.18; amp.connect(body).connect(bodyG).connect(mix);
  const mouth = ctx.createBiquadFilter(); mouth.type = 'lowpass'; mouth.Q.value = 0.7; curve(mouth.frequency, c.mouth, t, len);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.035);
  env.gain.setValueAtTime(1, t + len * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const out = ctx.createGain(); out.gain.value = 0.42; // peaks around 0.5, level with the toys
  mix.connect(mouth).connect(env).connect(out).connect(dest);
  src.start(t); src.stop(end);
}

// A purr is a stream of tiny flutters ~25 a second, louder breathing out than in. Built as a few
// seconds of individual pulses (each a short thump plus a burst of air) so it has the texture of a
// real purr and enough mid frequencies to come through laptop and phone speakers, which can't play
// the deep rumble alone.
export function purrBuffer(ctx) {
  const sr = ctx.sampleRate, breaths = [];
  let at = 0;
  for (let i = 0; i < 2; i++) {
    const out = 1.1 + Math.random() * 0.3, gap = 0.12, inn = 0.85 + Math.random() * 0.25;
    breaths.push([at, out, 1], [at + out + gap, inn, 0.55]); at += out + gap + inn + gap;
  }
  const len = Math.ceil(at * sr), d = new Float32Array(len), buf = ctx.createBuffer(1, len, sr);
  for (const [start, dur, level] of breaths) {
    const rate = 24 + Math.random() * 3;
    for (let p = start; p < start + dur; p += (1 + (Math.random() - 0.5) * 0.12) / rate) {
      const shape = Math.sin(Math.PI * (p - start) / dur) ** 0.6; // swell and fade within the breath
      const a = level * shape * (0.75 + Math.random() * 0.5), i0 = Math.floor(p * sr);
      const ring = 110 + Math.random() * 40, n = Math.floor(0.03 * sr);
      for (let j = 0; j < n && i0 + j < len; j++) {
        const s = j / sr;
        d[i0 + j] += a * (0.4 * Math.sin(2 * Math.PI * ring * s) * Math.exp(-s * 90) + 0.8 * (Math.random() * 2 - 1) * Math.exp(-s * 140));
      }
    }
  }
  buf.copyToChannel(d, 0);
  return buf;
}
const PURRS = new WeakMap();
export function purrInto(ctx, dest) {
  if (!PURRS.has(ctx)) PURRS.set(ctx, purrBuffer(ctx));
  const src = ctx.createBufferSource(); src.buffer = PURRS.get(ctx); src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
  const warm = ctx.createBiquadFilter(); warm.type = 'peaking'; warm.frequency.value = 420; warm.Q.value = 0.8; warm.gain.value = 9;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
  const out = ctx.createGain(); out.gain.value = 0;
  src.connect(hp).connect(warm).connect(lp).connect(out).connect(dest);
  src.start();
  return { src, out };
}

export function meow(kind = 'meow') {
  if (muted || !ensure()) return;
  meowInto(ac, fx, now() + 0.01, kind, noise());
}
let purrNode = null;
const PURR_LEVEL = 0.55;
export function purr(on) {
  if (on && (muted || purrNode)) return;
  if (!on) { if (purrNode && ac) { const p = purrNode; purrNode = null; p.out.gain.setTargetAtTime(0, now(), 0.15); setTimeout(() => { try { p.src.stop(); } catch {} }, 700); } return; }
  ensure();
  purrNode = purrInto(ac, fx);
  purrNode.out.gain.setTargetAtTime(PURR_LEVEL, now(), 0.2);
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

// ---------------------------------------------------------------- radio into the visualiser
// Once a media element is routed into Web Audio it only plays through here, so this is only used
// for sources that allow reading (radio). Must run inside a tap so the audio context can start.
export function attachMedia(el) {
  ensure();
  if (el._fokusSource) return;
  el._fokusSource = ac.createMediaElementSource(el);
  el._fokusSource.connect(master);
}
