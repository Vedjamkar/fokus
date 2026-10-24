// Study together: a small live room relayed through free public MQTT brokers over secure websockets.
// Direct browser-to-browser links (WebRTC) fail between different networks without a relay server,
// and PeerJS's free one is unreliable, so every message goes through a broker instead. Everyone
// connects to two brokers at once and drops duplicates, so one broker going down doesn't matter.
// There's no host: the room lives as long as anyone is in it.

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const TOPIC = (room) => `fokus-v1/rooms/${room}`;
const SESS = 'studyhaven:room';
const STALE = 35_000; // a member who hasn't been heard from in this long has left

export const TG = { room: '', isHost: false, me: null, members: new Map(), chat: [], status: 'off', error: '' };
const subs = new Set();
export const onChange = (fn) => subs.add(fn);
const emit = () => subs.forEach((fn) => fn(TG));
let onTimerFn = () => {};
export const onTimer = (fn) => { onTimerFn = fn; };

let clients = [], beat = 0, giveUp = 0;
const seen = new Set(), seenOrder = [];
const lastSeen = new Map();
const remember = (v) => { try { v ? sessionStorage.setItem(SESS, JSON.stringify(v)) : sessionStorage.removeItem(SESS); } catch {} };
const recalled = () => { try { return JSON.parse(sessionStorage.getItem(SESS)); } catch { return null; } };
const mid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const code = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

function loadMqtt() {
  if (window.mqtt) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
    s.onload = res; s.onerror = () => rej(new Error('Couldn’t load the connection library. Check your internet.'));
    document.head.append(s);
  });
}

function send(msg) {
  msg.mid ||= mid(); msg.from = TG.me?.id;
  markSeen(msg.mid);
  const body = JSON.stringify(msg);
  for (const c of clients) if (c.connected) c.publish(TOPIC(TG.room), body, { qos: 0 });
}
function markSeen(id) { seen.add(id); seenOrder.push(id); if (seenOrder.length > 600) seen.delete(seenOrder.shift()); }

function handle(raw) {
  let msg; try { msg = JSON.parse(raw); } catch { return; }
  if (!msg?.mid || seen.has(msg.mid)) return; // the same message arrives once per broker
  markSeen(msg.mid);
  if (msg.from === TG.me?.id) return;
  if (msg.t === 'presence' && msg.member?.id) {
    const isNew = !TG.members.has(msg.member.id);
    TG.members.set(msg.member.id, msg.member); lastSeen.set(msg.member.id, Date.now());
    if (isNew && msg.hello) { announce(); shareHistory(); } // say hi back so they see us straight away
  }
  if (msg.t === 'bye') { TG.members.delete(msg.id); lastSeen.delete(msg.id); }
  if (msg.t === 'chat' && msg.line) addChat(msg.line);
  if (msg.t === 'history' && Array.isArray(msg.lines)) msg.lines.forEach(addChat);
  if (msg.t === 'timer') onTimerFn(msg.timer, msg.by);
  emit();
}
function addChat(line) {
  if (!line?.id || TG.chat.some((l) => l.id === line.id)) return;
  TG.chat.push(line); TG.chat.sort((a, b) => a.at - b.at); TG.chat = TG.chat.slice(-80);
}
// whoever has been here longest catches newcomers up on the chat
function shareHistory() {
  const mine = TG.me?.joinedAt || 0;
  const oldest = [...TG.members.values()].every((m) => m.id === TG.me.id || !m.joinedAt || m.joinedAt >= mine);
  const lines = TG.chat.filter((l) => !l.sys).slice(-40);
  if (oldest && lines.length) send({ t: 'history', lines });
}
function announce(hello) { send({ t: 'presence', member: TG.me, hello: !!hello }); }

function prune() {
  const now = Date.now(); let changed = false;
  for (const [id, at] of lastSeen) if (now - at > STALE) { TG.members.delete(id); lastSeen.delete(id); changed = true; }
  if (changed) emit();
}

async function enter(room, me, created) {
  await loadMqtt();
  leave(true);
  room = room.trim().toUpperCase();
  TG.me = { ...me, joinedAt: Date.now() }; TG.room = room; TG.isHost = !!created;
  TG.members = new Map([[me.id, TG.me]]); TG.status = 'connecting'; TG.error = '';
  TG.chat = [{ id: mid(), from: 'FOKUS', text: created ? `Room ${room} is open. Share the invite link with friends.` : `You joined room ${room}.`, at: Date.now(), sys: true }];
  emit();
  clients = BROKERS.map((url) => {
    const c = window.mqtt.connect(url, { clientId: `fokus_${mid()}`, clean: true, keepalive: 30, reconnectPeriod: 3000, connectTimeout: 10_000 });
    c.on('connect', () => {
      c.subscribe(TOPIC(room), { qos: 0 }, () => {
        if (TG.status !== 'on') { TG.status = 'on'; clearTimeout(giveUp); remember({ room }); emit(); }
        announce(true);
      });
    });
    c.on('message', (_t, payload) => handle(payload.toString()));
    return c;
  });
  // if no broker answers at all, say so instead of spinning forever
  giveUp = setTimeout(() => {
    if (TG.status === 'on') return;
    leave(true);
    TG.status = 'error'; TG.room = room;
    TG.error = 'Couldn’t reach the room servers. Check your internet; some school or work Wi-Fi blocks them, and a phone hotspot usually works.';
    emit();
  }, 15_000);
  beat = setInterval(() => { if (TG.status === 'on') { announce(); prune(); } }, 10_000);
}

export const create = (me) => enter(code(), me, true);
export const join = (room, me) => enter(room, me, false);
export function resume(me) { const r = recalled(); if (!r?.room) return false; join(r.room, me); return true; }

export function updateMe(me) {
  if (TG.status !== 'on') return;
  TG.me = { ...TG.me, ...me }; TG.members.set(me.id, TG.me);
  announce(); emit();
}
export function say(text) {
  if (TG.status !== 'on' || !text.trim()) return;
  const line = { id: mid(), from: TG.me.name, color: TG.me.color, text: text.trim().slice(0, 400), at: Date.now() };
  addChat(line); send({ t: 'chat', line }); emit();
}
export function shareTimer(timer) {
  if (TG.status !== 'on') return;
  send({ t: 'timer', timer, by: TG.me.name });
}
export function leave(silent) {
  clearInterval(beat); clearTimeout(giveUp);
  if (TG.status === 'on' && TG.me) send({ t: 'bye', id: TG.me.id });
  const old = clients; clients = [];
  setTimeout(() => old.forEach((c) => { try { c.end(true); } catch {} }), 150); // let the goodbye go out first
  lastSeen.clear();
  if (!silent) remember(null);
  Object.assign(TG, { room: '', isHost: false, members: new Map(), chat: [], status: 'off', error: '' });
  if (!silent) emit();
}
export const health = () => ({ status: TG.status, brokers: clients.filter((c) => c.connected).length });
addEventListener('pagehide', () => { if (TG.status === 'on') send({ t: 'bye', id: TG.me.id }); });
