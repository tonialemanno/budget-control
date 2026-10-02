const SUPABASE_URL = 'https://bktzavcnaqwdwlwldbjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KKcZR8y1gAmC2MESwNa6pA_JFtC92ps';
const SESSION_KEY = 'finance-v2-session';

let session = readSession();
let refreshInFlight = null;

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(next) {
  if (!next) {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const expiresAt = next.expires_at || (next.expires_in ? Math.floor(Date.now() / 1000) + Number(next.expires_in) : null);
  session = { ...next, expires_at: expiresAt };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Server antwortet nicht. Bitte erneut versuchen.');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function authRequest(path, { method = 'POST', body, token } = {}) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse(response);
}

async function refreshSession() {
  if (!session?.refresh_token) return saveSession(null);
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const token = session?.refresh_token;
      if (!token) return saveSession(null);
      const data = await authRequest('token?grant_type=refresh_token', { body: { refresh_token: token } });
      return saveSession(data);
    } catch {
      return saveSession(null);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function ensureSession() {
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at <= now + 60) return refreshSession();
  return session;
}

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const active = await ensureSession();
  if (!active?.access_token) throw new Error('Nicht angemeldet.');
  const requestHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${active.access_token}`,
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse(response);
}

async function rpc(name, body = {}) {
  return rest(`rpc/${name}`, { method: 'POST', body });
}

async function invokeFunction(name, { method = 'POST', body } = {}) {
  const active = await ensureSession();
  if (!active?.access_token) throw new Error('Nicht angemeldet.');
  const response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${active.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse(response);
}

async function storageUpload(bucket, path, file) {
  const active = await ensureSession();
  if (!active?.access_token) throw new Error('Nicht angemeldet.');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${active.access_token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  return parseResponse(response);
}


async function storageDelete(bucket, paths) {
  const active = await ensureSession();
  if (!active?.access_token) throw new Error('Nicht angemeldet.');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${active.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  return parseResponse(response);
}

async function storageDownload(bucket, path) {
  const active = await ensureSession();
  if (!active?.access_token) throw new Error('Nicht angemeldet.');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${active.access_token}` },
  });
  if (!response.ok) throw new Error(`Dokument konnte nicht geladen werden (${response.status}).`);
  return response.blob();
}

export const backend = Object.freeze({
  async signIn({ email, password }) {
    const data = await authRequest('token?grant_type=password', { body: { email, password } });
    saveSession(data);
    return data;
  },

  async signOut() {
    const active = await ensureSession();
    let remoteRevoked = true;
    try {
      if (active?.access_token) await authRequest('logout', { method: 'POST', token: active.access_token });
    } catch {
      // A failed/blocked network request must never trap the user in the app.
      // The local session is always cleared; the server token expires normally if
      // the revoke request could not be delivered.
      remoteRevoked = false;
    } finally {
      saveSession(null);
    }
    return { remoteRevoked };
  },

  async restoreSession() {
    const active = await ensureSession();
    if (!active?.access_token) return null;
    try {
      const user = await authRequest('user', { method: 'GET', token: active.access_token });
      return { ...active, user };
    } catch {
      return saveSession(null);
    }
  },

  async updatePassword(password) {
    const active = await ensureSession();
    if (!active?.access_token) throw new Error('Nicht angemeldet.');
    return authRequest('user', { method: 'PUT', token: active.access_token, body: { password } });
  },

  adminListUsers() { return invokeFunction('admin-users', { method: 'GET' }); },
  adminCreateUser(payload) { return invokeFunction('admin-users', { body: { action: 'create_user', ...payload } }); },
  adminCreateDemo(payload = {}) { return invokeFunction('admin-users', { body: { action: 'create_demo', ...payload } }); },
  adminSetModule(payload) { return invokeFunction('admin-users', { body: { action: 'set_module', ...payload } }); },
  adminSetLocale(payload) { return invokeFunction('admin-users', { body: { action: 'set_locale', ...payload } }); },
  adminSetPassword(payload) { return invokeFunction('admin-users', { body: { action: 'set_password', ...payload } }); },
  householdMembers(payload) { return invokeFunction('household-members', { body: payload }); },
  fxRates() { return invokeFunction('fx-rates', { method: 'GET' }); },

  getSession() { return session ? { ...session } : null; },
  rest,
  rpc,
  storageUpload,
  storageDownload,
  storageDelete,
});
