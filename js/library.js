// The bookshelf and the reader. Study books are the `textbook` resources; leisure books are `book`
// resources, each on one of your own shelves (S.settings.shelves). The shelf is drawn from data:
// spine width from page count, colour from the subject or a cloth binding picked from the id.
// The reader turns PDF pages with StPageFlip (real page curls, corner drags, shadows); EPUBs are
// laid out by epub.js. All three libraries load only when a book is opened or added.
import { S, save, uid, putFile, getFile, delFile, subjectById } from './store.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/';
const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const EPUBJS = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
const PAGEFLIP = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.module.js';

let D; // helpers handed over by app.js: esc, ic, toast, render, openForm
export function initLibrary(deps) { D = deps; return { shelfView, syncReader, ACTS, CHANGES, dropOnShelf }; }

// ---------------------------------------------------------------- small helpers
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (id, salt, n) => hash(id + salt) % n;
const isBook = (r) => r.type === 'textbook' || r.type === 'book';
const fmtOf = (r) => r.format || (/\.epub$/i.test(r.fileName || '') ? 'epub' : 'pdf');
const prog = (r) => (r.pages ? Math.min(1, (r.page || 0) / r.pages) : 0);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// your leisure shelves; books on a shelf that's gone fall back to the first one
export const shelfList = () => (S.settings.shelves ||= [{ id: 'fun', name: 'For fun' }]);
const shelfOf = (r) => (shelfList().some((x) => x.id === r.shelf) ? r.shelf : shelfList()[0].id);
// cloth bindings for leisure books
const CLOTH = ['#7a2e2e', '#2f4a3a', '#25344f', '#b58a2f', '#e6dac0', '#3b6d6b', '#6b3f5e', '#a4532b', '#24242a', '#8c7a5b', '#4b5d2a', '#9c3b4a'];
function inkFor(hex) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#2b241c' : '#f4ead2';
}
function spineColor(r) {
  if (r.spine) return r.spine;
  if (r.type === 'textbook') {
    const base = subjectById(r.subjectId)?.color || '#6b5a48';
    // books of one subject are shades of its colour, like a matching set
    const k = pick(r.id, 'shade', 4);
    return k === 0 ? base : `color-mix(in srgb, ${base} ${[0, 78, 64, 86][k]}%, ${k === 2 ? '#f3ead7' : '#120d08'})`;
  }
  return CLOTH[pick(r.id, 'cloth', CLOTH.length)];
}
const spineInk = (r) => (r.type === 'textbook' ? '#f6efe0' : inkFor(spineColor(r)));
const coverUrls = new Map();
async function coverUrl(r) {
  if (!r.cover) return '';
  if (coverUrls.has(r.id)) return coverUrls.get(r.id);
  const b = await getFile(`cover-${r.id}`).catch(() => null);
  const u = b ? URL.createObjectURL(b) : '';
  coverUrls.set(r.id, u);
  return u;
}

// ---------------------------------------------------------------- the shelf
function spineHTML(r, opts = {}) {
  const { esc } = D;
  const h = 150 + pick(r.id, 'h', 46) + (r.type === 'textbook' ? 14 : 0);
  const w = Math.round(Math.max(24, Math.min(66, 20 + (r.pages || 240) / 16)));
  const look = ['bands', 'label', 'plain', 'block'][pick(r.id, 'look', 4)];
  const p = prog(r);
  const reading = p > 0 && p < 1;
  const sub = r.type === 'textbook' ? subjectById(r.subjectId) : null;
  const tip = `${r.title || 'Untitled'}${r.author ? ` · ${r.author}` : ''}${r.pages ? ` · ${Math.round(p * 100)}%` : r.fileId ? '' : ' · no file yet'}`;
  return `<div class="slot${opts.lean ? ' lean' : ''}" style="--h:${h}px;--w:${w}px">
    <button class="bk ${look}${r.type === 'textbook' ? ' study' : ''}" draggable="true" data-book="${r.id}" data-act="lib-open" data-id="${r.id}" style="--c:${esc(spineColor(r))};--t:${spineInk(r)}" aria-label="${esc(tip)}">
      <span class="bk-title">${esc(r.title || 'Untitled')}</span>
      ${r.author && w > 30 ? `<span class="bk-auth">${esc(r.author.split(/[ ,]/).filter(Boolean).pop())}</span>` : sub?.code && w > 30 ? `<span class="bk-auth">${esc(sub.code)}</span>` : ''}
      ${r.status === 'done' && r.type === 'book' ? '<span class="bk-star" aria-hidden="true">★</span>' : ''}
      ${r.marks?.length ? '<i class="bk-slip" aria-hidden="true"></i>' : ''}
    </button>
    <button class="bk-x" data-act="lib-remove" data-id="${r.id}" aria-label="Remove ${esc(r.title || 'this book')} from the shelf" title="Remove from shelf">${D.ic('x')}</button>
    ${reading ? `<i class="ribbon" style="--rl:${Math.round(18 + p * 26)}px" aria-hidden="true"></i>` : ''}
    <span class="bk-tip">${esc(tip)}</span>
  </div>`;
}
// finished leisure books lie flat in a pile, the way you put down a book you're done with
function pileHTML(list) {
  const { esc } = D;
  if (!list.length) return '';
  return `<div class="slot pile">${list.slice(0, 7).map((r, i) => {
    const t = Math.round(Math.max(16, Math.min(34, 12 + (r.pages || 240) / 26)));
    const len = 120 + pick(r.id, 'len', 40);
    return `<span class="flat-w"><button class="flat" draggable="true" data-book="${r.id}" data-act="lib-open" data-id="${r.id}" style="--c:${esc(spineColor(r))};--t:${spineInk(r)};--fw:${len}px;--fh:${t}px;--dx:${(pick(r.id, 'dx', 13) - 6) + (i % 2 ? 3 : -3)}px" aria-label="${esc(r.title)} (finished)"><span>${esc(r.title || 'Untitled')}</span></button><button class="bk-x" data-act="lib-remove" data-id="${r.id}" aria-label="Remove ${esc(r.title || 'this book')} from the shelf" title="Remove from shelf">${D.ic('x')}</button></span>`;
  }).reverse().join('')}</div>`;
}
const addSlot = (where, label) => `<label class="slot add" style="--h:168px;--w:46px" title="${label}">
  <span class="bk-ghost">${D.ic('plus')}<small>${label}</small></span>
  <input type="file" multiple accept="application/pdf,.pdf,application/epub+zip,.epub" data-change="lib-file" data-where="${where}" hidden></label>`;

