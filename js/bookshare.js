// Lending books in a study room. You mark books as lent; while you're in a room, everyone there sees
// them on a room shelf and can borrow a copy. Only the list of titles goes round the room. A book's
// file is sent when someone opens it, in pieces, through the MQTT brokers (see TGM.book), a few at a
// time because a broker drops pieces sent in a rush. Pieces that don't arrive are asked for again.
// The borrowed copy stays on the borrower's shelf until they give it back.
import { S, save, uid, putFile, getFile } from './store.js';
import * as TGM from './together.js';

const PART = 96 * 1024; // bytes of file per piece; base64 makes it about 128 KB on the wire
const MAX = 60 * 1024 * 1024;
const BURST = 3, GAP = 280; // pieces sent together, and the pause between bursts
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

let H = { render() {}, toast() {}, color: () => '', onRoute: () => false };
export function initShare(hooks) { H = { ...H, ...hooks }; }

export const lent = (r) => !!r.lent && !!r.fileId && !r.borrowed;
const me = () => TGM.TG.me?.id;

// ---------------------------------------------------------------- the owner's side
async function catalog() {
  const list = [];
  for (const r of S.resources.filter(lent).slice(0, 60)) {
    const size = (await getFile(r.fileId).catch(() => null))?.size || 0;
    if (size && size <= MAX) list.push({ id: r.id, title: r.title || 'Untitled', author: r.author || '', type: r.type, format: r.format || (/\.epub$/i.test(r.fileName || '') ? 'epub' : 'pdf'), pages: r.pages || 0, size, spine: H.color(r) });
  }
  return list;
}
let announceT = 0;
function announce(soon) {
  clearTimeout(announceT);
  announceT = setTimeout(async () => { if (TGM.TG.status === 'on') TGM.book({ t: 'books', list: await catalog() }); }, soon ? 0 : 300 + Math.random() * 600);
}
// lend or stop lending one of your books
export function toggleLend(r) {
  r.lent = !r.lent; save(); announce(true);
  H.toast(r.lent ? `Lending “${r.title || 'Untitled'}”: anyone in your study room can borrow a copy` : `Stopped lending “${r.title || 'Untitled'}”`);
}

const sending = new Set();
async function serve(id, to, need) {
  const r = S.resources.find((x) => x.id === id && lent(x));
  const blob = r && (await getFile(r.fileId).catch(() => null));
  if (!blob || blob.size > MAX) return TGM.book({ t: 'book-none', to, id });
  const key = `${to}:${id}`;
  if (sending.has(key) && !need) return; // already on its way
  sending.add(key);
  const of = Math.ceil(blob.size / PART);
  const list = Array.isArray(need) ? need.filter((n) => Number.isInteger(n) && n >= 0 && n < of).slice(0, 400) : [...Array(of).keys()];
  if (!need) H.toast(`Lending “${r.title || 'Untitled'}” to ${TGM.TG.members.get(to)?.name || 'a friend'}`);
  try {
    for (let i = 0; i < list.length; i++) {
      if (TGM.TG.status !== 'on' || !TGM.TG.members.has(to)) break;
      const n = list[i];
      const data = await b64(blob.slice(n * PART, (n + 1) * PART));
      if (!TGM.book({ t: 'book-part', to, id, n, of, size: blob.size, data }, true)) { TGM.book({ t: 'book-none', to, id, why: 'net' }); break; }
      if (i % BURST === BURST - 1) await wait(GAP);
    }
  } finally { sending.delete(key); }
}
const b64 = (blob) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1] || ''); f.onerror = rej; f.readAsDataURL(blob); });

// ---------------------------------------------------------------- everyone else's side
const shelves = new Map(); // member id → the books they lend
const loans = new Map(); // `${owner}:${id}` → a book on its way to you
const str = (v, n) => String(v ?? '').slice(0, n);
// friends still in the room, with what they lend
export function friendShelves() {
  return [...shelves].filter(([id, list]) => id !== me() && list.length && TGM.TG.members.has(id))
    .map(([id, list]) => ({ member: TGM.TG.members.get(id), list }));
}
export const loanOf = (owner, id) => loans.get(`${owner}:${id}`);
const copyOf = (id) => S.resources.find((r) => r.borrowed?.src === id);

export function borrow(owner, id) {
  const b = shelves.get(owner)?.find((x) => x.id === id);
  if (!b) return H.toast('That book isn’t on the room shelf any more');
  const have = copyOf(id);
  if (have) { location.hash = `#/read/${have.id}`; return; }
  const key = `${owner}:${id}`;
  if (loans.has(key)) return H.toast(`“${b.title}” is still on its way`);
  if (!TGM.canCarryBooks()) return H.toast('Your network blocks the servers books travel through. A phone hotspot usually works.');
  loans.set(key, { key, owner, id, b, parts: [], got: 0, of: Math.ceil(b.size / PART) || 1, last: Date.now(), tries: 0, started: Date.now() });
  TGM.book({ t: 'book-req', to: owner, id });
  progress(loans.get(key));
}

