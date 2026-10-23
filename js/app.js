import {
  S, save, uid, todayISO, addDays, parseISO, iso, subjectById, topicsIn, pct, counts, findNode, chaptersOf,
  putFile, getFile, delFile, replaceAll, clearExamples, resetToExamples, hasExamples,
} from './store.js';
import { renderNote, toggleTask } from './md.js';
import * as YT from './player.js';
import * as SND from './sounds.js';
import * as VIZ from './visualiser.js';
import * as TGM from './together.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const center = $('#center'), bl = $('#bl'), br = $('#br'), sheet = $('#sheet'), view = $('#view'), modal = $('#modal');
const popDue = $('#pop-due'), popMusic = $('#pop-music'), popTogether = $('#pop-together'), popRoom = $('#pop-room');
// features defined further down register their handlers here before the main tables exist
const ACTS_EXTRA = {}, CHANGES_EXTRA = {}, FORMS_EXTRA = {};

// ---------------------------------------------------------------- icons
const ICONS = {
  home: 'M4 11l8-6.5 8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  cloud: 'M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18z',
  tasks: 'M4 6l1.5 1.5L8 5M11 6.5h9M4 12.5h4v4H4zM11 14.5h9',
  music: 'M9 18V5.5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3',
  slides: 'M3 4h18v12H3zM8 20h8M12 16v4',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  course: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  today: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  expand: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
  shrink: 'M4 14h6v6M10 14l-7 7M20 10h-6V4M14 10l7-7',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  next: 'M5 5l10 7-10 7zM19 5v14',
  prev: 'M19 5L9 12l10 7zM5 5v14',
  skip: 'M5 5l8 7-8 7zM13 5l8 7-8 7z',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  chev: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  x: 'M6 6l12 12M18 6L6 18',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  ext: 'M14 4h6v6M20 4L10 14M18 14v6H4V6h6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  embed: 'M8 8l-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1.5 1.5 0 1 0 0-.01',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  tag: 'M3 12V4h8l9 9-8 8zM7.5 8.5h.01',
  brush: 'M14 4l6 6-8 8H6v-6zM4 20c0-2 1-3 3-3',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
};
const FILLED = new Set(['play', 'pause', 'next', 'prev', 'skip']);
const ic = (n, size) => `<svg viewBox="0 0 24 24" aria-hidden="true"${size ? ` width="${size}" height="${size}"` : ''} ${FILLED.has(n) ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}><path d="${ICONS[n]}"/></svg>`;
const TYPE_ICON = { textbook: 'book', slides: 'slides', note: 'note' };
const TYPE_LABEL = { textbook: 'Textbooks', slides: 'Slides', note: 'Notes' };
const TYPE_ONE = { textbook: 'Textbook', slides: 'Slides', note: 'Note' };

// ---------------------------------------------------------------- backgrounds
const GRADIENTS = [
  { id: 'twilight', name: 'Twilight', ink: 'light', css: 'radial-gradient(120% 90% at 100% 100%, #f2c4a2 0%, #e0725f 24%, rgba(224,114,95,0) 56%), radial-gradient(90% 80% at 42% 62%, #5a1fd8 0%, rgba(90,31,216,0) 72%), linear-gradient(160deg, #0e0d16 0%, #1c1240 46%, #3a1a8f 100%)' },
  { id: 'midnight', name: 'Midnight', ink: 'light', css: 'radial-gradient(80% 70% at 82% 92%, #2b5bd7 0%, rgba(43,91,215,0) 60%), radial-gradient(70% 60% at 18% 28%, #3b1d7a 0%, rgba(59,29,122,0) 70%), linear-gradient(170deg, #05060c, #0c1230)' },
  { id: 'ember', name: 'Ember', ink: 'light', css: 'radial-gradient(90% 80% at 90% 100%, #ffb36b 0%, rgba(255,179,107,0) 55%), radial-gradient(80% 70% at 30% 60%, #c2366b 0%, rgba(194,54,107,0) 72%), linear-gradient(160deg, #12070c, #3a0f24)' },
  { id: 'matcha', name: 'Matcha', ink: 'light', css: 'radial-gradient(90% 80% at 85% 88%, #c6dd8c 0%, rgba(198,221,140,0) 55%), radial-gradient(80% 70% at 30% 42%, #1f6b4f 0%, rgba(31,107,79,0) 72%), linear-gradient(160deg, #07120d, #123326)' },
  { id: 'lagoon', name: 'Lagoon', ink: 'light', css: 'radial-gradient(90% 80% at 100% 100%, #5fd0c7 0%, rgba(95,208,199,0) 55%), radial-gradient(80% 70% at 20% 50%, #1b4bb3 0%, rgba(27,75,179,0) 72%), linear-gradient(160deg, #050b1a, #0b2a5a)' },
  { id: 'peach', name: 'Peach', ink: 'dark', css: 'radial-gradient(100% 80% at 0% 100%, #ffb38a 0%, rgba(255,179,138,0) 60%), radial-gradient(90% 80% at 100% 0%, #ff9ec0 0%, rgba(255,158,192,0) 60%), linear-gradient(135deg, #ffe1cf, #ffd0dc)' },
  { id: 'paper', name: 'Paper', ink: 'dark', css: 'linear-gradient(180deg, #f2f2f0, #e5e5e1)' },
  { id: 'ink', name: 'Ink', ink: 'light', css: 'radial-gradient(70% 60% at 50% 45%, #1d1d22 0%, #09090b 100%)' },
];
// Unsplash photos served through Picsum (free to use)
const PHOTOS = [
  [11, 'Misty valley', 'Paul Jarvis'], [83, 'Night forest', 'Julie Geiger'], [84, 'Storm bridge', 'Johnny Lam'],
  [110, 'Golden field', 'Kenneth Thewissen'], [122, 'City lights', 'Vadim Sherbakov'], [124, 'Still water', 'Anton Sulsky'],
  [135, 'Grey sea', 'Yuriy Khimanin'], [149, 'Night lightning', 'Guillaume'], [10, 'Lake pines', 'Paul Jarvis'],
  [166, 'Highlands', 'Romain Briaux'], [38, 'Cloud drift', 'Allyson Souza'], [16, 'Quiet coast', 'Paul Jarvis'],
].map(([id, name, by]) => ({ id, name, by, url: `https://picsum.photos/id/${id}/1920/1080`, thumb: `https://picsum.photos/id/${id}/400/225` }));
// Animated scenes: muted YouTube livestreams and long videos looped behind everything
const ANIMATED = [
  ['rFZHOHl-L8A', 'Lofi Girl study room'], ['JD-kMIpDfnY', 'Lofi Girl at night'], ['4xDzrJKXOOY', 'Synthwave city'],
  ['E2vONfzoyRI', 'Jazz lofi'], ['1Tl2FtV06qo', 'Asian lofi'], ['NJuSStkIZBg', 'Rainy jazz café'], ['Jvgx5HHJ0qw', 'Rooftop rain'],
].map(([id, name]) => ({ id, name, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }));

// the room has its own backdrop when you pick one; otherwise it borrows the home background (blurred)
const bgFor = (mode) => (mode === 'room' && S.settings.bg.room) || (S.settings.bgSame ? S.settings.bg.home : S.settings.bg[mode === 'room' ? 'home' : mode]) || { type: 'gradient', value: 'twilight' };
let bgKey = '', bgObjectUrl = '';
async function applyBackground() {
  const spec = bgFor(ui.mode);
  const grad = spec.type === 'gradient' ? (GRADIENTS.find((g) => g.id === spec.value) || GRADIENTS[0]) : spec.type === 'css' ? { css: spec.value, ink: spec.ink || 'light' } : null;
  const root = document.documentElement;
  root.dataset.ink = grad ? grad.ink : 'light';
  root.style.setProperty('--dim', grad ? 0 : (S.settings.dim ?? 25) / 100);
  const key = JSON.stringify(spec);
  if (key === bgKey) return;
  bgKey = key;
  const host = $('#bg-photo');
  if (bgObjectUrl) { URL.revokeObjectURL(bgObjectUrl); bgObjectUrl = ''; }
  host.style.background = grad ? grad.css : '#0b0a12';
  if (grad) { host.innerHTML = ''; return; }
  if (spec.type === 'image') host.innerHTML = `<img src="${esc(spec.value)}" alt="">`;
  else if (spec.type === 'video') host.innerHTML = `<video src="${esc(spec.value)}" autoplay muted loop playsinline></video>`;
  else if (spec.type === 'youtube') {
    const id = encodeURIComponent(spec.value);
    host.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1" allow="autoplay; encrypted-media" tabindex="-1" title="Background video"></iframe>`;
  } else if (spec.type === 'file') {
    const blob = await getFile(spec.value).catch(() => null);
    if (!blob) { host.innerHTML = ''; return; }
    bgObjectUrl = URL.createObjectURL(blob);
    host.innerHTML = blob.type.startsWith('video') ? `<video src="${bgObjectUrl}" autoplay muted loop playsinline></video>` : `<img src="${bgObjectUrl}" alt="">`;
  }
}
function bgThumbStyle(spec) {
  if (spec.type === 'gradient') return `background:${(GRADIENTS.find((g) => g.id === spec.value) || GRADIENTS[0]).css}`;
  if (spec.type === 'css') return `background:${spec.value}`;
  if (spec.type === 'image') return `background-image:url('${esc(spec.value)}')`;
  if (spec.type === 'youtube') return `background-image:url('https://i.ytimg.com/vi/${esc(spec.value)}/hqdefault.jpg')`;
  return 'background:#222';
}