// a cover: the real one from the file, or a cloth-bound one set in type
function coverFace(r, url) {
  const { esc } = D;
  if (url && r.showCover !== false) return `<img src="${esc(url)}" alt="">`; // the book's own cover unless you chose cloth
  const orn = ['❦', '✦', '◆', '❧'][pick(r.id, 'orn', 4)];
  return `<span class="gen-cover" style="--c:${esc(spineColor(r))};--t:${spineInk(r)}"><b>${esc(r.title || 'Untitled')}</b><i>${orn}</i>${r.author ? `<small>${esc(r.author)}</small>` : ''}</span>`;
}

function shelfView() {
  const { esc, ic } = D;
  const books = S.resources.filter(isBook);
  const study = books.filter((r) => r.type === 'textbook');
  const leisure = books.filter((r) => r.type === 'book');
  // the display ledge on top: what you're in the middle of, most recent first
  const now = books.filter((r) => prog(r) > 0 && prog(r) < 1).sort((a, b) => b.updated - a.updated).slice(0, 4);
  const groups = [...S.subjects.map((s) => ({ s, list: study.filter((r) => r.subjectId === s.id) })), { s: null, list: study.filter((r) => !subjectById(r.subjectId)) }].filter((g) => g.list.length);
  const studyRow = groups.map((g) => `${g.s ? `<div class="divider" style="--c:${esc(g.s.color)}"><span>${esc(g.s.code || g.s.name)}</span></div>` : '<div class="divider"><span>Other</span></div>'}
    ${g.list.map((r, i) => spineHTML(r, { lean: i === g.list.length - 1 && g.list.length > 2 })).join('')}`).join('');
  const ledge = now.length
    ? now.map((r) => `<button class="face" data-act="lib-open" data-id="${r.id}" aria-label="Continue ${esc(r.title)}"><span class="face-cover" data-cover="${r.id}">${coverFace(r, coverUrls.get(r.id))}</span>
        <span class="face-meta"><b>${esc(r.title || 'Untitled')}</b><small>${Math.round(prog(r) * 100)}% read</small></span></button>`).join('')
    : '<p class="ledge-empty">Books you’re partway through stand here, cover out.</p>';
  const count = (n) => `${n} ${n === 1 ? 'book' : 'books'}`;
  const bays = shelfList().map((sh) => {
    const on = leisure.filter((r) => shelfOf(r) === sh.id);
    const standing = on.filter((r) => r.status !== 'done'), done = on.filter((r) => r.status === 'done');
    return `<section class="bay leisure" data-drop-shelf="leisure:${sh.id}" aria-label="${esc(sh.name)} shelf">
      <button class="plate" data-act="shelf-edit" data-id="${sh.id}" title="Rename or remove this shelf"><span>${esc(sh.name)}</span><small>${count(on.length)}</small></button>
      <div class="books">${standing.map((r, i) => spineHTML(r, { lean: i === standing.length - 1 && standing.length > 3 && !done.length })).join('')}${pileHTML(done)}${addSlot(`leisure:${sh.id}`, 'Add a book')}</div>
    </section>`;
  }).join('');
  setTimeout(hydrateCovers, 0);
  return `<div class="page wide shelf-page">
    <div class="ph-row"><div class="ph"><h1>Bookshelf</h1><p>Drop a PDF or EPUB on a shelf and it’s ready to read. Drag books between shelves to sort them.</p></div>
      <button class="btn" data-act="shelf-new">${ic('plus')} New shelf</button>
      <button class="btn" data-act="res-new" data-type="textbook">${ic('link')} Textbook from a link</button></div>
    <div class="case">
      <div class="crown"></div>
      <div class="ledge"><div class="ledge-row">${ledge}</div><span class="plant" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></span></div>
      <section class="bay" data-drop-shelf="study" aria-label="Study shelf">
        <div class="plate fixed"><span>Study</span><small>${count(study.length)}</small></div>
        <div class="books">${studyRow}${addSlot('study', 'Add textbook')}</div>
      </section>
      ${bays}
      <div class="plinth"></div>
    </div>
    <p class="shelf-hint">Books stay on this computer. Click a shelf’s nameplate to rename it.</p>
  </div>`;
}
async function hydrateCovers() {
  for (const el of document.querySelectorAll('[data-cover]')) {
    const r = S.resources.find((x) => x.id === el.dataset.cover);
    if (!r || el.querySelector('img')) continue;
    if (!r.cover && r.fileId) { makeCover(r).then(() => { if (r.cover) hydrateCovers(); }); continue; }
    const u = await coverUrl(r);
    if (u) el.innerHTML = coverFace(r, u);
  }
}

