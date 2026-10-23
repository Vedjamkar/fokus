// Turns a markdown note into a formatted study sheet: callouts, highlights, definition rows,
// clickable checklists, KaTeX math, and an optional Cornell layout.

const CALLOUT_ICONS = { note: '✎', tip: '★', warn: '!', exam: '◎', example: '→', summary: '≡' };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderNote(src, style = 'ruled') {
  // 1. Pull math out so markdown doesn't eat underscores and asterisks inside it.
  const math = [];
  let s = (src || '').replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => `@@M${math.push(m) - 1}@@`);

  // 2. House extensions: ==highlight== and "Term :: definition" rows.
  s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  s = s.replace(/^(?![\s>#|\-*\d])(.{1,80}?)\s::\s(.+)$/gm, (_, t, d) =>
    `<div class="defn"><dt>${window.marked.parseInline(t)}</dt><dd>${window.marked.parseInline(d)}</dd></div>\n`);

  let html = window.marked.parse(s, { gfm: true, breaks: false });
  html = html.replace(/@@M(\d+)@@/g, (_, i) => esc(math[+i]));
  html = window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

  const root = document.createElement('article');
  root.className = `sheet-note ${style}`;
  root.innerHTML = html;

  // 3. Callouts: > [!tip] Title
  root.querySelectorAll('blockquote').forEach((bq) => {
    const p = bq.querySelector('p');
    const m = p && p.innerHTML.match(/^\[!(\w+)\][ \t]*([^\n<]*)\n?/);
    if (!m) return;
    const kind = m[1].toLowerCase();
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.textContent.trim() && !p.querySelector('*')) p.remove();
    const box = document.createElement('div');
    box.className = `callout ${kind}`;
    box.innerHTML = `<div class="c-title"><span>${CALLOUT_ICONS[kind] || '•'}</span>${m[2] || kind[0].toUpperCase() + kind.slice(1)}</div>`;
    box.append(...bq.childNodes);
    bq.replaceWith(box);
  });

  // 4. Checklists become real checkboxes; data-i maps back to the nth "- [ ]" in the source.
  root.querySelectorAll('li > input[type=checkbox]').forEach((cb, i) => {
    cb.removeAttribute('disabled');
    cb.dataset.i = i;
    cb.dataset.act = 'note-task';
    const li = cb.parentElement;
    li.classList.add('task');
    if (cb.checked) li.classList.add('done');
    const span = document.createElement('span');
    span.append(...[...li.childNodes].filter((n) => n !== cb));
    li.append(span);
  });

  root.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });

  if (style === 'cornell') cornell(root);

  if (window.renderMathInElement) {
    window.renderMathInElement(root, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
      throwOnError: false,
    });
  }
  return root;
}

// Each ## heading becomes the cue for the notes under it; a [!summary] callout moves to the footer.
function cornell(root) {
  const nodes = [...root.childNodes];
  root.innerHTML = '';
  const top = el('div', 'cornell-top');
  let row = null;
  const summary = [];
  for (const n of nodes) {
    if (n.classList?.contains('summary')) { summary.push(n); continue; }
    if (n.tagName === 'H2') {
      row = el('div', 'cornell-row');
      const cue = el('div', 'cue'); cue.innerHTML = n.innerHTML;
      row.append(cue, el('div', 'cn-body'));
      root.append(row);
      continue;
    }
    (row ? row.lastChild : top).append(n);
  }
  if (top.textContent.trim()) root.prepend(top);
  const sum = el('div', 'cornell-sum');
  sum.innerHTML = '<div class="k">Summary</div>';
  if (summary.length) summary.forEach((c) => sum.append(...[...c.childNodes].slice(1)));
  else sum.insertAdjacentHTML('beforeend', '<p class="muted">Add a <code>&gt; [!summary]</code> callout to fill this box.</p>');
  root.append(sum);
}
const el = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };

export function toggleTask(src, index) {
  let n = -1;
  return src.replace(/^(\s*[-*+]\s+)\[([ xX])\]/gm, (m, pre, mark) => {
    n++;
    return n === index ? `${pre}[${mark === ' ' ? 'x' : ' '}]` : m;
  });
}
