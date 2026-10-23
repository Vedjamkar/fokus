// All app data lives in one JSON object in localStorage; uploaded PDFs live in IndexedDB.
// Progress is never stored: it is always computed from topic `done` flags.

const KEY = 'studyhaven:v1';
export const uid = () => Math.random().toString(36).slice(2, 10);

export const iso = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
export const todayISO = () => iso(new Date());
export const addDays = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return iso(d); };
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export const DEFAULT_SETTINGS = {
  appName: 'Study Haven',
  tagline: 'Every lecture, note and deadline in one quiet place.',
  scene: 'aurora', font: 'default', noteStyle: 'ruled', quotes: true,
  termStart: addDays(-45), termEnd: addDays(67),
  focus: { work: 25, short: 5, long: 15, every: 4, autoBreak: true, autoFocus: false },
  chime: true,
  accent: '', stickers: true, userName: '', clock24: false, dim: 25,
  // background per mode; each is { type: gradient | image | youtube | video | file, value, label?, credit? }
  bgSame: false,
  bg: {
    home: { type: 'gradient', value: 'twilight' },
    focus: { type: 'gradient', value: 'twilight' },
    ambient: { type: 'youtube', value: 'rFZHOHl-L8A', label: 'Lofi Girl study room' },
  },
};

export const PRESETS = [
  { url: 'https://www.youtube.com/watch?v=rFZHOHl-L8A', title: 'lofi hip hop radio – beats to relax/study to', by: 'Lofi Girl' },
  { url: 'https://www.youtube.com/watch?v=T_O_UWkRds4', title: 'Bollywood Hindi Lofi – 1 hour to study', by: 'Editor Soumya' },
  { url: 'https://www.youtube.com/watch?v=E2vONfzoyRI', title: 'jazz lofi radio – beats to chill/study to', by: 'Lofi Girl' },
  { url: 'https://www.youtube.com/watch?v=NJuSStkIZBg', title: 'Rainy Jazz Cafe – slow jazz for study', by: 'Coffee Shop Vibes' },
  { url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY', title: 'synthwave radio – beats to chill/game to', by: 'Lofi Girl' },
  { url: 'https://www.youtube.com/watch?v=WvkJlGtRWU8', title: 'Rain sounds for focus – no music', by: 'Driftwood Dreams' },
];

// [unitName, [[chapterName, [topic, ...]], ...]] — a topic name ending in ✓ starts done.
function subject(name, code, color, tree, extra = {}) {
  return {
    id: uid(), name, code, color, cover: '', example: true, ...extra,
    units: tree.map(([un, chs]) => ({
      id: uid(), name: un,
      chapters: chs.map(([cn, tps]) => ({
        id: uid(), name: cn,
        topics: tps.map((t) => ({ id: uid(), name: t.replace(/ ✓$/, ''), done: t.endsWith(' ✓') })),
      })),
    })),
  };
}

function seed() {
  const la = subject('Linear Algebra', 'MATH 221', '#8b6cf0', [
    ['Unit 1 · Systems & Matrices', [
      ['Ch 1 · Linear systems', ['Gaussian elimination ✓', 'Row echelon form ✓', 'Solution sets ✓']],
      ['Ch 2 · Matrix algebra', ['Matrix multiplication ✓', 'Inverses ✓', 'LU factorization']],
    ]],
    ['Unit 2 · Vector Spaces', [
      ['Ch 3 · Subspaces', ['Span ✓', 'Null & column space', 'Basis & dimension']],
      ['Ch 4 · Eigen theory', ['Eigenvalues', 'Diagonalization', 'Complex eigenvalues']],
    ]],
  ]);
  const oc = subject('Organic Chemistry', 'CHEM 210', '#4fb3a9', [
    ['Unit 1 · Structure', [
      ['Ch 1 · Bonding', ['Hybridization ✓', 'Resonance ✓', 'Formal charge ✓']],
      ['Ch 2 · Stereochemistry', ['Chirality ✓', 'R/S naming', 'Fischer projections']],
    ]],
    ['Unit 2 · Reactions', [
      ['Ch 3 · Substitution', ['SN1', 'SN2', 'Leaving groups']],
      ['Ch 4 · Elimination', ['E1', 'E2', "Zaitsev's rule"]],
    ]],
  ]);
  const cp = subject('Cognitive Psychology', 'PSYC 230', '#e0876a', [
    ['Unit 1 · Perception & Attention', [
      ['Ch 1 · Attention', ['Selective attention ✓', 'Inattentional blindness ✓', 'Divided attention ✓']],
      ['Ch 2 · Perception', ['Gestalt principles ✓', 'Top-down processing']],
    ]],
    ['Unit 2 · Memory', [
      ['Ch 3 · Memory systems', ['Working memory model', 'Encoding specificity', 'Spacing effect']],
    ]],
  ]);
  const ch = (s, u, c) => s.units[u].chapters[c].id;

  const lectures = [
    { id: uid(), subjectId: la.id, days: [1, 3, 5], start: '09:00', end: '09:50', room: 'Hall B · 104', example: true },
    { id: uid(), subjectId: oc.id, days: [2, 4], start: '11:00', end: '12:15', room: 'Science 2 · 210', example: true },
    { id: uid(), subjectId: cp.id, days: [1, 3], start: '14:00', end: '15:15', room: 'Arts 3 · 015', example: true },
  ];

  const due = [
    { title: 'Problem set 5 — eigenvalues', subjectId: la.id, date: addDays(-1), priority: 'high', kind: 'Assignment' },
    { title: 'Lab report: SN1 vs SN2 rates', subjectId: oc.id, date: addDays(0), priority: 'high', kind: 'Lab' },
    { title: 'Read ch. 3 (memory systems)', subjectId: cp.id, date: addDays(0), priority: 'med', kind: 'Reading' },
    { title: 'Quiz: stereochemistry', subjectId: oc.id, date: addDays(1), priority: 'med', kind: 'Quiz' },
    { title: 'Midterm review sheet', subjectId: la.id, date: addDays(3), priority: 'high', kind: 'Exam prep' },
    { title: 'Attention essay draft', subjectId: cp.id, date: addDays(5), priority: 'low', kind: 'Essay' },
    { title: 'Midterm exam', subjectId: la.id, date: addDays(9), priority: 'high', kind: 'Exam' },
  ].map((d) => ({ id: uid(), done: false, example: true, ...d }));

  const now = Date.now();
  const resources = [
    { type: 'textbook', title: 'Linear Algebra and Its Applications (Lay), 6e', subjectId: la.id, chapterId: ch(la, 1, 1), url: '', author: 'David C. Lay', page: 212, pages: 576 },
    { type: 'textbook', title: 'Organic Chemistry (Klein), 4e', subjectId: oc.id, chapterId: ch(oc, 1, 0), url: '', author: 'David Klein', page: 288, pages: 1312 },
    { type: 'textbook', title: 'Cognitive Psychology (Goldstein)', subjectId: cp.id, chapterId: ch(cp, 1, 0), url: '', author: 'E. Bruce Goldstein', page: 160, pages: 480 },
    { type: 'slides', title: 'Week 7 — Eigenvectors', subjectId: la.id, chapterId: ch(la, 1, 1), url: '', page: 18, pages: 42 },
    { type: 'slides', title: 'Lecture 12 — Nucleophilic substitution', subjectId: oc.id, chapterId: ch(oc, 1, 0), url: '', page: 0, pages: 56 },
    { type: 'slides', title: 'Lecture 9 — Working memory', subjectId: cp.id, chapterId: ch(cp, 1, 0), url: '', page: 31, pages: 31 },
    { type: 'note', title: 'Eigenvalues — the big picture', subjectId: la.id, chapterId: ch(la, 1, 1), body: NOTE_EIGEN },
    { type: 'note', title: 'SN1 vs SN2 cheat sheet', subjectId: oc.id, chapterId: ch(oc, 1, 0), body: NOTE_SN },
    { type: 'note', title: 'Baddeley’s working memory model', subjectId: cp.id, chapterId: ch(cp, 1, 0), body: NOTE_WM, style: 'cornell' },
  ].map((r, i) => ({ id: uid(), example: true, updated: now - i * 3.6e6 * 7, body: '', ...r }));

  const courses = [
    { title: 'MIT 18.06 Linear Algebra (Strang)', provider: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/', subjectId: la.id, done: 14, total: 34 },
    { title: 'Organic chemistry', provider: 'Khan Academy', url: 'https://www.khanacademy.org/science/organic-chemistry', subjectId: oc.id, done: 9, total: 40 },
    { title: 'Essence of linear algebra', provider: '3Blue1Brown', url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab', subjectId: la.id, done: 11, total: 16 },
  ].map((c) => ({ id: uid(), example: true, ...c }));

  const embeds = [
    { title: 'Desmos graphing calculator', url: 'https://www.desmos.com/calculator', subjectId: la.id, home: true },
    { title: 'Essence of linear algebra, ch. 14', url: 'https://www.youtube.com/watch?v=PFDu9oVAE-g', subjectId: la.id, home: false },
  ].map((e) => ({ id: uid(), example: true, ...e }));

  // A believable week of focus history so the stats widgets aren't blank.
  const sessions = [];
  [[0, 2], [1, 3], [2, 1], [3, 4], [4, 2], [5, 0], [6, 3]].forEach(([back, n]) => {
    for (let i = 0; i < n; i++) {
      const s = [la, oc, cp][(back + i) % 3];
      sessions.push({ id: uid(), subjectId: s.id, min: 25, at: now - back * 864e5 - i * 36e5 - 2 * 36e5, example: true });
    }
  });

  return {
    v: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    subjects: [la, oc, cp],
    lectures, due, resources, courses, embeds, sessions,
    music: { saved: PRESETS.map((p) => ({ id: uid(), ...p })), volume: 60, last: null },
    stickers: [],
    stickerPack: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = { ...structuredClone(DEFAULT_SETTINGS), ...s.settings, focus: { ...DEFAULT_SETTINGS.focus, ...(s.settings?.focus || {}) }, bg: { ...structuredClone(DEFAULT_SETTINGS.bg), ...(s.settings?.bg || {}) } };
      for (const k of ['subjects', 'lectures', 'due', 'resources', 'courses', 'embeds', 'sessions']) s[k] ||= [];
      s.music ||= { saved: [], volume: 60 };
      s.stickers ||= []; s.stickerPack ||= [];
      return s;
    }
  } catch (e) { console.warn('Could not read saved data', e); }
  return seed();
}

export const S = {}; // filled at the bottom of this file, after the example notes exist
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('Could not save', e); }
}
export function replaceAll(next) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, next);
  save();
}
export function resetToExamples() { replaceAll(seed()); }
export function clearExamples() {
  for (const k of ['subjects', 'lectures', 'due', 'resources', 'courses', 'embeds', 'sessions', 'stickers']) S[k] = S[k].filter((x) => !x.example);
  const ids = new Set(S.subjects.map((s) => s.id));
  S.resources.forEach((r) => { if (!ids.has(r.subjectId)) r.subjectId = ''; });
  save();
}
export const hasExamples = () => ['subjects', 'due', 'resources'].some((k) => S[k].some((x) => x.example));