// ---------------------------------------------------------------- adding books: drop it and it's shelved
// The title, author, page count and cover come from the file. A textbook goes under the subject
// its title mentions; anything can be changed later from the book's details.
function guessSubject(title) {
  const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const t = new Set(words(title));
  let best = '', score = 0;
  for (const s of S.subjects) {
    const n = [...words(s.name), ...words(s.code)].filter((w) => t.has(w)).length;
    if (n > score) { best = s.id; score = n; }
  }
  return best;
}
async function addFile(file, where) {
  if (!file) return;
  if (!/\.(pdf|epub)$/i.test(file.name) && !/pdf|epub/.test(file.type)) return D.toast(`“${file.name}” isn’t a PDF or EPUB`);
  if (file.size > 200 * 1024 * 1024) return D.toast('That file is over 200 MB');
  const study = where === 'study';
  const r = { id: uid(), type: study ? 'textbook' : 'book', title: file.name.replace(/\.(pdf|epub)$/i, '').replace(/[_-]+/g, ' ').trim(), author: '', subjectId: '', chapterId: '', url: '', body: '', page: 0, pages: 0, updated: Date.now(), status: 'later' };
  if (!study) r.shelf = where.split(':')[1] || shelfList()[0].id;
  r.fileId = uid(); r.fileName = file.name; r.format = /\.epub$/i.test(file.name) || /epub/.test(file.type) ? 'epub' : 'pdf';
  try { await putFile(r.fileId, file); } catch { return D.toast('Couldn’t store the file. The browser may be out of space.'); }
  await readMeta(r).catch(() => {});
  if (study) r.subjectId = guessSubject(`${r.title} ${file.name}`);
  S.resources.push(r); save(); D.render();
  const place = study ? subjectById(r.subjectId)?.name || 'Study' : shelfList().find((x) => x.id === r.shelf)?.name;
  D.toast(`Shelved “${r.title}” on ${place}`);
}
async function readMeta(r) {
  const blob = await getFile(r.fileId);
  if (fmtOf(r) === 'pdf') {
    const pdf = await (await pdfjs()).getDocument({ data: await blob.arrayBuffer() }).promise;
    r.pages = pdf.numPages;
    const { info } = await pdf.getMetadata().catch(() => ({}));
    if (info?.Title?.trim() && info.Title.length < 140 && !/^untitled|microsoft word|\.docx?$/i.test(info.Title)) r.title = info.Title.trim();
    if (info?.Author?.trim()) r.author = info.Author.trim();
    await coverFromPdf(r, pdf);
    pdf.destroy();
  } else {
    const book = (await epubjs())(await blob.arrayBuffer());
    const meta = await book.loaded.metadata;
    if (meta.title) r.title = meta.title;
    if (meta.creator) r.author = meta.creator;
    r.pages = 100;
    await coverFromEpub(r, book);
    book.destroy();
  }
}
const coverBusy = new Set();
async function makeCover(r) {
  if (coverBusy.has(r.id)) return;
  coverBusy.add(r.id);
  try {
    const blob = await getFile(r.fileId);
    if (!blob) return;
    if (fmtOf(r) === 'pdf') { const pdf = await (await pdfjs()).getDocument({ data: await blob.arrayBuffer() }).promise; await coverFromPdf(r, pdf); pdf.destroy(); }
    else { const book = (await epubjs())(await blob.arrayBuffer()); await coverFromEpub(r, book); book.destroy(); }
    save();
  } catch {} finally { coverBusy.delete(r.id); }
}
async function coverFromPdf(r, pdf) {
  const c = await renderPage(pdf, 1, 420);
  await storeCover(r, await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85)));
}
async function coverFromEpub(r, book) {
  const u = await book.coverUrl().catch(() => null);
  if (u) await storeCover(r, await (await fetch(u)).blob());
}
async function storeCover(r, blob) {
  if (!blob) return;
  await putFile(`cover-${r.id}`, blob);
  r.cover = true;
  const old = coverUrls.get(r.id); if (old) URL.revokeObjectURL(old);
  coverUrls.set(r.id, URL.createObjectURL(blob));
}
export async function forgetBook(r) { if (r.cover) await delFile(`cover-${r.id}`).catch(() => {}); }

