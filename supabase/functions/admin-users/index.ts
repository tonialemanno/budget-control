import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors(origin: string | null) {
  const allowed =
    origin === "https://aione-test.pages.dev" ||
    Boolean(origin?.match(/^https:\/\/[a-z0-9-]+\.aione-test\.pages\.dev$/i)) ||
    Boolean(origin?.match(/^http:\/\/localhost(?::\d+)?$/i));

  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://aione-test.pages.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

async function listAllUsers(admin: any) {
  const users: any[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405, origin);

  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "Unauthorized" }, 401, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const caller = userData?.user;
  if (userError || !caller) return json({ error: "Unauthorized" }, 401, origin);

  const { data: adminRow, error: adminError } = await admin
    .from("app_admins")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (adminError || !adminRow) return json({ error: "Forbidden" }, 403, origin);

  if (req.method === "GET") {
    let users;
    try { users = await listAllUsers(admin); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Benutzer konnten nicht geladen werden." }, 400, origin); }

    const userIds = users.map((u) => u.id);
    const [
      { data: accessRows, error: accessError },
      { data: presenceRows, error: presenceError },
      { data: profileRows, error: profileError },
    ] = await Promise.all([
      userIds.length
        ? admin.from("user_module_access").select("user_id,module_key,enabled").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("user_presence").select("user_id,last_seen_at,route,app_version,device_label").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("profiles").select("user_id,display_name,locale").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (accessError) return json({ error: accessError.message }, 400, origin);
    if (presenceError) return json({ error: presenceError.message }, 400, origin);
    if (profileError) return json({ error: profileError.message }, 400, origin);

    const modulesByUser = new Map<string, Record<string, boolean>>();
    for (const row of accessRows || []) {
      const current = modulesByUser.get(row.user_id) || {};
      current[row.module_key] = Boolean(row.enabled);
      modulesByUser.set(row.user_id, current);
    }

    const presenceByUser = new Map<string, any>();
    for (const row of presenceRows || []) presenceByUser.set(row.user_id, row);

    const profileByUser = new Map<string, any>();
    for (const row of profileRows || []) profileByUser.set(row.user_id, row);

    return json({
      caller_id: caller.id,
      users: users.map((user) => {
        const presence = presenceByUser.get(user.id) || null;
        const profile = profileByUser.get(user.id) || null;
        return {
          id: user.id,
          email: user.email,
          display_name: profile?.display_name || user.user_metadata?.display_name || "",
          locale: profile?.locale || user.user_metadata?.locale || "de-CH",
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          confirmed_at: user.email_confirmed_at,
          modules: modulesByUser.get(user.id) || {},
          presence,
        };
      }),
    }, 200, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400, origin);
  }

  const action = String(body.action || "create_user");

  if (action === "set_module") {
    const userId = String(body.userId || "");
    const moduleKey = String(body.moduleKey || "");
    const enabled = Boolean(body.enabled);
    if (!userId || !moduleKey) return json({ error: "Benutzer und Modul sind erforderlich." }, 400, origin);
    if (moduleKey === "core" || moduleKey === "money") return json({ error: "Finance Core und Mein Geld können nicht deaktiviert werden." }, 400, origin);

    const { error } = await admin
      .from("user_module_access")
      .upsert({ user_id: userId, module_key: moduleKey, enabled }, { onConflict: "user_id,module_key" });
    if (error) return json({ error: error.message }, 400, origin);
    return json({ ok: true }, 200, origin);
  }

  if (action === "set_locale") {
    const userId = String(body.userId || "");
    const locale = String(body.locale || "");
    const allowedLocales = new Set(["de-CH", "de-DE", "it-CH", "it-IT"]);
    if (!userId || !allowedLocales.has(locale)) return json({ error: "Ungültige Sprache / Region." }, 400, origin);

    const { error } = await admin
      .from("profiles")
      .update({ locale })
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 400, origin);

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { locale },
    });
    if (authError) return json({ error: authError.message }, 400, origin);
    return json({ ok: true, locale }, 200, origin);
  }

  if (action === "set_password") {
    const userId = String(body.userId || "");
    const password = String(body.password || "");
    if (!userId || password.length < 8) return json({ error: "Mindestens 8 Zeichen erforderlich." }, 400, origin);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400, origin);
    return json({ ok: true }, 200, origin);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayName = String(body.displayName || "").trim();
  const locale = ["de-CH", "de-DE", "it-CH", "it-IT"].includes(String(body.locale || "")) ? String(body.locale) : "de-CH";
  if (!email || !email.includes("@")) return json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, 400, origin);
  if (password.length < 8) return json({ error: "Das temporäre Passwort muss mindestens 8 Zeichen lang sein." }, 400, origin);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, locale },
  });
  if (error) return json({ error: error.message }, 400, origin);

  const { error: profileUpsertError } = await admin
    .from("profiles")
    .upsert({ user_id: data.user.id, display_name: displayName || null, locale }, { onConflict: "user_id" });
  if (profileUpsertError) return json({ error: profileUpsertError.message }, 400, origin);

  return json({
    user: {
      id: data.user.id,
      email: data.user.email,
      display_name: data.user.user_metadata?.display_name || "",
      locale,
      created_at: data.user.created_at,
      confirmed_at: data.user.email_confirmed_at,
    },
  }, 201, origin);
});