// ---------------------------------------------------------------- dates
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (s) => { const d = parseISO(s); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
function relDate(s) {
  const diff = Math.round((parseISO(s) - parseISO(todayISO())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days ago`;
  if (diff < 7) return DOW[parseISO(s).getDay()];
  return fmtDate(s);
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const fmtTime = (hm) => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const minutesOf = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
function nextLecture(subjectId) {
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const lecs = S.lectures.filter((l) => l.subjectId === subjectId);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const hits = lecs.filter((l) => l.days.includes(d.getDay()) && (i > 0 || minutesOf(l.end) > nowMin)).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    if (hits.length) {
      const l = hits[0];
      return { l, date: iso(d), inDays: i, live: i === 0 && minutesOf(l.start) <= nowMin && nowMin < minutesOf(l.end) };
    }
  }
  return null;
}
const lecturesOn = (ds) => { const dow = parseISO(ds).getDay(); return S.lectures.filter((l) => l.days.includes(dow)).sort((a, b) => minutesOf(a.start) - minutesOf(b.start)); };
const whenTxt = (nl) => (nl ? `${nl.live ? 'Now' : nl.inDays === 0 ? 'Today' : nl.inDays === 1 ? 'Tomorrow' : DOW[parseISO(nl.date).getDay()]} ${nl.live ? `· until ${fmtTime(nl.l.end)}` : fmtTime(nl.l.start)}` : 'No lectures set');

// ---------------------------------------------------------------- ui state
const UIKEY = 'studyhaven:ui';
const saved = (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch { return {}; } })();
const ui = { mode: saved.mode || 'home', pop: null, cal: 0, libSubject: '', subjTab: 'note', editNote: false, open: new Set(), closed: new Set(), bgTab: 'home', lastHash: '', tray: false };
const saveUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ mode: ui.mode })); } catch {} };

// ---------------------------------------------------------------- routing
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  if (name === 's' && subjectById(arg)) return { name: 'subject', id: arg };
  if (name === 'r' && S.resources.find((r) => r.id === arg)) return { name: 'resource', id: arg };
  if (name === 'library') return { name: 'library', tab: TYPE_LABEL[arg] ? arg : 'note' };
  if (['today', 'subjects', 'calendar', 'courses', 'settings', 'studio'].includes(name)) return { name };
  return { name: 'stage' };
}
function render() {
  const r = route();
  renderStage();
  if (r.name === 'stage') { sheet.hidden = true; }
  else {
    sheet.hidden = false;
    $('#sheet-nav').innerHTML = sheetNavHTML(r);
    view.innerHTML = VIEWS[r.name](r);
    if (location.hash !== ui.lastHash) view.scrollTop = 0;
    $$('[data-note]', view).forEach(mountNote);
    if (r.name === 'resource') mountViewer(S.resources.find((x) => x.id === r.id));
  }
  ui.lastHash = location.hash;
  room?.update(roomState());
  mountStickers();
  tickTimer(); tickClock(); syncPlayer();
}
window.addEventListener('hashchange', () => { ui.editNote = false; closePops(); render(); });

// ---------------------------------------------------------------- the stage
const QUOTES = ['Small steps, every day.', 'One page at a time.', 'Slow progress is still progress.', 'Done is better than perfect.', 'Focus is a quiet kind of power.', 'Start where you are.', 'Discipline is remembering what you want.', 'You don’t need more time, just fewer tabs.', 'Make today count.', 'Hard things get easier by doing them.'];
let quoteIdx = Math.floor(Date.now() / 864e5) % QUOTES.length;

function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Late night study' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Burning the midnight oil';
  const name = S.settings.userName ? `, ${S.settings.userName}` : '';
  const live = S.subjects.map((s) => ({ s, nl: nextLecture(s.id) })).find((x) => x.nl?.live);
  const dueToday = S.due.filter((d) => !d.done && d.date <= todayISO()).length;
  const line = live ? `${live.s.code || live.s.name} is on right now.` : dueToday ? `${dueToday} ${dueToday === 1 ? 'thing is' : 'things are'} due today.` : 'Nothing due today. Get ahead.';
  return `${g}${name}.<br>${line}`;
}
const digits = (str) => [...str].map((c) => (c === ':' ? '<span class="colon">:</span>' : `<span class="dg">${c}</span>`)).join('');
function clockStr() {
  const d = new Date();
  let h = d.getHours();
  if (!S.settings.clock24) h = ((h + 11) % 12) + 1;
  return `${S.settings.clock24 ? String(h).padStart(2, '0') : h}:${String(d.getMinutes()).padStart(2, '0')}`;
}
let lastClock = '';
function tickClock() {
  const c = clockStr();
  if (c === lastClock && $('[data-clock]')?.innerHTML) return;
  lastClock = c;
  $$('[data-clock]').forEach((e) => { e.innerHTML = digits(c); });
}
setInterval(tickClock, 1000);

function renderStage() {
  $('#wordmark').textContent = S.settings.appName.toLowerCase();
  const quote = $('#quote');
  if (ui.mode === 'ambient' && (T.running || T.left !== dur(T.mode))) {
    quote.outerHTML = `<div class="mini-card" id="quote"><small data-t="lbl">${MODE_LABEL[T.mode]}</small><div class="t-clock" data-t="clock">${digits(mmss(leftSec()))}</div><button class="sq sm" data-act="t-toggle" data-t="btn" aria-label="Start or pause">${ic(T.running ? 'pause' : 'play')}</button></div>`;
  } else {
    const q = S.settings.quotes ? `“${QUOTES[quoteIdx]}”` : '';
    if (quote.tagName !== 'P') quote.outerHTML = '<p class="quote" id="quote"></p>';
    $('#quote').textContent = q;
    $('#quote').dataset.act = 'quote';
  }
  center.classList.toggle('room-mode', ui.mode === 'room');
  document.body.classList.toggle('in-room', ui.mode === 'room');
  document.body.classList.toggle('room-bg', ui.mode === 'room' && !!S.settings.bg.room);
  center.innerHTML = ui.mode === 'home' ? homeHTML() : ui.mode === 'focus' ? focusHTML() : ui.mode === 'room' ? roomHudHTML() : '';
  if (ui.mode === 'room') ensureRoom(); else hideRoom();
  mountStickers();
  bl.innerHTML = blHTML();
  br.innerHTML = brHTML();
  applyBackground();
}

function homeHTML() {
  const dueOpen = S.due.filter((d) => !d.done);
  const soon = dueOpen.filter((d) => d.date <= addDays(1)).sort((a, b) => a.date.localeCompare(b.date));
  const tiles = S.subjects.slice(0, 6).map((s) => {
    const nl = nextLecture(s.id);
    return `<a class="lec" href="#/s/${s.id}"><span class="code"><i style="background:${esc(s.color)}"></i>${esc(s.code || 'COURSE')}${nl?.live ? '<span class="live">● LIVE</span>' : ''}</span>
      <b>${esc(s.name)}</b><small>${whenTxt(nl)}</small><div class="bar"><span style="width:${pct(s)}%"></span></div></a>`;
  }).join('');
  const tick = soon.length
    ? `<b>${soon.length} due soon</b> · ${esc(soon[0].title)}${soon.length > 1 ? ` · ${esc(soon[1].title)}` : ''}`
    : dueOpen.length ? `Next due · <b>${esc(dueOpen.sort((a, b) => a.date.localeCompare(b.date))[0].title)}</b>` : 'All caught up';
  return `<div class="home">
    <p class="greet">${greeting()}</p>
    <div class="clock num" data-clock></div>
    <div class="lec-row">${tiles}</div>
    <button class="ticker" data-act="pop" data-pop="due">${tick}</button>
  </div>`;
}

// ---------------------------------------------------------------- focus timer
const TKEY = 'studyhaven:timer';
const T = (() => { try { return JSON.parse(localStorage.getItem(TKEY)) || null; } catch { return null; } })() || { mode: 'focus', running: false, endAt: 0, left: S.settings.focus.work * 60, round: 0, subjectId: '', task: '' };
const saveT = () => { try { localStorage.setItem(TKEY, JSON.stringify(T)); } catch {} };
const MODE_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const dur = (m) => 60 * S.settings.focus[m === 'focus' ? 'work' : m];
const leftSec = () => (T.running ? Math.max(0, Math.ceil((T.endAt - Date.now()) / 1000)) : T.left);
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
function tStart() { T.endAt = Date.now() + T.left * 1000; T.running = true; saveT(); renderStage(); timerChanged(); }
function tPause() { T.left = leftSec(); T.running = false; saveT(); renderStage(); timerChanged(); }
function tSetMode(m) { T.mode = m; T.running = false; T.left = dur(m); saveT(); timerChanged(); }
function tComplete(skipped) {
  const f = S.settings.focus;
  const wasFocus = T.mode === 'focus';
  if (wasFocus) {
    if (!skipped) { S.sessions.push({ id: uid(), subjectId: T.subjectId, min: f.work, at: Date.now() }); save(); }
    T.round++;
    tSetMode(T.round % f.every === 0 ? 'long' : 'short');
    if (f.autoBreak) tStart();
  } else {
    tSetMode('focus');
    if (f.autoFocus) tStart();
  }
  if (!skipped) {
    chime();
    const msg = wasFocus ? 'Focus block done. Take a break.' : 'Break’s over. Back to it.';
    toast(msg);
    try { if (Notification.permission === 'granted') new Notification(S.settings.appName, { body: msg }); } catch {}
  }
  renderStage();
}
function chime() {
  if (!S.settings.chime) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.18], [1320, 0.36]].forEach(([f, t]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.6);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.7);
    });
  } catch {}
}
const subjOptions = (sel, none = 'No subject') => [`<option value="">${none}</option>`, ...S.subjects.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.code ? `${s.code} · ${s.name}` : s.name)}</option>`)].join('');
function focusHTML() {
  const every = S.settings.focus.every;
  return `<div class="focus ${T.running ? 'running' : ''}">
    <input class="focus-q" id="focus-q" data-input="t-task" value="${esc(T.task || '')}" placeholder="What do you want to focus on?" aria-label="What you’re focusing on" autocomplete="off">
    <div class="t-modes" role="tablist">${Object.entries(MODE_LABEL).map(([k, l]) => `<button role="tab" class="${T.mode === k ? 'on' : ''}" data-act="t-mode" data-mode="${k}">${l}</button>`).join('')}</div>
    <div class="t-dots" aria-label="Rounds">${Array.from({ length: every }, (_, i) => `<i class="${i <= T.round % every && T.mode === 'focus' ? (i < T.round % every || T.running ? 'on' : '') : i < T.round % every ? 'on' : ''}"></i>`).join('')}</div>
    <div class="t-clock num" data-t="clock">${digits(mmss(leftSec()))}</div>
    <div class="t-ctrls">
      <button class="sq" data-act="t-toggle" data-t="btn" aria-label="Start or pause">${ic(T.running ? 'pause' : 'play')}</button>
      <button class="sq" data-act="t-reset" aria-label="Reset">${ic('reset')}</button>
      <button class="sq" data-act="t-skip" aria-label="Skip to next">${ic('skip')}</button>
    </div>
    <label class="t-subj">Studying <select data-change="t-subject" aria-label="Subject">${subjOptions(T.subjectId, 'anything')}</select></label>
  </div>`;
}
function tickTimer() {
  const l = leftSec();
  if (T.running && l <= 0) { T.running = false; T.left = 0; tComplete(false); return; }
  const s = mmss(l);
  $$('[data-t="clock"]').forEach((e) => { if (e.textContent !== s) e.innerHTML = digits(s); });
  $$('[data-t="mini"]').forEach((e) => { e.textContent = s; });
  $$('[data-t="btn"]').forEach((e) => { const want = T.running ? 'pause' : 'play'; if (e.dataset.icon !== want) { e.dataset.icon = want; e.innerHTML = ic(want); } });
  document.title = T.running ? `${s} · ${MODE_LABEL[T.mode]}` : S.settings.appName;
  if (room && s !== lastRoomClock) { lastRoomClock = s; room.update({ timer: roomTimer() }); }
  $$('[data-t="lbl-room"]').forEach((e) => { e.textContent = MODE_LABEL[T.mode]; });
}
let lastRoomClock = '';
setInterval(() => { if (T.running) tickTimer(); }, 250);

// ---------------------------------------------------------------- corners
function streakDays() {
  const days = new Set(S.sessions.map((x) => iso(new Date(x.at))));
  let n = 0, d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function blHTML() {
  const r = route();
  const b = (act, icon, label, on, extra = '') => `<button class="sq sm ${on ? 'on' : ''}" ${act} aria-label="${label}" title="${label}" ${extra}>${ic(icon)}</button>`;
  return [
    b('data-act="pop" data-pop="due"', 'tasks', 'Due', ui.pop === 'due'),
    `<button class="sq sm has-eq ${ui.pop === 'music' ? 'on' : ''}" data-act="pop" data-pop="music" aria-label="Music" title="Music">${ic('music')}${YT.P.playing ? '<span class="eq"><i></i><i></i><i></i></span>' : ''}</button>`,
    `<button class="sq sm has-eq ${ui.pop === 'together' ? 'on' : ''}" data-act="pop" data-pop="together" aria-label="Study together" title="Study together">${ic('users')}${TGM.TG.status === 'on' ? `<span class="eq" style="padding:2px 5px;font:700 9px var(--f-ui);color:#fff;align-items:center">${TGM.TG.members.size}</span>` : ''}</button>`,
    b('data-act="go" data-href="#/library/note"', 'pen', 'Notes', r.name === 'library' || r.name === 'resource'),
    b('data-act="go" data-href="#/subjects"', 'grid', 'Subjects', r.name === 'subjects' || r.name === 'subject'),
    b('data-act="go" data-href="#/calendar"', 'calendar', 'Calendar', r.name === 'calendar'),
  ].join('');
}
function brHTML() {
  const modes = [['ambient', 'cloud', 'Ambient'], ['home', 'home', 'Home'], ['focus', 'bulb', 'Focus'], ['room', 'cube', 'Room']];
  const timerPill = T.running && ui.mode !== 'focus' ? `<button class="pill-btn" data-act="mode" data-mode="focus" title="Back to the timer">${ic('clock')}<span data-t="mini" class="num">${mmss(leftSec())}</span></button>` : '';
  return `${timerPill}<span class="pill-btn" title="Days in a row with a focus block">🔥 ${streakDays()}</span>
    <div class="seg" role="tablist" aria-label="Mode">${modes.map(([k, icn, l]) => `<button role="tab" class="${ui.mode === k ? 'on' : ''}" data-act="mode" data-mode="${k}" aria-label="${l} mode" title="${l}">${ic(icn)}<span class="lbl">${l}</span></button>`).join('')}</div>
    <button class="sq sm ${ui.tray ? 'on' : ''}" data-act="tray" aria-label="Stickers" title="Stickers">${ic('sparkle')}</button>
    <button class="sq sm" data-act="go" data-href="#/settings" aria-label="Settings" title="Settings">${ic('gear')}</button>
    <button class="sq sm" data-act="fullscreen" aria-label="Full screen" title="Full screen">${ic(document.fullscreenElement ? 'shrink' : 'expand')}</button>`;
}

// ---------------------------------------------------------------- popovers
function closePops() {
  ui.pop = null;
  popDue.hidden = true;
  popTogether.hidden = true;
  popRoom.hidden = true;
  popMusic.classList.add('closed');
}
function openPop(which) {
  const was = ui.pop;
  closePops();
  if (was !== which) {
    ui.pop = which;
    if (which === 'due') { popDue.innerHTML = duePopHTML(); popDue.hidden = false; }
    if (which === 'music') { renderTracks(); renderMixer(); popMusic.classList.remove('closed'); }
    if (which === 'together') { popTogether.innerHTML = togetherHTML(); popTogether.hidden = false; }
    if (which === 'room') { popRoom.innerHTML = roomCfgHTML(); popRoom.hidden = false; }
  }
  bl.innerHTML = blHTML();
}
const prioRank = (d) => ({ high: 0, med: 1, low: 2 }[d.priority] ?? 3);
const priChip = (p) => (p === 'high' ? '<span class="chip pri-high">High</span>' : p === 'med' ? '<span class="chip pri-med">Med</span>' : '');
const subjChip = (id) => { const s = subjectById(id); return s ? `<span class="chip"><i style="background:${esc(s.color)}"></i>${esc(s.code || s.name)}</span>` : ''; };
function dueGroups(list) {
  const t = todayISO(), tm = addDays(1), wk = addDays(7);
  const open = list.filter((d) => !d.done).sort((a, b) => a.date.localeCompare(b.date) || prioRank(a) - prioRank(b));
  return [
    ['Overdue', 'overdue', open.filter((d) => d.date < t)],
    ['Today', '', open.filter((d) => d.date === t)],
    ['Tomorrow', '', open.filter((d) => d.date === tm)],
    ['This week', '', open.filter((d) => d.date > tm && d.date <= wk)],
    ['Later', '', open.filter((d) => d.date > wk)],
  ].filter((g) => g[2].length);
}
function duePopHTML() {
  const groups = dueGroups(S.due);
  const now = new Date();
  const since = Date.now() - 7 * 864e5;
  const weekH = (S.sessions.filter((x) => x.at >= since).reduce((a, x) => a + x.min, 0) / 60).toFixed(1);
  const all = S.subjects.flatMap((s) => topicsIn(s));
  return `<div class="pop-head"><span class="chip-ic">${ic('tasks')}</span><b>Due</b><span class="spacer"></span><button class="sq sm" data-act="pop" data-pop="due" aria-label="Close">${ic('x')}</button></div>
    <div class="pop-body">${groups.length ? groups.map(([n, cls, items]) => `<div class="g-label ${cls}">${n} <span>${items.length}</span></div>${items.map((d) => {
      const s = subjectById(d.subjectId);
      return `<div class="trow"><input type="checkbox" class="check" data-change="due-done" data-id="${d.id}" aria-label="Mark ${esc(d.title)} done">
        <span class="t" data-act="due-edit" data-id="${d.id}">${esc(d.title)}<small>${[s?.code || s?.name, d.kind, n === 'Today' ? '' : relDate(d.date)].filter(Boolean).map(esc).join(' · ')}</small></span>${priChip(d.priority)}</div>`;
    }).join('')}`).join('') : '<div class="empty">Nothing due. Add your next assignment, quiz or exam.</div>'}</div>
    <div class="pop-foot"><button class="add-big" data-act="due-new">+ Add due item</button>
      <div class="stats-line"><span>Day <b>${Math.round(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100)}%</b></span><span>Focus this week <b>${weekH}h</b></span><span>Syllabus <b>${all.length ? Math.round((all.filter((t) => t.done).length / all.length) * 100) : 0}%</b></span><a href="#/today" style="color:var(--fg);font-weight:600">Open today →</a></div></div>`;
}

// ---------------------------------------------------------------- music
function renderTracks() {
  $('#tracks').innerHTML = S.music.saved.map((t) => {
    const p = YT.parseYT(t.url) || {};
    const on = (p.v && p.v === YT.P.id) || (p.list && p.list === YT.P.list);
    return `<div class="track ${on ? 'on' : ''}" role="button" tabindex="0" data-act="yt-saved" data-id="${t.id}"><span class="tt" style="background-image:url('${YT.thumb(p.v)}')"></span><span class="ellip"><b>${esc(t.title)}</b><small>${esc(t.by || (p.list ? 'Playlist' : 'YouTube'))}</small></span><button class="x" data-act="yt-forget" data-id="${t.id}" aria-label="Remove from list">${ic('x', 14)}</button></div>`;
  }).join('');
}
function syncPlayer() {
  const P = YT.P;
  const has = P.id || P.list;
  $('#np-title').textContent = has ? P.title : 'Nothing playing';
  $('#np-sub').textContent = P.error ? '' : has ? P.author || 'YouTube' : 'Pick a track or paste a YouTube link';
  $('#np-art').style.backgroundImage = P.id ? `url('${YT.thumb(P.id)}')` : '';
  $('#np-play').innerHTML = ic(P.playing ? 'pause' : 'play');
  const err = $('#np-err'); err.hidden = !P.error; err.textContent = P.error;
  $$('#tracks .track').forEach((e) => {
    const t = S.music.saved.find((x) => x.id === e.dataset.id); const p = YT.parseYT(t?.url || '') || {};
    e.classList.toggle('on', !!((p.v && p.v === P.id) || (p.list && p.list === P.list)));
  });
  const cur = S.music.saved.find((t) => { const p = YT.parseYT(t.url) || {}; return (p.v && p.v === P.id && !p.list) || (p.list && p.list === P.list); });
  if (cur && cur.pending && P.title && P.title !== 'Loading…') { cur.title = P.title; cur.by = P.author; delete cur.pending; save(); renderTracks(); }
  room?.update({ musicPlaying: P.playing });
  const btn = $('[data-pop="music"]', bl);
  if (btn && !!btn.querySelector('.eq') !== P.playing) bl.innerHTML = blHTML();
}
YT.onChange(syncPlayer);
YT.P.volume = S.music.volume ?? 60;
$('#np-vol').value = YT.P.volume;
$('#np-prev').innerHTML = ic('prev'); $('#np-next').innerHTML = ic('next'); $('#music-ic').innerHTML = ic('music'); $('#music-x').innerHTML = ic('x');
async function playLink(url) {
  const ok = await YT.play(url);
  if (ok && !S.music.saved.some((t) => t.url === url)) { S.music.saved.unshift({ id: uid(), url, title: 'YouTube link', by: '', pending: true }); save(); renderTracks(); }
}

// ---------------------------------------------------------------- sheet (the app window)
function sheetNavHTML(r) {
  const on = (cond) => (cond ? 'on' : '');
  const a = (href, icon, label, cond) => `<a href="${href}" class="${on(cond)}">${ic(icon)}${label}</a>`;
  return `<button class="close" data-act="close-sheet" aria-label="Close">${ic('x')}</button>
    ${a('#/today', 'today', 'Today', r.name === 'today')}
    ${a('#/subjects', 'grid', 'Subjects', r.name === 'subjects')}
    ${S.subjects.map((s) => `<a href="#/s/${s.id}" class="subj-link ${on(r.id === s.id)}"><i class="sub-dot" style="background:${esc(s.color)}"></i><span class="ellip">${esc(s.name)}</span><span class="pct num">${pct(s)}%</span></a>`).join('')}
    <div class="nav-label">Library</div>
    ${a('#/library/note', 'note', 'Notes', r.name === 'library' && r.tab === 'note')}
    ${a('#/library/textbook', 'book', 'Textbooks', r.name === 'library' && r.tab === 'textbook')}
    ${a('#/library/slides', 'slides', 'Slides', r.name === 'library' && r.tab === 'slides')}
    <div class="nav-label">Plan</div>
    ${a('#/calendar', 'calendar', 'Calendar', r.name === 'calendar')}
    ${a('#/courses', 'course', 'Courses & embeds', r.name === 'courses')}
    ${a('#/studio', 'sparkle', 'Aesthetic studio', r.name === 'studio')}
    ${a('#/settings', 'gear', 'Settings', r.name === 'settings')}
    ${hasExamples() ? '<div class="foot example-note">You’re seeing example data.<button data-act="clear-examples">Clear examples</button></div>' : ''}`;
}
const progBar = (p, color = '') => `<div class="prog"><div class="bar"><span style="width:${p}%;${color ? `--c:${esc(color)}` : ''}"></span></div><span class="num">${p}%</span></div>`;
const dueItemHTML = (d, showDate) => `
  <div class="due-item ${d.done ? 'done' : ''}">
    <input type="checkbox" class="check" data-change="due-done" data-id="${d.id}" ${d.done ? 'checked' : ''} aria-label="Mark ${esc(d.title)} done">
    <span class="t" data-act="due-edit" data-id="${d.id}">${esc(d.title)}</span>
    ${d.kind ? `<span class="chip">${esc(d.kind)}</span>` : ''}${subjChip(d.subjectId)}${priChip(d.priority)}
    ${showDate ? `<span class="chip num">${relDate(d.date)}</span>` : ''}
  </div>`;
function dueListHTML(list, subjectId = '') {
  const groups = dueGroups(list);
  return (groups.length ? groups.map(([name, cls, items]) => `<div class="due-group"><div class="g-label ${cls}">${name} <span>${items.length}</span></div>${items.map((d) => dueItemHTML(d, name !== 'Today' && name !== 'Tomorrow')).join('')}</div>`).join('') : '<div class="empty">Nothing due.</div>')
    + `<button class="add-link" data-act="due-new" data-subject="${subjectId}">${ic('plus')} New due item</button>`;
}

function todayView() {
  const now = new Date(), t = todayISO();
  const st = S.settings;
  const tStart = parseISO(st.termStart), tEnd = parseISO(st.termEnd);
  const weeks = Math.max(1, Math.ceil((tEnd - tStart) / (7 * 864e5)));
  const wk = Math.min(weeks, Math.max(0, Math.floor((now - tStart) / (7 * 864e5)) + 1));
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const perDay = Array.from({ length: 7 }, (_, i) => { const a = +monday + i * 864e5; return S.sessions.filter((x) => x.at >= a && x.at < a + 864e5).reduce((m, x) => m + x.min, 0); });
  const maxDay = Math.max(60, ...perDay);
  const hrs = now.getHours();
  const lecs = lecturesOn(t);
  return `<div class="page">
    <div class="ph"><h1>${DOW[now.getDay()]}, ${MON[now.getMonth()]} ${now.getDate()}</h1><p>Week ${wk} of ${weeks} · ${lecs.length ? `${lecs.length} lecture${lecs.length > 1 ? 's' : ''} today` : 'no lectures today'}</p></div>
    <div class="cols">
      <div class="sec"><h2>Due</h2>${dueListHTML(S.due)}</div>
      <div class="sec"><h2>Schedule</h2>${lecs.length ? `<div class="due-group">${lecs.map((l) => { const s = subjectById(l.subjectId); return `<a href="#/s/${l.subjectId}" class="due-item" style="text-decoration:none;color:inherit"><i class="sub-dot" style="width:9px;height:9px;border-radius:50%;background:${esc(s?.color)}"></i><span class="t"><b>${esc(s?.name)}</b><br><small class="muted">${esc(l.room || '')}</small></span><span class="num muted" style="font-size:13px">${fmtTime(l.start)}</span></a>`; }).join('')}</div>` : '<div class="empty">No lectures today.</div>'}</div>
    </div>
    <div class="sec"><h2>At a glance</h2><div class="widgets">
      <div class="box"><div class="w-title">Day <span class="num">${Math.round(((hrs * 60 + now.getMinutes()) / 1440) * 100)}%</span></div><div class="dots" style="--cols:8">${Array.from({ length: 24 }, (_, i) => `<i class="${i < hrs ? 'on' : i === hrs ? 'now' : ''}"></i>`).join('')}</div></div>
      <div class="box"><div class="w-title">Term <span class="num">wk ${wk}/${weeks}</span></div><div class="dots" style="--cols:${Math.min(weeks, 8)}">${Array.from({ length: weeks }, (_, i) => `<i class="${i < wk - 1 ? 'on' : i === wk - 1 ? 'now' : ''}"></i>`).join('')}</div></div>
      <div class="box"><div class="w-title">Focus this week <span class="num">${(perDay.reduce((a, b) => a + b, 0) / 60).toFixed(1)}h</span></div><div class="weekbars">${perDay.map((m, i) => `<div title="${m} min"><span style="height:${Math.round((m / maxDay) * 100)}%"></span>${'MTWTFSS'[i]}</div>`).join('')}</div></div>
      <div class="box"><div class="w-title">Streak</div><div class="stat-big num">${streakDays()} <span style="font-size:16px;font-weight:600" class="muted">days</span></div></div>
    </div></div>
  </div>`;
}

function subjectsView() {
  return `<div class="page wide">
    <div class="ph-row"><div class="ph"><h1>Subjects</h1><p>Your lectures, with progress worked out from the topics you tick off.</p></div><button class="btn primary" data-act="subject-new">${ic('plus')} New subject</button></div>
    <div class="tiles">${S.subjects.map((s) => {
      const nl = nextLecture(s.id);
      const cover = s.cover ? `background-image:url('${esc(s.cover)}')` : `background:radial-gradient(90% 90% at 100% 100%, ${esc(s.color)} 0%, transparent 70%), linear-gradient(150deg, #15131f, ${esc(s.color)}55)`;
      return `<a class="tile" href="#/s/${s.id}"><div class="tile-cover" style="${cover}"><span class="code">${esc(s.code || '')}</span><b>${esc(s.name)}</b></div>
        <div class="tile-meta"><span>${ic('clock', 13)} ${whenTxt(nl)}${nl?.l.room ? ` · ${esc(nl.l.room)}` : ''}</span>${progBar(pct(s), s.color)}</div></a>`;
    }).join('')}<button class="tile add" data-act="subject-new"><div class="tile-cover">+ Add subject</div></button></div>
    <div class="sec"><div class="sec-head"><h2>Weekly lectures</h2><span class="spacer"></span><button class="btn" data-act="lecture-new">${ic('plus')} Lecture</button></div>${lectureListHTML(S.lectures)}</div>
  </div>`;
}
function lectureListHTML(list) {
  if (!list.length) return '<div class="empty">Add your weekly lecture times. They show on the home screen and the calendar.</div>';
  return `<div class="due-group">${list.map((l) => {
    const s = subjectById(l.subjectId);
    return `<div class="due-item"><i style="width:9px;height:9px;border-radius:50%;background:${esc(s?.color || 'var(--accent)')}"></i>
      <span class="t" data-act="lecture-edit" data-id="${l.id}"><b>${esc(s?.name || '—')}</b> <span class="muted">${l.days.map((d) => DOW[d]).join(' / ')} · ${fmtTime(l.start)}–${fmtTime(l.end)}${l.room ? ` · ${esc(l.room)}` : ''}</span></span>
      <button class="icon-btn" data-act="lecture-edit" data-id="${l.id}" aria-label="Edit lecture">${ic('edit')}</button></div>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- subject page
function subjectView(r) {
  const s = subjectById(r.id);
  const units = s.units, chs = units.flatMap((u) => u.chapters), tps = topicsIn(s);
  const full = (n) => topicsIn(n).length && topicsIn(n).every((t) => t.done);
  const res = S.resources.filter((x) => x.subjectId === s.id);
  const tabs = [['note', 'Notes'], ['textbook', 'Textbooks'], ['slides', 'Slides'], ['courses', 'Courses'], ['embeds', 'Embeds']];
  const count = (k) => (TYPE_LABEL[k] ? res.filter((x) => x.type === k).length : k === 'courses' ? S.courses.filter((c) => c.subjectId === s.id).length : S.embeds.filter((e) => e.subjectId === s.id).length);
  let tabBody;
  if (TYPE_LABEL[ui.subjTab]) tabBody = resTableHTML(res.filter((x) => x.type === ui.subjTab), ui.subjTab) + `<button class="add-link" data-act="res-new" data-type="${ui.subjTab}" data-subject="${s.id}">${ic('plus')} New ${TYPE_ONE[ui.subjTab].toLowerCase()}</button>`;
  else if (ui.subjTab === 'courses') tabBody = `<div class="grid2">${S.courses.filter((c) => c.subjectId === s.id).map(courseHTML).join('') || '<div class="empty">No external courses linked yet.</div>'}</div><button class="add-link" data-act="course-new" data-subject="${s.id}">${ic('plus')} Add course</button>`;
  else tabBody = `${embedsHTML(S.embeds.filter((e) => e.subjectId === s.id))}<button class="add-link" data-act="embed-new" data-subject="${s.id}">${ic('plus')} Embed something</button>`;
  return `<div class="page">
    <div class="ph-row"><div class="ph"><div class="subj-head"><span class="dot" style="background:${esc(s.color)}"></span><span class="chip">${esc(s.code || 'Subject')}</span></div><h1 style="margin-top:8px">${esc(s.name)}</h1></div>
      <button class="btn" data-act="subject-edit" data-id="${s.id}">${ic('edit')} Edit</button></div>
    <div class="box" style="gap:10px">${progBar(pct(s), s.color)}
      <div class="levels"><span><b>${tps.filter((t) => t.done).length}/${tps.length}</b> topics</span><span><b>${chs.filter(full).length}/${chs.length}</b> chapters</span><span><b>${units.filter(full).length}/${units.length}</b> units</span><span>Next lecture <b>${whenTxt(nextLecture(s.id))}</b></span></div></div>
    <div class="sec"><div class="sec-head"><h2>Syllabus</h2><span class="muted" style="font-size:13px">Tick topics as you cover them.</span></div>
      <div class="tree">${units.map((u) => unitHTML(u, s)).join('')}<button class="add-link" data-act="node-new" data-kind="unit" data-parent="${s.id}">${ic('plus')} Add unit</button></div></div>
    <div class="cols">
      <div class="sec"><h2>Due</h2>${dueListHTML(S.due.filter((d) => d.subjectId === s.id), s.id)}</div>
      <div class="sec"><div class="sec-head"><h2>Lecture times</h2><span class="spacer"></span><button class="btn" data-act="lecture-new" data-subject="${s.id}">${ic('plus')} Add</button></div>${lectureListHTML(S.lectures.filter((l) => l.subjectId === s.id))}</div>
    </div>
    <div class="sec"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${ui.subjTab === k ? 'on' : ''}" data-act="subj-tab" data-tab="${k}">${l} <span class="count">${count(k)}</span></button>`).join('')}</div>${tabBody}</div>
  </div>`;
}
const isOpen = (id, def) => (ui.open.has(id) ? true : ui.closed.has(id) ? false : def);
const nodeActs = (id, addKind) => `<span class="acts">${addKind ? `<button class="icon-btn" data-act="node-new" data-kind="${addKind}" data-parent="${id}" aria-label="Add ${addKind}">${ic('plus')}</button>` : ''}<button class="icon-btn" data-act="node-edit" data-id="${id}" aria-label="Rename">${ic('edit')}</button><button class="icon-btn" data-act="node-del" data-id="${id}" aria-label="Delete">${ic('trash')}</button></span>`;
function unitHTML(u, s) {
  const c = counts(u);
  return `<details class="unit" data-id="${u.id}" ${isOpen(u.id, true) ? 'open' : ''}>
    <summary><div class="node-row">${ic('chev').replace('<svg', '<svg class="caret"')}<span class="name ellip">${esc(u.name)}<small class="num">${c.done}/${c.total}</small></span>${progBar(pct(u), s.color)}${nodeActs(u.id, 'chapter')}</div></summary>
    <div class="unit-body">${u.chapters.map((ch) => chapterHTML(ch, s)).join('')}<button class="add-link" data-act="node-new" data-kind="chapter" data-parent="${u.id}">${ic('plus')} Add chapter</button></div></details>`;
}
function chapterHTML(ch, s) {
  const c = counts(ch);
  const linked = S.resources.filter((r) => r.chapterId === ch.id);
  return `<details class="chapter" data-id="${ch.id}" ${isOpen(ch.id, pct(ch) < 100) ? 'open' : ''}>
    <summary><div class="node-row">${ic('chev').replace('<svg', '<svg class="caret"')}<span class="name ellip">${esc(ch.name)}<small class="num">${c.done}/${c.total}</small></span>${progBar(pct(ch), s.color)}${nodeActs(ch.id, 'topic')}</div></summary>
    <div class="topics">${ch.topics.map((t) => `<div class="topic ${t.done ? 'done' : ''}"><input type="checkbox" class="check" id="t-${t.id}" data-change="topic" data-id="${t.id}" ${t.done ? 'checked' : ''}><label for="t-${t.id}">${esc(t.name)}</label>${nodeActs(t.id)}</div>`).join('')}
      <button class="add-link" data-act="node-new" data-kind="topic" data-parent="${ch.id}">${ic('plus')} Add topic</button>
      ${linked.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">${linked.map((r) => `<a class="chip" href="#/r/${r.id}" style="text-decoration:none">${ic(TYPE_ICON[r.type], 12)} ${esc(r.title)}</a>`).join('')}</div>` : ''}</div></details>`;
}

// ---------------------------------------------------------------- library (three databases)
function resTableHTML(list, type) {
  if (!list.length) return `<div class="empty">No ${TYPE_LABEL[type].toLowerCase()} yet.</div>`;
  const chName = (r) => chaptersOf(subjectById(r.subjectId)).find((c) => c.id === r.chapterId)?.name || '';
  return `<div class="table-wrap"><table class="db"><thead><tr><th>Name</th><th>Subject</th><th>Chapter</th>${type === 'note' ? '' : '<th>Progress</th>'}<th>Edited</th></tr></thead><tbody>
    ${[...list].sort((a, b) => b.updated - a.updated).map((r) => `<tr class="click" data-act="go" data-href="#/r/${r.id}">
      <td><span class="title-cell">${ic(TYPE_ICON[r.type])}<span>${esc(r.title || 'Untitled')}</span>${r.fileId ? '<span class="chip">PDF</span>' : ''}</span></td>
      <td>${subjChip(r.subjectId)}</td><td class="muted ellip" style="max-width:220px">${esc(chName(r))}</td>
      ${type === 'note' ? '' : `<td style="min-width:150px">${r.pages ? progBar(Math.min(100, Math.round((r.page / r.pages) * 100))) : '<span class="muted">—</span>'}</td>`}
      <td class="muted num" style="white-space:nowrap">${ago(r.updated)}</td></tr>`).join('')}</tbody></table></div>`;
}
function libraryView(r) {
  const list = S.resources.filter((x) => x.type === r.tab && (!ui.libSubject || x.subjectId === ui.libSubject));
  const blurb = { textbook: 'Your textbooks, with page progress and the PDF right inside.', slides: 'Lecture decks. Upload the PDF or paste a Google Slides link.', note: 'Your own notes, laid out as proper study sheets.' }[r.tab];
  return `<div class="page wide">
    <div class="ph-row"><div class="ph"><h1>${TYPE_LABEL[r.tab]}</h1><p>${blurb}</p></div>
      <select class="input" style="flex:none;width:auto" data-change="lib-subject" aria-label="Filter by subject">${subjOptions(ui.libSubject, 'All subjects')}</select>
      <button class="btn primary" data-act="res-new" data-type="${r.tab}" data-subject="${ui.libSubject}">${ic('plus')} New ${TYPE_ONE[r.tab].toLowerCase()}</button></div>
    ${resTableHTML(list, r.tab)}</div>`;
}
function resourceView(rt) {
  const r = S.resources.find((x) => x.id === rt.id);
  const s = subjectById(r.subjectId);
  const chs = chaptersOf(s);
  const style = r.style || S.settings.noteStyle;
  const props = `<div class="props">
      <span class="k">${ic('layers')} Database</span><span>${TYPE_ONE[r.type]}</span>
      <span class="k">${ic('book')} Subject</span><select data-change="r-prop" data-k="subjectId" aria-label="Subject">${subjOptions(r.subjectId)}</select>
      <span class="k">${ic('note')} Chapter</span><select data-change="r-prop" data-k="chapterId" aria-label="Chapter"><option value="">—</option>${chs.map((c) => `<option value="${c.id}" ${c.id === r.chapterId ? 'selected' : ''}>${esc(c.unit.split('·')[0].trim())} · ${esc(c.name)}</option>`).join('')}</select>
      ${r.type !== 'note' ? `
        ${r.type === 'textbook' ? `<span class="k">${ic('edit')} Author</span><input data-change="r-prop" data-k="author" value="${esc(r.author || '')}" placeholder="Add author" aria-label="Author">` : ''}
        <span class="k">${ic('layers')} ${r.type === 'slides' ? 'Slide' : 'Page'}</span><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="number" min="0" style="width:80px" data-change="r-prop" data-k="page" value="${r.page || 0}" aria-label="Current page"> of <input type="number" min="0" style="width:90px" data-change="r-prop" data-k="pages" value="${r.pages || 0}" aria-label="Total pages"><span style="flex:1;min-width:120px">${r.pages ? progBar(Math.min(100, Math.round((r.page / r.pages) * 100))) : ''}</span></span>
        <span class="k">${ic('link')} Link</span><input data-change="r-prop" data-k="url" value="${esc(r.url || '')}" placeholder="PDF, Google Slides or Drive link" aria-label="Link">` : ''}
      <span class="k">${ic('clock')} Edited</span><span class="muted">${ago(r.updated)}</span></div>`;
  let body;
  if (r.type === 'note') {
    body = ui.editNote
      ? `<div class="split"><div style="display:flex;flex-direction:column;gap:8px"><textarea class="editor" id="note-src" data-input="note-src" data-id="${r.id}" spellcheck="true">${esc(r.body)}</textarea>
          <div class="md-help"><span><code># Heading</code></span><span><code>**bold**</code></span><span><code>==highlight==</code></span><span><code>Term :: definition</code></span><span><code>- [ ] task</code></span><span><code>&gt; [!tip] Title</code></span><span><code>$x^2$</code> math</span></div></div>
          <div data-note="${r.id}"></div></div>`
      : `<div data-note="${r.id}"></div>`;
  } else {
    const linkedNotes = S.resources.filter((x) => x.type === 'note' && x.chapterId && x.chapterId === r.chapterId);
    body = `<div style="display:flex;flex-direction:column;gap:14px"><div id="viewer-slot"></div>
      <label class="drop" data-drop="${r.id}" for="file-${r.id}">${ic('upload')}<span><b>${r.fileId ? 'Replace the PDF' : 'Drop a PDF here'}</b> or click to choose. It stays on this computer.</span>
        <input type="file" id="file-${r.id}" accept="application/pdf,image/*" data-change="r-file" data-id="${r.id}" hidden></label>
      ${r.fileId ? `<button class="btn ghost" data-act="r-file-del" data-id="${r.id}" style="align-self:flex-start">${ic('trash')} Remove uploaded file</button>` : ''}
      ${linkedNotes.length ? `<h2>Your notes on this chapter</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${linkedNotes.map((n) => `<a class="btn" href="#/r/${n.id}">${ic('note')} ${esc(n.title)}</a>`).join('')}</div>` : ''}</div>`;
  }
  return `<div class="page ${r.type === 'note' && ui.editNote ? 'wide' : ''}">
    <div class="res-bar"><span class="crumbs"><a href="#/library/${r.type}">${TYPE_LABEL[r.type]}</a> / ${s ? `<a href="#/s/${s.id}">${esc(s.name)}</a> /` : ''}</span>
      ${r.type === 'note' ? `<select class="input" style="flex:none;width:auto" data-change="r-style" aria-label="Paper">${[['ruled', 'Ruled notebook'], ['clean', 'Clean'], ['grid', 'Graph paper'], ['cornell', 'Cornell']].map(([v, l]) => `<option value="${v}" ${v === style ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn ${ui.editNote ? '' : 'primary'}" data-act="note-mode">${ui.editNote ? 'Done' : `${ic('edit')} Edit`}</button>` : ''}
      ${r.type !== 'note' && r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">${ic('ext')} Open link</a>` : ''}
      <button class="icon-btn" data-act="res-del" data-id="${r.id}" aria-label="Delete">${ic('trash')}</button></div>
    <div class="sec" style="gap:8px"><input class="title-input" data-change="r-prop" data-k="title" value="${esc(r.title)}" placeholder="Untitled" aria-label="Title">${props}</div>
    ${body}</div>`;
}
function mountNote(slot) {
  const r = S.resources.find((x) => x.id === slot.dataset.note);
  if (r) slot.replaceChildren(renderNote(r.body || '*Empty note. Click **Edit** to start writing.*', r.style || S.settings.noteStyle));
}
async function mountViewer(r) {
  const slot = $('#viewer-slot');
  if (!slot || !r) return;
  let src = '';
  if (r.fileId) { const blob = await getFile(r.fileId).catch(() => null); if (blob) src = URL.createObjectURL(blob); }
  if (!src && r.url) src = embedUrl(r.url);
  slot.innerHTML = src ? `<div class="viewer"><iframe src="${esc(src)}" title="${esc(r.title)}" allow="fullscreen"></iframe></div>${!r.fileId ? '<small class="muted">Blank? That site blocks embedding. Use <b>Open link</b>, or upload the PDF.</small>' : ''}` : '';
}

// ---------------------------------------------------------------- calendar
function calendarView() {
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + ui.cal);
  const y = base.getFullYear(), m = base.getMonth();
  const start = new Date(y, m, 1); start.setDate(1 - ((start.getDay() + 6) % 7));
  const t = todayISO();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (i === 35 && d.getMonth() !== m) break;
    const ds = iso(d);
    const due = S.due.filter((x) => x.date === ds);
    const focus = S.sessions.filter((x) => iso(new Date(x.at)) === ds).reduce((a, x) => a + x.min, 0);
    cells.push(`<div class="day ${d.getMonth() !== m ? 'out' : ''} ${ds === t ? 'today' : ''}" data-act="cal-day" data-date="${ds}">
      <div class="dnum num"><span>${d.getDate()}</span></div>
      ${lecturesOn(ds).map((l) => { const s = subjectById(l.subjectId); return `<div class="lec" style="--c:${esc(s?.color || 'var(--accent)')}"><i></i>${fmtTime(l.start).replace(':00', '')} ${esc(s?.code || s?.name || '')}</div>`; }).join('')}
      ${due.map((x) => { const s = subjectById(x.subjectId); return `<div class="ev ${x.done ? 'done' : ''}" style="--c:${esc(s?.color || 'var(--accent)')}" data-act="due-edit" data-id="${x.id}">${esc(x.title)}</div>`; }).join('')}
      ${focus ? `<div class="focusmin num">${focus} min focus</div>` : ''}</div>`);
  }
  return `<div class="page wide">
    <div class="ph-row"><div class="ph"><h1>Calendar</h1><p>Deadlines, lectures and focus time. Click a day to add something due.</p></div><button class="btn" data-act="lecture-new">${ic('plus')} Lecture</button><button class="btn primary" data-act="due-new">${ic('plus')} Due item</button></div>
    <div class="sec"><div class="cal-head"><span class="m">${MONTH[m]} ${y}</span>
      <button class="icon-btn" data-act="cal-move" data-d="-1" aria-label="Previous month">${ic('left')}</button>
      <button class="btn" data-act="cal-move" data-d="0">Today</button>
      <button class="icon-btn" data-act="cal-move" data-d="1" aria-label="Next month">${ic('chev')}</button></div>
      <div class="cal-wrap"><div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div></div></div>
  </div>`;
}

// ---------------------------------------------------------------- courses & embeds
function courseHTML(c) {
  const p = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return `<div class="box course"><div class="top"><div class="fav">${esc((c.provider || c.title)[0] || '?')}</div><div class="info"><b>${esc(c.title)}</b><small>${esc(c.provider || '')}</small></div>${subjChip(c.subjectId)}</div>
    ${progBar(p)}
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="muted num" style="font-size:13px;margin-right:auto">${c.done}/${c.total} lessons</span>
      <button class="btn" data-act="course-step" data-id="${c.id}" data-d="-1" aria-label="One lesson back">−1</button>
      <button class="btn" data-act="course-step" data-id="${c.id}" data-d="1">+1 lesson</button>
      ${c.url ? `<a class="icon-btn" href="${esc(c.url)}" target="_blank" rel="noopener" aria-label="Open course">${ic('ext')}</a>` : ''}
      <button class="icon-btn" data-act="course-edit" data-id="${c.id}" aria-label="Edit course">${ic('edit')}</button></div></div>`;
}
function coursesView() {
  return `<div class="page wide">
    <div class="ph-row"><div class="ph"><h1>Courses & embeds</h1><p>MOOCs and YouTube series, plus tools you keep open: Desmos, Google Slides, Quizlet.</p></div><button class="btn primary" data-act="course-new">${ic('plus')} Course</button><button class="btn" data-act="embed-new">${ic('plus')} Embed</button></div>
    <div class="grid2">${S.courses.map(courseHTML).join('') || '<div class="empty">No courses yet.</div>'}</div>
    <div class="sec"><h2>Embeds</h2>${embedsHTML(S.embeds)}</div></div>`;
}
function embedUrl(u) {
  try {
    const url = new URL(u);
    const yt = YT.parseYT(u);
    if (yt) return yt.v ? `https://www.youtube.com/embed/${yt.v}${yt.list ? `?list=${yt.list}` : ''}` : `https://www.youtube.com/embed/videoseries?list=${yt.list}`;
    let m;
    if (url.hostname === 'docs.google.com' && (m = url.pathname.match(/\/(presentation|document|spreadsheets|forms)\/d\/(e\/)?([^/]+)/))) {
      const id = (m[2] || '') + m[3];
      return m[1] === 'presentation' ? `https://docs.google.com/presentation/d/${id}/embed` : `https://docs.google.com/${m[1]}/d/${id}/preview`;
    }
    if (url.hostname === 'drive.google.com' && (m = url.pathname.match(/\/file\/d\/([^/]+)/))) return `https://drive.google.com/file/d/${m[1]}/preview`;
    if (/(^|\.)figma\.com$/.test(url.hostname)) return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(u)}`;
    if (url.hostname.endsWith('loom.com')) return u.replace('/share/', '/embed/');
    if (url.hostname.endsWith('vimeo.com') && (m = url.pathname.match(/\/(\d+)/))) return `https://player.vimeo.com/video/${m[1]}`;
    return u;
  } catch { return ''; }
}
function embedsHTML(list) {
  if (!list.length) return '<div class="empty">Embed a Desmos graph, Google Slides deck, YouTube lecture or any page that allows it.</div>';
  return `<div class="grid2">${list.map((e) => `<div class="box embed">
    <div class="e-head">${ic('embed', 15)}<span class="t ellip">${esc(e.title || e.url)}</span>${subjChip(e.subjectId)}
      <a class="icon-btn" href="${esc(e.url)}" target="_blank" rel="noopener" aria-label="Open in new tab">${ic('ext')}</a>
      <button class="icon-btn" data-act="embed-edit" data-id="${e.id}" aria-label="Edit embed">${ic('edit')}</button></div>
    <div class="frame"><iframe src="${esc(embedUrl(e.url))}" title="${esc(e.title)}" loading="lazy" allow="fullscreen; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <div class="e-foot">Blank? That site blocks embedding. Use ↗.</div></div>`).join('')}</div>`;
}


// ---------------------------------------------------------------- the study room (Room mode)
let room = null, roomLoading = null;
const roomHost = $('#room-host');
function roomTimer() {
  const l = leftSec();
  return { label: MODE_LABEL[T.mode], clock: mmss(l), running: T.running, frac: 1 - l / dur(T.mode) };
}
function roomState() {
  const t = todayISO(), now = new Date();
  const open = S.due.filter((d) => !d.done).sort((a, b) => a.date.localeCompare(b.date));
  const spec = bgFor('home');
  const grad = spec.type === 'gradient' ? GRADIENTS.find((g) => g.id === spec.value) : null;
  const accent = S.settings.accent || '#6c47ff';
  return {
    accent,
    wall: mixHex('#1d1a2b', accent, 0.12),
    task: T.task || '',
    timer: roomTimer(),
    due: open.slice(0, 5).map((d) => ({ title: d.title, when: d.date < t ? 'overdue' : relDate(d.date), overdue: d.date < t })),
    dueDays: [...new Set(open.filter((d) => d.date.startsWith(t.slice(0, 7))).map((d) => +d.date.slice(8)))],
    subjects: S.subjects.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    sessions: S.sessions.length,
    musicPlaying: YT.P.playing,
    posterImage: spec.type === 'image' ? spec.value : spec.type === 'youtube' ? `https://i.ytimg.com/vi/${spec.value}/hqdefault.jpg` : '',
    posterColors: grad ? (grad.css.match(/#[0-9a-f]{6}/gi) || []).slice(0, 4) : [mixHex('#120c26', accent, 0.2), accent, mixHex(accent, '#ffb36b', 0.5)],
    weather: S.settings.roomWeather || 'rain',
    lampOn: S.settings.roomLamp ?? true,
    custom: roomCfg(),
    posters: posterSrcs(),
    labels: S.settings.roomLabels ?? true,
  };
}
async function ensureRoom() {
  roomHost.hidden = false;
  if (room) { room.pause(false); room.update(roomState()); return; }
  if (roomLoading) return;
  const note = document.createElement('div'); note.className = 'room-loading'; note.textContent = 'Setting up your room…'; document.body.append(note);
  try {
    const { mountRoom } = await (roomLoading = import('./room.js'));
    room = await mountRoom(roomHost, { state: roomState(), onPick: roomPick });
    room.onRugMove(() => pushFriends());
    if (ui.arrange) room.setArrange(true);
    pushFriends();
    if (ui.mode !== 'room') hideRoom();
  } catch (e) {
    console.error(e);
    toast('The room needs WebGL and an internet connection the first time. Couldn’t load it.');
    ui.mode = 'home'; saveUI(); renderStage();
  } finally { note.remove(); roomLoading = null; }
}
function hideRoom() { roomHost.hidden = true; room?.pause(true); if (ui.arrange) { ui.arrange = false; room?.setArrange(false); } }
function roomHudHTML() {
  return `<div style="display:flex;flex-direction:column;align-items:center"><div class="room-hud">
      <div class="rh-timer"><small data-t="lbl-room">${MODE_LABEL[T.mode]}</small><b data-t="mini">${mmss(leftSec())}</b><button class="sq sm" data-act="t-toggle" data-t="btn" aria-label="Start or pause">${ic(T.running ? 'pause' : 'play')}</button></div>
      <input class="rh-task" data-input="t-task" value="${esc(T.task || '')}" placeholder="What are you working on?" aria-label="What you’re working on">
      <button class="sq sm" data-act="pop" data-pop="together" title="Study together" aria-label="Study together">${ic('users')}</button>
      <button class="sq sm ${ui.arrange ? 'on' : ''}" data-act="room-arrange" title="Arrange: drag furniture, R to rotate" aria-label="Arrange the room">${ic('move')}</button>
      <button class="sq sm ${ui.pop === 'room' ? 'on' : ''}" data-act="pop" data-pop="room" title="Customise the room" aria-label="Customise the room">${ic('brush')}</button>
      <button class="sq sm ${(S.settings.roomLabels ?? true) ? 'on' : ''}" data-act="room-labels" title="Show what each thing opens" aria-label="Toggle labels">${ic('tag')}</button>
      <button class="sq sm" data-act="room-reset" title="Reset the view" aria-label="Reset the view">${ic('reset')}</button>
    </div>
    <p class="room-hint">${ui.arrange ? 'Arranging · drag furniture around · press R to rotate · click the move button when you’re done' : 'Drag to look around · scroll to zoom · click anything in the room'}</p></div>`;
}
function roomPick(id, data) {
  const go = (h) => { location.hash = h; };
  ({
    laptop: () => go('#/library/note'),
    book: () => go(`#/s/${data.subjectId}`),
    shelf: () => go('#/library/textbook'),
    calendar: () => go('#/calendar'),
    board: () => openPop('due'),
    clock: () => ACTS['t-toggle'](),
    record: () => { if (!YT.P.id && !YT.P.list && S.music.saved[0]) YT.play(S.music.saved[0].url, S.music.saved[0]); openPop('music'); },
    weather: () => { S.settings.roomWeather = data.weather; save(); if (ui.pop === 'room') popRoom.innerHTML = roomCfgHTML(); if (data.weather === 'rain' && !(S.settings.sounds?.rain > 0)) toast('Rain sounds live in the Music panel'); else toast(data.weather === 'snow' ? 'Snowing ❄' : data.weather === 'clear' ? 'Clear skies' : 'Raining'); },
    lamp: () => { S.settings.roomLamp = data.on; save(); },
    plant: () => toast(`Your plant has grown from ${S.sessions.length} focus blocks · ${streakDays()}-day streak`),
    mug: () => toast(T.mode === 'focus' ? 'Sip of tea. Back to it.' : 'Fresh tea for your break ☕'),
    cat: () => { const n = roomCfg().petName || 'Mochi'; room?.say(data.woke ? pickOne(['*yawn* Oh, hi.', 'Mrrp? I was napping.', 'Five more minutes…']) : pickOne(['Mrrp!', 'Meow.', `${n} approves of your focus.`, 'Hold me down to give me pets.', 'Throw the yarn! The pink one!', 'I’m guarding your desk.'])); },
    pet: () => {},
    speaker: () => openPop('music'),
    lights: () => { setRoomCfg({ lights: data.lights }, true); },
    poster: () => go('#/studio'),
    frame: () => pickPoster(data.slot),
    chair: () => { ui.mode = 'focus'; saveUI(); renderStage(); if (!T.running) ACTS['t-toggle'](); },
    layout: () => { S.settings.room = { ...roomCfg(), layout: data.layout }; save(); },
    desk: () => {}, rug: () => {},
    friend: () => toast(`${data.name}${data.task ? ` is working on “${data.task}”` : ' is here'}`),
  })[id]?.();
}
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
// ---------------------------------------------------------------- the cat cheers you on every ~5 minutes
function cheerLine() {
  const task = (T.task || '').trim(), mins = Math.ceil(leftSec() / 60);
  if (T.running && T.mode === 'focus') return pickOne([
    `You’re doing great. ${mins} minute${mins === 1 ? '' : 's'} to go.`, task ? `Keep going on ${task}. I believe in you.` : 'I believe in you. Mrrp.',
    'Deep breath. One line at a time.', 'Eyes on the page, I’ll guard the yarn.', 'Proud of you for showing up today.', 'Slow is fine. Steady wins.',
  ]);
  if (T.running) return pickOne(['Stretch with me!', 'Drink some water, human.', 'Rest your eyes. Look out the window.', 'Good break. Back soon?']);
  return pickOne([task ? `Shall we do some ${task}?` : 'Shall we start a focus block?', 'I’m ready when you are.', 'Small steps still count.', 'Just ten minutes? I’ll sit with you.']);
}
function catCheer() {
  if (document.hidden || S.settings.catCheer === false || !roomCfg().show.pet) return;
  const line = cheerLine();
  if (ui.mode === 'room' && room?.say(line)) SND.meow('mrrp');
  else { toast(`🐈 ${roomCfg().petName || 'Mochi'}: ${line}`); SND.meow('small'); }
}
setInterval(catCheer, 5 * 60_000);
Object.assign(ACTS_EXTRA, {
  'viz-style': (el) => { S.settings.visualiser = el.dataset.v; save(); renderMixer(); },
  'viz-tab': async () => {
    if (SND.tabCaptured()) { SND.stopCapture(); renderMixer(); return; }
    try { await SND.captureTab(() => { if (!popMusic.classList.contains('closed')) renderMixer(); }); toast('Visualiser is following the music'); }
    catch (e) { toast(e.message === 'no-audio' ? 'No sound came through. Pick this tab and turn on “Share tab audio”.' : 'Tab sharing was cancelled or isn’t supported in this browser'); }
    renderMixer();
  },
});
const ROOM_ACTS = {
  'room-reset': () => room?.resetView(),
  'room-arrange': () => { ui.arrange = !ui.arrange; room?.setArrange(ui.arrange); center.innerHTML = roomHudHTML(); if (ui.arrange) toast('Drag furniture to move it · R rotates'); },
  'room-labels': (el) => { S.settings.roomLabels = !(S.settings.roomLabels ?? true); save(); room?.setLabels(S.settings.roomLabels); el.classList.toggle('on', S.settings.roomLabels); },
  'tg-create': () => { const me = meMember(); TGM.create(me); },
  'tg-leave': () => { TGM.leave(); },
  'tg-copy': async (el) => { try { await navigator.clipboard.writeText(el.dataset.text); toast('Copied'); } catch { toast(el.dataset.text); } },
  'tg-sync': () => { ui.syncTimer = !ui.syncTimer; popTogether.innerHTML = togetherHTML(); if (ui.syncTimer) timerChanged(true); },
  'tg-group': () => { ui.syncTimer = true; tSetMode('focus'); tStart(); toast('Group focus started for everyone in the room'); },
};


// ---------------------------------------------------------------- room customiser
const ROOM_DEFAULTS = { view: 'city', time: 'auto', wall: 'auto', floor: 'oak', rug: 'accent', curtains: 'accent', lights: 'warm', pet: 'black', petName: 'Mochi', show: { plant: true, record: true, poster: true, lights: true, pet: true, gallery: true, toys: true, speaker: true } };
const roomCfg = () => ({ ...ROOM_DEFAULTS, ...(S.settings.room || {}), show: { ...ROOM_DEFAULTS.show, ...(S.settings.room?.show || {}) } });
function setRoomCfg(patch, quiet) {
  S.settings.room = { ...roomCfg(), ...patch };
  save();
  room?.update({ custom: roomCfg() });
  if (!quiet || ui.pop === 'room') popRoom.innerHTML = roomCfgHTML();
}
const SKY = { night: ['#070a1f', '#2b2266'], sunset: ['#3b2a7a', '#e0725f', '#f6b98a'], day: ['#5aa0e8', '#c9e4ff'] };
const svgGrad = (id, cols) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${cols.map((c, i) => `<stop offset="${i / (cols.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
const VIEW_ART = {
  city: '<rect x="2" y="30" width="10" height="20" fill="#0b0b1c"/><rect x="13" y="22" width="9" height="28" fill="#0b0b1c"/><rect x="23" y="33" width="12" height="17" fill="#0b0b1c"/><rect x="36" y="18" width="8" height="32" fill="#0b0b1c"/><rect x="45" y="28" width="12" height="22" fill="#0b0b1c"/><rect x="58" y="24" width="9" height="26" fill="#0b0b1c"/><rect x="68" y="32" width="11" height="18" fill="#0b0b1c"/><g fill="#ffd88a"><rect x="15" y="26" width="2" height="2"/><rect x="38" y="22" width="2" height="2"/><rect x="47" y="32" width="2" height="2"/><rect x="60" y="30" width="2" height="2"/><rect x="25" y="37" width="2" height="2"/></g>',
  forest: '<g fill="#141432"><path d="M0 50L8 26L16 50zM12 50L22 20L32 50zM28 50L37 28L46 50zM42 50L52 18L62 50zM58 50L68 26L78 50z"/></g><g fill="#0b0b1c"><path d="M-4 50L4 34L12 50zM18 50L27 32L36 50zM48 50L57 34L66 50zM66 50L76 30L86 50z"/></g>',
  beach: '<rect y="30" width="80" height="11" fill="#101a3a"/><g fill="rgba(255,243,207,.35)"><rect x="10" y="33" width="16" height="1"/><rect x="42" y="36" width="20" height="1"/></g><rect y="41" width="80" height="9" fill="#2a2236"/>',
  mountains: '<path d="M0 50L0 30L14 18L26 28L40 12L54 26L66 16L80 28L80 50z" fill="#1a1a3a"/><path d="M0 50L0 38L18 28L34 38L50 26L64 36L80 30L80 50z" fill="#0b0b1c"/>',
};
const PET_COLORS = { black: '#2b2838', orange: '#d9822b', white: '#eeeae4', grey: '#8a8a92', cream: '#e8c99a' };
const FLOOR_COLORS = { oak: ['#5a3d2c', '#62432f'], walnut: ['#33211a', '#3b271d'], birch: ['#b48a5f', '#bf9668'], grey: ['#4d4e57', '#55565f'], carpet: ['#3a3348', '#3a3348'] };
const LIGHT_COLORS = { warm: ['#ffc46b'], pink: ['#ff7ab0'], blue: ['#7ad7ff'], rainbow: ['#ff7ab0', '#7ad7ff', '#ffc46b', '#b39bff'], off: ['#3a3646'] };
const svg = (body) => `<svg viewBox="0 0 80 50" aria-hidden="true">${body}</svg>`;
const catArt = (c) => svg(`<rect width="80" height="50" fill="#1d1a2b"/><ellipse cx="38" cy="36" rx="17" ry="9" fill="${c}"/><circle cx="55" cy="27" r="8" fill="${c}"/><path d="M49 22l2-7 4 5zM57 20l4-5 1 7z" fill="${c}"/><path d="M22 36q-10-2-8-14" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="58" cy="26" r="1.3" fill="#f5d76e"/><circle cx="53" cy="26" r="1.3" fill="#f5d76e"/>`);
const ITEM_ART = {
  plant: svg('<rect width="80" height="50" fill="#1d1a2b"/><path d="M32 30h16l-2 16H34z" fill="#d98b5f"/><ellipse cx="34" cy="22" rx="7" ry="4" fill="#3f8f5f" transform="rotate(-30 34 22)"/><ellipse cx="46" cy="20" rx="7" ry="4" fill="#3f8f5f" transform="rotate(25 46 20)"/><ellipse cx="40" cy="14" rx="4" ry="7" fill="#4f9a6a"/>'),
  record: svg('<rect width="80" height="50" fill="#1d1a2b"/><rect x="20" y="12" width="40" height="30" rx="3" fill="#6e4630"/><circle cx="37" cy="27" r="12" fill="#111"/><circle cx="37" cy="27" r="4" fill="var(--accent)"/><path d="M52 16l-3 16" stroke="#ccc" stroke-width="2"/>'),
  poster: svg('<rect width="80" height="50" fill="#1d1a2b"/><rect x="28" y="6" width="24" height="38" fill="#e8e1d6"/><rect x="31" y="9" width="18" height="32" fill="url(#pg)"/>' + svgGrad('pg', ['#1c1240', '#6c47ff', '#e0725f'])),
  lights: svg('<rect width="80" height="50" fill="#1d1a2b"/><path d="M4 14q18 14 36 0t36 0" stroke="#555" fill="none"/>' + [8, 18, 28, 40, 52, 62, 72].map((x, i) => `<circle cx="${x}" cy="${16 + (i % 2) * 5}" r="3" fill="#ffc46b"/>`).join('')),
  pet: catArt('#2b2838'),
  gallery: svg('<rect width="80" height="50" fill="#1d1a2b"/><rect x="20" y="8" width="20" height="28" fill="#f3eee6" stroke="#241f2e" stroke-width="2"/><rect x="44" y="8" width="14" height="14" fill="#e0725f" stroke="#241f2e" stroke-width="2"/><rect x="44" y="25" width="14" height="12" fill="#6c47ff" stroke="#241f2e" stroke-width="2"/><rect x="23" y="11" width="14" height="22" fill="#4fb3a9"/>'),
};
// ---------------------------------------------------------------- gallery wall posters
// Saved as {fileId} (an upload kept in IndexedDB) or {url}; blob links are made once per session.
const posterBlobs = new Map();
function posterSrcs() {
  return [0, 1, 2].map((i) => {
    const p = roomCfg().posters?.[i];
    if (!p) return null;
    if (p.url) return p.url;
    if (posterBlobs.has(p.fileId)) return posterBlobs.get(p.fileId);
    getFile(p.fileId).then((b) => { if (!b || posterBlobs.has(p.fileId)) return; posterBlobs.set(p.fileId, URL.createObjectURL(b)); room?.update({ posters: posterSrcs() }); if (ui.pop === 'room') popRoom.innerHTML = roomCfgHTML(); }).catch(() => {});
    return null;
  });
}
function setPoster(slot, p) {
  const list = [...(roomCfg().posters || [null, null, null])];
  const old = list[slot];
  if (old?.fileId && old.fileId !== p?.fileId) delFile(old.fileId).catch(() => {});
  list[slot] = p;
  setRoomCfg({ posters: list }, true);
  room?.update({ posters: posterSrcs() });
}
function pickPoster(slot) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const id = `poster-${uid()}`;
    try { await putFile(id, f); posterBlobs.set(id, URL.createObjectURL(f)); setPoster(slot, { fileId: id }); toast('Poster up on the wall'); } catch { toast('Couldn’t store that image'); }
  };
  inp.click();
}
const nextFreeSlot = () => { const l = roomCfg().posters || []; const i = [0, 1, 2].findIndex((k) => !l[k]); return i < 0 ? 0 : i; };
function postersHTML() {
  const srcs = posterSrcs();
  const shape = ['portrait', 'square', 'square'];
  const slots = srcs.map((src, i) => `<div class="poster-slot ${shape[i]}">
      <button class="ps-img" data-act="poster-pick" data-slot="${i}" style="${src ? `background-image:url('${esc(src)}')` : ''}" aria-label="${src ? 'Change' : 'Add'} poster ${i + 1}">${src ? '' : ic('plus', 22)}</button>
      ${src ? `<button class="ps-x" data-act="poster-del" data-slot="${i}" aria-label="Take poster ${i + 1} down">${ic('x', 12)}</button>` : ''}</div>`).join('');
  const studioPics = (S.studio?.imgs || []).filter((im) => im.url).slice(0, 8);
  return `<div class="rc-sec"><b>Wall posters</b><p class="rc-note">Three frames on the left wall. Click a frame here or in the room to put up any picture.</p>
    <div class="poster-slots">${slots}</div>
    <form class="row-input" data-form="poster-url" style="padding:0"><input placeholder="…or paste an image link" aria-label="Image link"><button class="pill">Hang</button></form>
    ${studioPics.length ? `<div class="poster-studio">${studioPics.map((im) => `<button data-act="poster-studio" data-url="${esc(im.url)}" style="background-image:url('${esc(im.url)}')" title="Hang this from your studio" aria-label="Hang ${esc(im.name || 'studio image')}"></button>`).join('')}</div>` : ''}
  </div>`;
}
// ---------------------------------------------------------------- room backdrop (what's behind the diorama)
function setRoomBg(spec) {
  S.settings.bg.room = spec || undefined; save();
  document.body.classList.toggle('room-bg', ui.mode === 'room' && !!spec);
  applyBackground();
  if (ui.pop === 'room') popRoom.innerHTML = roomCfgHTML();
}
function backdropHTML() {
  const cur = S.settings.bg.room;
  const same = (a) => cur && cur.type === a.type && String(cur.value) === String(a.value);
  const tile = (spec, style, label) => `<button class="bd ${same(spec) ? 'on' : ''}" data-act="room-bg" data-spec="${esc(JSON.stringify(spec))}" style="${style}" title="${esc(label)}" aria-label="${esc(label)}"></button>`;
  const home = bgFor('home');
  return `<div class="rc-sec"><b>Backdrop</b><p class="rc-note">What you see around the room.</p>
    <div class="bd-grid">
      <button class="bd ${cur ? '' : 'on'}" data-act="room-bg-clear" style="${bgThumbStyle(home)};filter:blur(2px) brightness(.7)" title="Blurred home background" aria-label="Blurred home background"><span>Home</span></button>
      ${GRADIENTS.map((g) => tile({ type: 'gradient', value: g.id }, `background:${g.css}`, g.name)).join('')}
      ${PHOTOS.slice(0, 7).map((ph) => tile({ type: 'image', value: ph.url, label: ph.name }, `background-image:url('${ph.thumb}')`, ph.name)).join('')}
      ${cur && !['gradient'].includes(cur.type) && !PHOTOS.some((ph) => ph.url === cur.value) ? `<button class="bd on" style="${bgThumbStyle(cur)}" aria-label="Your backdrop"><span>Yours</span></button>` : ''}
      <label class="bd add" title="Upload an image or video" aria-label="Upload a backdrop">${ic('upload', 18)}<input type="file" accept="image/*,video/mp4,video/webm" data-change="room-bg-upload" hidden></label>
    </div>
    <form class="row-input" data-form="room-bg-url" style="padding:0"><input placeholder="…or paste an image, video or YouTube link" aria-label="Backdrop link"><button class="pill">Use</button></form>
  </div>`;
}
Object.assign(ACTS_EXTRA, {
  'room-bg': (el) => setRoomBg(JSON.parse(el.dataset.spec)),
  'room-bg-clear': () => setRoomBg(null),
});
Object.assign(CHANGES_EXTRA, {
  'room-bg-upload': async (el) => {
    const f = el.files[0]; if (!f) return;
    const id = `bg-${uid()}`;
    try { await putFile(id, f); setRoomBg({ type: 'file', value: id, label: f.name }); toast('Room backdrop saved on this computer'); } catch { toast('Couldn’t store that file'); }
  },
});
Object.assign(FORMS_EXTRA, {
  'room-bg-url': (v) => {
    const yt = YT.parseYT(v);
    if (yt?.v) setRoomBg({ type: 'youtube', value: yt.v, label: 'YouTube video' });
    else if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) setRoomBg({ type: 'video', value: v });
    else if (/^https?:\/\//.test(v)) setRoomBg({ type: 'image', value: v });
    else toast('Paste a full link starting with https://');
  },
});
function roomCfgHTML() {
  const c = roomCfg();
  const tile = (act, attrs, art, label, on, off) => `<button class="vis ${on ? 'on' : ''} ${off ? 'off' : ''}" data-act="${act}" ${attrs} aria-pressed="${!!on}">${art}<span>${label}</span></button>`;
  const swatches = (key, list, auto) => `<div class="chips" style="align-items:center">${auto ? `<button class="swatch auto ${c[key] === auto ? 'on' : ''}" data-act="rc" data-k="${key}" data-v="${auto}" title="Match my accent" aria-label="Match my accent"></button>` : ''}${list.map((h) => `<button class="swatch ${c[key] === h ? 'on' : ''}" style="background:${h}" data-act="rc" data-k="${key}" data-v="${h}" aria-label="${h}"></button>`).join('')}<input type="color" value="${/^#/.test(c[key]) ? c[key] : '#2c2540'}" data-change="rc-color" data-k="${key}" aria-label="Any colour" style="width:34px;height:28px;padding:0;border:0;background:none;cursor:pointer"></div>`;
  const w = S.settings.roomWeather || 'rain';
  const viewSky = c.time === 'day' ? SKY.day : c.time === 'sunset' ? SKY.sunset : SKY.night;
  return `<div class="pop-head"><span class="chip-ic">${ic('brush')}</span><b>Your room</b><span class="spacer"></span><button class="sq sm" data-act="pop" data-pop="room" aria-label="Close">${ic('x')}</button></div>
  <div class="pop-body" style="gap:16px;padding:16px 18px">
    ${backdropHTML()}
    ${postersHTML()}
    <div class="rc-sec"><b>Window view</b><div class="vis-grid">${Object.entries({ city: 'City', forest: 'Forest', beach: 'Beach', mountains: 'Mountains' }).map(([v, l]) => tile('rc', `data-k="view" data-v="${v}"`, svg(`${svgGrad(`vs-${v}`, viewSky)}<rect width="80" height="50" fill="url(#vs-${v})"/>${VIEW_ART[v]}`), l, c.view === v)).join('')}</div></div>
    <div class="rc-sec"><b>Time of day</b><div class="vis-grid">${[['auto', 'My clock'], ['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']].map(([v, l]) => {
      const art = v === 'auto' ? svg(`${svgGrad('ta', [...SKY.day, ...SKY.night])}<rect width="80" height="50" fill="url(#ta)"/><circle cx="40" cy="25" r="11" fill="none" stroke="#fff" stroke-width="2"/><path d="M40 18v7l5 3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`)
        : svg(`${svgGrad(`tt-${v}`, SKY[v])}<rect width="80" height="50" fill="url(#tt-${v})"/><circle cx="${v === 'sunset' ? 40 : 56}" cy="${v === 'sunset' ? 40 : 15}" r="7" fill="${v === 'night' ? '#fff3cf' : '#ffe08a'}"/>`);
      return tile('rc', `data-k="time" data-v="${v}"`, art, l, c.time === v);
    }).join('')}</div></div>
    <div class="rc-sec"><b>Weather</b><div class="vis-grid">${[['rain', 'Rain'], ['snow', 'Snow'], ['clear', 'Clear']].map(([v, l]) => {
      const fx = v === 'rain' ? Array.from({ length: 14 }, (_, i) => `<path d="M${(i * 13) % 78} ${(i * 7) % 40}l-3 9" stroke="#cfe0ff" stroke-width="1.2" opacity=".8"/>`).join('')
        : v === 'snow' ? Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 17) % 78}" cy="${(i * 11) % 48}" r="1.6" fill="#fff"/>`).join('')
        : '<circle cx="56" cy="16" r="7" fill="#fff3cf"/>';
      return tile('rc-weather', `data-v="${v}"`, svg(`${svgGrad(`w-${v}`, SKY.night)}<rect width="80" height="50" fill="url(#w-${v})"/>${fx}`), l, w === v);
    }).join('')}</div></div>
    <div class="rc-sec"><b>Floor</b><div class="vis-grid">${Object.entries({ oak: 'Oak', walnut: 'Walnut', birch: 'Birch', grey: 'Grey wood', carpet: 'Carpet' }).map(([v, l]) => {
      const [a, b] = FLOOR_COLORS[v];
      return tile('rc', `data-k="floor" data-v="${v}"`, svg(v === 'carpet' ? `<rect width="80" height="50" fill="${a}"/>` : Array.from({ length: 6 }, (_, i) => `<rect y="${i * 8.4}" width="80" height="8" fill="${i % 2 ? a : b}"/><rect x="${(i * 29) % 70}" y="${i * 8.4}" width="1" height="8" fill="rgba(0,0,0,.3)"/>`).join('')), l, c.floor === v);
    }).join('')}</div></div>
    <div class="rc-sec"><b>Walls</b>${swatches('wall', ['#2c2540', '#1e2638', '#22302a', '#3a2626', '#3b3346', '#d9d2c7', '#c9d3de'], 'auto')}</div>
    <div class="rc-sec"><b>Rug</b>${swatches('rug', ['#3a2f6b', '#7a3f4a', '#2f5b4a', '#c98b5f', '#d9d2c7', '#1d1d24'], 'accent')}</div>
    <div class="rc-sec"><b>Curtains</b>${swatches('curtains', ['#4b3a8f', '#8f3a52', '#3a6b5a', '#c9a46a', '#e8e1d6', '#22222b'], 'accent')}</div>
    <div class="rc-sec"><b>Fairy lights</b><div class="vis-grid">${Object.entries({ warm: 'Warm', pink: 'Pink', blue: 'Blue', rainbow: 'Rainbow', off: 'Off' }).map(([v, l]) => {
      const cols = LIGHT_COLORS[v];
      return tile('rc', `data-k="lights" data-v="${v}"`, svg(`<rect width="80" height="50" fill="#141220"/><path d="M2 16q19 16 38 0t38 0" stroke="#3a3646" fill="none"/>${[6, 16, 26, 40, 54, 64, 74].map((x, i) => `<circle cx="${x}" cy="${16 + Math.round(Math.sin((x / 76) * Math.PI * 2) ** 2 * 7)}" r="3.2" fill="${cols[i % cols.length]}" ${v === 'off' ? '' : `style="filter:drop-shadow(0 0 3px ${cols[i % cols.length]})"`}/>`).join('')}`), l, c.lights === v);
    }).join('')}</div></div>
    <div class="rc-sec"><b>Pet</b><div class="vis-grid">${Object.entries({ black: 'Black', orange: 'Ginger', white: 'White', grey: 'Grey', cream: 'Cream' }).map(([v, l]) => tile('rc', `data-k="pet" data-v="${v}"`, catArt(PET_COLORS[v]), l, c.pet === v)).join('')}</div>
      <input class="input" data-input="rc-name" value="${esc(c.petName)}" placeholder="Pet’s name" maxlength="20" aria-label="Pet’s name">
      <div class="chips"><button class="chip ${S.settings.catSounds !== false ? 'on' : ''}" data-act="cat-opt" data-k="catSounds" aria-pressed="${S.settings.catSounds !== false}">Meows & toy sounds</button><button class="chip ${S.settings.catCheer !== false ? 'on' : ''}" data-act="cat-opt" data-k="catCheer" aria-pressed="${S.settings.catCheer !== false}">Encourages me every 5 min</button></div></div>
    <div class="rc-sec"><b>In the room</b><div class="vis-grid">${[['plant', 'Plant'], ['record', 'Record player'], ['speaker', 'Speaker'], ['toys', 'Toys'], ['poster', 'Poster'], ['gallery', 'Gallery wall'], ['lights', 'Fairy lights'], ['pet', 'Pet']].map(([k, l]) => tile('rc-show', `data-k="${k}"`, k === 'pet' ? catArt(PET_COLORS[c.pet] || '#2b2838') : ITEM_ART[k], l, c.show[k], !c.show[k])).join('')}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="rc-layout">Reset furniture layout</button><button class="btn ghost" data-act="rc-reset">Reset everything</button></div>
  </div>`;
}
Object.assign(ACTS_EXTRA, {
  rc: (el) => setRoomCfg({ [el.dataset.k]: el.dataset.v }),
  'cat-opt': (el) => { const k = el.dataset.k; S.settings[k] = S.settings[k] === false; save(); SND.setMuted(S.settings.catSounds === false); popRoom.innerHTML = roomCfgHTML(); if (k === 'catCheer' && S.settings.catCheer) setTimeout(catCheer, 400); },
  'rc-show': (el) => { const c = roomCfg(); setRoomCfg({ show: { ...c.show, [el.dataset.k]: !c.show[el.dataset.k] } }); },
  'rc-weather': (el) => { S.settings.roomWeather = el.dataset.v; save(); room?.update({ weather: el.dataset.v }); popRoom.innerHTML = roomCfgHTML(); },
  'rc-reset': () => { const keep = roomCfg().posters; S.settings.room = keep ? { posters: keep } : {}; setRoomCfg({}); },
  'poster-pick': (el) => pickPoster(+el.dataset.slot),
  'poster-del': (el) => setPoster(+el.dataset.slot, null),
  'poster-studio': (el) => { setPoster(nextFreeSlot(), { url: el.dataset.url }); toast('Poster up on the wall'); },
  'rc-layout': () => { const c = roomCfg(); delete c.layout; S.settings.room = c; save(); room?.update({ custom: roomCfg() }); toast('Furniture back in place'); },
});
Object.assign(CHANGES_EXTRA, { 'rc-color': (el) => setRoomCfg({ [el.dataset.k]: el.value }) });

// ---------------------------------------------------------------- study together
const MEKEY = 'studyhaven:me';
// per tab, so two windows on one computer count as two people (handy for trying a room alone)
const myId = (() => { try { let id = sessionStorage.getItem(MEKEY); if (!id) { id = uid(); sessionStorage.setItem(MEKEY, id); } return id; } catch { return uid(); } })();
function meMember() {
  const s = subjectById(T.subjectId);
  return { id: myId, name: S.settings.userName || 'Someone', color: S.settings.accent || '#6c47ff', task: T.task || '', subject: s?.code || s?.name || '',
    status: T.running ? (T.mode === 'focus' ? 'focus' : 'break') : 'idle', endAt: T.running ? T.endAt : 0, left: T.running ? 0 : T.left };
}
const pushPresence = () => TGM.updateMe(meMember());
function timerChanged(force) {
  pushPresence();
  if ((ui.syncTimer || force) && !applyingRemote) TGM.shareTimer({ mode: T.mode, running: T.running, endAt: T.endAt, left: T.left });
}
let applyingRemote = false;
TGM.onTimer((t, by) => {
  applyingRemote = true;
  T.mode = t.mode; T.running = t.running; T.endAt = t.endAt; T.left = t.left; saveT();
  renderStage(); tickTimer(); pushPresence();
  applyingRemote = false;
  toast(`${by} ${t.running ? 'started' : 'paused'} the room timer`);
});
function friendClock(m) { return m.status !== 'idle' && m.endAt ? mmss(Math.max(0, Math.ceil((m.endAt - Date.now()) / 1000))) : ''; }
function pushFriends() { room?.setFriends([...TGM.TG.members.values()].filter((m) => m.id !== myId).map((m) => ({ ...m, clock: friendClock(m) }))); }
TGM.onChange(() => {
  if (ui.pop === 'together') {
    const chatIn = $('#tg-say'), had = document.activeElement === chatIn, val = chatIn?.value;
    popTogether.innerHTML = togetherHTML();
    if (val) $('#tg-say').value = val;
    if (had) $('#tg-say')?.focus();
    const log = $('.tg-chat', popTogether); if (log) log.scrollTop = log.scrollHeight;
  }
  bl.innerHTML = blHTML();
  pushFriends();
});
setInterval(() => { if (TGM.TG.status === 'on') { pushFriends(); if (ui.pop === 'together') $$('[data-fclock]', popTogether).forEach((e) => { const m = TGM.TG.members.get(e.dataset.fclock); if (m) e.textContent = statusText(m); }); } }, 1000);
setInterval(() => { if (TGM.TG.status === 'on') pushPresence(); }, 20_000);
const statusText = (m) => (m.status === 'focus' ? `focusing ${friendClock(m)}` : m.status === 'break' ? `break ${friendClock(m)}` : 'here');
function joinRoom(codeStr) { TGM.join(codeStr, meMember()); }
function togetherHTML() {
  const TG = TGM.TG;
  const head = `<div class="pop-head"><span class="chip-ic">${ic('users')}</span><b>Study together</b><span class="spacer"></span><button class="sq sm" data-act="pop" data-pop="together" aria-label="Close">${ic('x')}</button></div>`;
  if (TG.status !== 'on') {
    return `${head}<div class="pop-body" style="gap:12px;padding:16px 18px">
      <p class="muted" style="margin:0;font-size:14px">Open a live room and study with friends: you’ll see each other’s timers and tasks, share a group focus, and chat on breaks. Friends show up sitting in your study room.</p>
      <label class="field">Your name<input data-input="tg-name" value="${esc(S.settings.userName)}" placeholder="How friends will see you"></label>
      <button class="pill accent" data-act="tg-create" ${TG.status === 'connecting' ? 'disabled' : ''}>${TG.status === 'connecting' ? 'Connecting…' : 'Create a room'}</button>
      <form class="row-input" data-form="tg-join" style="padding:0"><input placeholder="Room code" value="${esc(ui.pendingJoin || '')}" maxlength="5" style="text-transform:uppercase;font-family:var(--f-mono);letter-spacing:.1em" aria-label="Room code"><button class="pill">Join</button></form>
      ${TG.error ? `<p style="margin:0;color:var(--bad);font-size:13.5px">${esc(TG.error)}</p>` : ''}
      <p class="muted" style="margin:0;font-size:12.5px">Rooms connect browsers directly, with no accounts. Friends need to open this same app: host it online (GitHub Pages or Netlify) and send them the link. To try it now, open the app in a second browser window and join your own room.</p>
    </div>`;
  }
  const link = `${location.origin}${location.pathname}?room=${TG.room}`;
  const members = [...TG.members.values()];
  return `${head}<div class="pop-body" style="gap:12px;padding:14px 16px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="code-chip">${TG.room}</span>
      <button class="btn" data-act="tg-copy" data-text="${TG.room}">${ic('copy')} Code</button><button class="btn" data-act="tg-copy" data-text="${esc(link)}">${ic('link')} Invite link</button></div>
    <div class="tg-members">${members.map((m) => `<div class="tg-m"><span class="av" style="background:${esc(m.color)}">${esc((m.name || '?')[0].toUpperCase())}</span>
      <span class="who"><b>${esc(m.name)}${m.id === myId ? ' (you)' : ''}</b><small>${esc([m.subject, m.task].filter(Boolean).join(' · ') || 'No task set')}</small></span>
      <span class="st ${m.status}" data-fclock="${m.id}">${statusText(m)}</span></div>`).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill accent" data-act="tg-group">Start a group focus</button>
      <label class="switch" style="font-size:13.5px"><input type="checkbox" data-act="tg-sync" ${ui.syncTimer ? 'checked' : ''}> Keep timers in sync</label></div>
    <div class="tg-chat">${TG.chat.map((l) => `<div class="tg-line ${l.sys ? 'sys' : ''}">${l.sys ? '' : `<b style="color:${esc(l.color || 'inherit')}">${esc(l.from)}</b>`}${esc(l.text)}</div>`).join('')}</div>
    <form class="row-input" data-form="tg-chat" style="padding:0"><input id="tg-say" placeholder="Say something (best on breaks)" maxlength="400" autocomplete="off" aria-label="Chat message"><button class="pill">Send</button></form>
    <button class="btn ghost danger" data-act="tg-leave" style="align-self:flex-start">Leave room</button>
  </div>`;
}

// ---------------------------------------------------------------- ambient sound mixer (lives in the Music panel)
function renderMixer() {
  const v = S.settings.sounds || {};
  const vs = S.settings.visualiser || 'bars', cap = SND.tabCaptured();
  $('#mixer').innerHTML = `<h4>Ambient sounds</h4>${SND.CHANNELS.map(([id, label]) => `<label class="mix-row">${label}<input type="range" min="0" max="1" step="0.01" value="${v[id] || 0}" data-input="snd" data-id="${id}" aria-label="${label} volume"></label>`).join('')}
    <h4 style="margin-top:8px">Visualiser</h4>
    <div class="chips">${[['bars', 'Bars'], ['wave', 'Wave'], ['off', 'Off']].map(([k, l]) => `<button class="chip ${vs === k ? 'on' : ''}" data-act="viz-style" data-v="${k}" aria-pressed="${vs === k}">${l}</button>`).join('')}
      <button class="chip ${cap ? 'on' : ''}" data-act="viz-tab" aria-pressed="${cap}">${cap ? 'Following YouTube · stop' : 'React to YouTube'}</button></div>
    <p class="mix-note">${cap ? 'The bars, speaker and fairy lights follow the real music now.' : 'Ambient sounds drive the bars directly. YouTube plays in a sealed frame, so its bars are a gentle made-up groove unless you share this tab’s audio.'}</p>`;
}

// ---------------------------------------------------------------- aesthetic studio
// Pictures in → palette out (k-means on a 48×48 sample) → a gradient, an accent and text colour.
// Pictures can be uploads, links, or images browsed from any public GitHub repo.
const studio = { imgs: null, palette: [], accent: '', mood: 'night', gh: { owner: '', repo: '', ref: '', path: '', items: null, error: '', loading: false } };
const GH_EXAMPLES = [['D3Ext/aesthetic-wallpapers', 'images'], ['dharmx/walls', ''], ['FrenzyExists/wallpapers', ''], ['linuxdotexe/nordic-wallpapers', '']];
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lumOf = (h) => { const [r, g, b] = rgbOf(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const satOf = (h) => { const [r, g, b] = rgbOf(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
const mixHex = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return toHex(...A.map((v, i) => v + (B[i] - v) * t)); };
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function pixelsOf(src) {
  const img = await loadImg(src);
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data, px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
  return px;
}
function kmeans(px, k = 6) {
  if (!px.length) return [];
  let cs = Array.from({ length: k }, (_, i) => px[Math.floor(((i + 0.5) * px.length) / k)].slice());
  let n = [];
  for (let it = 0; it < 10; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let bi = 0, bd = Infinity;
      cs.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } });
      const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    cs = cs.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c));
    n = sum.map((s) => s[3]);
  }
  return cs.map((c, i) => ({ hex: toHex(...c), n: n[i] })).filter((x) => x.n).sort((a, b) => b.n - a.n).map((x) => x.hex);
}
async function studioImgs() {
  if (studio.imgs) return studio.imgs;
  studio.imgs = await Promise.all((S.studio?.imgs || []).map(async (im) => {
    if (!im.fileId) return { ...im };
    const blob = await getFile(im.fileId).catch(() => null);
    return blob ? { ...im, src: URL.createObjectURL(blob) } : null;
  })).then((a) => a.filter(Boolean));
  return studio.imgs;
}
const persistStudio = () => { S.studio = { imgs: (studio.imgs || []).map(({ fileId, url, name }) => ({ fileId, url, name, src: fileId ? undefined : url })) }; save(); };
async function analyse() {
  const imgs = await studioImgs();
  const px = [];
  for (const im of imgs) { try { px.push(...(await pixelsOf(im.src))); } catch { /* an image that blocks reading its pixels is skipped */ } }
  studio.palette = kmeans(px, imgs.length > 2 ? 8 : 6);
  const score = (h) => satOf(h) * (1 - Math.abs(lumOf(h) - 0.55));
  studio.accent = [...studio.palette].sort((a, b) => score(b) - score(a))[0] || '';
}
function studioTheme() {
  const pal = studio.palette;
  if (pal.length < 2) return null;
  const byLum = [...pal].sort((a, b) => lumOf(a) - lumOf(b));
  const darkest = byLum[0], brightest = byLum[byLum.length - 1];
  const accent = studio.accent || pal[0];
  const second = pal.filter((h) => ![darkest, brightest, accent].includes(h)).sort((a, b) => satOf(b) - satOf(a))[0] || brightest;
  let css, ink;
  if (studio.mood === 'day') {
    const base = mixHex(brightest, '#ffffff', 0.55);
    css = `radial-gradient(100% 80% at 0% 100%, ${mixHex(accent, '#ffffff', 0.35)} 0%, ${mixHex(accent, '#ffffff', 0.35)}00 60%), radial-gradient(90% 80% at 100% 0%, ${mixHex(second, '#ffffff', 0.3)} 0%, ${mixHex(second, '#ffffff', 0.3)}00 60%), linear-gradient(135deg, ${base}, ${mixHex(base, second, 0.25)})`;
    ink = 'dark';
  } else {
    const base = mixHex(darkest, '#000000', 0.4);
    css = `radial-gradient(120% 90% at 100% 100%, ${brightest} 0%, ${second} 24%, ${second}00 56%), radial-gradient(90% 80% at 42% 62%, ${accent} 0%, ${accent}00 72%), linear-gradient(160deg, ${base} 0%, ${mixHex(base, accent, 0.3)} 50%, ${mixHex(accent, base, 0.3)} 100%)`;
    ink = 'light';
  }
  // keep the UI accent readable: pull very dark or very light picks toward the middle
  const l = lumOf(accent);
  const uiAccent = l < 0.3 ? mixHex(accent, '#ffffff', 0.35) : l > 0.75 ? mixHex(accent, '#000000', 0.35) : accent;
  return { css, ink, accent: uiAccent };
}
function applyEverywhere(spec) { S.settings.bg = { home: spec, focus: spec, ambient: spec }; save(); render(); }

function studioView() {
  if (!studio.imgs) { studioImgs().then(() => analyse()).then(() => { if (route().name === 'studio') render(); }); }
  const imgs = studio.imgs || [];
  const th = studioTheme();
  const gh = studio.gh;
  const crumbs = gh.repo ? [`${gh.owner}/${gh.repo}`, ...gh.path.split('/').filter(Boolean)] : [];
  let ghBody = '';
  if (gh.loading) ghBody = '<div class="empty">Loading…</div>';
  else if (gh.error) ghBody = `<div class="empty" style="color:var(--bad)">${esc(gh.error)}</div>`;
  else if (gh.items) {
    const dirs = gh.items.filter((x) => x.type === 'dir');
    const pics = gh.items.filter((x) => x.type === 'file' && IMG_RE.test(x.name));
    ghBody = `<div class="crumbs-gh">${crumbs.map((c, i) => `<button data-act="gh-crumb" data-i="${i}">${esc(c)}</button>`).join('<span>/</span>')}<span class="muted" style="margin-left:6px">${pics.length} images${dirs.length ? ` · ${dirs.length} folders` : ''}</span></div>
      ${dirs.length ? `<div class="gh-grid">${dirs.slice(0, 60).map((d) => `<button class="gh-folder" data-act="gh-open" data-path="${esc(d.path)}">${ic('grid')}<span class="ellip">${esc(d.name)}</span></button>`).join('')}</div>` : ''}
      ${pics.length ? `<div class="gh-grid">${pics.slice(0, 80).map((f) => `<div class="gh-item"><div class="im" style="background-image:url('${esc(f.download_url)}')"></div><div class="nm" title="${esc(f.name)}">${esc(f.name)}</div>
        <div class="acts"><button data-act="gh-studio" data-url="${esc(f.download_url)}" data-name="${esc(f.name)}">+ Studio</button><button data-act="gh-bg" data-url="${esc(f.download_url)}" data-name="${esc(f.name)}">Background</button><button data-act="gh-sticker" data-url="${esc(f.download_url)}">Sticker</button></div></div>`).join('')}</div>` : ''}
      ${pics.length > 80 ? '<p class="muted" style="margin:0;font-size:13px">Showing the first 80. Open a subfolder to narrow it down.</p>' : ''}
      ${!dirs.length && !pics.length ? '<div class="empty">No images or folders here.</div>' : ''}`;
  }
  return `<div class="page wide">
    <div class="ph"><h1>Aesthetic studio</h1><p>Drop in pictures you love, or pull them from GitHub. The studio reads their colours and builds a matching theme.</p></div>
    <div class="cols">
      <div class="sec">
        <h2>1 · Pictures</h2>
        <label class="drop" for="studio-files" data-drop-studio>${ic('image')}<span><b>Drop images here</b> or click to choose. Mood boards, screenshots, wallpapers, album art.</span><input type="file" id="studio-files" accept="image/*" multiple data-change="studio-files" hidden></label>
        <form class="row-input" data-form="studio-url" style="padding:0"><input placeholder="…or paste an image link" aria-label="Image link"><button class="pill">Add</button></form>
        ${imgs.length ? `<div class="studio-imgs">${imgs.map((im, i) => `<div class="si" style="background-image:url('${esc(im.src)}')"><button class="rm" data-act="studio-rm" data-i="${i}" aria-label="Remove">✕</button><button class="use" data-act="studio-usebg" data-i="${i}">Background</button></div>`).join('')}</div>` : ''}
        <h2 style="margin-top:14px">2 · Elements from GitHub</h2>
        <form class="row-input" data-form="gh" style="padding:0"><input placeholder="github.com/owner/repo, or a link to a folder" aria-label="GitHub link" value="${gh.repo ? `github.com/${esc(gh.owner)}/${esc(gh.repo)}${gh.path ? `/tree/${esc(gh.ref || 'main')}/${esc(gh.path)}` : ''}` : ''}"><button class="pill accent">Browse</button></form>
        <div class="ex-chips"><span class="muted" style="font-size:12.5px;align-self:center">Try</span>${GH_EXAMPLES.map(([r, p]) => `<button data-act="gh-example" data-repo="${r}" data-path="${p}">${r}</button>`).join('')}</div>
        ${ghBody}
      </div>
      <div class="sec" style="position:sticky;top:0">
        <h2>3 · Your aesthetic</h2>
        <div class="bg-preview" style="${th ? `background:${th.css}` : 'background:var(--panel-2)'};color:${th?.ink === 'dark' ? '#111' : '#fff'}"><span class="num">${clockStr()}</span>${th ? `<small style="background:${th.accent};color:${inkFor(th.accent)}">Accent</small>` : ''}</div>
        ${studio.palette.length ? `<div class="palette">${studio.palette.map((h) => `<div><button class="${h === studio.accent ? 'on' : ''}" style="background:${h}" data-act="studio-accent" data-h="${h}" aria-label="Use ${h} as accent"></button><small>${h}</small></div>`).join('')}</div>
          <p class="muted" style="margin:0;font-size:13px">Click a colour to make it the accent.</p>` : `<div class="empty">${imgs.length ? 'Reading colours…' : 'Add a picture to get a palette.'}</div>`}
        <div class="seg-tabs"><button class="${studio.mood === 'night' ? 'on' : ''}" data-act="studio-mood" data-m="night">Night</button><button class="${studio.mood === 'day' ? 'on' : ''}" data-act="studio-mood" data-m="day">Day</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" data-act="studio-apply" ${th ? '' : 'disabled'}>Apply theme</button>
          <button class="btn" data-act="studio-accent-only" ${th ? '' : 'disabled'}>Accent only</button>
          <button class="btn" data-act="studio-save">Save current look</button>
        </div>
      </div>
    </div>
    <div class="sec"><h2>Saved aesthetics</h2>
      ${(S.aesthetics || []).length ? `<div class="saved-grid">${S.aesthetics.map((a) => `<div class="saved-card"><div class="im" style="${bgThumbStyle(a.bg)};color:${a.bg.ink === 'dark' ? '#111' : '#fff'}">${clockStr()}</div>
        <div class="row"><span class="dot" style="background:${esc(a.accent || '#6c47ff')}"></span><b>${esc(a.name)}</b><button class="btn" data-act="aes-apply" data-id="${a.id}">Apply</button><button class="icon-btn" data-act="aes-del" data-id="${a.id}" aria-label="Delete">${ic('trash')}</button></div></div>`).join('')}</div>`
        : '<div class="empty">Save a look to switch back to it in one click: background, accent and font together.</div>'}
    </div>
  </div>`;
}
async function ghLoad(owner, repo, path = '', ref = '') {
  Object.assign(studio.gh, { owner, repo, path, ref, loading: true, error: '', items: null });
  render();
  try {
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 403 || res.status === 429) throw new Error('GitHub’s hourly limit for browsing without an account was reached. Try again in a while.');
    if (res.status === 404) throw new Error('Couldn’t find that repo or folder. Check the link, and that the repo is public.');
    if (!res.ok) throw new Error(`GitHub answered with an error (${res.status}).`);
    const data = await res.json();
    studio.gh.items = Array.isArray(data) ? data : [data];
  } catch (e) { studio.gh.error = e.message || 'Couldn’t reach GitHub.'; }
  studio.gh.loading = false;
  render();
}
function parseGitHub(input) {
  const m = input.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').match(/^github\.com\/([^/]+)\/([^/#?]+)(?:\/(?:tree|blob)\/([^/]+)\/?(.*))?/);
  if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, ''), ref: m[3] || '', path: (m[4] || '').replace(/\/$/, '') };
  const s = input.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  return s ? { owner: s[1], repo: s[2], ref: '', path: '' } : null;
}
async function studioAdd(items) {
  const imgs = await studioImgs();
  imgs.push(...items);
  persistStudio();
  await analyse();
  render();
}
Object.assign(ACTS_EXTRA, {
  'studio-rm': async (el) => { const imgs = await studioImgs(); const [gone] = imgs.splice(+el.dataset.i, 1); if (gone?.fileId) delFile(gone.fileId).catch(() => {}); persistStudio(); await analyse(); render(); },
  'studio-usebg': async (el) => { const im = (await studioImgs())[+el.dataset.i]; applyEverywhere(im.fileId ? { type: 'file', value: im.fileId, label: im.name } : { type: 'image', value: im.src, label: im.name }); toast('Background set'); },
  'studio-accent': (el) => { studio.accent = el.dataset.h; render(); },
  'studio-mood': (el) => { studio.mood = el.dataset.m; render(); },
  'studio-apply': () => { const th = studioTheme(); if (!th) return; S.settings.accent = th.accent; applySettings(); applyEverywhere({ type: 'css', value: th.css, ink: th.ink, label: 'Studio gradient' }); toast('Theme applied'); },
  'studio-accent-only': () => { const th = studioTheme(); if (!th) return; S.settings.accent = th.accent; save(); applySettings(); render(); },
  'studio-save': () => openForm('Save this look', [{ k: 'name', label: 'Name', required: true, placeholder: 'e.g. Rainy library' }], (v) => {
    S.aesthetics ||= [];
    S.aesthetics.unshift({ id: uid(), name: v.name, bg: structuredClone(bgFor(ui.mode)), accent: S.settings.accent, font: S.settings.font });
    toast('Saved');
  }, { submit: 'Save' }),
  'aes-apply': (el) => { const a = S.aesthetics.find((x) => x.id === el.dataset.id); S.settings.accent = a.accent; S.settings.font = a.font || 'default'; applySettings(); applyEverywhere(structuredClone(a.bg)); toast(`${a.name} applied`); },
  'aes-del': (el) => { S.aesthetics = S.aesthetics.filter((x) => x.id !== el.dataset.id); save(); render(); },
  'gh-example': (el) => ghLoad(...el.dataset.repo.split('/'), el.dataset.path),
  'gh-open': (el) => ghLoad(studio.gh.owner, studio.gh.repo, el.dataset.path, studio.gh.ref),
  'gh-crumb': (el) => { const i = +el.dataset.i; ghLoad(studio.gh.owner, studio.gh.repo, studio.gh.path.split('/').filter(Boolean).slice(0, i).join('/'), studio.gh.ref); },
  'gh-studio': (el) => { studioAdd([{ url: el.dataset.url, src: el.dataset.url, name: el.dataset.name }]); toast('Added to the studio'); },
  'gh-bg': (el) => { applyEverywhere({ type: 'image', value: el.dataset.url, label: el.dataset.name }); toast('Background set'); },
  'gh-sticker': (el) => { S.stickerPack.push({ id: uid(), src: el.dataset.url }); save(); location.hash = '#/'; setTimeout(() => addSticker('img', el.dataset.url), 60); toast('Sticker added to the home screen and your pack'); },
});
Object.assign(CHANGES_EXTRA, {
  'studio-files': async (el) => {
    const items = [];
    for (const f of [...el.files].filter((x) => x.type.startsWith('image/')).slice(0, 12)) {
      const id = `studio-${uid()}`;
      try { await putFile(id, f); items.push({ fileId: id, name: f.name, src: URL.createObjectURL(f) }); } catch {}
    }
    if (items.length) studioAdd(items);
  },
});
Object.assign(FORMS_EXTRA, {
  'poster-url': (v) => { if (!/^https?:\/\//.test(v)) return toast('Paste a full link starting with https://'); setPoster(nextFreeSlot(), { url: v }); toast('Poster up on the wall'); },
  'studio-url': (v) => { if (!/^https?:\/\//.test(v)) return toast('Paste a full link starting with https://'); studioAdd([{ url: v, src: v, name: v.split('/').pop() }]); },
  gh: (v) => { const p = parseGitHub(v); if (!p) return toast('Paste a GitHub link like github.com/owner/repo'); ghLoad(p.owner, p.repo, p.path, p.ref); },
});

// ---------------------------------------------------------------- settings
const ACCENTS = ['#6c47ff', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7'];
function inkFor(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62 ? '#111111' : '#ffffff'; }
function settingsView() {
  const st = S.settings;
  const tab = st.bgSame ? 'home' : ui.bgTab;
  const cur = st.bgSame ? st.bg.home : st.bg[tab];
  const isOn = (spec) => cur && cur.type === spec.type && String(cur.value) === String(spec.value);
  const card = (spec, name, thumbStyle, sub = '', badge = '') => `<button class="lib-card ${isOn(spec) ? 'on' : ''}" data-act="bg-pick" data-spec="${esc(JSON.stringify(spec))}"><span class="im" style="${thumbStyle}">${badge ? `<span class="badge">${badge}</span>` : ''}</span>${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  const curName = cur.type === 'css' ? (cur.label || 'Studio gradient') : cur.type === 'gradient' ? (GRADIENTS.find((g) => g.id === cur.value)?.name || 'Gradient') : cur.label || ({ image: 'Image link', youtube: 'YouTube video', video: 'Video link', file: 'Your upload' }[cur.type]);
  return `<div class="page wide">
    <div class="ph"><h1>Settings</h1><p>Make it yours. Everything saves as you change it.</p></div>

    <div class="sec"><div class="sec-head"><h2>Background</h2><span class="spacer"></span><a class="btn" href="#/studio">${ic('sparkle')} Build one in the Aesthetic studio</a></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${st.bgSame ? '' : `<div class="seg-tabs" role="tablist">${['home', 'focus', 'ambient', 'room'].map((m) => `<button class="${tab === m ? 'on' : ''}" data-act="bg-tab" data-tab="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>`}
        <label class="switch"><input type="checkbox" data-change="set" data-k="bgSame" ${st.bgSame ? 'checked' : ''}> Same background for every mode</label>
      </div>
      <div class="bg-preview" id="bg-preview" style="${bgThumbStyle(cur)}"><span class="num">${clockStr()}</span><small>${esc(curName)}</small></div>
      <details class="custom" ${cur.type === 'file' || cur.type === 'image' || cur.type === 'video' ? 'open' : ''}><summary>Custom background ${ic('down', 18)}</summary><div>
        <label class="drop" for="bg-file">${ic('upload')}<span><b>Upload an image or video</b> (JPG, PNG, GIF, MP4, WebM). It stays on this computer.</span><input type="file" id="bg-file" accept="image/*,video/mp4,video/webm" data-change="bg-upload" hidden></label>
        <form class="row-input" data-form="bg-url" style="padding:0"><input placeholder="…or paste an image, video or YouTube link" aria-label="Background link"><button class="pill accent">Use</button></form>
        <label class="field">Darken photos and videos <input type="range" min="0" max="70" value="${st.dim}" data-input="dim" style="padding:0"></label>
      </div></details>
      <div class="sec"><h2 style="font-size:15px">Gradients</h2><div class="lib-row">${GRADIENTS.map((g) => card({ type: 'gradient', value: g.id }, g.name, `background:${g.css}`)).join('')}</div></div>
      <div class="sec"><h2 style="font-size:15px">Photos</h2><div class="lib-row">${PHOTOS.map((p) => card({ type: 'image', value: p.url, label: p.name, credit: p.by }, p.name, `background-image:url('${p.thumb}')`, `by ${p.by} · Unsplash`)).join('')}</div></div>
      <div class="sec"><h2 style="font-size:15px">Animated</h2><div class="lib-row">${ANIMATED.map((a) => card({ type: 'youtube', value: a.id, label: a.name }, a.name, `background-image:url('${a.thumb}')`, 'YouTube, muted', 'LIVE')).join('')}</div></div>
    </div>

    <div class="sec"><h2>You</h2><div class="set-grid">
      <label class="field">Your name<input data-change="set" data-k="userName" value="${esc(st.userName)}" placeholder="Shown in the greeting"></label>
      <label class="field">App name<input data-change="set" data-k="appName" value="${esc(st.appName)}"></label>
      <label class="field">Term starts<input type="date" data-change="set" data-k="termStart" value="${st.termStart}"></label>
      <label class="field">Term ends<input type="date" data-change="set" data-k="termEnd" value="${st.termEnd}"></label></div>
      <div style="display:flex;gap:18px;flex-wrap:wrap"><label class="switch"><input type="checkbox" data-change="set" data-k="quotes" ${st.quotes ? 'checked' : ''}> Show a quote</label><label class="switch"><input type="checkbox" data-change="set" data-k="clock24" ${st.clock24 ? 'checked' : ''}> 24-hour clock</label></div></div>

    <div class="sec"><h2>Look</h2>
      <div class="field">Accent colour<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${ACCENTS.map((c) => `<button class="swatch ${(st.accent || '#6c47ff') === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Accent ${c}"></button>`).join('')}<input type="color" value="${esc(st.accent || '#6c47ff')}" data-change="set" data-k="accent" aria-label="Any accent colour" style="width:40px;height:30px;padding:0;border:0;background:none;cursor:pointer"></div></div>
      <div class="set-grid">
        <label class="field">Font<select data-change="set" data-k="font">${[['default', 'Plus Jakarta Sans'], ['classic', 'Newsreader (serif)'], ['mono', 'JetBrains Mono']].map(([v, l]) => `<option value="${v}" ${st.font === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Default note paper<select data-change="set" data-k="noteStyle">${[['ruled', 'Ruled notebook'], ['clean', 'Clean'], ['grid', 'Graph paper'], ['cornell', 'Cornell']].map(([v, l]) => `<option value="${v}" ${st.noteStyle === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><label class="switch"><input type="checkbox" data-change="set" data-k="stickers" ${st.stickers ? 'checked' : ''}> Show stickers</label><button class="btn" data-act="tray">${ic('sparkle')} Sticker tray</button></div></div>

    <div class="sec"><h2>Focus timer</h2><div class="set-grid">
      ${[['work', 'Focus (minutes)'], ['short', 'Short break'], ['long', 'Long break'], ['every', 'Long break every … rounds']].map(([k, l]) => `<label class="field">${l}<input type="number" min="1" max="180" value="${st.focus[k]}" data-change="focus-set" data-k="${k}"></label>`).join('')}</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <label class="switch"><input type="checkbox" data-change="focus-set" data-k="autoBreak" ${st.focus.autoBreak ? 'checked' : ''}> Start breaks automatically</label>
        <label class="switch"><input type="checkbox" data-change="focus-set" data-k="autoFocus" ${st.focus.autoFocus ? 'checked' : ''}> Start focus automatically</label>
        <label class="switch"><input type="checkbox" data-change="set" data-k="chime" ${st.chime ? 'checked' : ''}> Chime at the end</label></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="chime-test">Test chime</button><button class="btn" data-act="notify-perm">Allow notifications</button></div></div>

    <div class="sec"><h2>Your data</h2>
      <p class="muted" style="margin:0;max-width:65ch">Everything is saved in this browser on this computer. Uploaded PDFs and backgrounds stay here too and aren’t part of the backup file.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="export">Export backup</button>
        <label class="btn" for="import-file">Import backup</label><input type="file" id="import-file" accept="application/json" data-change="import" hidden>
        ${hasExamples() ? '<button class="btn" data-act="clear-examples">Clear example data</button>' : ''}<button class="btn danger" data-act="reset-all">Start over</button></div></div>
  </div>`;
}
function applySettings() {
  const st = S.settings, root = document.documentElement, rs = root.style;
  root.dataset.font = st.font;
  if (/^#[0-9a-f]{6}$/i.test(st.accent || '')) { rs.setProperty('--accent', st.accent); rs.setProperty('--accent-ink', inkFor(st.accent)); }
  else { rs.removeProperty('--accent'); rs.removeProperty('--accent-ink'); }
}
function setBg(spec) {
  const st = S.settings;
  if (st.bgSame) st.bg.home = spec; else st.bg[ui.bgTab] = spec;
  save();
  if (!st.bgSame && ui.bgTab !== ui.mode) { ui.mode = ui.bgTab; saveUI(); }
  render();
}

// ---------------------------------------------------------------- modal forms
let modalDelete = null;
function fieldHTML(f) {
  if (Array.isArray(f)) return `<div class="row2">${f.map(fieldHTML).join('')}</div>`;
  const id = `f-${f.k}`, v = f.value ?? '';
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${f.k}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.k}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  else if (f.type === 'days') input = `<div style="display:flex;gap:10px;flex-wrap:wrap">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="switch"><input type="checkbox" name="${f.k}" value="${d}" ${v.includes(d) ? 'checked' : ''}>${DOW[d]}</label>`).join('')}</div>`;
  else if (f.type === 'checkbox') return `<label class="switch"><input type="checkbox" id="${id}" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
  else input = `<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.type === 'number' ? 'min="0"' : ''}>`;
  return `<label class="field" for="${id}">${esc(f.label)}${input}</label>`;
}
function openForm(title, fields, onSubmit, opts = {}) {
  modal.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>
    <form id="mform">${fields.map(fieldHTML).join('')}<div class="acts">${opts.onDelete ? '<button type="button" class="btn danger left" data-act="m-del">Delete</button>' : ''}<button type="button" class="btn ghost" data-act="m-close">Cancel</button><button class="btn primary">${esc(opts.submit || 'Save')}</button></div></form></div>`;
  modal.hidden = false;
  modalDelete = opts.onDelete || null;
  const form = $('#mform');
  setTimeout(() => form.querySelector('input:not([type=checkbox]),select,textarea')?.focus(), 30);
  form.onsubmit = (e) => {
    e.preventDefault();
    const out = {};
    for (const f of fields.flat()) {
      if (f.type === 'days') out[f.k] = $$(`input[name="${f.k}"]:checked`, form).map((x) => +x.value);
      else if (f.type === 'checkbox') out[f.k] = form.elements[f.k].checked;
      else if (f.type === 'number') out[f.k] = Math.max(0, +form.elements[f.k].value || 0);
      else out[f.k] = form.elements[f.k].value.trim();
    }
    if (onSubmit(out) !== false) { closeModal(); save(); render(); refreshPops(); }
  };
}
function confirmBox(text, yesLabel, onYes) {
  modal.innerHTML = `<div class="modal-box" role="alertdialog" aria-modal="true"><h3>${esc(text)}</h3><p class="muted" style="margin:0">This can’t be undone.</p>
    <div class="acts"><button class="btn ghost" data-act="m-close">Cancel</button><button class="btn" data-act="m-yes" style="background:var(--bad);color:#fff">${esc(yesLabel)}</button></div></div>`;
  modal.hidden = false;
  modalDelete = onYes;
}
function closeModal() { modal.hidden = true; modal.innerHTML = ''; modalDelete = null; }
const refreshPops = () => { if (ui.pop === 'due') popDue.innerHTML = duePopHTML(); };
modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
sheet.addEventListener('mousedown', (e) => { if (e.target === sheet) location.hash = '#/'; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modal.hidden) closeModal();
  else if (ui.pop) { closePops(); bl.innerHTML = blHTML(); }
  else if (ui.tray) toggleTray(false);
  else if (!sheet.hidden) location.hash = '#/';
});
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `${esc(msg)}${undo ? ' <button class="btn" style="padding:3px 10px" data-act="toast-undo">Undo</button>' : ''}`;
  t.hidden = false; t._undo = undo;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 5000 : 2600);
}

const subjOpts = () => [['', 'No subject'], ...S.subjects.map((s) => [s.id, s.name])];
const subjFields = (s = {}) => [
  { k: 'name', label: 'Subject name', value: s.name, required: true, placeholder: 'e.g. Thermodynamics' },
  [{ k: 'code', label: 'Course code', value: s.code, placeholder: 'e.g. MECH 240' }, { k: 'color', label: 'Colour', type: 'color', value: s.color || '#6c47ff' }],
  { k: 'cover', label: 'Cover image link (optional)', value: s.cover, placeholder: 'Leave empty for a colour cover' },
];
const dueFields = (d = {}) => [
  { k: 'title', label: 'What’s due', value: d.title, required: true, placeholder: 'e.g. Problem set 6' },
  [{ k: 'date', label: 'Due date', type: 'date', value: d.date || todayISO(), required: true }, { k: 'subjectId', label: 'Subject', type: 'select', value: d.subjectId || '', options: subjOpts() }],
  [{ k: 'priority', label: 'Priority', type: 'select', value: d.priority || 'med', options: [['high', 'High'], ['med', 'Medium'], ['low', 'Low']] }, { k: 'kind', label: 'Type', value: d.kind, placeholder: 'Assignment, Quiz, Exam…' }],
];
const lecFields = (l = {}) => [
  { k: 'subjectId', label: 'Subject', type: 'select', value: l.subjectId || S.subjects[0]?.id, options: S.subjects.map((s) => [s.id, s.name]) },
  { k: 'days', label: 'Days', type: 'days', value: l.days || [] },
  [{ k: 'start', label: 'Starts', type: 'time', value: l.start || '09:00', required: true }, { k: 'end', label: 'Ends', type: 'time', value: l.end || '10:00', required: true }],
  { k: 'room', label: 'Room or link', value: l.room, placeholder: 'e.g. Hall B · 104' },
];
const courseFields = (c = {}) => [
  { k: 'title', label: 'Course', value: c.title, required: true, placeholder: 'e.g. CS50x' },
  [{ k: 'provider', label: 'Where', value: c.provider, placeholder: 'Coursera, YouTube, edX…' }, { k: 'subjectId', label: 'Subject', type: 'select', value: c.subjectId || '', options: subjOpts() }],
  { k: 'url', label: 'Link', type: 'url', value: c.url, placeholder: 'https://' },
  [{ k: 'done', label: 'Lessons done', type: 'number', value: c.done ?? 0 }, { k: 'total', label: 'Total lessons', type: 'number', value: c.total ?? 10 }],
];
const embedFields = (e = {}) => [
  { k: 'url', label: 'Link to embed', type: 'url', value: e.url, required: true, placeholder: 'Desmos, Google Slides, YouTube, Figma, Quizlet…' },
  { k: 'title', label: 'Label', value: e.title, placeholder: 'e.g. Unit 2 graph sandbox' },
  { k: 'subjectId', label: 'Subject', type: 'select', value: e.subjectId || '', options: subjOpts() },
];

// ---------------------------------------------------------------- stickers
const PACK_EMOJI = ['📚', '✏️', '☕', '🍵', '🎧', '🌙', '⭐', '✨', '🌸', '🍀', '🔥', '💡', '📌', '🧠', '🎯', '🏆', '🪐', '🐱', '🌧️', '💜', '📝', '🌈', '🦋', '🍓', '🧪', '📐', '🧬', '💻', '🕯️', '🫧'];
const PACK_TEXT = ['you got this', 'exam mode', 'due soon!', 'deep focus', 'no phone', 'hydrate', 'done ✓', 'one more pomodoro', 'review me', 'important!!'];
let selSticker = null;
const pageKey = () => { const r = route(); return r.name === 'stage' ? (ui.mode === 'room' ? 'room' : 'home') : r.id ? `${r.name}:${r.id}` : r.name === 'library' ? `library:${r.tab}` : r.name; };
const stickerHost = () => (sheet.hidden ? $('#sticker-stage') : view);
function mountStickers() {
  $$('.sticker-layer').forEach((l) => l.remove());
  if (!S.settings.stickers) return;
  const host = stickerHost();
  const layer = document.createElement('div');
  layer.className = 'sticker-layer'; layer.id = 'sticker-layer';
  for (const s of S.stickers.filter((x) => x.page === pageKey())) {
    const el = document.createElement('div');
    el.className = `sticker ${s.kind}${selSticker === s.id ? ' sel' : ''}`;
    el.dataset.sticker = s.id;
    el.style.left = `${s.x * 100}%`; el.style.top = `${s.y}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${s.rot}deg)`;
    if (s.kind === 'img') { el.innerHTML = `<img src="${esc(s.value)}" alt="" draggable="false">`; el.style.width = `${s.size}px`; }
    else { el.textContent = s.value; el.style.fontSize = `${s.kind === 'text' ? s.size / 2.6 : s.size}px`; }
    layer.append(el);
    if (selSticker === s.id) {
      const tools = document.createElement('div');
      tools.className = 'st-tools';
      tools.style.left = `${s.x * 100}%`; tools.style.top = `${s.y + (s.kind === 'img' ? s.size * 0.55 : s.kind === 'text' ? 30 : s.size * 0.65) + 8}px`;
      tools.innerHTML = [['smaller', '−', 'Smaller'], ['bigger', '+', 'Bigger'], ['rotl', '↺', 'Rotate left'], ['rotr', '↻', 'Rotate right'], ['front', '⇡', 'Bring to front'], ['del', '✕', 'Remove sticker']].map(([a, t, l]) => `<button data-st="${a}" aria-label="${l}" title="${l}">${t}</button>`).join('');
      layer.append(tools);
    }
  }
  host.append(layer);
  if (host === view) layer.style.height = `${view.scrollHeight}px`;
}
function addSticker(kind, value) {
  S.settings.stickers = true;
  const host = stickerHost();
  const y = host === view ? view.scrollTop + view.clientHeight / 2 : innerHeight * 0.3;
  const s = { id: uid(), page: pageKey(), kind, value, x: 0.25 + Math.random() * 0.5, y: Math.round(y + (Math.random() - 0.5) * 120), size: kind === 'emoji' ? 56 : kind === 'img' ? 120 : 96, rot: Math.round((Math.random() - 0.5) * 16) };
  S.stickers.push(s); selSticker = s.id; save(); mountStickers();
}
function stickerTool(a) {
  const i = S.stickers.findIndex((x) => x.id === selSticker);
  const s = S.stickers[i];
  if (!s) return;
  if (a === 'bigger') s.size = Math.min(400, Math.round(s.size * 1.18));
  if (a === 'smaller') s.size = Math.max(18, Math.round(s.size / 1.18));
  if (a === 'rotl') s.rot -= 12;
  if (a === 'rotr') s.rot += 12;
  if (a === 'front') { S.stickers.splice(i, 1); S.stickers.push(s); }
  if (a === 'del') { S.stickers.splice(i, 1); selSticker = null; toast('Sticker removed', () => { S.stickers.splice(i, 0, s); }); }
  save(); mountStickers();
}
let drag = null;
document.addEventListener('pointerdown', (e) => {
  const tool = e.target.closest('[data-st]');
  if (tool) { e.preventDefault(); stickerTool(tool.dataset.st); return; }
  const el = e.target.closest('[data-sticker]');
  if (el) {
    e.preventDefault();
    const s = S.stickers.find((x) => x.id === el.dataset.sticker);
    const rect = $('#sticker-layer').getBoundingClientRect();
    drag = { s, el, rect, dx: e.clientX - (rect.left + s.x * rect.width), dy: e.clientY - (rect.top + s.y) };
    el.setPointerCapture(e.pointerId);
    $$('.st-tools').forEach((t) => t.remove()); $$('.sticker.sel').forEach((t) => t.classList.remove('sel')); el.classList.add('sel');
    selSticker = s.id;
    return;
  }
  if (selSticker && !e.target.closest('.tray')) { selSticker = null; mountStickers(); }
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { s, el, rect } = drag;
  s.x = Math.max(0, Math.min(1, (e.clientX - drag.dx - rect.left) / rect.width));
  s.y = Math.max(0, Math.round(e.clientY - drag.dy - rect.top));
  el.style.left = `${s.x * 100}%`; el.style.top = `${s.y}px`;
});
document.addEventListener('pointerup', () => { if (drag) { drag = null; save(); mountStickers(); } });
const tray = document.createElement('div');
tray.className = 'tray'; tray.hidden = true;
document.body.append(tray);
function trayHTML() {
  return `<div class="tray-head"><b>Stickers</b><span class="muted">Click one to drop it here, then drag it anywhere.</span></div>
    <div class="tray-grid">${PACK_EMOJI.map((e) => `<button data-act="st-add" data-kind="emoji" data-value="${e}" aria-label="Add ${e} sticker">${e}</button>`).join('')}</div>
    <div class="tray-texts">${PACK_TEXT.map((t) => `<button class="sticker-chip" data-act="st-add" data-kind="text" data-value="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <form data-form="st-text" class="row-input"><input placeholder="Write your own label…" maxlength="40" aria-label="Custom sticker text"><button class="pill accent">Add</button></form>
    <div class="tray-head"><b>Your sticker pack</b><span class="muted">PNGs, GIFs, photos. Saved on this computer.</span></div>
    <div class="tray-grid pack">${S.stickerPack.map((p) => `<span class="pk"><button data-act="st-add" data-kind="img" data-value="${esc(p.src)}" aria-label="Add your sticker"><img src="${esc(p.src)}" alt=""></button><button class="pk-x" data-act="st-forget" data-id="${p.id}" aria-label="Remove from pack">✕</button></span>`).join('')}
      <label class="pk-add" for="st-upload" title="Upload an image">${ic('upload')}<input type="file" id="st-upload" accept="image/*" data-change="st-upload" hidden></label></div>
    <form data-form="st-url" class="row-input"><input placeholder="…or paste an image link" aria-label="Sticker image link"><button class="pill">Add</button></form>
    <button class="btn ghost" data-act="st-clear" style="align-self:flex-start">Clear stickers here</button>`;
}
function toggleTray(force) {
  ui.tray = force ?? !ui.tray;
  tray.hidden = !ui.tray;
  if (ui.tray) { closePops(); bl.innerHTML = blHTML(); tray.innerHTML = trayHTML(); }
  br.innerHTML = brHTML();
}
function shrinkImage(file) {
  if (file.type === 'image/gif' && file.size < 600_000) return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/webp', 0.88)); URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ---------------------------------------------------------------- actions
const ACTS = {
  go: (el) => { location.hash = el.dataset.href; },
  'close-sheet': () => { location.hash = '#/'; },
  mode: (el) => { ui.mode = el.dataset.mode; saveUI(); closePops(); renderStage(); tickTimer(); tickClock(); if (ui.mode === 'focus' && !T.task) setTimeout(() => $('#focus-q')?.focus(), 50); },
  pop: (el) => openPop(el.dataset.pop),
  'pop-close': () => { closePops(); bl.innerHTML = blHTML(); },
  quote: () => { quoteIdx = (quoteIdx + 1) % QUOTES.length; $('#quote').textContent = `“${QUOTES[quoteIdx]}”`; },
  fullscreen: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {} br.innerHTML = brHTML(); },
  tray: () => toggleTray(),
  'm-close': closeModal,
  'm-del': (el) => { if (el.dataset.armed) { modalDelete?.(); closeModal(); save(); render(); refreshPops(); } else { el.dataset.armed = 1; el.textContent = 'Click again to delete'; } },
  'm-yes': () => { modalDelete?.(); closeModal(); save(); render(); refreshPops(); },
  'toast-undo': () => { const t = $('#toast'); t._undo?.(); t.hidden = true; save(); render(); refreshPops(); },

  'subject-new': () => openForm('New subject', subjFields(), (v) => {
    const s = { id: uid(), ...v, units: [{ id: uid(), name: 'Unit 1', chapters: [{ id: uid(), name: 'Chapter 1', topics: [] }] }] };
    S.subjects.push(s); setTimeout(() => { location.hash = `#/s/${s.id}`; });
  }, { submit: 'Create subject' }),
  'subject-edit': (el) => {
    const s = subjectById(el.dataset.id);
    openForm('Edit subject', subjFields(s), (v) => { Object.assign(s, v); }, {
      onDelete: () => {
        S.subjects = S.subjects.filter((x) => x !== s);
        S.lectures = S.lectures.filter((l) => l.subjectId !== s.id);
        S.resources.forEach((r) => { if (r.subjectId === s.id) { r.subjectId = ''; r.chapterId = ''; } });
        location.hash = '#/subjects';
      },
    });
  },
  'node-new': (el, e) => {
    e.preventDefault();
    const kind = el.dataset.kind, parent = findNode(el.dataset.parent)?.node;
    const next = kind === 'unit' ? parent.units.length + 1 : kind === 'chapter' ? parent.chapters.length + 1 : '';
    openForm(`Add ${kind}`, [{ k: 'name', label: `${kind[0].toUpperCase() + kind.slice(1)} name`, required: kind !== 'topic', placeholder: kind === 'unit' ? `Unit ${next} · …` : kind === 'chapter' ? `Ch ${next} · …` : 'e.g. Le Chatelier’s principle' },
      ...(kind === 'topic' ? [{ k: 'many', label: 'Or add several, one per line', type: 'textarea', placeholder: 'Topic A\nTopic B\nTopic C' }] : [])], (v) => {
      if (kind === 'unit') parent.units.push({ id: uid(), name: v.name, chapters: [] });
      if (kind === 'chapter') { parent.chapters.push({ id: uid(), name: v.name, topics: [] }); ui.open.add(parent.id); }
      if (kind === 'topic') {
        const names = [v.name, ...(v.many || '').split('\n')].map((x) => x.trim()).filter(Boolean);
        if (!names.length) { toast('Type at least one topic'); return false; }
        names.forEach((n) => parent.topics.push({ id: uid(), name: n, done: false }));
        ui.open.add(parent.id);
      }
    }, { submit: 'Add' });
  },
  'node-edit': (el, e) => { e.preventDefault(); const f = findNode(el.dataset.id); openForm(`Rename ${f.kind}`, [{ k: 'name', label: 'Name', value: f.node.name, required: true }], (v) => { f.node.name = v.name; }); },
  'node-del': (el, e) => {
    e.preventDefault();
    const f = findNode(el.dataset.id), n = topicsIn(f.node).length;
    confirmBox(`Delete “${f.node.name}”${f.kind !== 'topic' && n ? ` and its ${n} topics` : ''}?`, 'Delete', () => { f.parent.splice(f.parent.indexOf(f.node), 1); });
  },
  'subj-tab': (el) => { ui.subjTab = el.dataset.tab; render(); },

  'due-new': (el) => openForm('New due item', dueFields({ subjectId: el.dataset.subject || '', date: el.dataset.date }), (v) => { S.due.push({ id: uid(), done: false, ...v }); toast('Added'); }, { submit: 'Add' }),
  'due-edit': (el, e) => {
    e.stopPropagation();
    const d = S.due.find((x) => x.id === el.dataset.id);
    openForm('Edit due item', [...dueFields(d), { k: 'done', label: 'Done', type: 'checkbox', value: d.done }], (v) => { Object.assign(d, v); }, { onDelete: () => { S.due = S.due.filter((x) => x !== d); } });
  },
  'cal-move': (el) => { const d = +el.dataset.d; ui.cal = d === 0 ? 0 : ui.cal + d; render(); },
  'cal-day': (el) => ACTS['due-new']({ dataset: { date: el.dataset.date } }),
  'lecture-new': (el) => {
    if (!S.subjects.length) return toast('Add a subject first');
    openForm('Add lecture time', lecFields({ subjectId: el.dataset.subject }), (v) => { if (!v.days.length) { toast('Pick at least one day'); return false; } S.lectures.push({ id: uid(), ...v }); });
  },
  'lecture-edit': (el) => {
    const l = S.lectures.find((x) => x.id === el.dataset.id);
    openForm('Edit lecture time', lecFields(l), (v) => { if (!v.days.length) { toast('Pick at least one day'); return false; } Object.assign(l, v); }, { onDelete: () => { S.lectures = S.lectures.filter((x) => x !== l); } });
  },

  'res-new': (el) => {
    const type = el.dataset.type;
    const r = { id: uid(), type, title: '', subjectId: el.dataset.subject || '', chapterId: '', url: '', body: type === 'note' ? '# New note\n\nStart writing…\n' : '', page: 0, pages: 0, updated: Date.now() };
    S.resources.push(r); save();
    location.hash = `#/r/${r.id}`;
    ui.editNote = type === 'note';
    setTimeout(() => { render(); $('.title-input')?.focus(); }, 30);
  },
  'res-del': (el) => {
    const r = S.resources.find((x) => x.id === el.dataset.id);
    confirmBox(`Delete “${r.title || 'Untitled'}”?`, 'Delete', () => { if (r.fileId) delFile(r.fileId).catch(() => {}); S.resources = S.resources.filter((x) => x !== r); location.hash = `#/library/${r.type}`; });
  },
  'note-mode': () => { ui.editNote = !ui.editNote; render(); if (ui.editNote) $('#note-src')?.focus(); },
  'note-task': (el) => {
    const r = S.resources.find((x) => x.id === el.closest('[data-note]').dataset.note);
    r.body = toggleTask(r.body, +el.dataset.i); r.updated = Date.now(); save();
    const src = $('#note-src'); if (src) src.value = r.body;
    $$(`[data-note="${r.id}"]`).forEach(mountNote);
  },
  'r-file-del': (el) => { const r = S.resources.find((x) => x.id === el.dataset.id); delFile(r.fileId).catch(() => {}); delete r.fileId; save(); render(); },

  'course-new': (el) => openForm('Add external course', courseFields({ subjectId: el.dataset.subject }), (v) => { S.courses.push({ id: uid(), ...v }); }, { submit: 'Add' }),
  'course-edit': (el) => { const c = S.courses.find((x) => x.id === el.dataset.id); openForm('Edit course', courseFields(c), (v) => { Object.assign(c, v); }, { onDelete: () => { S.courses = S.courses.filter((x) => x !== c); } }); },
  'course-step': (el) => { const c = S.courses.find((x) => x.id === el.dataset.id); c.done = Math.max(0, Math.min(c.total || Infinity, c.done + +el.dataset.d)); save(); render(); },
  'embed-new': (el) => openForm('Embed something', embedFields({ subjectId: el.dataset.subject }), (v) => { S.embeds.push({ id: uid(), ...v, title: v.title || new URL(v.url).hostname }); }, { submit: 'Embed' }),
  'embed-edit': (el) => { const x = S.embeds.find((e) => e.id === el.dataset.id); openForm('Edit embed', embedFields(x), (v) => { Object.assign(x, v); }, { onDelete: () => { S.embeds = S.embeds.filter((e) => e !== x); } }); },

  't-toggle': () => { if (T.running) tPause(); else { if (leftSec() <= 0) T.left = dur(T.mode); tStart(); } },
  't-reset': () => { tSetMode(T.mode); renderStage(); },
  't-skip': () => tComplete(true),
  't-mode': (el) => { tSetMode(el.dataset.mode); renderStage(); },

  'yt-toggle': () => { if (!YT.toggle() && S.music.saved[0]) YT.play(S.music.saved[0].url, S.music.saved[0]); },
  'yt-next': () => YT.next(),
  'yt-prev': () => YT.prev(),
  'yt-saved': (el) => { const t = S.music.saved.find((x) => x.id === el.dataset.id); if (t) YT.play(t.url, t); },
  'yt-forget': (el, e) => {
    e.stopPropagation();
    const i = S.music.saved.findIndex((x) => x.id === el.dataset.id);
    const [gone] = S.music.saved.splice(i, 1); save(); renderTracks();
    toast('Removed from list', () => { S.music.saved.splice(i, 0, gone); renderTracks(); });
  },

  'bg-tab': (el) => { ui.bgTab = el.dataset.tab; ui.mode = el.dataset.tab; saveUI(); render(); },
  'bg-pick': (el) => setBg(JSON.parse(el.dataset.spec)),
  accent: (el) => { S.settings.accent = el.dataset.c; save(); applySettings(); render(); },
  'chime-test': () => { const c = S.settings.chime; S.settings.chime = true; chime(); S.settings.chime = c; },
  'notify-perm': async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notifications on' : 'Notifications are blocked in this browser'); } catch { toast('This browser doesn’t support notifications'); } },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `study-haven-backup-${todayISO()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'clear-examples': () => confirmBox('Remove all the example subjects, notes and deadlines?', 'Clear examples', () => { clearExamples(); toast('Examples cleared'); }),
  'reset-all': () => confirmBox('Erase everything and reload the examples?', 'Erase and reset', () => { resetToExamples(); applySettings(); }),

  'st-add': (el) => addSticker(el.dataset.kind, el.dataset.value),
  'st-forget': (el) => { S.stickerPack = S.stickerPack.filter((p) => p.id !== el.dataset.id); save(); tray.innerHTML = trayHTML(); },
  'st-clear': () => { const key = pageKey(); const gone = S.stickers.filter((s) => s.page === key); S.stickers = S.stickers.filter((s) => s.page !== key); save(); mountStickers(); if (gone.length) toast(`Removed ${gone.length} stickers`, () => { S.stickers.push(...gone); }); },
};

const CHANGES = {
  topic: (el) => {
    const f = findNode(el.dataset.id);
    f.node.done = el.checked; save(); render();
    if (el.checked && pct(f.chapter) === 100) toast(`${f.chapter.name} complete`);
  },
  'due-done': (el) => {
    const d = S.due.find((x) => x.id === el.dataset.id);
    d.done = el.checked; save();
    setTimeout(() => { render(); refreshPops(); }, el.checked ? 250 : 0);
    if (el.checked) toast(`Done: ${d.title}`, () => { d.done = false; });
  },
  'lib-subject': (el) => { ui.libSubject = el.value; render(); },
  'r-prop': (el) => {
    const r = S.resources.find((x) => x.id === route().id);
    const k = el.dataset.k;
    r[k] = el.type === 'number' ? Math.max(0, +el.value || 0) : el.value;
    if (k === 'subjectId') r.chapterId = '';
    r.updated = Date.now(); save();
    if (k !== 'title') render();
  },
  'r-style': (el) => { const r = S.resources.find((x) => x.id === route().id); r.style = el.value; save(); $$('[data-note]').forEach(mountNote); },
  'r-file': (el) => uploadFile(S.resources.find((x) => x.id === el.dataset.id), el.files[0]),
  't-subject': (el) => { T.subjectId = el.value; saveT(); },
  'focus-set': (el) => {
    const f = S.settings.focus;
    f[el.dataset.k] = el.type === 'checkbox' ? el.checked : Math.max(1, +el.value || 1);
    save();
    if (!T.running) { T.left = dur(T.mode); saveT(); }
    tickTimer();
  },
  set: (el) => {
    const k = el.dataset.k;
    S.settings[k] = el.type === 'checkbox' ? el.checked : el.value;
    save(); applySettings();
    if (['bgSame', 'stickers', 'quotes', 'clock24', 'appName', 'userName'].includes(k)) render();
  },
  import: async (el) => {
    try {
      const data = JSON.parse(await el.files[0].text());
      if (!data.subjects || !data.settings) throw new Error('not a backup');
      replaceAll(data); applySettings(); render(); toast('Backup restored');
    } catch { toast('That file isn’t a Study Haven backup'); }
  },
  'bg-upload': async (el) => {
    const f = el.files[0];
    if (!f) return;
    if (f.size > 300 * 1024 * 1024) return toast('That file is over 300 MB');
    const id = `bg-${uid()}`;
    try { await putFile(id, f); setBg({ type: 'file', value: id, label: f.name }); toast('Background saved on this computer'); } catch { toast('Couldn’t store that file'); }
  },
  'st-upload': async (el) => {
    const f = el.files[0];
    if (!f) return;
    const src = await shrinkImage(f).catch(() => null);
    if (!src) return toast('Couldn’t read that image');
    S.stickerPack.push({ id: uid(), src }); save();
    addSticker('img', src); tray.innerHTML = trayHTML();
  },
};
async function uploadFile(r, file) {
  if (!file) return;
  if (file.size > 200 * 1024 * 1024) return toast('That file is over 200 MB');
  const id = r.fileId || uid();
  try {
    await putFile(id, file);
    r.fileId = id; r.fileName = file.name; r.updated = Date.now();
    if (!r.title) r.title = file.name.replace(/\.pdf$/i, '');
    save(); render(); toast('File saved on this computer');
  } catch { toast('Couldn’t store the file. The browser may be out of space.'); }
}
let noteSave, taskSync;
const INPUTS = {
  'note-src': (el) => {
    const r = S.resources.find((x) => x.id === el.dataset.id);
    r.body = el.value; r.updated = Date.now();
    clearTimeout(noteSave);
    noteSave = setTimeout(() => { save(); $$(`[data-note="${r.id}"]`).forEach(mountNote); }, 180);
  },
  'yt-vol': (el) => { YT.setVolume(el.value); S.music.volume = +el.value; save(); },
  't-task': (el) => { T.task = el.value; saveT(); clearTimeout(taskSync); taskSync = setTimeout(() => { room?.update({ task: T.task }); pushPresence(); }, 400); },
  snd: (el) => { S.settings.sounds = { ...(S.settings.sounds || {}), [el.dataset.id]: +el.value }; SND.setVolume(el.dataset.id, +el.value); save(); },
  'tg-name': (el) => { S.settings.userName = el.value; save(); },
  'rc-name': (el) => { S.settings.room = { ...roomCfg(), petName: el.value }; save(); },
  dim: (el) => { S.settings.dim = +el.value; save(); applyBackground(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  ACTS[el.dataset.act]?.(el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && e.target.id === 'focus-q') { e.target.blur(); if (!T.running) ACTS['t-toggle'](); }
  // space starts/pauses the timer when nothing is being typed into
  if (e.key === ' ' && ui.mode === 'focus' && sheet.hidden && !e.target.closest('input, textarea, select, button, [contenteditable]')) { e.preventDefault(); ACTS['t-toggle'](); }
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el) CHANGES[el.dataset.change]?.(el, e); });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el) INPUTS[el.dataset.input]?.(el, e); });
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const input = f.querySelector('input');
  const v = input.value.trim();
  if (!v) return;
  input.value = '';
  if (FORMS_EXTRA[f.dataset.form]) FORMS_EXTRA[f.dataset.form](v);
  if (f.dataset.form === 'yt-paste') playLink(v);
  if (f.dataset.form === 'tg-join') joinRoom(v);
  if (f.dataset.form === 'tg-chat') TGM.say(v);
  if (f.dataset.form === 'st-text') addSticker('text', v);
  if (f.dataset.form === 'st-url') { S.stickerPack.push({ id: uid(), src: v }); addSticker('img', v); tray.innerHTML = trayHTML(); }
  if (f.dataset.form === 'bg-url') {
    const yt = YT.parseYT(v);
    if (yt?.v) setBg({ type: 'youtube', value: yt.v, label: 'YouTube video' });
    else if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) setBg({ type: 'video', value: v });
    else if (/^https?:\/\//.test(v)) setBg({ type: 'image', value: v });
    else toast('Paste a full link starting with https://');
  }
});
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.tagName !== 'DETAILS' || !d.dataset.id) return;
  if (d.open) { ui.open.add(d.dataset.id); ui.closed.delete(d.dataset.id); } else { ui.closed.add(d.dataset.id); ui.open.delete(d.dataset.id); }
}, true);
document.addEventListener('dragover', (e) => { const z = e.target.closest('[data-drop], [data-drop-studio]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { e.target.closest?.('[data-drop]')?.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  if (e.target.closest('[data-drop-studio]')) { e.preventDefault(); CHANGES['studio-files']({ files: e.dataTransfer.files }); return; }
  const z = e.target.closest('[data-drop]');
  if (!z) return;
  e.preventDefault();
  uploadFile(S.resources.find((x) => x.id === z.dataset.drop), e.dataTransfer.files[0]);
});
document.addEventListener('fullscreenchange', () => { br.innerHTML = brHTML(); });
view.addEventListener('scroll', () => { const l = $('#sticker-layer', view); if (l) l.style.height = `${view.scrollHeight}px`; }, { passive: true });

// ---------------------------------------------------------------- boot
Object.assign(ACTS, ACTS_EXTRA, ROOM_ACTS);
Object.assign(CHANGES, CHANGES_EXTRA);
const VIEWS = { studio: studioView, today: todayView, subjects: subjectsView, subject: subjectView, library: libraryView, resource: resourceView, calendar: calendarView, courses: coursesView, settings: settingsView };
applySettings();
SND.setMuted(S.settings.catSounds === false);
VIZ.mountStage($('#viz'), () => ({ style: S.settings.visualiser || 'bars', hidden: ui.mode === 'room', musicPlaying: YT.P.playing, accent: S.settings.accent || '#6c47ff' }));
render();
{ const code = new URLSearchParams(location.search).get('room'); if (code) { ui.pendingJoin = code.toUpperCase(); openPop('together'); } }
// greeting and lecture "live" badges depend on the time of day
setInterval(() => { if (ui.mode === 'home' && sheet.hidden && !document.activeElement?.matches('input,textarea,select')) center.innerHTML = homeHTML(), tickClock(); }, 60_000);