// a file dropped on a shelf is added there; a book dragged from another shelf moves there
function moveBook(r, where) {
  if (where === 'study') { r.type = 'textbook'; if (!r.subjectId) r.subjectId = guessSubject(r.title); }
  else { r.type = 'book'; r.shelf = where.split(':')[1]; r.status ||= 'later'; }
  r.updated = Date.now(); save(); D.render();
}
function dropOnShelf(zone, dt) {
  const where = zone.closest('[data-drop-shelf]')?.dataset.dropShelf || `leisure:${shelfList()[0].id}`;
  const id = dt.getData('text/x-book');
  const r = id && S.resources.find((x) => x.id === id);
  if (r) return moveBook(r, where);
  [...dt.files].forEach((f) => addFile(f, where));
}
document.addEventListener('dragstart', (e) => {
  const b = e.target.closest?.('[data-book]');
  if (!b) return;
  e.dataTransfer.setData('text/x-book', b.dataset.book);
  e.dataTransfer.effectAllowed = 'move';
  b.classList.add('lifted');
});
document.addEventListener('dragend', (e) => { e.target.closest?.('[data-book]')?.classList.remove('lifted'); document.querySelectorAll('[data-drop-shelf].over').forEach((z) => z.classList.remove('over')); });

// ---------------------------------------------------------------- lazy libraries
let pdfp, epubp, flipp;
function pdfjs() {
  return (pdfp ||= import(`${PDFJS}pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`; return m; }));
}
const script = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
function epubjs() { return (epubp ||= script(JSZIP).then(() => script(EPUBJS)).then(() => window.ePub)); }
function pageflip() { return (flipp ||= import(PAGEFLIP).then((m) => m.PageFlip)); }
async function renderPage(pdf, n, height) {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const v = page.getViewport({ scale: height / vp.height });
  const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
  return c;
}

// ---------------------------------------------------------------- the reader
// It lives in its own overlay (#reader), outside the sheet that render() rebuilds, so a page stays
// put while the rest of the app re-renders around it.
const R = { id: null, r: null, kind: '', pdf: null, flip: null, pages: [], urls: new Map(), epub: null, rendition: null, single: false, aspect: 0.7, busy: false, saveT: 0 };
const host = () => document.getElementById('reader');
const $id = (x) => document.getElementById(x);

