// Music: YouTube (ad-free when possible) and live radio, behind one small API.
// - Ad-free: a public Invidious server hands back the plain audio of a YouTube video, which plays in
//   an <audio> element with no ads. Public servers come and go, so several are tried in turn, and if
//   none answers the song falls back to the normal YouTube player (ads possible) with a note saying so.
// - Radio: internet radio stations, also in an <audio> element. These let the page read the sound,
//   so the visualiser follows the real music.
// - YouTube player: the IFrame Player API, one player for the whole session.
// Using <audio> also means music keeps playing with a phone's screen locked.

export const P = { ownServer: '', ready: false, playing: false, id: '', list: '', title: '', author: '', error: '', note: '', queue: [], index: -1, volume: 60, mode: '', art: '', station: '', adFree: true };
const subs = new Set();
export const onChange = (fn) => subs.add(fn);
const emit = () => subs.forEach((fn) => fn(P));

let player = null;
let apiPromise = null;

// ---------------------------------------------------------------- ad-free YouTube via Invidious
// Servers, in the order they're tried: your own (Settings), the last one that worked, then the public
// ones that currently allow other sites to use them, from the live list at api.invidious.io (checked once
// a day, healthiest first), then a few known names as a last resort.
const KNOWN = ['https://yt.chocolatemoo53.com', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://invidious.tiekoetter.com'];
const LIST_KEY = 'fokus:invidious';
let goodServer = (() => { try { return localStorage.getItem(LIST_KEY + ':good') || null; } catch { return null; } })();
export const server = () => goodServer;
async function discovered() {
  try {
    const c = JSON.parse(localStorage.getItem(LIST_KEY) || 'null');
    if (c && Date.now() - c.at < 24 * 3600_000) return c.list;
  } catch {}
  try {
    const d = await withTimeout(fetch('https://api.invidious.io/instances.json?sort_by=health').then((r) => r.json()), 5000);
    const list = d.filter(([, i]) => i.type === 'https' && i.api && i.cors).map(([, i]) => i.uri.replace(/\/$/, ''));
    try { localStorage.setItem(LIST_KEY, JSON.stringify({ at: Date.now(), list })); } catch {}
    return list;
  } catch { return []; }
}
async function servers() {
  const own = (P.ownServer || '').replace(/\/$/, '');
  return [...new Set([own, goodServer, ...(await discovered()), ...KNOWN].filter(Boolean))];
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function invidious(path) {
  for (const base of await servers()) {
    try {
      const r = await withTimeout(fetch(base + path), 7000);
      if (!r.ok) continue;
      const j = await r.json();
      if (j.error) continue;
      goodServer = base;
      try { localStorage.setItem(LIST_KEY + ':good', base); } catch {}
      return { base, j };
    } catch { /* try the next server */ }
  }
  throw new Error('no-server');
}
// two players: one for YouTube audio (its server doesn't let the page read the sound) and one for radio
// (which does, so it's wired into the visualiser). A media element wired into Web Audio goes silent if
// its source can't be read, which is why they can't share one.
export const tubeEl = new Audio(); tubeEl.preload = 'auto';
// the picture: a muted video-only track that follows the audio (live streams on Safari carry both)
const videoEl = document.getElementById('np-video');
const frame = videoEl?.closest('.yt-frame'), badge = document.getElementById('np-badge');
let liveVideo = false; // true when the video element itself is playing the sound (Safari live streams)
const soundEl = () => (liveVideo ? videoEl : tubeEl);
function showAdFree(on, poster) {
  if (!videoEl) return;
  frame.classList.toggle('adfree', on); videoEl.hidden = !on; badge.hidden = !on;
  if (poster !== undefined) videoEl.poster = poster || '';
}
// keep the picture with the sound: start, stop and seek together, and nudge it back if it drifts
if (videoEl) {
  tubeEl.addEventListener('play', () => { if (!liveVideo && videoEl.src) videoEl.play().catch(() => {}); });
  tubeEl.addEventListener('pause', () => { if (!liveVideo) videoEl.pause(); });
  tubeEl.addEventListener('seeked', () => { if (!liveVideo && videoEl.src) videoEl.currentTime = tubeEl.currentTime; });
  tubeEl.addEventListener('timeupdate', () => { if (!liveVideo && videoEl.src && videoEl.readyState > 1 && Math.abs(videoEl.currentTime - tubeEl.currentTime) > 0.35) videoEl.currentTime = tubeEl.currentTime; });
  tubeEl.addEventListener('waiting', () => { if (!liveVideo) videoEl.pause(); });
  tubeEl.addEventListener('playing', () => { if (!liveVideo && videoEl.src) videoEl.play().catch(() => {}); });
  videoEl.addEventListener('error', () => { if (!liveVideo) { videoEl.removeAttribute('src'); videoEl.load(); } }); // music carries on over the thumbnail
}
export const radioEl = new Audio(); radioEl.preload = 'none'; radioEl.crossOrigin = 'anonymous';
// a valid 0.1-second silent WAV, built here rather than pasted in as a blob of base64
const SILENT = (() => {
  const n = 800, b = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 16000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...new Uint8Array(b.buffer)))}`;
})();
let unlocked = false;
// phones only let audio start inside a tap, and the song's address arrives after a network round-trip,
// so both players are woken up with a silent clip while the tap is still in progress
function unlock() {
  if (unlocked) return; unlocked = true;
  for (const el of [tubeEl, radioEl, videoEl].filter(Boolean)) { el.src = SILENT; el.play().then(() => el.pause()).catch(() => {}); }
}
let adQueue = [], adIndex = 0, playToken = 0;
async function playAd(i) {
  const token = ++playToken;
  const item = adQueue[i]; if (!item) return false;
  adIndex = i; P.index = i;
  P.id = item.id; P.title = item.title || 'Loading…'; P.author = item.author || ''; P.art = ''; emit();
  const { base, j } = await invidious(`/api/v1/videos/${item.id}?local=true&fields=title,author,liveNow,hlsUrl,adaptiveFormats`);
  if (token !== playToken) return true; // something else started meanwhile
  const abs = (u) => (u.startsWith('http') ? u : base + u);
  P.title = j.title || P.title; P.author = j.author || P.author;
  if (j.liveNow) {
    // live streams come as HLS (picture and sound together), which only Safari plays natively
    if (!j.hlsUrl || !videoEl?.canPlayType('application/vnd.apple.mpegurl')) throw new Error('live');
    liveVideo = true; tubeEl.pause(); tubeEl.removeAttribute('src');
    videoEl.muted = false; videoEl.volume = P.volume / 100; videoEl.src = abs(j.hlsUrl);
    showAdFree(true, thumb(item.id));
    P.mode = 'adfree'; P.note = ''; emit(); mediaSession();
    // some browsers say they can play HLS and then can't: treat that like any browser without it
    try { await videoEl.play(); } catch { liveVideo = false; videoEl.muted = true; videoEl.removeAttribute('src'); videoEl.load(); throw new Error('live'); }
    return true;
  }
  const formats = j.adaptiveFormats || [];
  const audio = formats.filter((f) => /^audio\//.test(f.type));
  const aPick = audio.filter((f) => /mp4a|audio\/mp4/.test(f.type)).sort((a, b) => +b.bitrate - +a.bitrate)[0] || audio.sort((a, b) => +b.bitrate - +a.bitrate)[0];
  if (!aPick) throw new Error('no-audio');
  // the sharpest H.264 picture up to 720p plays everywhere (Safari included); VP9 or AV1 only if that's all there is
  const height = (f) => parseInt(f.qualityLabel || f.resolution || '0', 10) || 0;
  const vids = formats.filter((f) => /^video\//.test(f.type) && height(f) <= 720 && videoEl?.canPlayType(f.type));
  const vPick = vids.filter((f) => /avc1/.test(f.type)).sort((a, b) => height(b) - height(a))[0] || vids.sort((a, b) => height(b) - height(a))[0];
  liveVideo = false;
  if (videoEl) { videoEl.muted = true; if (vPick) videoEl.src = abs(vPick.url); else { videoEl.removeAttribute('src'); videoEl.load(); } }
  showAdFree(true, thumb(item.id));
  tubeEl.src = abs(aPick.url);
  tubeEl.volume = P.volume / 100;
  P.mode = 'adfree'; P.note = ''; emit(); mediaSession();
  await tubeEl.play();
  return true;
}
tubeEl.addEventListener('ended', () => { if (P.mode === 'adfree' && adIndex + 1 < adQueue.length) playAd(adIndex + 1).catch(() => {}); });
tubeEl.addEventListener('error', () => {
  // the server gave a broken link: play this one through YouTube instead
  if (P.mode !== 'adfree' || !tubeEl.src || tubeEl.src.startsWith('data:')) return;
  const id = adQueue[adIndex]?.id; if (id) fallback({ v: id }, 'The ad-free server couldn’t play this one, so it’s playing through YouTube (ads possible).');
});
for (const el of [tubeEl, radioEl, videoEl].filter(Boolean)) {
  const owns = () => (el === radioEl ? P.mode === 'radio' : P.mode === 'adfree' && el === soundEl());
  el.addEventListener('play', () => { if (el.src.startsWith('data:') || !owns()) return; P.playing = true; emit(); });
  el.addEventListener('pause', () => { if (owns()) { P.playing = false; emit(); } });
}
function stopAll(except) {
  playToken++;
  if (except !== 'youtube') player?.stopVideo?.(); // stop, not pause: a pause while it's still loading doesn't stick
  if (except !== 'adfree') { tubeEl.pause(); videoEl?.pause(); if (liveVideo) { videoEl.removeAttribute('src'); videoEl.load(); liveVideo = false; } showAdFree(false); }
  if (except !== 'radio') { radioEl.pause(); radioEl.removeAttribute('src'); radioEl.load(); }
}
async function fallback(r, note) {
  stopAll('youtube');
  P.mode = 'youtube'; P.note = note || ''; P.art = '';
  P.id = r.v || ''; P.list = r.list || '';
  emit();
  await ensurePlayer();
  if (r.list) player.loadPlaylist({ list: r.list, listType: 'playlist', index: 0 });
  else player.loadVideoById(r.v);
}
// lock screen and headphone controls on phones
function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: P.title || 'FOKUS', artist: P.author || '', artwork: (P.art || (P.id && thumb(P.id))) ? [{ src: P.art || thumb(P.id), sizes: '480x360' }] : [] });
    navigator.mediaSession.setActionHandler('play', () => toggle());
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
  } catch { /* older browsers */ }
}

// ---------------------------------------------------------------- radio
export async function playRadio(st) {
  unlock();
  stopAll('radio');
  P.mode = 'radio'; P.station = st.id; P.id = ''; P.list = ''; P.queue = []; P.error = ''; P.note = '';
  P.title = st.name; P.author = `${st.genre} · live radio`; P.art = st.art || '';
  emit(); mediaSession();
  radioEl.src = st.url; radioEl.volume = P.volume / 100;
  try { await radioEl.play(); } catch { P.error = 'That station isn’t answering right now. Try another.'; P.playing = false; emit(); }
}

export function parseYT(input) {
  const raw = (input || '').trim();
  if (/^[\w-]{11}$/.test(raw)) return { v: raw };
  try {
    const u = new URL(raw);
    if (!/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(u.hostname)) return null;
    let v = u.searchParams.get('v');
    const list = u.searchParams.get('list');
    if (u.hostname.endsWith('youtu.be')) v = u.pathname.slice(1, 12);
    if (!v) { const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) v = m[1]; }
    if (!v && !list) return null;
    return { v: v || '', list: list || '' };
  } catch { return null; }
}

export const thumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  return (apiPromise ||= new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  }));
}

async function ensurePlayer() {
  if (player) return;
  await loadApi();
  await new Promise((res) => {
    player = new window.YT.Player('yt-host', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: () => { P.ready = true; player.setVolume(P.volume); res(); },
        onStateChange: (e) => {
          // an old video waking up after we switched away: keep it quiet
          if (P.mode !== 'youtube' && P.mode !== '') { if (e.data === 1 || e.data === 3) player.stopVideo(); return; }
          P.playing = e.data === 1;
          if (e.data === 1 || e.data === -1 || e.data === 5) refreshMeta();
          emit();
        },
        onError: (e) => {
          P.error = {
            2: 'That link has an invalid video ID.',
            5: 'This video can’t play in an embedded player.',
            100: 'Video not found. It may be private or removed.',
            101: 'The uploader doesn’t allow this video to play outside YouTube. Try another link.',
            150: 'The uploader doesn’t allow this video to play outside YouTube. Try another link.',
          }[e.data] || `YouTube error ${e.data}.`;
          P.playing = false;
          emit();
        },
      },
    });
  });
}

function refreshMeta() {
  if (!player?.getVideoData) return;
  const d = player.getVideoData() || {};
  if (d.video_id) P.id = d.video_id;
  if (d.title) P.title = d.title;
  if (d.author) P.author = d.author;
  P.queue = player.getPlaylist?.() || [];
  P.index = player.getPlaylistIndex?.() ?? -1;
}

// Call from a click: browsers only allow sound after a user gesture.
export async function play(input, meta = {}) {
  const r = typeof input === 'string' ? parseYT(input) : input;
  if (!r) { P.error = 'Paste a YouTube or YouTube Music link (video or playlist).'; emit(); return false; }
  unlock(); // must happen before the first await, while the tap still counts
  P.error = ''; P.note = ''; P.station = '';
  P.id = r.v || ''; P.list = r.list || '';
  P.title = meta.title || 'Loading…'; P.author = meta.by || '';
  emit();
  if (P.adFree) {
    try {
      stopAll('adfree');
      if (r.list) {
        const { j } = await invidious(`/api/v1/playlists/${r.list}?fields=title,author,videos`);
        adQueue = (j.videos || []).map((v) => ({ id: v.videoId, title: v.title, author: v.author }));
        const start = Math.max(0, adQueue.findIndex((v) => v.id === r.v));
        if (!adQueue.length) throw new Error('empty');
        P.queue = adQueue.map((v) => v.id);
        await playAd(start);
      } else {
        adQueue = [{ id: r.v, title: meta.title, author: meta.by }]; P.queue = [];
        await playAd(0);
      }
      return true;
    } catch (e) {
      const note = e.message === 'live' ? 'Live streams play ad-free only in Safari, so this one is playing through YouTube (ads possible).'
        : 'The ad-free servers aren’t answering right now, so this is playing through YouTube (ads possible).';
      await fallback(r, note);
      return true;
    }
  }
  await fallback(r, '');
  return true;
}

export function toggle() {
  if (P.mode === 'adfree' || P.mode === 'radio') {
    const el = P.mode === 'radio' ? radioEl : soundEl();
    if (!el.src || el.src.startsWith('data:')) return false;
    if (el.paused) el.play().catch(() => {}); else el.pause();
    return true;
  }
  if (!player?.getPlayerState) return false;
  if (player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo();
  return true;
}
export const pause = () => { player?.pauseVideo?.(); tubeEl.pause(); videoEl?.pause(); radioEl.pause(); };
export function next() {
  if (P.mode === 'adfree') { if (adIndex + 1 < adQueue.length) playAd(adIndex + 1).catch(() => {}); else tubeEl.currentTime = 0; return; }
  if (P.mode === 'radio') return;
  return P.queue.length ? player?.nextVideo?.() : player?.seekTo?.(0);
}
export function prev() {
  if (P.mode === 'adfree') { if (tubeEl.currentTime > 5 || adIndex === 0) tubeEl.currentTime = 0; else playAd(adIndex - 1).catch(() => {}); return; }
  if (P.mode === 'radio') return;
  return P.queue.length ? player?.previousVideo?.() : player?.seekTo?.(0);
}
export function setVolume(v) { P.volume = +v; player?.setVolume?.(P.volume); tubeEl.volume = radioEl.volume = P.volume / 100; if (liveVideo) videoEl.volume = P.volume / 100; }
export const playAt = (i) => (P.mode === 'adfree' ? playAd(i).catch(() => {}) : player?.playVideoAt?.(i));
export const state = () => (P.mode === 'adfree' || P.mode === 'radio' ? (P.playing ? 1 : 2) : player?.getPlayerState?.() ?? -2);
// YouTube's own player state, whatever mode is active (1 = playing); handy for checking it's quiet
export const youtubeState = () => player?.getPlayerState?.() ?? -2;
