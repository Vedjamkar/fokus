// Study together: a small live room over WebRTC (PeerJS's free public broker does the handshake).
// The person who creates the room is the hub; everyone else connects to them and the hub relays.

const PREFIX = 'studyhaven-room-';
// the room this tab is in survives a refresh: the host re-claims the same code, guests rejoin it
const SESS = 'studyhaven:room';
const remember = (v) => { try { v ? sessionStorage.setItem(SESS, JSON.stringify(v)) : sessionStorage.removeItem(SESS); } catch {} };
const recalled = () => { try { return JSON.parse(sessionStorage.getItem(SESS)); } catch { return null; } };
let retryTimer = 0, joinTimer = 0;
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
    // the host may just be refreshing: keep trying to get back in for a little while
    if (!TG.isHost && conn === hostConn && TG.status !== 'off') rejoin(TG.room, TG.me, 0);
  });
}

export async function create(me, reuse, tries = 0) {
  await loadPeer();
  leave(true);
  TG.me = me; TG.isHost = true; TG.status = 'connecting'; TG.error = ''; emit();
  const room = reuse || code();
  peer = new window.Peer(PREFIX + room);
  peer.on('open', () => {
    TG.room = room; TG.status = 'on'; remember({ room, host: true });
    TG.members = new Map([[me.id, me]]);
    TG.chat = [{ from: 'FOKUS', text: reuse ? `Room ${room} is back open.` : `Room ${room} is open. Share the invite link with friends.`, at: Date.now(), sys: true }];
    emit();
  });
  peer.on('connection', (c) => { conns.add(c); wire(c); c.on('open', hubState); });
  peer.on('disconnected', () => { if (TG.status === 'on') try { peer.reconnect(); } catch {} });
  peer.on('error', (e) => {
    // after a refresh the broker can hold the old code for a few seconds
    if (e.type === 'unavailable-id' && reuse && tries < 6) { TG.status = 'reconnecting'; emit(); retryTimer = setTimeout(() => create(me, reuse, tries + 1), 3000); return; }
    if (TG.status === 'on' && e.type !== 'unavailable-id') return; // a friend's connection failing shouldn't close the room
    TG.status = 'error'; TG.error = e.type === 'unavailable-id' ? 'That room code is taken. Try again.' : 'Couldn’t open a room. Check your internet and try again.'; remember(null); emit();
  });
}

export async function join(room, me, quiet) {
  await loadPeer();
  leave(true);
  room = room.trim().toUpperCase();
  TG.me = me; TG.isHost = false; TG.room = room; TG.status = quiet ? 'reconnecting' : 'connecting'; TG.error = ''; emit();
  const fail = (msg) => { clearTimeout(joinTimer); if (quiet) return rejoin(room, me, quiet); TG.status = 'error'; TG.error = msg; remember(null); try { peer?.destroy(); } catch {} emit(); };
  // a connection that never opens fires no error, so give up after a while instead of spinning forever
  joinTimer = setTimeout(() => { if (TG.status !== 'on') fail('Couldn’t reach the room. Check the code, make sure the host still has FOKUS open, then try again. Some school or work Wi-Fi blocks this; a phone hotspot usually works.'); }, quiet ? 8000 : 15000);
  peer = new window.Peer();
  peer.on('open', () => {
    hostConn = peer.connect(PREFIX + room, { reliable: true });
    conns.add(hostConn); wire(hostConn);
    hostConn.on('open', () => { clearTimeout(joinTimer); TG.status = 'on'; remember({ room, host: false }); hostConn.send({ t: 'hello', member: TG.me }); emit(); });
    hostConn.on('error', () => fail('The connection to the room failed. Try again.'));
  });
  peer.on('disconnected', () => { if (TG.status === 'on') try { peer.reconnect(); } catch {} });
  peer.on('error', (e) => { if (TG.status === 'on' && e.type !== 'peer-unavailable') return; fail(e.type === 'peer-unavailable' ? `No room called ${room} is open right now.` : 'Couldn’t connect. Check your internet and try again.'); });
}
function rejoin(room, me, n) {
  if (n >= 14) { TG.status = 'error'; TG.error = 'Lost the room: the host has left.'; TG.members.clear(); remember(null); emit(); return; }
  TG.status = 'reconnecting'; emit();
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => join(room, me, n + 1), 2500);
}
// Background tabs get their timers throttled, so the broker can quietly drop a host without the
// 'disconnected' event ever reaching us. Check now and then, and whenever the tab comes back.
export const health = () => ({ status: TG.status, open: !!peer?.open, disconnected: !!peer?.disconnected, destroyed: !!peer?.destroyed });
function watchdog() {
  if (TG.status !== 'on' || !peer) return;
  if (peer.destroyed) { if (TG.isHost) create(TG.me, TG.room); else rejoin(TG.room, TG.me, 0); }
  else if (peer.disconnected) try { peer.reconnect(); } catch {}
}
setInterval(watchdog, 8000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) watchdog(); });
// called once at startup: get back into the room this tab was in before a refresh
export function resume(me) {
  const r = recalled();
  if (!r?.room) return false;
  if (r.host) create(me, r.room); else join(r.room, me, 1);
  return true;
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
  clearTimeout(retryTimer); clearTimeout(joinTimer);
  if (!silent) remember(null);
  for (const c of conns) try { c.close(); } catch {}
  conns.clear(); hostConn = null;
  try { peer?.destroy(); } catch {}
  peer = null;
  Object.assign(TG, { room: '', isHost: false, members: new Map(), chat: [], status: 'off', error: '' });
  if (!silent) emit();
}