export function syncReader(rt) {
  const want = rt.name === 'read' ? rt.id : null;
  if (want === R.id) return;
  closeReader();
  if (want) openReader(S.resources.find((x) => x.id === want));
}
function closeReader() {
  if (!R.id) return;
  flush();
  try { R.flip?.destroy(); } catch {}
  R.pdf?.destroy(); R.epub?.destroy();
  R.urls.forEach((u) => URL.revokeObjectURL(u));
  Object.assign(R, { id: null, r: null, pdf: null, flip: null, pages: [], urls: new Map(), epub: null, rendition: null });
  const h = host(); h.hidden = true; h.innerHTML = '';
  window.removeEventListener('resize', onResize);
}
async function openReader(r) {
  if (!r) return;
  const { esc, ic } = D;
  R.id = r.id; R.r = r; R.kind = fmtOf(r);
  const h = host();
  h.hidden = false;
  h.innerHTML = `<div class="rd-top">
      <a class="rd-btn" href="#/shelf" aria-label="Back to the shelf">${ic('left')}<span>Shelf</span></a>
      <div class="rd-title"><b>${esc(r.title || 'Untitled')}</b><small>${esc(r.author || (r.type === 'textbook' ? subjectById(r.subjectId)?.name || 'Textbook' : 'Leisure'))}</small></div>
      <button class="rd-btn" data-act="rd-cover" aria-label="Switch between the book's own cover and a cloth cover" title="Cover: the book's own or cloth">${ic('image')}</button>
      <button class="rd-btn" data-act="rd-mark" aria-label="Bookmark this page" id="rd-mark">${ic('tag')}</button>
      <a class="rd-btn" href="#/r/${r.id}" aria-label="Details">${ic('more')}</a>
    </div>
    <div class="rd-desk" id="rd-desk">
      <div class="book-open ${R.kind}" id="book-open">
        <div class="edges l"></div><div class="edges r"></div>
        <div class="flip-stage" id="flip-stage"></div>
        <div class="paper-pages"><div class="leaf-page left"></div><div class="leaf-page right"></div></div>
        <div class="epub-host" id="epub-host"></div>
        <div class="gutter"></div>
        <div class="bm-tabs" id="bm-tabs"></div>
        <button class="bm" id="bm" data-act="rd-mark" aria-label="Remove this bookmark" title="Remove bookmark" hidden><i class="bm-tassel"></i><span>✦</span></button>
      </div>
      <button class="rd-arrow prev" data-act="rd-turn" data-d="-1" aria-label="Previous page">${ic('left')}</button>
      <button class="rd-arrow next" data-act="rd-turn" data-d="1" aria-label="Next page">${ic('chev')}</button>
      <div class="rd-loading" id="rd-loading">Opening the book…</div>
    </div>
    <div class="rd-foot"><span class="num" id="rd-pos"></span><div class="rd-track"><input type="range" id="rd-scrub" min="1" max="1" value="1" aria-label="Go to page" data-change="rd-scrub"><span class="rd-marks" id="rd-marks"></span></div></div>`;
  $id('book-open').style.setProperty('--cover', spineColor(r));
  window.addEventListener('resize', onResize);
  try {
    const blob = await getFile(r.fileId);
    if (!blob) throw new Error('missing');
    if (R.id !== r.id) return;
    if (R.kind === 'pdf') await openPdf(r, blob); else await openEpub(r, blob);
    $id('rd-loading')?.remove();
    if (!r.status || r.status === 'later') { r.status = 'reading'; save(); }
  } catch (e) {
    console.warn(e);
    const l = $id('rd-loading');
    if (l) l.innerHTML = `Couldn’t open this book.<br><a class="btn" href="#/r/${r.id}">Check the file</a>`;
  }
}
// Fit the page (or the spread) inside the desk with room for the cover board, page stacks and arrows.
function layout() {
  const desk = $id('rd-desk'), bk = $id('book-open');
  if (!desk || !bk) return { pw: 300, ph: 420 };
  const narrow = desk.clientWidth < 760;
  const W = desk.clientWidth - (narrow ? 56 : 180), H = desk.clientHeight - (narrow ? 40 : 64);
  R.single = narrow || W / H < 1.05;
  const n = R.single ? 1 : 2;
  let ph = H, pw = ph * R.aspect;
  if (pw * n > W) { pw = W / n; ph = pw / R.aspect; }
  pw = Math.floor(pw); ph = Math.floor(ph);
  bk.style.setProperty('--pw', `${pw}px`);
  bk.style.setProperty('--ph', `${ph}px`);
  bk.classList.toggle('single', R.single);
  return { pw, ph };
}
let resizeT;
function onResize() {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const was = R.single;
    layout();
    if (R.pdf) buildFlip(R.flip?.getCurrentPageIndex() || 0);
    else if (R.rendition) { if (was !== R.single) R.rendition.spread(R.single ? 'none' : 'always'); R.rendition.resize(); }
  }, 180);
}

