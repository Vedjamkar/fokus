// Import study materials: drop files, a whole course folder, or paste links anywhere in the library.
// Everything lands in a review list first. Each item arrives with a type (textbook, slides, note,
// book) and a subject already guessed from its name, its folder and, for PDFs, the page shape
// (landscape pages are slides). You fix whatever's off, then one button files it all.
import { S, save, uid, putFile, subjectById } from './store.js';
import { readMeta, guessSubject, peekPdf, loadZip, shelfList } from './library.js';
import { protectStorage } from './backup.js';

let D; // helpers handed over by app.js: esc, ic, toast, closeModal
const modal = () => document.getElementById('modal');

const EXT = { pdf: 'pdf', epub: 'epub', docx: 'docx', pptx: 'pptx', md: 'text', markdown: 'text', txt: 'text', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image' };
const ACCEPT = '.pdf,.epub,.docx,.pptx,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp';
const MAX_FILE = 200 * 1024 * 1024, MAX_ITEMS = 150;
// which types each kind of source can become; the first is the default
const TYPES = {
  pdf: ['textbook', 'slides', 'book'], epub: ['textbook', 'book'], image: ['slides', 'textbook'],
  text: ['note'], docx: ['note'], pptx: ['note'], link: ['textbook', 'slides'],
};
const TYPE_NAME = { textbook: 'Textbook', slides: 'Slides', note: 'Note', book: 'Book for fun' };
const TYPE_ICON = { textbook: 'book', slides: 'slides', note: 'note', book: 'book' };
const TYPE_PLURAL = { textbook: 'textbooks', slides: 'slides', note: 'notes', book: 'books' };
const KIND_NAME = { pdf: 'PDF', epub: 'EPUB', image: 'Image', text: 'Text', docx: 'Word', pptx: 'PowerPoint', link: 'Link' };
const SLIDEY = /slides?|lecture|lec[\s_-]?\d|deck|week[\s_-]?\d|ppt|presentation/i;

// the review list lives here until you import or close the dialog
const ST = { open: false, items: [], notes: [], hint: {}, busy: false, subject: '' };

export function initImport(deps) {
  D = deps;
  return { ACTS, openImport, canDrop };
}

// ---------------------------------------------------------------- small helpers
const ext = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const cleanTitle = (name) => name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' – ').replace(/\s{2,}/g, ' ').trim();
const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(n > 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const subjLabel = (s) => (s.code ? `${s.code} · ${s.name}` : s.name);
const isDup = (name, size) => S.resources.some((r) => r.fileName === name && r.size === size)
  || ST.items.some((i) => i.file?.name === name && i.file.size === size);

function guessType(it) {
  const opts = TYPES[it.kind];
  if (opts.length === 1) return opts[0];
  const text = `${it.path || ''} ${it.file?.name || it.url || ''}`;
  if (it.kind === 'link') return /docs\.google\.com\/presentation|canva\.com|pitch\.com|slides\./i.test(it.url) ? 'slides' : 'textbook';
  if (opts.includes(ST.hint.type)) return ST.hint.type; // you started from the Slides or Textbooks tab
  if (SLIDEY.test(text)) return 'slides';
  if (it.kind === 'epub') return it.subjectId ? 'textbook' : 'book';
  return opts[0];
}

// ---------------------------------------------------------------- staging
async function stage(entries) {
  let unsupported = new Set(), tooBig = 0, dups = 0, cut = 0;
  for (const { file, path } of entries) {
    if (file.name.startsWith('.')) continue; // .DS_Store and friends
    const kind = EXT[ext(file.name)];
    if (!kind) { unsupported.add(ext(file.name) ? `.${ext(file.name)}` : file.name); continue; }
    if (file.size > MAX_FILE) { tooBig++; continue; }
    if (isDup(file.name, file.size)) { dups++; continue; }
    if (ST.items.length >= MAX_ITEMS) { cut++; continue; }
    const it = { id: uid(), kind, file, path: path || '', title: cleanTitle(file.name), typeSet: false };
    if (kind === 'text') {
      it.body = await file.text().catch(() => '');
      const h = it.body.match(/^\s*#\s+(.+)$/m);
      if (h) it.title = h[1].trim().slice(0, 120);
    }
    it.subjectId = ST.hint.subjectId || guessSubject(`${it.path} ${it.title}`);
    it.type = guessType(it);
    ST.items.push(it);
    if (kind === 'pdf') peekLater(it);
  }
  const say = (n, t) => n && ST.notes.push(t);
  say(unsupported.size, `Skipped ${[...unsupported].slice(0, 4).join(', ')}: ${/\.(doc|ppt|key|pages)\b/.test([...unsupported].join(' ')) ? 'save older Word, PowerPoint and Keynote files as PDF first' : 'FOKUS can’t read that kind of file yet'}.`);
  say(tooBig, `${tooBig} file${tooBig > 1 ? 's were' : ' was'} over 200 MB and skipped.`);
  say(dups, `${dups} already in your library, so left out.`);
  say(cut, `Only the first ${MAX_ITEMS} files were added. Import these, then drop the rest.`);
  paint();
}
// A landscape first page means slides. It's checked quietly after the list is up, and never
// overrides a type you chose (or one the file name already settled).
const peekQ = [];
let peeking = false;
function peekLater(it) {
  if (it.file.size > 80 * 1024 * 1024 || it.type !== TYPES.pdf[0] || ST.hint.type) return;
  peekQ.push(it);
  if (peeking) return;
  peeking = true;
  (async () => {
    while (peekQ.length) {
      const x = peekQ.shift();
      try {
        const { landscape } = await peekPdf(x.file);
        if (landscape && !x.typeSet && ST.items.includes(x)) { x.type = 'slides'; paint(); }
      } catch {}
    }
    peeking = false;
  })();
}
function stageLinks(text) {
  const urls = [...new Set(text.split(/[\s,]+/).filter((u) => /^https?:\/\/\S+/i.test(u)))];
  if (!urls.length) return D.toast('Paste a full link starting with https://');
  for (const url of urls) {
    if (S.resources.some((r) => r.url === url) || ST.items.some((i) => i.url === url)) { ST.notes.push('That link is already in your library.'); continue; }
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    const it = { id: uid(), kind: 'link', url, title: host, typeSet: false, subjectId: ST.hint.subjectId || '' };
    it.type = guessType(it);
    ST.items.push(it);
  }
  paint();
}

// ---------------------------------------------------------------- the dialog
function openImport(opts = {}) {
  Object.assign(ST, { open: true, items: [], notes: [], busy: false, hint: { type: opts.type || '', subjectId: opts.subjectId || '' } });
  peekQ.length = 0;
  const m = modal();
  m.innerHTML = '<div class="modal-box imp" role="dialog" aria-modal="true" aria-label="Import study materials"></div>';
  m.hidden = false;
  paint();
}
export const importing = () => ST.open && !modal().hidden && !!modal().querySelector('.imp');

function rowHTML(it, i) {
  const { esc, ic } = D;
  const opts = TYPES[it.kind];
  const meta = it.kind === 'link' ? esc(it.url) : `${KIND_NAME[it.kind]} · ${fmtSize(it.file.size)}${it.path ? ` · ${esc(it.path.replace(/\/$/, ''))}` : ''}`;
  return `<div class="imp-row" data-i="${i}">
    <span class="imp-ic t-${it.type}">${ic(TYPE_ICON[it.type])}</span>
    <div class="imp-main"><input class="imp-title" data-imp-title value="${esc(it.title)}" aria-label="Title" ${ST.busy ? 'disabled' : ''}><small class="ellip">${meta}</small></div>
    <div class="imp-pick">
      ${opts.length > 1 ? `<select data-imp-type aria-label="Type" ${ST.busy ? 'disabled' : ''}>${opts.map((t) => `<option value="${t}" ${t === it.type ? 'selected' : ''}>${TYPE_NAME[t]}</option>`).join('')}</select>` : `<span class="imp-fixed">${TYPE_NAME[it.type]}</span>`}
      ${it.type === 'book' ? `<span class="imp-fixed">on ${esc(shelfList()[0].name)}</span>` : `<select data-imp-subj aria-label="Subject" ${ST.busy ? 'disabled' : ''}><option value="">No subject</option>${S.subjects.map((s) => `<option value="${s.id}" ${s.id === it.subjectId ? 'selected' : ''}>${esc(subjLabel(s))}</option>`).join('')}</select>`}
    </div>
    <button type="button" class="imp-x" data-imp="remove" aria-label="Leave out ${esc(it.title)}" ${ST.busy ? 'disabled' : ''}>${ic('x', 14)}</button>
  </div>`;
}
function summary() {
  const c = {};
  ST.items.forEach((it) => { c[it.type] = (c[it.type] || 0) + 1; });
  return Object.entries(c).map(([t, n]) => `${n} ${n === 1 ? TYPE_NAME[t].toLowerCase().replace(' for fun', '') : TYPE_PLURAL[t]}`).join(', ');
}
function paint() {
  const box = modal().querySelector('.imp');
  if (!box || !ST.open) return;
  const { esc, ic } = D;
  const n = ST.items.length;
  const keep = { files: box.querySelector('[data-imp-files]'), dir: box.querySelector('[data-imp-dir]') }; // pickers keep their state
  const top = box.querySelector('.imp-list')?.scrollTop || 0;
  box.innerHTML = `<h3>Import study materials</h3>
    <label class="drop imp-drop" data-imp-drop for="imp-files">${ic('upload')}<span><b>Drop files or a whole folder here</b>, or click to choose.<br><small>PDF, EPUB, Word, PowerPoint, Markdown, text and images. Everything stays on this computer.</small></span>
      <input type="file" id="imp-files" multiple accept="${ACCEPT}" data-imp-files hidden></label>
    <div class="imp-tools">
      <label class="btn" for="imp-dir">${ic('layers')} Choose a folder<input type="file" id="imp-dir" webkitdirectory data-imp-dir hidden></label>
      <form class="row-input imp-link" data-imp-link><input placeholder="Or paste links (Google Slides, Drive, a course page)" aria-label="Paste links"><button class="pill accent">Add</button></form>
    </div>
    ${n ? `<div class="imp-bar"><span><b>${n}</b> ready · ${esc(summary())}</span>
      ${S.subjects.length ? `<label>Put everything in <select data-imp-all aria-label="Put everything in a subject"><option value="">Keep my sorting</option>${S.subjects.map((s) => `<option value="${s.id}">${esc(subjLabel(s))}</option>`).join('')}</select></label>` : ''}</div>
      <div class="imp-list">${ST.items.map(rowHTML).join('')}</div>` : ''}
    ${ST.notes.map((t) => `<p class="imp-note">${esc(t)}</p>`).join('')}
    ${n && !S.subjects.length ? '<p class="imp-note">Tip: add your subjects in Setup and imports will sort themselves by file and folder name.</p>' : ''}
    <div class="acts"><button type="button" class="btn ghost" data-act="m-close" ${ST.busy ? 'disabled' : ''}>Cancel</button><button type="button" class="btn primary" data-imp="go" ${n && !ST.busy ? '' : 'disabled'}>${ST.busy ? `Importing… ${ST.done || 0}/${n}` : n ? `Import ${n} item${n > 1 ? 's' : ''}` : 'Import'}</button></div>`;
  const list = box.querySelector('.imp-list'); if (list) list.scrollTop = top;
  void keep;
}

// ---------------------------------------------------------------- filing
// Word and PowerPoint files become notes: their text comes across as markdown, so it's searchable,
// editable and sits on the same study paper as notes you write yourself.
async function docxToMd(file) {
  const zip = await (await loadZip()).loadAsync(file);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('not a Word file');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const on = (el, tag) => { const e = el.getElementsByTagNameNS(W, tag)[0]; return !!e && !/^(0|false|none)$/.test(e.getAttributeNS(W, 'val') || ''); };
  const para = (p) => {
    let s = '';
    for (const r of p.getElementsByTagNameNS(W, 'r')) {
      let t = '';
      for (const c of r.children) t += c.localName === 't' ? c.textContent : c.localName === 'tab' ? ' ' : c.localName === 'br' ? '  \n' : '';
      if (!t.trim()) { s += t; continue; }
      const rp = r.getElementsByTagNameNS(W, 'rPr')[0];
      const lead = t.match(/^\s*/)[0], tail = t.match(/\s*$/)[0], core = t.trim();
      const mark = rp ? `${on(rp, 'b') ? '**' : ''}${on(rp, 'i') ? '*' : ''}` : '';
      s += `${lead}${mark}${core}${[...mark].reverse().join('')}${tail}`;
    }
    return s.replace(/\*\*\*\*/g, '').trim();
  };
  const out = [];
  for (const el of doc.getElementsByTagNameNS(W, 'body')[0]?.children || []) {
    if (el.localName === 'p') {
      const text = para(el);
      if (!text) { out.push(''); continue; }
      const style = el.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || '';
      const lvl = style.match(/^heading\s*(\d)/i);
      const numbered = el.getElementsByTagNameNS(W, 'numPr')[0];
      if (/^title$/i.test(style)) out.push(`# ${text}`);
      else if (lvl) out.push(`${'#'.repeat(Math.min(4, +lvl[1]))} ${text}`);
      else if (numbered) out.push(`${'  '.repeat(+(numbered.getElementsByTagNameNS(W, 'ilvl')[0]?.getAttributeNS(W, 'val') || 0))}- ${text}`);
      else out.push(text);
    } else if (el.localName === 'tbl') {
      const rows = [...el.getElementsByTagNameNS(W, 'tr')].map((tr) => [...tr.getElementsByTagNameNS(W, 'tc')].map((tc) => [...tc.getElementsByTagNameNS(W, 'p')].map(para).filter(Boolean).join(' ').replace(/\|/g, '/')));
      if (rows.length) out.push([`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n'));
    }
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').replace(/^(\s*- .*)\n\n(?=\s*- )/gm, '$1\n').trim(); // list items sit together
}
async function pptxToMd(file) {
  const zip = await (await loadZip()).loadAsync(file);
  const slides = Object.keys(zip.files).map((p) => p.match(/^ppt\/slides\/slide(\d+)\.xml$/)).filter(Boolean).sort((a, b) => a[1] - b[1]);
  if (!slides.length) throw new Error('not a PowerPoint file');
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const out = [];
  for (const [path, num] of slides) {
    const doc = new DOMParser().parseFromString(await zip.file(path).async('string'), 'application/xml');
    const lines = [...doc.getElementsByTagNameNS(A, 'p')].map((p) => [...p.getElementsByTagNameNS(A, 't')].map((t) => t.textContent).join('').trim()).filter(Boolean);
    out.push(`## ${num}. ${lines[0] || 'Slide'}`, ...lines.slice(1).map((l) => `- ${l}`));
  }
  return out.join('\n\n').replace(/\n\n- /g, '\n- ');
}

async function fileOne(it, at) {
  const r = { id: uid(), type: it.type, title: it.title.trim() || 'Untitled', author: '', subjectId: it.type === 'book' ? '' : it.subjectId || '', chapterId: '', url: '', body: '', page: 0, pages: 0, updated: at, status: 'later' };
  if (it.kind === 'link') r.url = it.url;
  else if (it.kind === 'text') r.body = it.body;
  else if (it.kind === 'docx' || it.kind === 'pptx') r.body = await (it.kind === 'docx' ? docxToMd : pptxToMd)(it.file);
  else {
    r.fileId = uid(); r.fileName = it.file.name; r.size = it.file.size; r.format = it.kind === 'epub' ? 'epub' : 'pdf';
    await putFile(r.fileId, it.file);
    if (it.kind === 'pdf' || it.kind === 'epub') {
      const edited = it.title.trim() !== cleanTitle(it.file.name), typed = r.title;
      await readMeta(r).catch(() => {}); // the file's own title, author, page count and cover
      if (edited) r.title = typed; // …unless you renamed it here
    }
  }
  if (it.type === 'book') r.shelf = shelfList()[0].id;
  S.resources.push(r);
  return r;
}
async function go() {
  if (ST.busy || !ST.items.length) return;
  ST.busy = true; ST.done = 0; paint();
  const made = [], failed = [];
  const now = Date.now();
  for (const [i, it] of ST.items.entries()) {
    try { made.push(await fileOne(it, now - i)); }
    catch (e) { console.warn('import', it.title, e); failed.push(it); }
    ST.done = i + 1;
    modal().querySelector('[data-imp="go"]').textContent = `Importing… ${ST.done}/${ST.items.length}`;
  }
  save();
  if (made.some((r) => r.fileId)) protectStorage(); // now there's something worth keeping
  ST.busy = false;
  if (failed.length) {
    ST.items = failed;
    ST.notes = [`${made.length ? `${made.length} imported. ` : ''}${failed.length} couldn’t be read or stored (a damaged file, or the browser is out of space). They’re left here to try again or remove.`];
    paint();
    D.render();
    return;
  }
  ST.open = false;
  D.closeModal();
  const tally = {};
  made.forEach((r) => { tally[r.type] = (tally[r.type] || 0) + 1; });
  const main = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
  const say = Object.entries(tally).map(([t, n]) => `${n} ${n === 1 ? TYPE_NAME[t].toLowerCase().replace(' for fun', '') : TYPE_PLURAL[t]}`).join(', ');
  D.toast(`Imported ${say}`);
  // land where most of it went: books and textbooks stand on the shelf
  const to = main === 'book' || main === 'textbook' ? '#/shelf' : `#/library/${main}`;
  if (location.hash === to) D.render(); else location.hash = to;
}

// ---------------------------------------------------------------- events
const ACTS = { 'imp-open': (el) => openImport({ type: el.dataset.type || '', subjectId: el.dataset.subject || '' }) };

const inBox = (e) => ST.open && !modal().hidden && e.target.closest?.('.imp');
const itemOf = (el) => ST.items[+el.closest('.imp-row')?.dataset.i];
document.addEventListener('click', (e) => {
  if (!inBox(e)) return;
  const b = e.target.closest('[data-imp]');
  if (!b) return;
  if (b.dataset.imp === 'go') go();
  if (b.dataset.imp === 'remove') { ST.items.splice(+b.closest('.imp-row').dataset.i, 1); paint(); }
});
document.addEventListener('input', (e) => {
  if (inBox(e) && e.target.matches('[data-imp-title]')) { const it = itemOf(e.target); if (it) it.title = e.target.value; }
});
document.addEventListener('change', async (e) => {
  if (!inBox(e)) return;
  const el = e.target;
  if (el.matches('[data-imp-files], [data-imp-dir]')) {
    const files = [...el.files].map((file) => ({ file, path: file.webkitRelativePath ? file.webkitRelativePath.replace(/[^/]*$/, '') : '' }));
    el.value = '';
    await stage(files);
  } else if (el.matches('[data-imp-type]')) { const it = itemOf(el); it.type = el.value; it.typeSet = true; paint(); }
  else if (el.matches('[data-imp-subj]')) { itemOf(el).subjectId = el.value; }
  else if (el.matches('[data-imp-all]')) { if (el.value) { ST.items.forEach((it) => { if (it.type !== 'book') it.subjectId = el.value; }); paint(); } }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest?.('[data-imp-link]');
  if (!f || !inBox(e)) return;
  e.preventDefault();
  const input = f.querySelector('input');
  const v = input.value.trim();
  if (v) { input.value = ''; stageLinks(v); }
});

// drag from the desktop: anywhere in the library opens the dialog, and the dialog takes drops too
const SHELF_ZONES = '[data-drop], [data-drop-studio], [data-drop-shelf]';
const canDrop = () => {
  if (importing()) return true;
  if (!modal().hidden) return false;
  const sheet = document.getElementById('sheet');
  return !!sheet && !sheet.hidden && !/^#\/(studio|settings|calendar|courses|read)/.test(location.hash);
};
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
let veil;
function showVeil(on) {
  if (!veil) {
    veil = document.createElement('div');
    veil.className = 'imp-veil';
    veil.hidden = true;
    veil.innerHTML = `<div>${D.ic('upload', 30)}<b>Drop to import</b><small>PDFs, EPUBs, notes, slides, or a whole folder</small></div>`;
    document.body.append(veil);
  }
  veil.hidden = !on;
}
document.addEventListener('dragenter', (e) => { if (hasFiles(e) && canDrop() && !importing()) showVeil(true); });
document.addEventListener('dragover', (e) => {
  if (!hasFiles(e) || !canDrop()) return;
  if (e.target.closest?.(SHELF_ZONES) && !importing()) return; // a shelf or a replace-file slot takes its own drops
  e.preventDefault();
});
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) showVeil(false); });
document.addEventListener('dragend', () => showVeil(false));
document.addEventListener('drop', async (e) => {
  showVeil(false);
  if (!hasFiles(e) || !canDrop()) return;
  if (e.target.closest?.(SHELF_ZONES) && !importing()) return;
  e.preventDefault();
  const items = [...(e.dataTransfer.items || [])].filter((i) => i.kind === 'file');
  const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean); // must be read before any await
  const plain = [...e.dataTransfer.files].map((file) => ({ file, path: '' }));
  const hint = { type: /^#\/library\/(textbook|slides)$/.exec(location.hash)?.[1] || '' };
  if (!importing()) openImport({ ...hint, subjectId: /^#\/s\/([^/]+)/.exec(location.hash)?.[1] || '' });
  const out = [];
  const walk = async (en, dir) => {
    if (en.isFile) out.push({ file: await new Promise((res, rej) => en.file(res, rej)), path: dir });
    else if (en.isDirectory) {
      const rd = en.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => rd.readEntries(res, rej));
        if (!batch.length) break;
        for (const c of batch) await walk(c, `${dir}${en.name}/`);
      }
    }
  };
  try { await Promise.all(entries.map((en) => walk(en, ''))); } catch { out.length = 0; }
  await stage(out.length ? out : plain);
});
