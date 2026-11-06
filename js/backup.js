// Keeping your library safe. Books and uploads live in the browser's IndexedDB, which the browser
// may clear on its own. Three defences: ask for persistent storage, make backups that carry the files
// (a .zip: the data as JSON plus every stored file), and notice when files have gone missing.
import { S, save, replaceAll, putFile, getFile, fileKeys, checkFiles, todayISO } from './store.js';
import { loadZip } from './library.js';

const DAY = 864e5;
const mb = (n) => (n > 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1048576))} MB`);

// ---------------------------------------------------------------- persistent storage
// With this granted the browser won't clear our files to free space. Chrome decides quietly from how
// much you use the site; Firefox asks. Asked after the first import, when there's something to lose.
export async function protectStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}
let info = null;
async function readInfo() {
  try {
    const [persisted, est] = await Promise.all([navigator.storage?.persisted?.(), navigator.storage?.estimate?.()]);
    info = { persisted: !!persisted, usage: est?.usage || 0, quota: est?.quota || 0 };
  } catch { info = null; }
  return info;
}
function statusHTML(esc) {
  if (!info) return '<small class="muted">Storage status isn’t available in this browser.</small>';
  const used = info.usage ? `${mb(info.usage)} used${info.quota ? ` of about ${mb(info.quota)}` : ''}. ` : '';
  const last = S.settings.lastBackup ? `Last backup ${new Date(S.settings.lastBackup).toLocaleDateString()}.` : 'No backup yet.';
  return `<span class="store-dot ${info.persisted ? 'ok' : 'warn'}"></span><span>${info.persisted
    ? 'Protected: the browser won’t clear your library to free up space.'
    : 'Not protected: the browser may clear your books if the disk runs low.'} ${esc(used + last)}</span>
    ${info.persisted ? '' : '<button class="btn" data-act="protect-storage">Protect my library</button>'}`;
}
// fill the status line on the settings page (it's drawn empty, then updated once the browser answers)
export async function paintStatus(esc) {
  const el = document.getElementById('store-status');
  if (!el) return;
  await readInfo();
  const now = document.getElementById('store-status');
  if (now) now.innerHTML = statusHTML(esc);
}

// ---------------------------------------------------------------- backup and restore
// backup.zip: fokus.json (everything in S), manifest.json (the type of each file) and files/<key>.
// Files are stored uncompressed: PDFs, EPUBs and photos are compressed already.
export async function exportBackup(progress = () => {}) {
  const Z = await loadZip();
  const zip = new Z();
  const types = {};
  zip.file('fokus.json', JSON.stringify(S), { compression: 'DEFLATE' });
  const keys = await fileKeys();
  let n = 0;
  for (const key of keys) {
    const blob = await getFile(key).catch(() => null);
    if (blob) { types[key] = blob.type || ''; zip.file(`files/${encodeURIComponent(key)}`, blob, { compression: 'STORE' }); }
    progress(`Collecting files ${++n}/${keys.length}`);
  }
  zip.file('manifest.json', JSON.stringify({ app: 'fokus', format: 2, made: new Date().toISOString(), types }));
  let shown = -1;
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, (m) => {
    const p = Math.floor(m.percent / 10) * 10;
    if (p !== shown) { shown = p; progress(`Packing the backup ${p}%`); }
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = `fokus-backup-${todayISO()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  S.settings.lastBackup = Date.now(); save();
  return { files: Object.keys(types).length, size: out.size };
}
// takes a .zip made above, or an older .json backup (data only, no files)
export async function restoreBackup(file, progress = () => {}) {
  if (!/\.zip$/i.test(file.name) && !/zip/.test(file.type)) {
    const data = JSON.parse(await file.text());
    if (!data.subjects || !data.settings) throw new Error('not a backup');
    replaceAll(data);
    return { files: 0, lost: await checkFiles() };
  }
  const zip = await (await loadZip()).loadAsync(file);
  const raw = await (zip.file('fokus.json') || zip.file('study-haven.json'))?.async('string');
  if (!raw) throw new Error('not a backup');
  const data = JSON.parse(raw);
  if (!data.subjects || !data.settings) throw new Error('not a backup');
  const types = JSON.parse((await zip.file('manifest.json')?.async('string')) || '{}').types || {};
  replaceAll(data);
  const entries = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith('files/'));
  let n = 0;
  for (const f of entries) {
    const key = decodeURIComponent(f.name.slice(6));
    await putFile(key, new Blob([await f.async('arraybuffer')], { type: types[key] || '' }));
    progress(`Restoring files ${++n}/${entries.length}`);
  }
  return { files: entries.length, lost: await checkFiles() };
}

// ---------------------------------------------------------------- a gentle reminder
// Only if there's a library worth losing: once every two weeks, and not if you backed up recently.
export function nudge(toast) {
  const has = S.resources.some((r) => r.fileId);
  const now = Date.now(), st = S.settings;
  if (!has || now - (st.lastBackup || 0) < 30 * DAY || now - (st.nudgedAt || 0) < 14 * DAY) return;
  st.nudgedAt = now; save();
  setTimeout(() => toast('Your books live only in this browser. Settings → Your data → Export backup keeps a copy.'), 4000);
}
export const storageInfo = () => info;
export { statusHTML };