// PDF: every page is a div holding an <img>; StPageFlip turns them. Images are drawn a few pages
// ahead and behind as you read (img, not canvas, because single-page mode clones the page mid-turn).
async function openPdf(r, blob) {
  const [lib, PageFlip] = await Promise.all([pdfjs(), pageflip()]);
  R.PageFlip = PageFlip;
  R.pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
  const first = (await R.pdf.getPage(1)).getViewport({ scale: 1 });
  R.aspect = first.width / first.height;
  if (r.pages !== R.pdf.numPages) { r.pages = R.pdf.numPages; save(); }
  if (!r.cover) {
    coverFromPdf(r, R.pdf).then(() => {
      save();
      const f = R.pages?.[0]?.querySelector('.board-face');
      if (f && R.r === r) f.innerHTML = coverFace(r, coverUrls.get(r.id));
    }).catch((e) => console.warn('cover', e));
  }
  $id('rd-scrub').max = r.pages;
  buildFlip(0, true);
}
// The flip book is a real book: front board, endpaper, the PDF's pages, (a blank to even it out),
// endpaper, back board. Index 0 is the closed front cover; PDF page k sits at index k + 1.
const FRONT = 2; // board + endpaper before page 1
// When the book shows its own cover, that cover is PDF page 1, so page 1 is the front board and
// the pages inside start at page 2 (otherwise the cover would appear twice).
const toIndex = (page) => Math.max(page, 1 + (R.skip || 0)) - (R.skip || 0) + FRONT - 1;
function buildFlip(start, opening = false) {
  const stage = $id('flip-stage');
  if (!stage || !R.pdf) return;
  try { R.flip?.destroy(); } catch {}
  const { esc } = D;
  const r = R.r;
  const { pw, ph } = layout();
  const N = R.pdf.numPages;
  const el = document.createElement('div');
  el.className = 'flip-book';
  el.style.width = `${R.single ? pw : pw * 2}px`; el.style.height = `${ph}px`;
  stage.replaceChildren(el);
  const page = (cls, html, hard) => { const p = document.createElement('div'); p.className = `pf-page ${cls}`; p.dataset.density = hard ? 'hard' : 'soft'; p.innerHTML = html; el.append(p); return p; };
  const cloth = `style="--c:${esc(spineColor(r))};--t:${spineInk(r)}"`;
  const pages = [page('board front', `<span class="board-face" ${cloth}>${coverFace(r, coverUrls.get(r.id))}</span>`, true), page('endpaper', '', false)];
  R.skip = r.showCover !== false && N > 1 ? 1 : 0;
  R.pdfEl = [];
  for (let k = R.skip; k < N; k++) {
    const p = page('', `<img alt="Page ${k + 1}" draggable="false">${R.urls.has(k) ? '' : '<span class="pf-wait"></span>'}`, false);
    if (R.urls.has(k)) p.firstChild.src = R.urls.get(k);
    R.pdfEl[k] = p; pages.push(p);
  }
  // the back board has to land alone on the left, so the page count before it must be odd
  if ((pages.length + 1) % 2) pages.push(page('blank', '', false));
  pages.push(page('endpaper', '', false));
  pages.push(page('board back', `<span class="board-face" ${cloth}></span>`, true));
  R.pages = pages;
  if (!coverUrls.get(r.id) && r.cover) coverUrl(r).then((u) => { const f = pages[0].querySelector('.board-face'); if (u && f) f.innerHTML = coverFace(r, u); });
  R.flip = new R.PageFlip(el, {
    width: pw, height: ph, size: 'stretch', minWidth: Math.floor(pw * 0.9), maxWidth: pw, minHeight: 100, maxHeight: ph,
    autoSize: false, showCover: true, usePortrait: true, startPage: Math.min(start, pages.length - 1),
    flippingTime: 800, maxShadowOpacity: 0.5, drawShadow: true, showPageCorners: true, mobileScrollSupport: false, swipeDistance: 24,
  });
  R.flip.on('init', (e) => { onPage(e.data.page); $id('book-open')?.classList.add('ready'); if (opening) openSlowly(); });
  R.flip.on('flip', (e) => onPage(e.data));
  R.flip.on('changeState', (e) => {
    const bk = $id('book-open'), moving = e.data === 'flipping' || e.data === 'user_fold';
    bk?.classList.toggle('turning', moving);
    if (moving) bk?.classList.remove('closed', 'closed-back'); // the board opens out as the cover lifts
  });
  R.flip.loadFromHTML(pages);
}
// The book rests closed for a moment, the cover lifts slowly, then it turns to where you left off.
async function openSlowly() {
  const f = R.flip, r = R.r;
  if (!f) return;
  const target = toIndex(Math.max(1, r.page || 1));
  if (calm()) { f.turnToPage(target); return; }
  drawAround(target); // ready by the time the cover is open
  await wait(900);
  if (R.flip !== f) return;
  const set = f.getSettings();
  set.flippingTime = 1700;
  f.flipNext('bottom');
  await wait(1800);
  set.flippingTime = 800;
  if (R.flip !== f) return;
  const now = f.getCurrentPageIndex();
  if (target > now + 1) { $id('book-open')?.classList.add('riffle'); f.turnToPage(target); setTimeout(() => $id('book-open')?.classList.remove('riffle'), 500); }
}
let drawQ = Promise.resolve();
function drawAround(i) {
  const k0 = i - FRONT + R.skip;
  const want = [0, 1, -1, 2, 3, -2, 4, 5].map((d) => k0 + d).filter((k) => k >= R.skip && k < (R.pdfEl?.length || 0) && !R.urls.has(k));
  for (const k of want) {
    drawQ = drawQ.then(async () => {
      if (!R.pdf || R.urls.has(k)) return;
      // you've moved on: skip it, it'll be drawn when you come back
      const here = (R.flip?.getCurrentPageIndex() ?? 0) - FRONT + R.skip;
      if (Math.abs(k - here) > 7 && Math.abs(k - (R.r.page || 1) + 1) > 7) return;
      const { ph } = layout();
      const c = await renderPage(R.pdf, k + 1, Math.min(2600, ph * Math.min(2, window.devicePixelRatio || 1)));
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
      if (!R.pdf || !blob) return;
      const u = URL.createObjectURL(blob);
      R.urls.set(k, u);
      const pg = R.pdfEl[k];
      if (pg) { pg.querySelector('img').src = u; pg.querySelector('.pf-wait')?.remove(); }
    }).catch(() => {});
  }
}
// i is StPageFlip's page index; progress counts the right-hand page of a spread
function onPage(i) {
  const n = R.pages.length, N = R.pdfEl.length;
  const bk = $id('book-open');
  const portrait = R.flip?.getOrientation() === 'portrait';
  bk?.classList.toggle('closed', i === 0);
  bk?.classList.toggle('closed-back', i >= n - 1);
  bk?.classList.toggle('portrait', portrait);
  drawAround(Math.max(i, FRONT));
  if (i === 0) return; // closed: keep the place you were at
  const right = portrait ? i : i + 1;
  setPos(Math.max(1, Math.min(N, right - FRONT + 1 + R.skip)));
}
function setPos(page) {
  const r = R.r; if (!r) return;
  r.page = page; r.updated = Date.now();
  if (r.pages && page >= r.pages && r.type === 'book') r.status = 'done';
  clearTimeout(R.saveT); R.saveT = setTimeout(save, 400);
  const pos = $id('rd-pos'), scrub = $id('rd-scrub');
  if (pos) pos.textContent = R.kind === 'pdf' ? `${page} of ${r.pages}` : `${page}%`;
  if (scrub && document.activeElement !== scrub) scrub.value = page;
  $id('book-open')?.style.setProperty('--read', prog(r).toFixed(3));
  const marks = (r.marks || []).sort((x, y) => x - y);
  const left = R.single || R.kind !== 'pdf' ? page : page - 1; // the spread shows left…page
  const marked = marks.some((m) => m >= left && m <= page);
  $id('bm')?.toggleAttribute('hidden', !marked);
  $id('rd-mark')?.classList.toggle('on', marked);
  // the others stick out of the top of the page block: behind you on the left, ahead on the right
  const tabs = $id('bm-tabs'), total = r.pages || 1;
  if (tabs) tabs.innerHTML = marks.filter((m) => m < left || m > page).map((m, i) => {
    const before = m < left;
    const f = before ? m / Math.max(1, left) : (m - page) / Math.max(1, total - page);
    const x = R.single ? (before ? 4 + f * 40 : 54 + f * 40) : (before ? 4 + f * 40 : 56 + f * 40);
    return `<button class="bm-tab" data-act="rd-go" data-p="${m}" style="--x:${x.toFixed(1)}%;--k:${i % 3}" title="${R.kind === 'pdf' ? `Page ${m}` : `${m}%`}" aria-label="Go to bookmark at ${R.kind === 'pdf' ? `page ${m}` : `${m}%`}"></button>`;
  }).join('');
  const mk = $id('rd-marks');
  if (mk) mk.innerHTML = (r.marks || []).sort((x, y) => x - y).map((m) => `<button class="mark" data-act="rd-go" data-p="${m}" style="--at:${r.pages ? (m / r.pages) * 100 : 0}%" aria-label="Bookmark at ${m}"></button>`).join('');
}
function flush() { if (R.r) { clearTimeout(R.saveT); save(); } }