function collect(m) {
  const L = loans.get(`${m.from}:${m.id}`);
  if (!L || !Number.isInteger(m.n) || m.n < 0 || m.n >= L.of || m.of !== L.of || typeof m.data !== 'string') return;
  if (!L.parts[m.n]) { L.parts[m.n] = m.data; L.got++; }
  L.last = Date.now();
  progress(L);
  if (L.got === L.of) finish(L);
}
// the spine on the room shelf fills up as the pieces arrive
function progress(L) {
  document.querySelectorAll(`[data-loan="${CSS.escape(L.key)}"]`).forEach((el) => { el.style.setProperty('--load', (L.got / L.of).toFixed(3)); el.classList.add('loading'); });
}
function fail(L, why) {
  loans.delete(L.key);
  H.toast(why || `Couldn’t get “${L.b.title}”. Try again in a moment.`);
  if (H.onRoute('shelf')) H.render();
}
async function finish(L) {
  loans.delete(L.key);
  const bytes = L.parts.map((p) => Uint8Array.from(atob(p), (c) => c.charCodeAt(0)));
  const blob = new Blob(bytes, { type: L.b.format === 'epub' ? 'application/epub+zip' : 'application/pdf' });
  if (blob.size !== L.b.size) return fail(L);
  const b = L.b, owner = TGM.TG.members.get(L.owner);
  const r = { id: uid(), type: b.type === 'textbook' ? 'textbook' : 'book', title: b.title, author: b.author, subjectId: '', chapterId: '', url: '', body: '', page: 0, pages: b.pages, updated: Date.now(), status: 'later',
    fileId: uid(), fileName: `${b.title}.${b.format}`, format: b.format, spine: b.spine || undefined, borrowed: { src: b.id, from: owner?.name || 'a friend', room: TGM.TG.room, at: Date.now() } };
  try { await putFile(r.fileId, blob); } catch { return fail(L, 'Couldn’t store the book. The browser may be out of space.'); }
  S.resources.push(r); save();
  // straight into it if you're still at the shelf waiting; otherwise it's there when you look
  if (H.onRoute('shelf')) location.hash = `#/read/${r.id}`;
  else H.toast(`“${r.title}” arrived from ${r.borrowed.from}. It’s on your bookshelf.`);
}
// pieces that went missing are asked for again; a book that stops coming is given up on
setInterval(() => {
  for (const L of loans.values()) {
    if (Date.now() - L.last < 4000) continue;
    if (TGM.TG.status !== 'on' || !TGM.TG.members.has(L.owner)) { fail(L, `${L.b.title}: the lender left the room`); continue; }
    if (++L.tries > 8) { fail(L); continue; }
    const need = [];
    for (let n = 0; n < L.of && need.length < 400; n++) if (!L.parts[n]) need.push(n);
    L.last = Date.now();
    TGM.book({ t: 'book-req', to: L.owner, id: L.id, need: L.got ? need : undefined });
  }
}, 1500);

TGM.onBook((m) => {
  if (m.t === 'book-hello') { if (S.resources.some(lent)) announce(!m.from); return; }
  if (m.t === 'books' && Array.isArray(m.list)) {
    shelves.set(m.from, m.list.slice(0, 60).filter((b) => b && typeof b.id === 'string').map((b) => ({
      id: str(b.id, 40), title: str(b.title, 160) || 'Untitled', author: str(b.author, 100), type: b.type === 'textbook' ? 'textbook' : 'book',
      format: b.format === 'epub' ? 'epub' : 'pdf', pages: Math.max(0, Math.min(5000, +b.pages || 0)), size: Math.max(0, +b.size || 0), spine: /^[#\w(),.%\s-]{1,80}$/.test(b.spine || '') ? b.spine : '',
    })).filter((b) => b.size && b.size <= MAX));
    if (H.onRoute('shelf')) H.render();
    return;
  }
  if (m.to !== me()) return; // pieces and requests meant for someone else
  if (m.t === 'book-req' && typeof m.id === 'string') serve(m.id, m.from, m.need);
  if (m.t === 'book-part') collect(m);
  if (m.t === 'book-none') { const L = loans.get(`${m.from}:${m.id}`); if (L) fail(L, m.why === 'net' ? 'The lender’s network can’t send books right now' : `“${L.b.title}” isn’t being lent any more`); }
});
// when someone leaves, their shelf goes with them; when you leave, all of them do
let seenShelves = '';
TGM.onChange(() => {
  if (TGM.TG.status !== 'on') shelves.clear();
  const now = TGM.TG.status + friendShelves().map((f) => f.member.id).join();
  if (now !== seenShelves) { seenShelves = now; if (H.onRoute('shelf')) H.render(); }
});
