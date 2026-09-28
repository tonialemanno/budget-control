const SUPABASE_URL = 'https://bktzavcnaqwdwlwldbjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KKcZR8y1gAmC2MESwNa6pA_JFtC92ps';
const SESSION_KEY = 'finance-v1-session';

let session = readSession();

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

  const expiresAt = next.expires_at || (
    next.expires_in ? Math.floor(Date.now() / 1000) + Number(next.expires_in) : null
  );

  session = { ...next, expires_at: expiresAt };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function authRequest(path, { method = 'POST', body, token } = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
}

async function refreshSession() {
  if (!session?.refresh_token) return saveSession(null);

  try {
    const data = await authRequest('token?grant_type=refresh_token', {
      body: { refresh_token: session.refresh_token },
    });
    return saveSession(data);
  } catch {
    return saveSession(null);
  }
}

async function ensureSession() {
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at <= now + 60) {
    return refreshSession();
  }

  return session;
}

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const activeSession = await ensureSession();
  if (!activeSession?.access_token) throw new Error('Nicht angemeldet.');

  const requestHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${activeSession.access_token}`,
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
}

export const backend = Object.freeze({
  async signUp({ email, password, displayName }) {
    const data = await authRequest('signup', {
      body: {
        email,
        password,
        data: { display_name: displayName || '' },
      },
    });

    if (data?.access_token) saveSession(data);
    return data;
  },

  async signIn({ email, password }) {
    const data = await authRequest('token?grant_type=password', {
      body: { email, password },
    });
    saveSession(data);
    return data;
  },

  async signOut() {
    const activeSession = await ensureSession();
    try {
      if (activeSession?.access_token) {
        await authRequest('logout', {
          method: 'POST',
          token: activeSession.access_token,
        });
      }
    } finally {
      saveSession(null);
    }
  },

  async restoreSession() {
    const activeSession = await ensureSession();
    if (!activeSession?.access_token) return null;

    try {
      const user = await authRequest('user', {
        method: 'GET',
        token: activeSession.access_token,
      });
      return { ...activeSession, user };
    } catch {
      return saveSession(null);
    }
  },

  getSession() {
    return session ? { ...session } : null;
  },

  rest,
});