// EPUB: epub.js lays the text across both pages. A turn fades the text, flips a sheet of paper
// over and brings the next page in, since the text lives in an iframe and can't be curled.
async function openEpub(r, blob) {
  const ePub = await epubjs();
  R.epub = ePub(await blob.arrayBuffer());
  R.aspect = 0.68;
  layout();
  R.rendition = R.epub.renderTo($id('epub-host'), { width: '100%', height: '100%', flow: 'paginated', spread: R.single ? 'none' : 'always', minSpreadWidth: 0 });
  R.rendition.themes.default({ html: { background: 'transparent !important' }, body: { 'font-family': 'Newsreader, Georgia, serif !important', color: '#2a241c', background: 'transparent !important', 'line-height': '1.6', padding: '0 !important' }, p: { 'font-family': 'inherit !important' }, a: { color: '#7a2e2e' } });
  R.rendition.themes.fontSize('112%');
  R.rendition.on('relocated', (loc) => {
    r.loc = loc.start.cfi;
    setPos(R.epub.locations.length() ? Math.round(R.epub.locations.percentageFromCfi(loc.start.cfi) * 100) : r.page || 0);
  });
  R.rendition.on('keyup', onKey);
  $id('rd-scrub').max = 100;
  r.pages = 100;
  // closed first: the front board over the text, then it swings open
  const bk = $id('book-open');
  const cover = document.createElement('div');
  cover.className = 'epub-cover';
  cover.innerHTML = `<span class="board-face" style="--c:${D.esc(spineColor(r))};--t:${spineInk(r)}">${coverFace(r, await coverUrl(r))}</span><span class="endpaper"></span>`;
  bk.append(cover);
  bk.classList.add('closed');
  await R.rendition.display(r.loc || undefined);
  bk.classList.add('ready');
  if (calm()) cover.remove(), bk.classList.remove('closed');
  else wait(900).then(() => { bk.classList.remove('closed'); cover.classList.add('open'); return wait(1750); }).then(() => cover.remove());
  if (!r.cover) coverFromEpub(r, R.epub).then(save).catch(() => {});
  R.epub.ready.then(() => R.epub.locations.generate(1200)).then(() => { if (R.rendition?.location) setPos(Math.round(R.epub.locations.percentageFromCfi(R.rendition.location.start.cfi) * 100)); }).catch(() => {});
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
async function turn(d) {
  if (!R.id) return;
  if (R.flip) { d > 0 ? R.flip.flipNext('bottom') : R.flip.flipPrev('bottom'); return; }
  if (!R.rendition || R.busy) return;
  R.busy = true;
  const bk = $id('book-open');
  try {
    if (calm()) { await (d > 0 ? R.rendition.next() : R.rendition.prev()); return; }
    bk.classList.add('fading');
    await wait(140);
    const leaf = document.createElement('div');
    leaf.className = `leaf ${d > 0 ? 'fwd' : 'back'}${R.single ? ' one' : ''}`;
    leaf.innerHTML = '<div class="face front"></div><div class="face backside"></div>';
    bk.append(leaf);
    await (d > 0 ? R.rendition.next() : R.rendition.prev());
    await wait(520);
    bk.classList.remove('fading');
    await wait(160);
    leaf.remove();
  } finally { R.busy = false; bk?.classList.remove('fading'); }
}
function goTo(page) {
  if (R.flip) R.flip.turnToPage(Math.max(0, Math.min(R.pages.length - 1, toIndex(page))));
  else if (R.rendition && R.epub.locations.length()) R.rendition.display(R.epub.locations.cfiFromPercentage(page / 100));
}
function onKey(e) {
  if (!R.id || $id('modal')?.hidden === false) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault?.(); turn(1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault?.(); turn(-1); }
  else if (e.key === 'Escape') location.hash = '#/shelf';
}
document.addEventListener('keydown', onKey);
// swipe to turn an EPUB (StPageFlip handles swipes on PDFs itself)
let touchX = null;
document.addEventListener('touchstart', (e) => { if (R.rendition && e.target.closest('#book-open')) touchX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1); }, { passive: true });