// ---------- tree helpers ----------
export const subjectById = (id) => S.subjects.find((s) => s.id === id);
export function topicsIn(node) {
  if (!node) return [];
  if (node.topics) return node.topics;
  if (node.chapters) return node.chapters.flatMap((c) => c.topics);
  if (node.units) return node.units.flatMap((u) => u.chapters.flatMap((c) => c.topics));
  return [];
}
export function pct(node) {
  const t = topicsIn(node);
  return t.length ? Math.round((100 * t.filter((x) => x.done).length) / t.length) : 0;
}
export function counts(node) {
  const t = topicsIn(node);
  return { done: t.filter((x) => x.done).length, total: t.length };
}
export function findNode(id) {
  for (const s of S.subjects) {
    if (s.id === id) return { node: s, kind: 'subject', subject: s };
    for (const u of s.units) {
      if (u.id === id) return { node: u, kind: 'unit', subject: s, parent: s.units };
      for (const c of u.chapters) {
        if (c.id === id) return { node: c, kind: 'chapter', subject: s, unit: u, parent: u.chapters };
        for (const t of c.topics) if (t.id === id) return { node: t, kind: 'topic', subject: s, unit: u, chapter: c, parent: c.topics };
      }
    }
  }
  return null;
}
export const chaptersOf = (s) => (s ? s.units.flatMap((u) => u.chapters.map((c) => ({ ...c, unit: u.name }))) : []);

