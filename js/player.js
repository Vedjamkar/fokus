// Thin wrapper over the YouTube IFrame Player API. One player lives in the dock for the whole
// session, so music keeps going while you move between pages.

export const P = { ready: false, playing: false, id: '', list: '', title: '', author: '', error: '', queue: [], index: -1, volume: 60 };
const subs = new Set();
export const onChange = (fn) => subs.add(fn);
const emit = () => subs.forEach((fn) => fn(P));

let player = null;
let apiPromise = null;

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
  P.error = '';
  P.id = r.v || ''; P.list = r.list || '';
  P.title = meta.title || 'Loading…'; P.author = meta.by || '';
  emit();
  await ensurePlayer();
  if (r.list) player.loadPlaylist({ list: r.list, listType: 'playlist', index: 0 });
  else player.loadVideoById(r.v);
  return true;
}

export function toggle() {
  if (!player?.getPlayerState) return false;
  if (player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo();
  return true;
}
export const pause = () => player?.pauseVideo?.();
export const next = () => (P.queue.length ? player?.nextVideo?.() : player?.seekTo?.(0));
export const prev = () => (P.queue.length ? player?.previousVideo?.() : player?.seekTo?.(0));
export function setVolume(v) { P.volume = +v; player?.setVolume?.(P.volume); }
export const playAt = (i) => player?.playVideoAt?.(i);
export const state = () => player?.getPlayerState?.() ?? -2;