// ---------------------------------------------------------------- handlers
const ACTS = {
  'lib-open': (el) => {
    const r = S.resources.find((x) => x.id === el.dataset.id);
    if (!r) return;
    // a link-only textbook (or an image upload) opens its page, where a PDF can be added
    if (!r.fileId || /\.(png|jpe?g|gif|webp)$/i.test(r.fileName || '')) { location.hash = `#/r/${r.id}`; return; }
    el.classList.add('pulled');
    setTimeout(() => { location.hash = `#/read/${r.id}`; }, calm() ? 0 : 280);
  },
  'rd-turn': (el) => turn(+el.dataset.d),
  'rd-go': (el) => goTo(+el.dataset.p),
  'rd-mark': () => {
    const r = R.r; if (!r) return;
    r.marks ||= [];
    const left = R.single || R.kind !== 'pdf' ? r.page : r.page - 1;
    const here = r.marks.filter((m) => m >= left && m <= r.page);
    if (here.length) r.marks = r.marks.filter((m) => !here.includes(m)); else r.marks.push(r.page);
    save(); setPos(r.page);
    D.toast(here.length ? 'Bookmark taken out' : 'Bookmark slipped in');
  },
  'rd-cover': () => { const r = R.r; if (r) setCover(r, r.showCover === false); },
  // off the shelf: gone straight away, with a few seconds to undo before the file is deleted
  'lib-remove': (el) => {
    const r = S.resources.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const at = S.resources.indexOf(r);
    S.resources.splice(at, 1); save(); D.render();
    let undone = false;
    D.toast(`Removed “${r.title || 'Untitled'}”`, () => { undone = true; S.resources.splice(Math.min(at, S.resources.length), 0, r); });
    setTimeout(() => { if (!undone && !S.resources.includes(r)) { if (r.fileId) delFile(r.fileId).catch(() => {}); forgetBook(r); } }, 6500);
  },
  'shelf-new': () => D.openForm('New shelf', [{ k: 'name', label: 'Name', required: true, placeholder: 'e.g. Sci-fi, Poetry, To read next' }], (v) => {
    shelfList().push({ id: uid(), name: v.name });
  }, { submit: 'Add shelf' }),
  'shelf-edit': (el) => {
    const list = shelfList(), sh = list.find((x) => x.id === el.dataset.id);
    if (!sh) return;
    D.openForm('Shelf', [{ k: 'name', label: 'Name', value: sh.name, required: true }], (v) => { sh.name = v.name; }, {
      submit: 'Save',
      // its books move to the first remaining shelf
      onDelete: list.length > 1 ? () => {
        S.settings.shelves = list.filter((x) => x !== sh);
        S.resources.forEach((r) => { if (r.type === 'book' && r.shelf === sh.id) r.shelf = S.settings.shelves[0].id; });
      } : null,
    });
  },
};
// show the book's own cover (PDF first page, EPUB cover image) or a cloth one, everywhere at once
async function setCover(r, own) {
  r.showCover = own; save();
  if (own && !r.cover && r.fileId) await makeCover(r);
  const html = coverFace(r, await coverUrl(r));
  document.querySelectorAll(`[data-cover="${r.id}"]`).forEach((el) => { el.innerHTML = html; });
  const board = R.r === r && (R.pages?.[0]?.querySelector('.board-face') || document.querySelector('.epub-cover .board-face'));
  if (board) board.innerHTML = html;
  // page 1 moves between the front board and the inside, so lay the book out again at the same page
  if (R.r === r && R.pdf) { R.skip = own && R.pdf.numPages > 1 ? 1 : 0; buildFlip(toIndex(r.page || 1)); }
  D.toast(own ? (r.cover ? 'Showing the book’s own cover' : 'This file has no cover image, so it keeps a cloth one') : 'Showing a cloth cover');
}
const CHANGES = {
  'lib-cover': (el) => { const r = S.resources.find((x) => x.id === el.dataset.id); if (r) setCover(r, el.value === 'own'); },
  'lib-file': (el) => { [...el.files].forEach((f) => addFile(f, el.dataset.where)); el.value = ''; },
  'rd-scrub': (el) => goTo(+el.value),
};