// ---------- uploaded files (IndexedDB) ----------
let dbp;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('studyhaven-files', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('files');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('files', mode);
    const req = fn(t.objectStore('files'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
};
export const putFile = (id, blob) => tx('readwrite', (st) => st.put(blob, id));
export const getFile = (id) => tx('readonly', (st) => st.get(id));
export const delFile = (id) => tx('readwrite', (st) => st.delete(id));

// ---------- example notes ----------
const NOTE_EIGEN = `# Eigenvalues — the big picture

An eigenvector is a direction the matrix only **stretches**, never turns.

Eigenvector :: a nonzero $v$ with $Av = \\lambda v$
Eigenvalue :: the stretch factor $\\lambda$ for that direction
Characteristic polynomial :: $\\det(A - \\lambda I) = 0$, whose roots are the eigenvalues

## How to find them
1. Solve $\\det(A - \\lambda I) = 0$ for $\\lambda$.
2. For each $\\lambda$, find the null space of $A - \\lambda I$.
3. Those null-space vectors are the ==eigenvectors== for that $\\lambda$.

$$A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix} \\Rightarrow \\lambda^2 - 4\\lambda + 3 = 0 \\Rightarrow \\lambda = 1, 3$$

> [!tip] Shortcut
> Trace $= \\lambda_1 + \\lambda_2$ and determinant $= \\lambda_1 \\lambda_2$. Check your answer in five seconds.

> [!exam] Likely on the midterm
> Diagonalize a 2×2 and use it to compute $A^{10}$.

## To do
- [x] Watch 3Blue1Brown ch. 14
- [ ] Lay §5.1 exercises 1–15 (odd)
- [ ] Redo PS5 Q3 without notes
`;

const NOTE_SN = `# SN1 vs SN2

| | SN1 | SN2 |
|---|---|---|
| Steps | 2 (carbocation) | 1 (concerted) |
| Rate law | $k[\\text{RX}]$ | $k[\\text{RX}][\\text{Nu}^-]$ |
| Substrate | 3° > 2° | methyl > 1° > 2° |
| Solvent | polar **protic** | polar **aprotic** |
| Stereo | racemization | ==inversion== (Walden) |

> [!note] Mnemonic
> SN**2** → **2** molecules in the rate-determining step.

Leaving group :: weak bases leave best: I⁻ > Br⁻ > Cl⁻ ≫ F⁻
Nucleophile :: strong, unhindered Nu⁻ pushes toward SN2

> [!warn] Common trap
> A 2° substrate can go either way. Decide on solvent and nucleophile, not the substrate.
`;

const NOTE_WM = `Lecture 9 · Baddeley & Hitch (1974)

## What is working memory?
A limited-capacity system that **holds and manipulates** information for a few seconds. It replaced the single "short-term store".

## The four parts
- **Phonological loop**: inner voice + inner ear
- **Visuospatial sketchpad**: mental imagery
- **Central executive**: attention controller, with no storage of its own
- **Episodic buffer** (added in 2000): links WM with long-term memory

## Evidence
Word-length effect :: shorter words are recalled better because they fit the loop
Articulatory suppression :: saying "the the the" wipes out the word-length effect
Dual-task studies :: two visual tasks interfere; one verbal + one visual barely do

## Exam questions
- [ ] Why is the central executive called a "homunculus problem"?
- [ ] Design a dual-task experiment that separates the loop from the sketchpad

> [!summary] Summary
> Working memory is a multi-part system. Separate stores explain why some task pairs interfere and others don't.
`;

Object.assign(S, load());
