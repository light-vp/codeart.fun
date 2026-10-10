// Client for the PHP/MySQL API in /api. Everything degrades gracefully: when
// the API isn't reachable (static hosting, local file server) the app keeps
// progress in localStorage and simply hides the account features.

const BASE = new URL('../api/', import.meta.url);

class Unavailable extends Error {}

async function call(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(new URL(path, BASE), {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-CodeArt': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Unavailable('network');
  }
  if (!(res.headers.get('content-type') || '').includes('application/json')) throw new Unavailable('not an API');
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const account = {
  available: false,
  user: null,
  listeners: new Set(),

  onChange(fn) { this.listeners.add(fn); },
  emit() { for (const fn of this.listeners) fn(this.user); },

  async init() {
    try {
      const data = await call('me.php');
      this.available = true;
      this.user = data.user;
    } catch (err) {
      this.available = !(err instanceof Unavailable);
      this.user = null;
    }
    this.emit();
    return this;
  },

  async login(email, password) {
    const data = await call('auth.php', { method: 'POST', body: { action: 'login', email, password } });
    this.user = data.user;
    this.emit();
    return data.user;
  },

  async register(name, email, password) {
    const data = await call('auth.php', { method: 'POST', body: { action: 'register', name, email, password } });
    this.user = data.user;
    this.emit();
    return data.user;
  },

  async logout() {
    try { await call('auth.php', { method: 'POST', body: { action: 'logout' } }); } catch { /* already gone */ }
    this.user = null;
    this.emit();
  },

  /** Upload local progress/drafts and get the merged server state back. */
  sync(solved, drafts) { return call('sync.php', { method: 'POST', body: { solved, drafts } }); },
  progress() { return call('progress.php'); },
  submit(levelId, code, passed, total) { return call('submit.php', { method: 'POST', body: { level_id: levelId, code, passed, total } }); },
  saveDraft(levelId, code) { return call('draft.php', { method: 'POST', body: { level_id: levelId, code } }); },
  submissions(levelId) { return call(`submissions.php?level=${encodeURIComponent(levelId)}`); },
};
