// Google Calendar sync, entirely in the browser (there is no server).
// One-way: FOKUS pushes due items (all-day events) and weekly lectures (recurring events) into its own
// calendar called "FOKUS". The narrow `calendar.app.created` scope means it can only touch calendars it
// made itself, never your other ones. The access token lives in memory only and is never saved.
// Also here: a plain .ics export that needs no Google setup at all.

import { parseISO, iso } from './store.js';

const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const API = 'https://www.googleapis.com/calendar/v3';
const CAL_NAME = 'FOKUS';
// Paste your Google OAuth client ID here once (see README) and nobody using the app has to set anything up:
// they just press Connect. A client ID is public by design, so it's safe to commit.
export const BUILT_IN_CLIENT_ID = '137520622527-mjd6u0be26jv9cecsu0il85riibp3eca.apps.googleusercontent.com';
export const clientIdOf = (cfg) => cfg.clientId || BUILT_IN_CLIENT_ID;
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

let token = null, tokenExp = 0, gisLoading = null, client = null;

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const nextDay = (ds) => { const d = parseISO(ds); d.setDate(d.getDate() + 1); return iso(d); };
const compact = (ds) => ds.replaceAll('-', '');

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = ok;
    s.onerror = () => { gisLoading = null; no(new Error('Couldn’t reach Google. Check your connection.')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export const isConnected = () => !!token && Date.now() < tokenExp;
export function disconnect() {
  if (token) try { google.accounts.oauth2.revoke(token); } catch {}
  token = null; tokenExp = 0;
}

async function connect(clientId) {
  await loadGIS();
  return new Promise((ok, no) => {
    client = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPE,
      callback: (r) => {
        if (r.error) return no(new Error(r.error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google said: ${r.error_description || r.error}`));
        token = r.access_token; tokenExp = Date.now() + (r.expires_in - 60) * 1000; ok();
      },
      error_callback: (e) => no(new Error(e.type === 'popup_closed' ? 'The Google window was closed.' : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google popup. Allow popups for this site and try again.' : `Google sign-in failed (${e.type || 'unknown'}).`)),
    });
    client.requestAccessToken({ prompt: token === null ? '' : undefined });
  });
}

async function call(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { token = null; throw new Error('Google sign-in expired. Press Sync again.'); }
  if (!res.ok && !(method === 'DELETE' && (res.status === 404 || res.status === 410))) {
    const j = await res.json().catch(() => ({}));
    const e = new Error(j.error?.message || `Google Calendar error ${res.status}`); e.status = res.status; throw e;
  }
  return res.status === 204 || method === 'DELETE' ? null : res.json();
}

// ---- turning FOKUS items into calendar events
const firstDate = (l, from) => { // first date on/after `from` that falls on one of the lecture's weekdays
  const d = parseISO(from);
  for (let i = 0; i < 7; i++, d.setDate(d.getDate() + 1)) if (l.days.includes(d.getDay())) return iso(d);
  return from;
};

export function eventsFor(S) {
  const sub = (id) => S.subjects.find((s) => s.id === id);
  const out = [];
  for (const d of S.due) {
    const s = sub(d.subjectId);
    out.push({
      key: `due:${d.id}`,
      body: {
        summary: `${d.done ? '✓ ' : ''}${d.title}`,
        description: [s?.name, d.kind, d.priority && `${d.priority} priority`].filter(Boolean).join(' · '),
        start: { date: d.date }, end: { date: nextDay(d.date) },
        transparency: 'transparent',
      },
    });
  }
  const { termStart, termEnd } = S.settings;
  for (const l of S.lectures) {
    const s = sub(l.subjectId);
    if (!l.days.length) continue;
    const day = firstDate(l, termStart);
    out.push({
      key: `lec:${l.id}`,
      body: {
        summary: s?.code ? `${s.code} · ${s.name}` : s?.name || 'Lecture',
        location: l.room || undefined,
        start: { dateTime: `${day}T${l.start}:00`, timeZone: tz() }, end: { dateTime: `${day}T${l.end}:00`, timeZone: tz() },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${l.days.map((n) => DAYS[n]).join(',')};UNTIL=${compact(termEnd)}T235959Z`],
      },
    });
  }
  return out;
}

// Push everything. `cfg` is S.settings.gcal ({ clientId, calendarId, map }); the caller saves it afterwards.
export async function sync(S, cfg, onProgress = () => {}) {
  const clientId = clientIdOf(cfg);
  if (!clientId) throw new Error('Google sync isn’t set up yet. Open “Set up Google sync” below.');
  if (!isConnected()) await connect(clientId);

  if (cfg.calendarId) { // the user may have deleted it in Google; recreate if so
    try { await call(`/calendars/${encodeURIComponent(cfg.calendarId)}`); } catch (e) { if (e.status === 404 || e.status === 410) { cfg.calendarId = ''; cfg.map = {}; } else throw e; }
  }
  if (!cfg.calendarId) cfg.calendarId = (await call('/calendars', 'POST', { summary: CAL_NAME, timeZone: tz() })).id;
  const base = `/calendars/${encodeURIComponent(cfg.calendarId)}/events`;

  const wanted = eventsFor(S);
  const keep = new Set(wanted.map((w) => w.key));
  let made = 0, updated = 0, removed = 0, i = 0;

  for (const w of wanted) {
    onProgress(++i, wanted.length);
    const id = cfg.map[w.key];
    if (id) {
      try { await call(`${base}/${id}`, 'PUT', w.body); updated++; continue; }
      catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
    }
    cfg.map[w.key] = (await call(base, 'POST', w.body)).id; made++;
  }
  for (const [key, id] of Object.entries(cfg.map)) { // things deleted in FOKUS since last time
    if (keep.has(key)) continue;
    await call(`${base}/${id}`, 'DELETE'); delete cfg.map[key]; removed++;
  }
  cfg.lastSync = Date.now();
  return { made, updated, removed };
}

// ---- .ics export (opens in Apple Calendar, Outlook, and Google Calendar's Import)
const esc = (t) => String(t ?? '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
const fold = (line) => line.match(/.{1,70}/gu).join('\r\n ');

export function buildICS(S) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FOKUS//Study planner//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${CAL_NAME}`];
  for (const { key, body: b } of eventsFor(S)) {
    lines.push('BEGIN:VEVENT', `UID:${key.replace(':', '-')}@fokus`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(b.summary)}`);
    if (b.description) lines.push(`DESCRIPTION:${esc(b.description)}`);
    if (b.location) lines.push(`LOCATION:${esc(b.location)}`);
    if (b.start.date) lines.push(`DTSTART;VALUE=DATE:${compact(b.start.date)}`, `DTEND;VALUE=DATE:${compact(b.end.date)}`, 'TRANSP:TRANSPARENT');
    else {
      const t = (x) => x.dateTime.replace(/[-:]/g, '');
      lines.push(`DTSTART;TZID=${b.start.timeZone}:${t(b.start)}`, `DTEND;TZID=${b.end.timeZone}:${t(b.end)}`, b.recurrence[0]);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}
