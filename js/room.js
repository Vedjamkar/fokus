// The study room: a low-poly isometric diorama (after the Dribbble "isometric study room" pieces).
// Every object is a door into the app; app.js decides what a pick does via opts.onPick(id, data).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as SND from './sounds.js';
import * as VIZ from './visualiser.js';

const LABELS = {
  laptop: 'Notes', shelf: 'Textbooks & slides', book: 'Subject', calendar: 'Calendar', board: 'What’s due',
  clock: 'Start / pause timer', record: 'Music', window: 'Change the weather', lamp: 'Lamp', plant: 'Your streak plant',
  mug: 'Tea', cat: 'Mochi the cat', poster: 'Aesthetic studio', frame: 'Your poster · click to change', lights: 'Fairy lights', chair: 'Sit down to focus', friend: 'Friend',
  yarn: 'Throw the yarn', globe: 'Spin the globe', cradle: 'Newton’s cradle', chime: 'Wind chime', speaker: 'Visualiser · music',
};

export async function mountRoom(host, opts) {
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, W() / H(), 0.1, 200);
  camera.position.set(19, 15, 19);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.3, -0.2);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 13; controls.maxDistance = 40;
  controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.32;
  controls.minAzimuthAngle = 0.12; controls.maxAzimuthAngle = 1.45;
  controls.update();
  const home = { pos: camera.position.clone(), target: controls.target.clone() };

  // ---------- helpers
  const pickables = [];
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02, ...o });
  function box(w, h, d, m, r = 0.06) { const g = r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d); const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; return me; }
  function cyl(rt, rb, h, m, seg = 24) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.castShadow = me.receiveShadow = true; return me; }
  function at(o, x, y, z) { o.position.set(x, y, z); return o; }
  function pick(group, id, data = {}) {
    group.traverse((o) => {
      if (!o.isMesh || !o.material || o.material.isMeshBasicMaterial || o.material.userData.own) return;
      const c = o.material.clone(); c.userData = { own: true, src: o.material }; o.material = c;
    });
    group.userData.pick = { id, data }; pickables.push(group); return group;
  }
  // after a theme change, copy shared colours onto each object's own copies
  function syncOwn() { scene.traverse((o) => { const m = o.isMesh && o.material; if (m?.userData?.src) { m.color.copy(m.userData.src.color); } }); }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const redraw = (...a) => { g.clearRect(0, 0, w, h); draw(g, w, h, ...a); tex.needsUpdate = true; };
    redraw();
    return { tex, redraw, canvas: c };
  }
  const font = (wt, px) => `${wt} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const hand = (px) => `600 ${px}px Caveat, "Bradley Hand", cursive`;
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  let S = opts.state;
  let C = S.custom || {};
  const accent = () => new THREE.Color(S.accent || '#6c47ff');

  // ---------- light
  const hemi = new THREE.HemisphereLight(0x8f7cff, 0x3a2a40, 0.95); scene.add(hemi);
  // soft warm fill from the room side so the floor and corners never sink into black
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.55); fill.position.set(12, 9, 14); scene.add(fill);
  const moon = new THREE.DirectionalLight(0xaab8ff, 1.15);
  moon.position.set(4, 14, 10); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -9; moon.shadow.camera.right = 9; moon.shadow.camera.top = 9; moon.shadow.camera.bottom = -9; moon.shadow.bias = -0.0005; moon.shadow.radius = 4;
  scene.add(moon);
  const windowGlow = new THREE.PointLight(0x9fb4ff, 6, 9, 2); at(windowGlow, 0, 4.4, -3.8); scene.add(windowGlow);

  // ---------- shell
  const FLOORS = { oak: ['#5a3d2c', '#62432f', '#563a2a'], walnut: ['#33211a', '#3b271d', '#2e1e17'], birch: ['#b48a5f', '#bf9668', '#a98156'], grey: ['#4d4e57', '#55565f', '#484951'], carpet: ['#3a3348', '#3a3348', '#3a3348'] };
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    const [a, b, c] = FLOORS[C.floor] || FLOORS.oak;
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    if (C.floor === 'carpet') { for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } return; }
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : c; g.fillRect(0, i * 64, w, 62); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * 64 + 62, w, 2); for (let k = 0; k < 3; k++) { g.fillRect(((i * 137 + k * 211) % 512), i * 64, 2, 62); } }
  });
  const floor = box(10, 0.5, 10, mat(0xffffff, { map: floorTex.tex }), 0.04); at(floor, 0, -0.25, 0); scene.add(floor);
  const wallMat = mat(0x2c2540);
  const backWall = box(10, 7.5, 0.35, wallMat, 0.03); at(backWall, 0, 3.75, -5.17); scene.add(backWall);
  const leftWall = box(0.35, 7.5, 10, wallMat, 0.03); at(leftWall, -5.17, 3.75, 0); scene.add(leftWall);
  const trim = mat(0x3a3150);
  scene.add(at(box(10, 0.3, 0.12, trim, 0.02), 0, 0.15, -4.95), at(box(0.12, 0.3, 10, trim, 0.02), -4.95, 0.15, 0));
  // floating base under the diorama
  const base = box(10.6, 0.5, 10.6, mat(0x15121f), 0.12); at(base, 0, -0.75, 0); scene.add(base);

  // ---------- window with sky, weather and curtains
  const sky = canvasTex(512, 384, (g, w, h) => {
    const hr = new Date().getHours();
    const phase = C.time && C.time !== 'auto' ? C.time : hr < 6 || hr >= 19 ? 'night' : (hr >= 17 || hr < 8) ? 'sunset' : 'day';
    const night = phase === 'night', dusk = phase === 'sunset', dawn = false;
    const grd = g.createLinearGradient(0, 0, 0, h);
    if (night) { grd.addColorStop(0, '#070a1f'); grd.addColorStop(1, '#2b2266'); }
    else if (dusk || dawn) { grd.addColorStop(0, '#3b2a7a'); grd.addColorStop(0.6, '#e0725f'); grd.addColorStop(1, '#f6b98a'); }
    else { grd.addColorStop(0, '#5aa0e8'); grd.addColorStop(1, '#c9e4ff'); }
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    if (night) { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; g.fillRect(Math.random() * w, Math.random() * h * 0.7, 2, 2); } g.fillStyle = '#fff3cf'; g.shadowColor = '#fff3cf'; g.shadowBlur = 30; g.beginPath(); g.arc(w * 0.72, h * 0.25, 26, 0, 7); g.fill(); g.shadowBlur = 0; }
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const dark = night ? '#0b0b1c' : dusk ? '#3a2240' : '#5f7899';
    const view = C.view || 'city';
    if (view === 'city') {
      g.fillStyle = dark; let x = 0;
      while (x < w) { const bw = 30 + rnd() * 50, bh = 60 + rnd() * 140; g.fillRect(x, h - bh, bw, bh); if (night) { g.fillStyle = '#ffd88a'; for (let y = h - bh + 10; y < h - 8; y += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (rnd() < 0.25) g.fillRect(wx, y, 5, 6); g.fillStyle = dark; } x += bw + 4; }
    } else if (view === 'forest') {
      [[0.55, 0.8], [0.75, 1]].forEach(([top, shade], li) => {
        g.fillStyle = li ? dark : (night ? '#141432' : dusk ? '#5a3050' : '#7d98b0');
        for (let x = -20; x < w + 20; x += 26 + rnd() * 18) { const th = h * (0.25 + rnd() * 0.3) * shade, base = h; g.beginPath(); g.moveTo(x, base); g.lineTo(x + 22, base - th - h * (1 - top) * 0.2); g.lineTo(x + 44, base); g.fill(); }
      });
    } else if (view === 'beach') {
      g.fillStyle = night ? '#101a3a' : dusk ? '#7a3f6a' : '#3f8fd0'; g.fillRect(0, h * 0.62, w, h * 0.22);
      g.fillStyle = night ? 'rgba(255,243,207,.25)' : 'rgba(255,255,255,.35)'; for (let i = 0; i < 18; i++) g.fillRect(rnd() * w, h * 0.64 + rnd() * h * 0.18, 30 + rnd() * 40, 2);
      g.fillStyle = night ? '#2a2236' : dusk ? '#c98b6a' : '#ecd3a0'; g.fillRect(0, h * 0.84, w, h * 0.16);
    } else if (view === 'mountains') {
      [[0.35, night ? '#1a1a3a' : dusk ? '#6a3a5e' : '#8aa2c0'], [0.55, dark]].forEach(([top, col]) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 64) g.lineTo(x, h * top + rnd() * h * 0.25);
        g.lineTo(w, h); g.fill();
      });
      if (!night) { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(180, h * 0.42); g.lineTo(200, h * 0.36); g.lineTo(222, h * 0.43); g.fill(); }
    }
  });
  const win = new THREE.Group(); at(win, 0, 4.75, -4.98);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7), new THREE.MeshBasicMaterial({ map: sky.tex, toneMapped: false }));
  win.add(glass);
  const frameM = mat(0xe8e1d6, { roughness: 0.5 });
  win.add(at(box(3.9, 0.16, 0.18, frameM, 0.03), 0, 1.42, 0.05), at(box(3.9, 0.16, 0.18, frameM, 0.03), 0, -1.42, 0.05), at(box(0.16, 2.9, 0.18, frameM, 0.03), -1.87, 0, 0.05), at(box(0.16, 2.9, 0.18, frameM, 0.03), 1.87, 0, 0.05), at(box(0.08, 2.7, 0.1, frameM, 0.02), 0, 0, 0.04), at(box(3.6, 0.08, 0.1, frameM, 0.02), 0, 0.1, 0.04));
  win.add(at(box(4.3, 0.14, 0.6, frameM, 0.04), 0, -1.55, 0.25));
  const curtainM = mat(0x6c47ff, { roughness: 0.95 });
  const curtL = new THREE.Group(), curtR = new THREE.Group();
  for (let i = 0; i < 4; i++) { curtL.add(at(cyl(0.12, 0.14, 3.4, curtainM, 10), -2.35 + i * 0.16, 0, 0.25)); curtR.add(at(cyl(0.12, 0.14, 3.4, curtainM, 10), 1.87 + i * 0.16, 0, 0.25)); }
  win.add(curtL, curtR, at(cyl(0.05, 0.05, 5.2, mat(0x2a2233), 8).rotateZ(Math.PI / 2), 0, 1.75, 0.3));
  scene.add(pick(win, 'window'));
  // weather particles live just inside the glass
  const N = 420;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 3.5; pos[i * 3 + 1] = (Math.random() - 0.5) * 2.6; pos[i * 3 + 2] = 0.01; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.05, transparent: true, opacity: 0.75, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat); win.add(particles);

  // ---------- desk, laptop, lamp, mug
  const wood = mat(0x8a5a3b, { roughness: 0.6 });
  const desk = new THREE.Group(); at(desk, 0, 0, -3.9);
  desk.add(at(box(4.6, 0.18, 1.9, wood, 0.05), 0, 2.4, 0));
  [[-2.1, -0.75], [2.1, -0.75], [-2.1, 0.75], [2.1, 0.75]].forEach(([x, z]) => desk.add(at(box(0.16, 2.35, 0.16, wood, 0.03), x, 1.17, z)));
  desk.add(at(box(1.4, 0.9, 1.6, mat(0x6e4630), 0.05), 1.3, 1.6, 0));
  scene.add(desk);
  // laptop + screen texture showing the current task
  const screen = canvasTex(512, 320, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#1b1640'); grd.addColorStop(1, S.accent || '#6c47ff');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = font(700, 30); g.fillText('study haven', 28, 54);
    g.font = font(600, 22); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('NOW', 28, 120);
    g.fillStyle = '#fff'; g.font = font(700, 34);
    const t = S.task || 'Pick something to focus on';
    wrap(g, t, 28, 162, w - 56, 40, 3);
    g.font = font(500, 20); g.fillStyle = 'rgba(255,255,255,.65)'; g.fillText('Click to open your notes', 28, h - 28);
  });
  function wrap(g, text, x, y, maxW, lh, maxLines) {
    const words = text.split(' '); let line = '', n = 0;
    for (const wd of words) { const test = line ? `${line} ${wd}` : wd; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = wd; if (++n >= maxLines - 1) { line = `${line}…`; break; } } else line = test; }
    g.fillText(line, x, y);
  }
  const laptop = new THREE.Group(); at(laptop, -0.1, 2.49, -3.75);
  const shell = mat(0xc9c6d4, { metalness: 0.4, roughness: 0.35 });
  laptop.add(at(box(1.9, 0.08, 1.25, shell, 0.04), 0, 0, 0.15));
  laptop.add(at(box(1.6, 0.02, 0.55, mat(0x2b2838), 0.01), 0, 0.05, 0.2));
  const lid = new THREE.Group(); at(lid, 0, 0.04, -0.45); lid.rotation.x = -0.25;
  lid.add(at(box(1.9, 1.25, 0.06, shell, 0.04), 0, 0.62, 0));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 1.08), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false })); at(scr, 0, 0.63, 0.035); lid.add(scr);
  laptop.add(lid);
  scene.add(pick(laptop, 'laptop'));
  const screenGlow = new THREE.PointLight(0x8f7cff, 2.2, 4, 2); at(screenGlow, -0.1, 3.3, -3.2); scene.add(screenGlow);
  // desk lamp
  const lamp = new THREE.Group(); at(lamp, -1.75, 2.49, -4.25);
  const lampM = mat(0x2b2838, { metalness: 0.3, roughness: 0.4 });
  lamp.add(at(cyl(0.35, 0.4, 0.1, lampM), 0, 0.05, 0));
  const arm = at(cyl(0.05, 0.05, 1.5, lampM, 8), 0.2, 0.75, 0.1); arm.rotation.z = -0.25; lamp.add(arm);
  const shadeM = mat(0xf0c06a, { emissive: 0xffb35c, emissiveIntensity: 1.2 });
  const shade = at(cyl(0.18, 0.45, 0.45, mat(0x2b2838), 20), 0.55, 1.5, 0.25); shade.rotation.z = 0.6; lamp.add(shade);
  const bulb = at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), shadeM), 0.68, 1.36, 0.28); lamp.add(bulb);
  const lampLight = new THREE.PointLight(0xffb36b, 14, 9, 1.6); at(lampLight, 0.7, 1.3, 0.4); lampLight.castShadow = true; lampLight.shadow.mapSize.set(1024, 1024); lampLight.shadow.bias = -0.002; lamp.add(lampLight);
  scene.add(pick(lamp, 'lamp'));
  // mug with steam
  const mug = new THREE.Group(); at(mug, 1.45, 2.49, -3.45);
  mug.add(at(cyl(0.2, 0.18, 0.4, mat(0xf2ede6, { roughness: 0.3 })), 0, 0.2, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 16), mat(0xf2ede6)); at(handle, 0.22, 0.22, 0); handle.rotation.y = Math.PI / 2; mug.add(handle);
  mug.add(at(cyl(0.17, 0.17, 0.02, mat(0x7a4a2a)), 0, 0.38, 0));
  const steam = [];
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })); s.userData.o = i / 3; mug.add(s); steam.push(s); }
  scene.add(pick(mug, 'mug'));
  // sticky note on the desk with today's focus
  const sticky = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ffe680'; g.fillRect(0, 0, w, h); g.fillStyle = '#5b4a14'; g.font = hand(40); wrap(g, S.task ? `today: ${S.task}` : 'today: one thing at a time', 18, 58, w - 36, 44, 4); });
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), mat(0xffffff, { map: sticky.tex })); at(note, 1.0, 2.5, -3.15); note.rotation.x = -Math.PI / 2; note.rotation.z = 0.15; note.receiveShadow = true; scene.add(note);

  // ---------- chair
  const chair = new THREE.Group(); at(chair, 0, 0, -2.55);
  const seatM = mat(0x6c47ff, { roughness: 0.85 });
  chair.add(at(box(1.3, 0.25, 1.2, seatM, 0.1), 0, 1.5, 0), at(box(1.3, 1.5, 0.22, seatM, 0.1), 0, 2.3, 0.55), at(cyl(0.07, 0.07, 1.3, lampM, 8), 0, 0.75, 0), at(cyl(0.5, 0.5, 0.06, lampM, 16), 0, 0.08, 0));
  scene.add(pick(chair, 'chair'));

  // ---------- bookshelf (books are your subjects)
  const shelf = new THREE.Group(); at(shelf, -4.55, 0, 2.75);
  const shelfM = mat(0x6e4630, { roughness: 0.65 });
  shelf.add(at(box(0.9, 5, 0.14, shelfM, 0.03), 0, 2.5, -1.6), at(box(0.9, 5, 0.14, shelfM, 0.03), 0, 2.5, 1.6), at(box(0.12, 5, 3.3, shelfM, 0.02), -0.4, 2.5, 0));
  [0.15, 1.35, 2.55, 3.75, 4.95].forEach((y) => shelf.add(at(box(0.9, 0.12, 3.3, shelfM, 0.02), 0, y, 0)));
  scene.add(pick(shelf, 'shelf'));
  const bookGroup = new THREE.Group(); shelf.add(bookGroup);
  function buildBooks() {
    bookGroup.clear();
    pickables.splice(0, pickables.length, ...pickables.filter((p) => p.userData.pick.id !== 'book'));
    const filler = ['#3d3553', '#8a6d4f', '#4d6b5e', '#7a3f4a', '#c9b38a', '#2f4a6b'];
    const rows = [0.21, 1.41, 2.61, 3.81];
    let k = 0;
    rows.forEach((y, ri) => {
      let z = -1.45;
      while (z < 1.35) {
        const subj = S.subjects[k] && ri === 1 ? S.subjects[k] : null;
        const h = 0.75 + ((k * 37) % 30) / 100, t = 0.16 + ((k * 13) % 10) / 100;
        const color = subj ? subj.color : filler[(k + ri) % filler.length];
        const b = new THREE.Group();
        b.add(at(box(0.62, h, t, mat(color, { roughness: 0.6 }), 0.02), 0, h / 2, 0));
        if (subj) b.add(at(box(0.63, 0.06, t + 0.01, mat(0xf3e7c9), 0.005), 0, h * 0.75, 0));
        at(b, 0.05, y, z + t / 2);
        if (!subj && (k % 7 === 5)) b.rotation.x = 0.18;
        bookGroup.add(b);
        if (subj) pick(b, 'book', { subjectId: subj.id, name: subj.name });
        z += t + 0.03; k++;
        if (ri === 1 && k >= S.subjects.length && z > 0.2) { z += 0.2; }
      }
    });
    // a little plant and trophy on the top shelf
    const pot = at(cyl(0.18, 0.14, 0.3, mat(0xd98b5f)), 0, 5.16, 0.9); bookGroup.add(pot);
    for (let i = 0; i < 5; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat(0x4f9a6a)); at(lf, Math.sin(i) * 0.15, 5.4 + (i % 2) * 0.12, 0.9 + Math.cos(i) * 0.15); bookGroup.add(lf); }
  }
  buildBooks();

  // ---------- wall clock (runs your timer)
  const clockTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, 7); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#2b2838'; g.stroke();
    const t = S.timer || {};
    g.fillStyle = t.running ? (S.accent || '#6c47ff') : '#8b8798'; g.font = font(800, 18); g.textAlign = 'center';
    g.fillText((t.label || 'FOCUS').toUpperCase(), w / 2, 92);
    g.fillStyle = '#1b1825'; g.font = font(800, 58); g.fillText(t.clock || '25:00', w / 2, 152);
    g.fillStyle = '#8b8798'; g.font = font(600, 16); g.fillText(t.running ? 'click to pause' : 'click to start', w / 2, 186);
    // progress ring
    g.strokeStyle = S.accent || '#6c47ff'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (t.frac || 0)); g.stroke();
  });
  const clock = new THREE.Group(); at(clock, -3.45, 4.9, -4.98);
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ map: clockTex.tex, toneMapped: false })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 10, 48), mat(0x2b2838)); clock.add(rim);
  scene.add(pick(clock, 'clock'));

  // ---------- calendar on the left wall
  const calTex = canvasTex(320, 380, (g, w, h) => {
    const now = new Date();
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = S.accent || '#6c47ff'; g.fillRect(0, 0, w, 74);
    g.fillStyle = '#fff'; g.font = font(800, 30); g.textAlign = 'center';
    g.fillText(now.toLocaleString('en', { month: 'long' }).toUpperCase(), w / 2, 48);
    const first = new Date(now.getFullYear(), now.getMonth(), 1), off = (first.getDay() + 6) % 7, days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    g.font = font(700, 18);
    for (let d = 1; d <= days; d++) {
      const i = d - 1 + off, cx = 30 + (i % 7) * 43, cy = 112 + Math.floor(i / 7) * 46;
      if (d === now.getDate()) { g.fillStyle = S.accent || '#6c47ff'; g.beginPath(); g.arc(cx, cy - 6, 17, 0, 7); g.fill(); g.fillStyle = '#fff'; } else g.fillStyle = '#2b2838';
      g.fillText(String(d), cx, cy);
      if ((S.dueDays || []).includes(d)) { g.fillStyle = '#ef4444'; g.beginPath(); g.arc(cx, cy + 9, 3.5, 0, 7); g.fill(); }
    }
  });
  const cal = new THREE.Group(); at(cal, -4.98, 4.3, -0.15); cal.scale.setScalar(0.85); cal.rotation.y = Math.PI / 2;
  cal.add(at(box(1.5, 1.8, 0.05, mat(0xffffff, { map: calTex.tex }), 0.02), 0, 0, 0));
  cal.add(at(cyl(0.05, 0.05, 0.08, mat(0x777777), 8).rotateX(Math.PI / 2), 0, 0.95, 0.05));
  scene.add(pick(cal, 'calendar'));

  // ---------- corkboard with due items
  const boardTex = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#b98a5a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const colors = ['#ffe680', '#ffb3c7', '#b3e5ff', '#c9f7c3', '#ffd2a6'];
    const items = (S.due || []).slice(0, 5);
    if (!items.length) { g.fillStyle = '#fff8e0'; g.save(); g.translate(150, 120); g.rotate(-0.05); g.fillRect(0, 0, 210, 150); g.fillStyle = '#5b4a14'; g.font = hand(44); g.fillText('all clear!', 26, 88); g.restore(); }
    items.forEach((d, i) => {
      const x = 22 + (i % 3) * 162, y = 18 + Math.floor(i / 3) * 180, rot = ((i * 37) % 9 - 4) / 60;
      g.save(); g.translate(x + 70, y + 75); g.rotate(rot);
      g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
      g.fillStyle = colors[i % colors.length]; g.fillRect(-70, -72, 140, 150); g.shadowColor = 'transparent';
      g.fillStyle = '#e04848'; g.beginPath(); g.arc(0, -62, 7, 0, 7); g.fill();
      g.fillStyle = '#3c3010'; g.font = hand(28); wrap(g, d.title, -60, -24, 122, 28, 3);
      g.font = font(700, 15); g.fillStyle = d.overdue ? '#c62828' : '#6b5a1e'; g.fillText(d.when, -60, 66);
      g.restore();
    });
  });
  const board = new THREE.Group(); at(board, -4.98, 4.7, -2.75); board.rotation.y = Math.PI / 2;
  board.add(at(box(2.6, 1.95, 0.08, mat(0xffffff, { map: boardTex.tex }), 0.02), 0, 0, 0));
  board.add(at(box(2.75, 2.1, 0.06, mat(0x6e4630), 0.03), 0, 0, -0.03));
  scene.add(pick(board, 'board'));

  // ---------- poster: shows your current background
  const posterTex = canvasTex(300, 400, (g, w, h, paint) => { g.fillStyle = '#1b1825'; g.fillRect(0, 0, w, h); paint?.(g, w, h); });
  const poster = new THREE.Group(); at(poster, 3.6, 4.85, -4.98);
  poster.add(at(box(1.45, 1.9, 0.06, mat(0xe8e1d6), 0.02), 0, 0, 0));
  const posterImg = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.7), new THREE.MeshBasicMaterial({ map: posterTex.tex, toneMapped: false })); at(posterImg, 0, 0, 0.035); poster.add(posterImg);
  scene.add(pick(poster, 'poster'));
  function updatePoster() {
    const src = S.posterImage;
    if (src) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => posterTex.redraw((g, w, h) => { const k = Math.max(w / img.width, h / img.height); g.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k); });
      img.onerror = () => drawPosterColors();
      img.src = src;
    } else drawPosterColors();
  }
  function drawPosterColors() {
    const c = S.posterColors || ['#1c1240', '#5a1fd8', '#e0725f'];
    posterTex.redraw();
    const g = posterTex.canvas.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 300, 400); c.forEach((col, i) => grd.addColorStop(i / (c.length - 1), col));
    g.fillStyle = grd; g.fillRect(0, 0, 300, 400);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = font(800, 34); g.fillText('focus', 26, 360);
    posterTex.tex.needsUpdate = true;
  }
  updatePoster();

  // ---------- gallery wall: three frames for your own posters (left wall, under the calendar and corkboard)
  // local +x runs along the wall towards the window once the group is turned to face the room
  const FRAMES = [[0, 0, 1.15, 1.5], [1.05, 0.38, 0.72, 0.72], [1.05, -0.5, 0.72, 0.62]];
  const gallery = new THREE.Group(); at(gallery, -4.97, 2.75, -1.05); gallery.rotation.y = Math.PI / 2;
  const galleryM = mat(0x241f2e, { roughness: 0.5 });
  const frames = FRAMES.map(([x, y, w, h], slot) => {
    const g = new THREE.Group(); at(g, x, y, 0);
    g.add(at(box(w + 0.1, h + 0.1, 0.06, galleryM, 0.02), 0, 0, 0));
    g.add(at(box(w - 0.02, h - 0.02, 0.02, mat(0xf3eee6), 0), 0, 0, 0.035));
    const t = canvasTex(Math.round(w * 260), Math.round(h * 260), (g2, cw, ch, paint) => paint?.(g2, cw, ch));
    const img = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, h - 0.16), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false }));
    at(img, 0, 0, 0.05); g.add(img);
    gallery.add(pick(g, 'frame', { slot }));
    return { t, src: null };
  });
  scene.add(gallery);
  function drawEmptyFrame(f) {
    f.t.redraw((g, w, h) => {
      g.fillStyle = '#2a2537'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'center';
      g.font = font(300, Math.min(w, h) * 0.32); g.fillText('+', w / 2, h / 2 + Math.min(w, h) * 0.06);
      g.font = hand(Math.min(w, h) * 0.13); g.fillText('your poster', w / 2, h / 2 + Math.min(w, h) * 0.3);
    });
  }
  function updateFrames() {
    const list = S.posters || [];
    frames.forEach((f, i) => {
      const src = list[i] || null;
      if (src === f.src) return;
      f.src = src;
      if (!src) return drawEmptyFrame(f);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { if (f.src === src) f.t.redraw((g, w, h) => { const k = Math.max(w / im.width, h / im.height); g.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k); }); };
      im.onerror = () => { if (f.src === src) drawEmptyFrame(f); };
      im.src = src;
    });
  }
  frames.forEach(drawEmptyFrame);
  updateFrames();

  // ---------- record player on a side table
  const table = new THREE.Group(); at(table, 3.6, 0, -3.95);
  table.add(at(box(1.9, 0.14, 1.5, wood, 0.04), 0, 1.9, 0));
  [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]].forEach(([x, z]) => table.add(at(cyl(0.06, 0.06, 1.85, wood, 8), x, 0.93, z)));
  table.add(at(box(1.6, 0.6, 1.2, mat(0x2b2838), 0.05), 0, 0.8, 0));
  for (let i = 0; i < 6; i++) table.add(at(box(0.05, 0.5, 0.9, mat(['#e0725f', '#6c47ff', '#f2c14e', '#4fb3a9', '#e8e1d6', '#8a5a3b'][i]), 0.01), -0.6 + i * 0.12, 0.8, 0.05));
  const player = new THREE.Group(); at(player, 0, 1.97, 0);
  player.add(at(box(1.45, 0.22, 1.15, mat(0x6e4630, { roughness: 0.4 }), 0.05), 0, 0.11, 0));
  const disc = new THREE.Group(); at(disc, -0.15, 0.24, 0);
  disc.add(cyl(0.48, 0.48, 0.03, mat(0x111111, { roughness: 0.3, metalness: 0.2 }), 40));
  disc.add(at(cyl(0.16, 0.16, 0.035, mat(0x6c47ff)), 0, 0.003, 0));
  player.add(disc);
  const tonearm = at(box(0.06, 0.05, 0.7, mat(0xcfcfd6, { metalness: 0.6, roughness: 0.3 }), 0.02), 0.5, 0.3, 0.05); tonearm.rotation.y = 0.35; player.add(tonearm);
  table.add(player);
  scene.add(pick(table, 'record'));
  // music notes that float up while music plays
  const notes = [];
  const noteTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.font = '48px serif'; g.fillText('♪', 12, 50); });
  for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex.tex, transparent: true, opacity: 0, depthWrite: false })); sp.scale.set(0.35, 0.35, 1); sp.userData.o = i / 4; at(sp, 3.45, 2.6, -3.95); scene.add(sp); notes.push(sp); }

  // ---------- plant (grows with your focus sessions)
  const plant = new THREE.Group(); at(plant, -4.1, 0, -4.1);
  plant.add(at(cyl(0.55, 0.42, 0.9, mat(0xd98b5f, { roughness: 0.8 })), 0, 0.45, 0));
  plant.add(at(cyl(0.5, 0.5, 0.05, mat(0x3b2a1e)), 0, 0.88, 0));
  const leaves = new THREE.Group(); at(leaves, 0, 0.9, 0); plant.add(leaves);
  function growPlant() {
    leaves.clear();
    const n = Math.min(16, 4 + Math.floor((S.sessions || 0) / 2));
    const leafM = mat(0x3f8f5f, { roughness: 0.6 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 * 2.3, hgt = 0.4 + (i / n) * (1.2 + Math.min(1.6, (S.sessions || 0) / 20));
      const stem = at(cyl(0.025, 0.03, hgt, mat(0x2f6b45), 6), Math.cos(a) * 0.08, hgt / 2, Math.sin(a) * 0.08); stem.rotation.z = Math.cos(a) * 0.25; stem.rotation.x = Math.sin(a) * 0.25; leaves.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), leafM); leaf.scale.set(1, 0.35, 1.8);
      at(leaf, Math.cos(a) * (0.25 + hgt * 0.25), hgt, Math.sin(a) * (0.25 + hgt * 0.25)); leaf.rotation.y = -a; leaf.castShadow = true; leaves.add(leaf);
    }
  }
  growPlant();
  scene.add(pick(plant, 'plant'));

  // ---------- rug, fairy lights, cat
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.04, 48), mat(0x6c47ff, { roughness: 1 })); rug.scale.z = 0.7; at(rug, 0, 0.02, 0); rug.receiveShadow = true;
  const rugRing = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.05, 6, 64), mat(0xf2ede6, { roughness: 1 })); rugRing.rotation.x = Math.PI / 2; rugRing.scale.y = 0.7; at(rugRing, 0, 0.05, 0);
  const rugG = new THREE.Group(); rugG.add(rug, rugRing); at(rugG, 1.0, 0, 1.95); scene.add(pick(rugG, 'rug'));
  const lights = new THREE.Group();
  const bulbs = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const onBack = t < 0.55;
    const u = onBack ? t / 0.55 : (t - 0.55) / 0.45;
    const x = onBack ? 4.7 - u * 9.5 : -4.85, z = onBack ? -4.85 : -4.8 + u * 9.4;
    const y = 7.0 - Math.abs(Math.sin(u * Math.PI * (onBack ? 5 : 4))) * 0.28;
    const bm = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc46b, emissiveIntensity: 2 });
    const b = at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), bm), x, y, z); lights.add(b); bulbs.push(b);
  }
  scene.add(pick(lights, 'lights'));
  const cat = new THREE.Group(); at(cat, 1.1, 0.05, 2.1);
  const fur = mat(0x2b2838, { roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), fur); body.scale.set(1.3, 0.75, 0.9); at(body, 0, 0.38, 0); body.castShadow = true; cat.add(body);
  const head = new THREE.Group(); at(head, 0.62, 0.62, 0.05); cat.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), fur));
  const eyes = [];
  [-0.14, 0.14].forEach((z) => { const ear = at(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 6), fur), 0.02, 0.27, z); head.add(ear); const eye = at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf5d76e })), 0.25, 0.05, z * 0.8); head.add(eye); eyes.push(eye); });
  const tail = new THREE.Group(); at(tail, -0.6, 0.3, 0); cat.add(tail);
  const tailMesh = at(cyl(0.06, 0.08, 0.9, fur, 8), -0.1, 0.4, 0); tailMesh.rotation.z = 0.5; tail.add(tailMesh);
  cat.rotation.y = -0.6;
  scene.add(pick(cat, 'cat'));

  // ---------- toys
  // yarn ball on the floor: click to throw it, the cat chases it
  const yarn = new THREE.Group(); at(yarn, 2.9, 0.22, 0.5);
  const yarnBall = new THREE.Group(); yarn.add(yarnBall);
  const yarnM = mat(0xe86a8a, { roughness: 0.95 });
  yarnBall.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), yarnM));
  for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.018, 6, 28), mat(0xf28fa6, { roughness: 1 })); w.rotation.set(i * 0.8, i * 1.3, i * 0.4); yarnBall.add(w); }
  yarnBall.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(pick(yarn, 'yarn'));
  const yv = new THREE.Vector3(); let yvy = 0;
  // desk globe: click to spin
  const globeTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#2f6fa8'; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 14; i++) { g.fillStyle = rnd() < 0.7 ? '#5fae6b' : '#d9c48a'; g.beginPath(); g.ellipse(rnd() * w, 20 + rnd() * (h - 40), 8 + rnd() * 26, 6 + rnd() * 18, rnd() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.18)'; for (let y = 16; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  const globe = new THREE.Group(); at(globe, -1.8, 2.49, -3.3);
  const brass = mat(0xc9a25a, { metalness: 0.6, roughness: 0.35 });
  globe.add(at(cyl(0.2, 0.24, 0.05, brass), 0, 0.025, 0), at(cyl(0.025, 0.03, 0.2, brass, 8), 0, 0.14, 0));
  const tilt = new THREE.Group(); at(tilt, 0, 0.48, 0); tilt.rotation.z = 0.41; globe.add(tilt);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.25, 28, 20), mat(0xffffff, { map: globeTex.tex, roughness: 0.5 })); earth.castShadow = true; tilt.add(earth);
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 6, 40, Math.PI), brass); meridian.rotation.z = -Math.PI / 2; tilt.add(meridian);
  scene.add(pick(globe, 'globe'));
  let globeSpin = 0.15;
  // Newton's cradle: click to set the balls clacking
  const cradle = new THREE.Group(); at(cradle, 1.75, 2.49, -4.35);
  const steel = mat(0xd8dbe2, { metalness: 0.9, roughness: 0.18 });
  const dark = mat(0x2b2838, { roughness: 0.4 });
  cradle.add(at(box(0.92, 0.06, 0.44, dark, 0.02), 0, 0.03, 0));
  [[-0.42, -0.18], [0.42, -0.18], [-0.42, 0.18], [0.42, 0.18]].forEach(([x, z]) => cradle.add(at(cyl(0.014, 0.014, 0.6, steel, 6), x, 0.36, z)));
  [-0.18, 0.18].forEach((z) => { const bar = at(cyl(0.014, 0.014, 0.86, steel, 6), 0, 0.66, z); bar.rotation.z = Math.PI / 2; cradle.add(bar); });
  const swings = [];
  for (let i = 0; i < 5; i++) {
    const pv = new THREE.Group(); at(pv, (i - 2) * 0.125, 0.66, 0); cradle.add(pv);
    const ball = at(new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), steel), 0, -0.42, 0); ball.castShadow = true; pv.add(ball);
    [-1, 1].forEach((sg) => { const st = at(cyl(0.004, 0.004, 0.46, mat(0xeeeeee), 4), 0, -0.21, sg * 0.09); st.rotation.x = sg * 0.4; pv.add(st); });
    swings.push(pv);
  }
  scene.add(pick(cradle, 'cradle'));
  let cradleA = 0, cradlePh = 0, cradleSign = 0;
  // wind chime by the window: brush past it to hear it, click to ring it
  const chimeG = new THREE.Group(); at(chimeG, 2.72, 6.45, -4.45);
  chimeG.add(at(box(0.06, 0.06, 0.55, dark, 0.01), 0, 0.12, -0.25));
  chimeG.add(at(cyl(0.006, 0.006, 0.12, mat(0xdddddd), 4), 0, 0.06, 0));
  const chimeTop = at(cyl(0.17, 0.17, 0.04, mat(0x8a5a3b)), 0, 0, 0); chimeG.add(chimeTop);
  const tubes = [];
  [0.62, 0.55, 0.48, 0.42, 0.36].forEach((L, i) => {
    const a = (i / 5) * Math.PI * 2;
    const pv = new THREE.Group(); at(pv, Math.cos(a) * 0.11, -0.03, Math.sin(a) * 0.11); chimeG.add(pv);
    pv.add(at(cyl(0.022, 0.022, L, mat(0xcfd6e0, { metalness: 0.85, roughness: 0.2 }), 10), 0, -0.1 - L / 2, 0));
    pv.add(at(cyl(0.003, 0.003, 0.1, mat(0xdddddd), 4), 0, -0.05, 0));
    pv.userData.a = a; tubes.push(pv);
  });
  chimeG.add(at(cyl(0.004, 0.004, 0.75, mat(0xdddddd), 4), 0, -0.4, 0), at(cyl(0.06, 0.06, 0.02, mat(0x8a5a3b), 12), 0, -0.42, 0), at(box(0.14, 0.2, 0.01, mat(0xe8e1d6), 0.01), 0, -0.85, 0));
  scene.add(pick(chimeG, 'chime'));
  let chimeSway = 0, chimeHoverAt = 0;
  // speaker by the record player: a walnut cabinet with a fabric front, an LED screen that dances
  // to the music (and breathes softly when nothing plays), and a woofer that pumps with the bass
  const ledTex = canvasTex(256, 200, (g, w, h, paint) => paint?.(g, w, h));
  const speaker = new THREE.Group(); at(speaker, 4.0, 0, -1.75); speaker.rotation.y = 0.6; speaker.scale.setScalar(1.2);
  const walnut = mat(0x6b4630, { roughness: 0.45 });
  speaker.add(at(box(0.92, 1.62, 0.72, walnut, 0.08), 0, 0.85, 0));
  speaker.add(at(box(0.8, 0.08, 0.6, dark, 0.03), 0, 0.03, 0));
  const fabric = mat(0x2a2633, { roughness: 1 });
  speaker.add(at(box(0.78, 1.46, 0.04, fabric, 0.05), 0, 0.85, 0.35));
  const leds = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.5), new THREE.MeshBasicMaterial({ map: ledTex.tex, toneMapped: false, transparent: true })); at(leds, 0, 1.3, 0.374); speaker.add(leds);
  const tweeter = new THREE.Group(); at(tweeter, 0, 0.92, 0.37); speaker.add(tweeter);
  tweeter.add(at(cyl(0.1, 0.1, 0.02, steel, 24).rotateX(Math.PI / 2), 0, 0, 0), at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x111018, { roughness: 0.3 })).rotateX(Math.PI / 2), 0, 0, 0.01));
  const woofer = new THREE.Group(); at(woofer, 0, 0.48, 0.37); speaker.add(woofer);
  woofer.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 36), steel), 0, 0, 0.01));
  woofer.add(at(cyl(0.27, 0.27, 0.02, mat(0x16141d), 32).rotateX(Math.PI / 2), 0, 0, 0));
  const cone = at(cyl(0.22, 0.12, 0.06, mat(0x1d1b25, { roughness: 0.85 }), 32).rotateX(Math.PI / 2), 0, 0, 0.03); woofer.add(cone);
  const cap = at(new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a3646, { roughness: 0.4 })).rotateX(Math.PI / 2), 0, 0, 0.06); woofer.add(cap);
  const speakerGlow = new THREE.PointLight(0x6c47ff, 0, 3.2, 2); at(speakerGlow, 0, 1.1, 0.9); speaker.add(speakerGlow);
  scene.add(pick(speaker, 'speaker'));
  function drawLeds(bins, accentHex, idle) {
    ledTex.redraw((g, w, h) => {
      g.fillStyle = '#0b0a10'; roundRect(g, 0, 0, w, h, 22); g.fill();
      const cols = 14, rows = 9, pad = 16, cw = (w - pad * 2) / cols, rh = (h - pad * 2) / rows, r = Math.min(cw, rh) * 0.34;
      for (let c = 0; c < cols; c++) {
        const b = bins[c];
        const lit = b * rows;
        for (let rI = 0; rI < rows; rI++) {
          const on = Math.min(1, Math.max(0, lit - rI));
          const x = pad + c * cw + cw / 2, y = h - pad - rI * rh - rh / 2;
          g.globalAlpha = 0.16;
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
          if (on > 0) {
            g.globalAlpha = (idle ? 0.85 : 1) * on;
            g.fillStyle = rI >= rows - 2 ? '#ff7aa2' : rI >= rows - 4 ? '#ffc46b' : accentHex;
            g.shadowColor = g.fillStyle; g.shadowBlur = 10;
            g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.shadowBlur = 0;
          }
        }
      }
      g.globalAlpha = 1;
    });
  }
  const ledBins = new Float32Array(14);

  // ---------- little sprites: speech bubble, hearts, z's
  const bubbleTex = canvasTex(640, 200, (g, w, h, text = '') => {
    if (!text) return;
    g.font = font(650, 34);
    const words = text.split(' '), lines = [''];
    for (const wd of words) { const t2 = lines.at(-1) ? `${lines.at(-1)} ${wd}` : wd; if (g.measureText(t2).width > w - 90 && lines.at(-1)) { if (lines.length === 2) { lines[1] += '…'; break; } lines.push(wd); } else lines[lines.length - 1] = t2; }
    const tw = Math.max(...lines.map((l) => g.measureText(l).width)), bw = tw + 60, bh = lines.length * 44 + 36, x = (w - bw) / 2, y = h - bh - 34;
    g.fillStyle = 'rgba(255,253,248,.97)'; roundRect(g, x, y, bw, bh, 30); g.fill();
    g.beginPath(); g.moveTo(w / 2 - 18, y + bh - 1); g.lineTo(w / 2, h - 6); g.lineTo(w / 2 + 16, y + bh - 1); g.fill();
    g.fillStyle = '#2a2140'; g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, w / 2, y + 50 + i * 44));
  });
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex.tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
  bubble.scale.set(3.6, 1.125, 1); bubble.renderOrder = 12; scene.add(bubble);
  let bubbleT = 0;
  function say(text, secs = 6) { bubbleTex.redraw(text); bubbleT = secs; }
  const glyph = (ch, color) => { const t2 = canvasTex(64, 64, (g) => { g.fillStyle = color; g.font = `700 46px "Plus Jakarta Sans", system-ui`; g.textAlign = 'center'; g.fillText(ch, 32, 48); }); return t2.tex; };
  const heartTex = glyph('♥', '#ff7aa2'), zTex = glyph('z', '#e8e4ff');
  const puffs = [];
  function puff(tex, x, y, z, size = 0.32) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.set(x, y, z); sp.scale.setScalar(size); sp.userData = { life: 1.6, vx: (Math.random() - 0.5) * 0.4 }; scene.add(sp); puffs.push(sp);
  }

  // ---------- the cat's little life: idle → sleep after a while, chase the yarn, purr when held
  let catMode = 'idle', catPoke = 0, hopT = 0, petting = false, petPuff = 0, chaseBats = 0, sleepPuff = 0;
  const catHome = new THREE.Vector3();
  function wakeCat() { if (catMode === 'sleep') { catMode = 'idle'; SND.meow('mrrp'); hopT = 0.01; } catPoke = clockT.getElapsedTime(); }
  function throwYarn() {
    const a = Math.random() * Math.PI * 2, sp = 4.5 + Math.random() * 2.5;
    yv.set(Math.cos(a) * sp, 0, Math.sin(a) * sp); yvy = 3.2;
    SND.whoosh(0.18, 0.4);
    if (cat.visible) { wakeCat(); catMode = 'chase'; chaseBats = 1 + Math.floor(Math.random() * 3); setTimeout(() => SND.meow('small'), 250); }
  }

  // ---------- friends: each gets an armchair around the rug and a little seated character
  // Characters are kept per person and only rebuilt when their look changes, so actions can animate.
  const friendGroup = new THREE.Group(); scene.add(friendGroup);
  // seats on the far side of the rug, so friends face the rug and you see their faces from the camera
  const SEAT_OFFSETS = [[-2.45, -0.45], [-0.3, -1.95], [1.8, -1.75], [-2.35, 1.2]];
  const friends = new Map(); // id → { g, sig, parts, label, labelText, act }
  function labelTex(text, color) {
    return canvasTex(512, 128, (g, w, h) => { g.font = font(700, 44); const tw = g.measureText(text).width; g.fillStyle = 'rgba(15,14,24,.82)'; roundRect(g, w / 2 - tw / 2 - 28, 18, tw + 56, 84, 42); g.fill(); g.fillStyle = color; g.beginPath(); g.arc(w / 2 - tw / 2 - 6, 60, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(text, w / 2 - tw / 2 + 10, 76); });
  }
  function emojiSprite(ch) {
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = 'rgba(255,253,248,.96)'; g.beginPath(); g.arc(w / 2, h / 2 - 10, 92, 0, 7); g.fill();
      g.beginPath(); g.moveTo(w / 2 - 22, h - 46); g.lineTo(w / 2, h - 8); g.lineTo(w / 2 + 18, h - 46); g.fill();
      g.font = '110px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 - 4);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.setScalar(0.85); sp.renderOrder = 11; return sp;
  }
  const hashOf = (str) => [...(str || '?')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  function buildFriend(f) {
    const hash = hashOf(f.name);
    const c = new THREE.Color(f.color || '#4fb3a9');
    const g = new THREE.Group();
    const skin = mat([0xf6d5b8, 0xe9bb92, 0xc98d64, 0x9c6743, 0x6f472c][hash % 5], { roughness: 0.62 });
    const hairM = mat([0x2b1d14, 0x4a2c1a, 0x16131a, 0x8a5a2b, 0xd9b26a, 0x7a2f3a, 0x3d3a66][(hash >> 3) % 7], { roughness: 0.75 });
    const shirt = mat(c, { roughness: 0.75 });
    const pants = mat(new THREE.Color(c).lerp(new THREE.Color('#1d1a2b'), 0.7), { roughness: 0.85 });
    const shoe = mat(0xf2ede6, { roughness: 0.6 });
    // armchair: wooden legs, a soft seat and back, rounded arms, all a calm tint of their colour
    const fabric = mat(new THREE.Color(c).lerp(new THREE.Color('#e8e1d6'), 0.55), { roughness: 0.95 });
    const legW = mat(0x6e4630, { roughness: 0.5 });
    [[-0.42, -0.36], [0.42, -0.36], [-0.42, 0.36], [0.42, 0.36]].forEach(([x, z]) => g.add(at(cyl(0.04, 0.03, 0.42, legW, 8), x, 0.21, z)));
    g.add(at(box(1.05, 0.22, 0.95, fabric, 0.1), 0, 0.52, 0));
    g.add(at(box(0.92, 0.12, 0.8, fabric, 0.06), 0, 0.68, 0.04)); // seat cushion
    const back = at(box(1.05, 0.95, 0.2, fabric, 0.1), 0, 1.05, -0.4); back.rotation.x = -0.12; g.add(back);
    [-1, 1].forEach((sd) => g.add(at(box(0.18, 0.42, 0.88, fabric, 0.08), sd * 0.52, 0.8, 0)));
    // the character, sitting: everything above the hips can move
    const upper = new THREE.Group(); at(upper, 0, 0.78, -0.05); g.add(upper);
    [-1, 1].forEach((sd) => {
      const thigh = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 10), pants), sd * 0.13, 0.84, 0.16); thigh.rotation.x = Math.PI / 2; g.add(thigh);
      const shin = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.38, 6, 10), pants), sd * 0.13, 0.55, 0.42); g.add(shin);
      const sh = at(box(0.18, 0.12, 0.3, shoe, 0.05), sd * 0.13, 0.3, 0.5); g.add(sh);
    });
    const torso = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.32, 8, 16), shirt), 0, 0.36, 0); torso.scale.set(1.05, 1, 0.82); upper.add(torso);
    // arms hang from shoulder pivots so they can wave, clap and cheer
    const arms = [-1, 1].map((sd) => {
      const pv = new THREE.Group(); at(pv, sd * 0.3, 0.58, 0); upper.add(pv);
      pv.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), shirt), 0, -0.22, 0));
      pv.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skin), 0, -0.44, 0));
      return pv;
    });
    const mug = new THREE.Group(); mug.visible = false; at(mug, 0, -0.5, 0.06);
    mug.add(cyl(0.065, 0.06, 0.13, mat(0xf2ede6, { roughness: 0.4 }), 14)); arms[1].add(mug);
    // big friendly head
    const head = new THREE.Group(); at(head, 0, 0.98, 0.02); upper.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), skin));
    [-1, 1].forEach((sd) => head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin), sd * 0.33, -0.02, 0)));
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1d1a2b }), shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyes = [-1, 1].map((sd) => {
      const e = new THREE.Group(); at(e, sd * 0.12, -0.01, 0.305); head.add(e);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), eyeM); pupil.scale.set(1, 1.25, 0.6); e.add(pupil);
      e.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), shineM), 0.015, 0.025, 0.03));
      const blush = at(new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.5 })), sd * 0.08, -0.09, -0.01);
      e.add(blush);
      return e;
    });
    const smile = at(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI), eyeM), 0, -0.12, 0.315); smile.rotation.z = Math.PI; head.add(smile);
    // hair: a cap with a side-swept fringe; some get a bun, some longer hair at the back
    const cap = at(new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM), 0, 0.03, -0.04); cap.rotation.x = -0.3; head.add(cap);
    const fringe = at(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), hairM), (hash % 2 ? 1 : -1) * 0.07, 0.2, 0.18); fringe.scale.set(1.25, 0.42, 0.62); fringe.rotation.z = (hash % 2 ? -1 : 1) * 0.3; head.add(fringe);
    const style = (hash >> 5) % 3;
    if (style === 0) head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), hairM), 0, 0.2, -0.3));
    if (style === 1) { const long = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.25, 6, 16), hairM), 0, -0.18, -0.12); long.scale.set(1.05, 1, 0.7); head.add(long); }
    // headphones in their colour
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 8, 28, Math.PI), mat(0x2b2838, { roughness: 0.4 })); at(band, 0, 0.02, -0.02); head.add(band);
    [-1, 1].forEach((sd) => { const cup = at(cyl(0.1, 0.1, 0.08, mat(c, { roughness: 0.4 }), 18), sd * 0.36, 0, 0); cup.rotation.z = Math.PI / 2; head.add(cup); });
    // laptop on their lap, screen facing them
    const lap = new THREE.Group(); at(lap, 0, 0.98, 0.3); lap.rotation.x = -0.08; g.add(lap);
    lap.add(box(0.5, 0.03, 0.34, shell, 0.01));
    const lid = new THREE.Group(); at(lid, 0, 0.015, 0.17); lid.rotation.x = 0.3; lap.add(lid);
    lid.add(at(box(0.5, 0.34, 0.025, shell, 0.01), 0, 0.17, 0));
    const screenM = new THREE.MeshStandardMaterial({ color: 0x1b1640, emissive: c, emissiveIntensity: f.status === 'focus' ? 0.9 : 0.25 });
    lid.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), screenM).rotateY(Math.PI), 0, 0.17, -0.014));
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    eyes.forEach((e) => e.traverse((o) => { o.castShadow = false; }));
    return { g, parts: { upper, head, arms, eyes, mug, screenM, lap } };
  }
  const labelFor = (f) => [`${f.name}${f.status === 'focus' ? ` · ${f.clock || 'focusing'}` : f.status === 'break' ? ' · on break' : ''}`, f.status === 'focus' ? '#4ade80' : f.status === 'break' ? '#fbbf24' : '#9ca3af'];
  function setFriends(list) {
    const RUG = [rugG.position.x, rugG.position.z];
    const keep = new Set();
    list.slice(0, SEAT_OFFSETS.length).forEach((f, i) => {
      keep.add(f.id);
      const sig = `${f.name}|${f.color}|${f.status}`;
      let fr = friends.get(f.id);
      if (!fr || fr.sig !== sig) {
        if (fr) { friendGroup.remove(fr.g, fr.label); }
        const built = buildFriend(f);
        const lt = labelTex(...labelFor(f));
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt.tex, transparent: true, depthWrite: false, depthTest: false })); label.scale.set(2.2, 0.55, 1); label.renderOrder = 10;
        fr = { ...built, sig, label, lt, labelText: labelFor(f).join(), act: fr?.act || null };
        friends.set(f.id, fr);
        friendGroup.add(pick(fr.g, 'friend', { id: f.id, name: f.name, task: f.task, status: f.status }), label);
      }
      fr.g.userData.pick.data = { id: f.id, name: f.name, task: f.task, status: f.status };
      const text = labelFor(f);
      if (text.join() !== fr.labelText) { fr.labelText = text.join(); const old = fr.label.material.map; fr.lt = labelTex(...text); fr.label.material.map = fr.lt.tex; fr.label.material.needsUpdate = true; old.dispose(); }
      const x = RUG[0] + SEAT_OFFSETS[i][0], z = RUG[1] + SEAT_OFFSETS[i][1];
      fr.g.position.set(x, 0, z);
      fr.g.rotation.y = Math.atan2(RUG[0] - x, RUG[1] - z); // face the middle of the rug
      fr.label.position.set(x, 2.55, z);
      fr.status = f.status;
    });
    for (const [id, fr] of friends) if (!keep.has(id)) { friendGroup.remove(fr.g, fr.label); if (fr.emoji) scene.remove(fr.emoji); friends.delete(id); }
    pickables.splice(0, pickables.length, ...pickables.filter((p) => p.userData.pick.id !== 'friend' || [...friends.values()].some((fr) => fr.g === p)));
  }
  // ---------- actions: wave, cheer, clap, heart, highfive, coffee, sleepy
  const ACT_EMOJI = { wave: '👋', cheer: '🎉', clap: '👏', heart: '❤️', highfive: '✋', coffee: '☕', sleepy: '😴' };
  const ACT_LEN = { wave: 2.4, cheer: 2.4, clap: 2.2, heart: 2.6, highfive: 2.2, coffee: 3.2, sleepy: 4 };
  const confettiTex = ['#ff7aa2', '#ffc46b', '#7ad7ff', '#b39bff', '#4ade80'].map((col) => glyph('■', col));
  function friendAct(id, act) {
    const fr = friends.get(id);
    if (!fr || !ACT_EMOJI[act]) return false;
    fr.act = { act, t: 0 };
    if (fr.emoji) scene.remove(fr.emoji);
    fr.emoji = emojiSprite(ACT_EMOJI[act]); scene.add(fr.emoji);
    if (act === 'clap') [0, 0.22, 0.44, 0.66, 0.88].forEach((d) => setTimeout(() => SND.clack(0.18), d * 1000));
    if (act === 'cheer') SND.chime(4, 0.12);
    if (act === 'highfive') setTimeout(() => SND.clack(0.4), 450);
    return true;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  function stepFriends(dt, t) {
    for (const fr of friends.values()) {
      const P = fr.parts, a = fr.act;
      let lx = -0.95, lz = 0.12, rx = -0.95, rz = -0.12, bob = 0, nod = 0, eyesClosed = false;
      if (fr.status === 'focus') { lx += Math.sin(t * 18) * 0.06; rx += Math.sin(t * 18 + 1.7) * 0.06; nod = Math.sin(t * 1.3) * 0.04; }
      else nod = Math.sin(t * 0.9) * 0.05;
      P.mug.visible = false;
      if (a) {
        a.t += dt; const k = a.t, L = ACT_LEN[a.act], ease = Math.min(1, k * 4, (L - k) * 4);
        // rotation.z swings an arm sideways: + moves the right arm outward, − moves the left arm outward
        if (a.act === 'wave') { rx = lerp(rx, -2.6, ease); rz = lerp(rz, 0.55 + Math.sin(k * 12) * 0.35, ease); }
        if (a.act === 'highfive') { rx = lerp(rx, -2.95, ease); rz = lerp(rz, 0.35, ease); bob = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.08; }
        if (a.act === 'cheer') { lx = rx = lerp(-0.95, -2.9, ease); lz = lerp(lz, -0.55, ease); rz = lerp(rz, 0.55, ease); bob = Math.abs(Math.sin(k * 9)) * 0.14 * ease; if (Math.random() < dt * 22) { const wp2 = P.head.getWorldPosition(new THREE.Vector3()); puff(confettiTex[Math.floor(Math.random() * 5)], wp2.x + (Math.random() - 0.5) * 0.9, wp2.y + 0.2, wp2.z + (Math.random() - 0.5) * 0.6, 0.12); } }
        if (a.act === 'clap') { lx = rx = lerp(-0.95, -1.45, ease); const cl = (Math.sin(k * 28) * 0.5 + 0.5) * 0.35; lz = lerp(lz, 0.25 + cl, ease); rz = lerp(rz, -0.25 - cl, ease); }
        if (a.act === 'heart') { nod = Math.sin(k * 3) * 0.12; if (Math.random() < dt * 5) { const wp2 = P.head.getWorldPosition(new THREE.Vector3()); puff(heartTex, wp2.x + (Math.random() - 0.5) * 0.5, wp2.y + 0.35, wp2.z, 0.28); } }
        if (a.act === 'coffee') { P.mug.visible = true; rx = lerp(rx, -2.2, ease); rz = lerp(rz, -0.5, ease); nod = -0.12 * ease; }
        if (a.act === 'sleepy') { eyesClosed = true; nod = (0.25 + Math.sin(k * 2.2) * 0.12) * ease; if (Math.random() < dt * 1.2) { const wp2 = P.head.getWorldPosition(new THREE.Vector3()); puff(zTex, wp2.x + 0.25, wp2.y + 0.4, wp2.z, 0.26); } }
        if (fr.emoji) { const wp2 = P.head.getWorldPosition(new THREE.Vector3()); fr.emoji.position.set(wp2.x, wp2.y + 0.95 + Math.sin(k * 4) * 0.05, wp2.z); fr.emoji.material.opacity = Math.max(0, Math.min(1, k * 5, (L - k) * 3)); }
        if (k >= L) { fr.act = null; if (fr.emoji) { scene.remove(fr.emoji); fr.emoji = null; } }
      }
      const s2 = Math.min(1, dt * 12);
      P.arms[0].rotation.x = lerp(P.arms[0].rotation.x, lx, s2); P.arms[0].rotation.z = lerp(P.arms[0].rotation.z, lz, s2);
      P.arms[1].rotation.x = lerp(P.arms[1].rotation.x, rx, s2); P.arms[1].rotation.z = lerp(P.arms[1].rotation.z, rz, s2);
      P.upper.position.y = 0.78 + bob + Math.sin(t * 1.6) * 0.008;
      P.head.rotation.x = lerp(P.head.rotation.x, nod, s2);
      P.eyes.forEach((e) => { e.scale.y = lerp(e.scale.y, eyesClosed || (Math.sin(t * 0.7 + fr.g.position.x) > 0.995) ? 0.12 : 1, Math.min(1, dt * 18)); });
    }
  }

  // ---------- floating labels: what each thing opens
  const tags = new THREE.Group(); scene.add(tags);
  function tagSprite(text) {
    const t = canvasTex(512, 112, (g, w) => {
      g.font = font(700, 42); const tw = g.measureText(text).width;
      g.fillStyle = 'rgba(12,11,20,.78)'; roundRect(g, w / 2 - tw / 2 - 26, 14, tw + 52, 80, 40); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(text, w / 2, 69);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.92 }));
    sp.scale.set(1.75, 0.38, 1); sp.renderOrder = 9;
    return sp;
  }
  const wp = new THREE.Vector3();
  [['Notes', laptop, 1.75], ['Subjects', shelf, 5.75], ['Due', board, 1.35], ['Calendar', cal, 1.1], ['Timer', clock, 1.25], ['Music', table, 3.05],
   ['Weather', win, 1.7], ['Studio', poster, 1.2], ['Streak', plant, 3.7], ['Focus', chair, 3.75]]
    .forEach(([text, obj, dy]) => { const sp = tagSprite(text); sp.userData.follow = obj; sp.userData.dy = dy; tags.add(sp); });
  function placeTags() { tags.children.forEach((sp) => { sp.userData.follow.getWorldPosition(wp); sp.position.set(wp.x, sp.userData.follow === shelf || sp.userData.follow === table || sp.userData.follow === plant || sp.userData.follow === chair ? sp.userData.dy : wp.y + sp.userData.dy, wp.z); }); }
  placeTags();
  tags.visible = S.labels ?? true;

  // ---------- customisation
  const LIGHTS = { warm: [0xffc46b], pink: [0xff7ab0], blue: [0x7ad7ff], rainbow: [0xff7ab0, 0x7ad7ff, 0xffc46b, 0xb39bff] };
  const PETS = { black: 0x2b2838, orange: 0xd9822b, white: 0xeeeae4, grey: 0x8a8a92, cream: 0xe8c99a };
  function applyCustom() {
    const show = { plant: true, record: true, poster: true, lights: true, pet: true, gallery: true, toys: true, speaker: true, ...(C.show || {}) };
    plant.visible = show.plant; table.visible = show.record; poster.visible = show.poster; cat.visible = show.pet; gallery.visible = show.gallery;
    yarn.visible = globe.visible = cradle.visible = chimeG.visible = show.toys; speaker.visible = show.speaker;
    lights.visible = show.lights && C.lights !== 'off';
    const lc = LIGHTS[C.lights] || LIGHTS.warm;
    bulbs.forEach((b, i) => b.material.emissive.set(lc[i % lc.length]));
    fur.color.set(PETS[C.pet] || PETS.black); syncOwn();
    floorTex.redraw(); sky.redraw();
    applyTheme();
  }

  // ---------- theme sync
  function applyTheme() {
    const a = accent();
    if (C.curtains && C.curtains !== 'accent') curtainM.color.set(C.curtains); else curtainM.color.copy(a).multiplyScalar(0.75);
    seatM.color.copy(a);
    if (C.rug && C.rug !== 'accent') rug.material.color.set(C.rug); else rug.material.color.copy(a).multiplyScalar(0.55);
    const wall = new THREE.Color(C.wall && C.wall !== 'auto' ? C.wall : S.wall || '#2c2540');
    wallMat.color.copy(wall);
    trim.color.copy(wall).multiplyScalar(1.25);
    hemi.color.copy(a).lerp(new THREE.Color('#ffffff'), 0.5);
    disc.children[1].material.color.copy(a);
    syncOwn();
  }
  applyTheme();

  // everything on the desk moves with the desk
  for (const o of [laptop, lamp, mug, note, screenGlow, globe, cradle]) desk.attach(o);
  pick(desk, 'desk');
  const DRAG = new Map([[desk, 'floor'], [chair, 'floor'], [shelf, 'floor'], [table, 'floor'], [plant, 'floor'], [rugG, 'floor'], [cat, 'floor'],
    [clock, 'back'], [poster, 'back'], [cal, 'left'], [board, 'left'], [gallery, 'left'], [speaker, 'floor']]);
  const KEYS = new Map([[desk, 'desk'], [chair, 'chair'], [shelf, 'shelf'], [table, 'record'], [plant, 'plant'], [rugG, 'rug'], [cat, 'pet'], [clock, 'clock'], [poster, 'poster'], [cal, 'calendar'], [board, 'board'], [gallery, 'gallery'], [speaker, 'speaker']]);
  const HOME = new Map([...DRAG.keys()].map((g) => [g, [g.position.x, g.position.y, g.position.z, g.rotation.y]]));
  function applyLayout() {
    for (const [g, key] of KEYS) {
      const l = C.layout?.[key] || HOME.get(g);
      g.position.set(l[0], l[1], l[2]); g.rotation.y = l[3];
    }
  }
  applyCustom();
  applyLayout();

  // ---------- state
  let weather = S.weather || 'rain';
  let lampOn = S.lampOn ?? true;
  let lightHue = 0;
  function setWeather(w) {
    weather = w;
    particles.visible = w !== 'clear';
    pMat.size = w === 'snow' ? 0.09 : 0.045;
    pMat.color.set(w === 'snow' ? 0xffffff : 0xcfe0ff);
  }
  setWeather(weather);
  // brightness slider (0.4 – 1.8) scales the whole exposure on top of the lamp
  let bright = S.bright ?? 1;
  function applyExposure() { renderer.toneMappingExposure = (lampOn ? 1.2 : 0.95) * bright; }
  function setLamp(on) {
    lampOn = on;
    lampLight.intensity = on ? 14 : 0;
    bulb.material.emissiveIntensity = on ? 1.2 : 0;
    hemi.intensity = on ? 0.95 : 0.55;
    fill.intensity = on ? 0.55 : 0.3;
    applyExposure();
  }
  setLamp(lampOn);

  // ---------- picking
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hovered = null, downAt = null;
  const tip = document.createElement('div'); tip.className = 'room-tip'; tip.hidden = true; host.append(tip);
  function groupOf(obj) { while (obj && !obj.userData.pick) obj = obj.parent; return obj; }
  // Many objects share materials, so originals are kept per material, not per mesh.
  const glowing = new Set();
  function setGlow(group, on) {
    if (!on) { for (const m of glowing) { m.emissive.copy(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i; delete m.userData.e0; } glowing.clear(); return; }
    group?.traverse((o) => {
      const m = o.isMesh && o.material;
      if (!m || m.isMeshBasicMaterial || !m.emissive || glowing.has(m)) return;
      m.userData.e0 = { c: m.emissive.clone(), i: m.emissiveIntensity };
      m.emissive.copy(accent()); m.emissiveIntensity = Math.max(0.18, m.emissiveIntensity);
      glowing.add(m);
    });
  }
  function hit(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(pickables, true);
    // books sit inside the shelf: prefer the most specific pickable
    // hidden pieces (switched off in the customiser) shouldn't catch clicks
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    for (const h of hits) { const g = groupOf(h.object); if (g && shown(h.object)) return g; }
    return null;
  }
  const onMove = (e) => {
    if (onDrag(e)) return;
    if (downAt && !petting && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) clearTimeout(holdTimer);
    const g = hit(e);
    const target = arrange ? movable(g) : g;
    if (target !== hovered) { setGlow(null, false); hovered = target; setGlow(target, true); }
    renderer.domElement.style.cursor = target ? (arrange ? 'move' : 'pointer') : 'grab';
    if (arrange) { tip.textContent = target ? 'Drag to move · R to rotate' : ''; tip.hidden = !target; if (target) { const r = host.getBoundingClientRect(); tip.style.left = `${e.clientX - r.left + 14}px`; tip.style.top = `${e.clientY - r.top + 14}px`; } return; }
    const gg = g;
    if (gg) {
      const p = gg.userData.pick;
      if (p.id === 'chime' && clockT.getElapsedTime() - chimeHoverAt > 0.45) { chimeHoverAt = clockT.getElapsedTime(); chimeSway = Math.min(0.5, chimeSway + 0.18); SND.chime(Math.floor(Math.random() * 6), 0.09); }
      tip.textContent = p.id === 'cat' ? `${C.petName || 'Mochi'} the cat` : p.id === 'book' ? p.data.name : p.id === 'friend' ? `${p.data.name}${p.data.task ? ` — ${p.data.task}` : ''}` : LABELS[p.id];
      tip.hidden = false;
      const r = host.getBoundingClientRect();
      tip.style.left = `${e.clientX - r.left + 14}px`; tip.style.top = `${e.clientY - r.top + 14}px`;
    } else tip.hidden = true;
  };
  let arrange = false, dragging = null;
  const plane = new THREE.Plane(), hitPt = new THREE.Vector3();
  const movable = (g) => { while (g && !DRAG.has(g)) g = g.parent; return g; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let holdTimer = 0;
  function startPet() { petting = true; catMode = catMode === 'chase' ? 'idle' : catMode; wakeCat(); controls.enabled = false; SND.purr(true); opts.onPick('pet', {}); }
  function stopPet() { clearTimeout(holdTimer); if (!petting) return; petting = false; controls.enabled = true; SND.purr(false); catPoke = clockT.getElapsedTime(); }
  const onDown = (e) => {
    downAt = [e.clientX, e.clientY];
    if (!arrange && hit(e)?.userData.pick.id === 'cat') holdTimer = setTimeout(startPet, 380);
    if (!arrange) return;
    const g = movable(hit(e));
    if (!g) return;
    const kind = DRAG.get(g);
    if (kind === 'floor') plane.set(new THREE.Vector3(0, 1, 0), -g.position.y);
    else if (kind === 'back') plane.set(new THREE.Vector3(0, 0, 1), -g.position.z);
    else plane.set(new THREE.Vector3(1, 0, 0), -g.position.x);
    if (!ray.ray.intersectPlane(plane, hitPt)) return;
    // keep the whole object inside the room, not just its centre
    const box = new THREE.Box3().setFromObject(g);
    const half = { x: (box.max.x - box.min.x) / 2, y: (box.max.y - box.min.y) / 2, z: (box.max.z - box.min.z) / 2 };
    const ctr = box.getCenter(new THREE.Vector3()).sub(g.position);
    dragging = { g, kind, off: g.position.clone().sub(hitPt), half, ctr };
    controls.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  const onDrag = (e) => {
    if (!dragging) return false;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    if (!ray.ray.intersectPlane(plane, hitPt)) return true;
    const p = hitPt.add(dragging.off), g = dragging.g, h = dragging.half, c = dragging.ctr;
    const fit = (v, off, half, lo, hi) => clamp(v + off, lo + half, hi - half) - off;
    if (dragging.kind === 'floor') { g.position.x = fit(p.x, c.x, h.x, -4.98, 5); g.position.z = fit(p.z, c.z, h.z, -4.98, 5); }
    else if (dragging.kind === 'back') { g.position.x = fit(p.x, c.x, h.x, -4.95, 5); g.position.y = fit(p.y, c.y, h.y, 0.4, 7.4); }
    else { g.position.z = fit(p.z, c.z, h.z, -4.95, 5); g.position.y = fit(p.y, c.y, h.y, 0.4, 7.4); }
    if (g === rugG) pushFriendsRef?.();
    return true;
  };
  function endDrag() {
    if (!dragging) return;
    const g = dragging.g; dragging = null; controls.enabled = true;
    saveLayout(g);
  }
  function saveLayout(g) {
    const layout = { ...(C.layout || {}) };
    layout[KEYS.get(g)] = [+g.position.x.toFixed(3), +g.position.y.toFixed(3), +g.position.z.toFixed(3), +g.rotation.y.toFixed(4)];
    C = { ...C, layout };
    opts.onPick('layout', { layout });
  }
  const onKey = (e) => {
    if (!arrange || e.target.closest?.('input, textarea')) return;
    if (e.key === 'r' || e.key === 'R') {
      const g = dragging?.g || movable(hovered);
      if (!g || DRAG.get(g) !== 'floor') return;
      g.rotation.y += (e.shiftKey ? -1 : 1) * Math.PI / 2;
      bounce(g); saveLayout(g);
    }
  };
  addEventListener('keydown', onKey);
  let pushFriendsRef = null;
  const onUp = (e) => {
    clearTimeout(holdTimer);
    if (petting) { stopPet(); downAt = null; return; }
    if (dragging) { endDrag(); return; }
    if (arrange) return;
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const g = hit(e);
    if (!g) return;
    const p = g.userData.pick;
    bounce(g);
    if (p.id === 'window') { const order = ['rain', 'snow', 'clear']; setWeather(order[(order.indexOf(weather) + 1) % 3]); opts.onPick('weather', { weather }); return; }
    if (p.id === 'lamp') { setLamp(!lampOn); opts.onPick('lamp', { on: lampOn }); return; }
    if (p.id === 'lights') { const order = ['warm', 'pink', 'blue', 'rainbow']; C = { ...C, lights: order[(order.indexOf(C.lights || 'warm') + 1) % order.length] }; applyCustom(); opts.onPick('lights', { lights: C.lights }); return; }
    if (p.id === 'cat') { const was = catMode; wakeCat(); if (was !== 'sleep') { SND.meow(); hopT = 0.01; } catHappy = 2.5; opts.onPick('cat', { woke: was === 'sleep' }); return; }
    if (p.id === 'yarn') { throwYarn(); return; }
    if (p.id === 'globe') { globeSpin += 9 + Math.random() * 5; SND.whoosh(0.22, 0.9); return; }
    if (p.id === 'cradle') { if (cradleA < 0.1) cradlePh = -Math.PI / 2; cradleA = 0.75; return; }
    if (p.id === 'chime') { chimeSway = 0.7; [0, 2, 4, 1, 3, 5].forEach((n, i) => setTimeout(() => SND.chime(n, 0.2 - i * 0.02), i * 140)); return; }
    opts.onPick(p.id, p.data);
  };
  const onLeave = () => { stopPet(); setGlow(null, false); hovered = null; tip.hidden = true; };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('pointercancel', onLeave);
  window.addEventListener('blur', onLeave);
  const bounces = new Map();
  function bounce(g) { bounces.set(g, 0); }

  // ---------- toys and the cat, stepped every frame
  const ROOM_X = [-3.4, 4.7], ROOM_Z = [-2.3, 4.7];
  function stepToys(dt, t) {
    // yarn: rolls with friction, bounces off the edges of the open floor
    const sp = Math.hypot(yv.x, yv.z);
    if (sp > 0.02 || yarn.position.y > 0.221) {
      yarn.position.x += yv.x * dt; yarn.position.z += yv.z * dt;
      yvy -= 14 * dt; yarn.position.y += yvy * dt;
      if (yarn.position.y < 0.22) { yarn.position.y = 0.22; if (yvy < -1.2) { SND.thump(Math.min(0.35, -yvy * 0.07)); yvy = -yvy * 0.42; } else yvy = 0; }
      const k = Math.exp(-(yarn.position.y > 0.23 ? 0.3 : 1.25) * dt); yv.x *= k; yv.z *= k;
      for (const [ax, [lo, hi]] of [['x', ROOM_X], ['z', ROOM_Z]]) {
        if (yarn.position[ax] < lo || yarn.position[ax] > hi) { yarn.position[ax] = Math.min(hi, Math.max(lo, yarn.position[ax])); yv[ax] *= -0.65; if (sp > 1.2) SND.thump(Math.min(0.3, sp * 0.05)); }
      }
      yarnBall.rotation.x += (yv.z * dt) / 0.22; yarnBall.rotation.z -= (yv.x * dt) / 0.22;
      if (sp <= 0.02) yv.set(0, 0, 0);
    }
    // globe
    globeSpin = Math.max(0.15, globeSpin * Math.exp(-0.55 * dt));
    earth.rotation.y += globeSpin * dt;
    // Newton's cradle: only the end balls swing; each pass through the middle is a clack
    if (cradleA > 0.015) {
      cradlePh += dt * 5.6;
      const s = Math.sin(cradlePh), sg = Math.sign(s);
      swings[0].rotation.z = s < 0 ? cradleA * s : 0;
      swings[4].rotation.z = s > 0 ? cradleA * s : 0;
      if (sg && cradleSign && sg !== cradleSign) SND.clack(Math.min(0.5, cradleA * 0.8));
      cradleSign = sg || cradleSign;
      cradleA *= Math.exp(-0.16 * dt);
    } else { swings[0].rotation.z = swings[4].rotation.z = 0; cradleA = 0; }
    // chime tubes sway and settle
    chimeSway *= Math.exp(-0.9 * dt);
    tubes.forEach((pv, i) => { const w = Math.sin(t * (2.2 + i * 0.37) + i) * (chimeSway + 0.02); pv.rotation.x = Math.cos(pv.userData.a) * w; pv.rotation.z = Math.sin(pv.userData.a) * w; });
  }
  function faceTo(x, z, dt, rate = 8) {
    const want = -Math.atan2(z - cat.position.z, x - cat.position.x);
    let d = want - cat.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    cat.rotation.y += d * Math.min(1, dt * rate);
  }
  function stepCat(dt, t) {
    if (!cat.visible || (dragging && dragging.g === cat)) return;
    if (catMode === 'idle' && !petting && t - catPoke > 80) catMode = 'sleep';
    if (catMode === 'chase') {
      const dx = yarn.position.x - cat.position.x, dz = yarn.position.z - cat.position.z, d = Math.hypot(dx, dz);
      const ys = Math.hypot(yv.x, yv.z);
      faceTo(yarn.position.x, yarn.position.z, dt);
      if (d > 0.85) {
        const sp = Math.min(3.2, 1.2 + d) * dt;
        cat.position.x = Math.min(ROOM_X[1], Math.max(ROOM_X[0], cat.position.x + (dx / d) * sp));
        cat.position.z = Math.min(ROOM_Z[1], Math.max(ROOM_Z[0], cat.position.z + (dz / d) * sp));
        cat.position.y = 0.05 + Math.abs(Math.sin(t * 13)) * 0.07;
      } else if (ys < 1.2 && hopT === 0) {
        // pounce, then maybe bat it away again
        hopT = 0.01; SND.thump(0.4);
        if (chaseBats-- > 0) { const a = Math.atan2(dz, dx) + (Math.random() - 0.5) * 1.6; yv.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); yvy = 1.6; }
        else { catMode = 'idle'; catPoke = t; catHappy = 2; setTimeout(() => SND.meow('mrrp'), 350); }
      }
    } else if (hopT === 0) cat.position.y += (0.05 - cat.position.y) * Math.min(1, dt * 10);
    if (hopT > 0) { hopT += dt * 2.6; cat.position.y = 0.05 + Math.sin(Math.min(1, hopT) * Math.PI) * 0.42; if (hopT >= 1) hopT = 0; }
    const asleep = catMode === 'sleep';
    const closed = asleep || petting;
    eyes.forEach((e) => { e.scale.y += ((closed ? 0.12 : 1) - e.scale.y) * Math.min(1, dt * 10); });
    head.position.y += ((asleep ? 0.44 : 0.62) - head.position.y) * Math.min(1, dt * 4);
    head.rotation.z = asleep ? -0.25 : petting ? Math.sin(t * 3) * 0.12 + 0.15 : catHappy > 0 ? Math.sin(t * 6) * 0.15 : 0;
    tail.rotation.y = Math.sin(t * (catMode === 'chase' ? 12 : catHappy > 0 ? 9 : asleep ? 0.6 : 1.6)) * (catMode === 'chase' || catHappy > 0 ? 0.7 : asleep ? 0.12 : 0.35);
    body.scale.y = 0.75 + Math.sin(t * (asleep ? 0.9 : 1.4)) * (asleep ? 0.035 : 0.02);
    catHappy = Math.max(0, catHappy - dt);
    cat.getWorldPosition(wp);
    if (petting && (petPuff -= dt) <= 0) { petPuff = 0.3; puff(heartTex, wp.x + (Math.random() - 0.5) * 0.6, wp.y + 1.1, wp.z, 0.3); }
    if (asleep && (sleepPuff -= dt) <= 0) { sleepPuff = 1.4; const hp = head.getWorldPosition(new THREE.Vector3()); puff(zTex, hp.x + 0.2, hp.y + 0.35, hp.z, 0.26 + Math.random() * 0.12); }
  }

  // ---------- loop
  let raf = 0, running = true, catHappy = 0, last = performance.now(), frameN = 0;
  const clockT = new THREE.Clock();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = clockT.getElapsedTime();
    controls.update();
    frameN++;
    if (particles.visible) {
      const a = pGeo.attributes.position;
      const speed = weather === 'snow' ? 0.35 : 3.2;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) - speed * dt * (0.7 + (i % 5) * 0.1);
        let x = a.getX(i) + (weather === 'snow' ? Math.sin(t + i) * 0.003 : -0.004);
        if (y < -1.3) { y = 1.3; x = (Math.random() - 0.5) * 3.5; }
        a.setXY(i, x, y);
      }
      a.needsUpdate = true;
    }
    steam.forEach((s) => { const k = (t * 0.35 + s.userData.o) % 1; s.position.set(Math.sin(k * 6 + s.userData.o * 4) * 0.06, 0.5 + k * 0.9, 0); s.scale.setScalar(0.6 + k * 1.4); s.material.opacity = 0.28 * (1 - k); });
    if (S.musicPlaying) { disc.rotation.y -= dt * 3.5; notes.forEach((n) => { const k = (t * 0.3 + n.userData.o) % 1; n.position.set(3.45 + Math.sin(k * 5 + n.userData.o * 6) * 0.35, 2.4 + k * 2, -3.95); n.material.opacity = Math.sin(k * Math.PI) * 0.9; }); }
    else notes.forEach((n) => { n.material.opacity = 0; });
    stepToys(dt, t);
    stepCat(dt, t);
    stepFriends(dt, t);
    // music → fairy lights, speaker LEDs and woofer
    const v = VIZ.sample(t, S.musicPlaying);
    bulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.4 + Math.sin(t * 2 + i) * 0.6 + v.bins[(i * 3) % VIZ.BINS] * 3.2; });
    if (speaker.visible && frameN % 2 === 0) {
      const idle = v.source === 'none';
      for (let c = 0; c < 14; c++) ledBins[c] = idle ? 0.16 + 0.12 * Math.sin(t * 1.3 + c * 0.55) + 0.05 * Math.sin(t * 2.7 - c) : v.bins[Math.min(VIZ.BINS - 1, Math.floor((c / 14) * VIZ.BINS * 0.8))];
      drawLeds(ledBins, S.accent || '#6c47ff', idle);
    }
    cone.position.z = 0.03 + v.bass * 0.06; cap.position.z = 0.06 + v.bass * 0.07; woofer.scale.setScalar(1 + v.bass * 0.05);
    speakerGlow.color.set(S.accent || '#6c47ff'); speakerGlow.intensity = speaker.visible ? 1.2 + v.level * 8 : 0;
    if (bubbleT > 0) { bubbleT -= dt; bubble.material.opacity = Math.min(1, bubbleT * 2, (6.3 - bubbleT) * 4); cat.getWorldPosition(wp); bubble.position.set(wp.x, wp.y + 2.05, wp.z); bubble.visible = cat.visible; }
    else bubble.material.opacity = 0;
    for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.userData.life -= dt; p.position.y += dt * 0.55; p.position.x += p.userData.vx * dt; p.material.opacity = Math.min(1, p.userData.life); if (p.userData.life <= 0) { scene.remove(p); p.material.dispose(); puffs.splice(i, 1); } }
    if (lampOn) lampLight.intensity = 14 + Math.sin(t * 13) * 0.08;
    if (tags.visible && (frameN % 8 === 0)) {
      placeTags();
      const placed = [];
      const v = new THREE.Vector3();
      const sorted = tags.children.map((sp) => { v.copy(sp.position).project(camera); return { sp, x: v.x * W() / 2, y: v.y * H() / 2, d: v.z }; }).sort((a, b) => a.d - b.d);
      for (const t2 of sorted) {
        const clash = placed.some((p) => Math.abs(p.x - t2.x) < 70 && Math.abs(p.y - t2.y) < 24);
        t2.sp.material.opacity = clash ? 0 : 0.92;
        if (!clash) placed.push(t2);
      }
    }
    for (const [g, k] of bounces) {
      const nk = k + dt * 3.2;
      const s = 1 + Math.sin(Math.min(1, nk) * Math.PI) * 0.06;
      g.scale.setScalar(s);
      if (nk >= 1) { g.scale.setScalar(1); bounces.delete(g); } else bounces.set(g, nk);
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const onResize = () => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()); };
  addEventListener('resize', onResize);
  const onVis = () => { running = !document.hidden; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  // the room's hour-dependent sky refreshes every few minutes
  const skyTimer = setInterval(() => sky.redraw(), 5 * 60_000);

  return {
    update(next) {
      const prev = S; S = { ...S, ...next };
      if (next.timer) clockTex.redraw();
      if ('task' in next && next.task !== prev.task) { screen.redraw(); sticky.redraw(); }
      if (next.due) boardTex.redraw();
      if (next.dueDays) calTex.redraw();
      if (next.subjects && JSON.stringify(next.subjects) !== JSON.stringify(prev.subjects)) buildBooks();
      if ('sessions' in next && next.sessions !== prev.sessions) growPlant();
      if ('posterImage' in next || 'posterColors' in next) { if (next.posterImage !== prev.posterImage || JSON.stringify(next.posterColors) !== JSON.stringify(prev.posterColors)) updatePoster(); }
      if ('posters' in next) updateFrames();
      if ('accent' in next || 'wall' in next) { applyTheme(); screen.redraw(); calTex.redraw(); clockTex.redraw(); }
      if (next.custom && JSON.stringify(next.custom) !== JSON.stringify(C)) { const relayout = JSON.stringify(next.custom.layout) !== JSON.stringify(C.layout); C = next.custom; applyCustom(); if (relayout) applyLayout(); }
      if (next.weather && next.weather !== weather) setWeather(next.weather);
      if ('lampOn' in next && next.lampOn !== lampOn) setLamp(next.lampOn);
      if ('bright' in next) { bright = next.bright; applyExposure(); }
    },
    setFriends,
    friendAct,
    say(text) { if (!cat.visible) return false; say(text); if (catMode === 'sleep') { catMode = 'idle'; catPoke = clockT.getElapsedTime(); } return true; },
    setLabels(on) { tags.visible = on; },
    setArrange(on) { arrange = on; setGlow(null, false); hovered = null; tip.hidden = true; if (!on) endDrag(); },
    onRugMove(fn) { pushFriendsRef = fn; },
    pause(p) { running = !p; last = performance.now(); },
    resetView() { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); },
    get weather() { return weather; },
    destroy() {
      cancelAnimationFrame(raf); clearInterval(skyTimer); SND.purr(false);
      removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis);
      removeEventListener('keydown', onKey);
      controls.dispose(); renderer.dispose(); renderer.domElement.remove(); tip.remove();
    },
  };
}
