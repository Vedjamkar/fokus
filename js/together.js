// Study together: a small live room over WebRTC (PeerJS's free public broker does the handshake).
// The person who creates the room is the hub; everyone else connects to them and the hub relays.

const PREFIX = 'studyhaven-room-';
export const TG = { room: '', isHost: false, me: null, members: new Map(), chat: [], status: 'off', error: '' };
let peer = null, hostConn = null;
const conns = new Set();
const subs = new Set();
export const onChange = (fn) => subs.add(fn);
const emit = () => subs.forEach((fn) => fn(TG));
let onTimerFn = () => {};
export const onTimer = (fn) => { onTimerFn = fn; };

function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('Couldn’t load the connection library. Check your internet.'));
    document.head.append(s);
  });
}
const code = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const membersList = () => [...TG.members.values()];

function broadcast(msg, except) { for (const c of conns) if (c !== except && c.open) c.send(msg); }
function hubState() { broadcast({ t: 'state', members: membersList(), chat: TG.chat.slice(-60) }); }

function handle(msg, from) {
  if (TG.isHost) {
    if (msg.t === 'hello' || msg.t === 'update') { from._mid = msg.member.id; TG.members.set(msg.member.id, msg.member); hubState(); }
    if (msg.t === 'chat') { TG.chat.push(msg.line); broadcast({ t: 'chat', line: msg.line }); }
    if (msg.t === 'timer') { broadcast(msg, from); onTimerFn(msg.timer, msg.by); }
  } else {
    if (msg.t === 'state') { TG.members = new Map(msg.members.map((m) => [m.id, m])); TG.chat = msg.chat; }
    if (msg.t === 'chat') TG.chat.push(msg.line);
    if (msg.t === 'timer') onTimerFn(msg.timer, msg.by);
  }
  emit();
}

function wire(conn) {
  conn.on('data', (m) => handle(m, conn));
  conn.on('close', () => {
    conns.delete(conn);
    if (TG.isHost && conn._mid) { TG.members.delete(conn._mid); hubState(); emit(); }
    if (!TG.isHost && conn === hostConn) { TG.status = 'error'; TG.error = 'The room’s host left, so the room closed.'; TG.members.clear(); emit(); }
  });
}

export async function create(me) {
  await loadPeer();
  leave(true);
  TG.me = me; TG.isHost = true; TG.status = 'connecting'; TG.error = ''; emit();
  const room = code();
  peer = new window.Peer(PREFIX + room);
  peer.on('open', () => {
    TG.room = room; TG.status = 'on';
    TG.members = new Map([[me.id, me]]);
    TG.chat = [{ from: 'Study Haven', text: `Room ${room} is open. Share the code with friends.`, at: Date.now(), sys: true }];
    emit();
  });
  peer.on('connection', (c) => { conns.add(c); wire(c); c.on('open', hubState); });
  peer.on('error', (e) => { TG.status = 'error'; TG.error = e.type === 'unavailable-id' ? 'That room code is taken. Try again.' : 'Couldn’t open a room. Check your internet and try again.'; emit(); });
}

export async function join(room, me) {
  await loadPeer();
  leave(true);
  room = room.trim().toUpperCase();
  TG.me = me; TG.isHost = false; TG.status = 'connecting'; TG.error = ''; emit();
  peer = new window.Peer();
  peer.on('open', () => {
    hostConn = peer.connect(PREFIX + room, { reliable: true });
    conns.add(hostConn); wire(hostConn);
    hostConn.on('open', () => { TG.room = room; TG.status = 'on'; hostConn.send({ t: 'hello', member: me }); emit(); });
  });
  peer.on('error', (e) => { TG.status = 'error'; TG.error = e.type === 'peer-unavailable' ? `No room called ${room} is open right now.` : 'Couldn’t connect. Check your internet and try again.'; emit(); });
}

export function updateMe(me) {
  if (TG.status !== 'on') return;
  TG.me = me;
  if (TG.isHost) { TG.members.set(me.id, me); hubState(); emit(); }
  else hostConn?.open && hostConn.send({ t: 'update', member: me });
}
export function say(text) {
  if (TG.status !== 'on' || !text.trim()) return;
  const line = { from: TG.me.name, color: TG.me.color, text: text.trim().slice(0, 400), at: Date.now() };
  if (TG.isHost) { TG.chat.push(line); broadcast({ t: 'chat', line }); emit(); }
  else hostConn?.send({ t: 'chat', line });
}
export function shareTimer(timer) {
  if (TG.status !== 'on') return;
  const msg = { t: 'timer', timer, by: TG.me.name };
  if (TG.isHost) broadcast(msg); else hostConn?.send(msg);
}
export function leave(silent) {
  for (const c of conns) try { c.close(); } catch {}
  conns.clear(); hostConn = null;
  try { peer?.destroy(); } catch {}
  peer = null;
  Object.assign(TG, { room: '', isHost: false, members: new Map(), chat: [], status: 'off', error: '' });
  if (!silent) emit();
}
