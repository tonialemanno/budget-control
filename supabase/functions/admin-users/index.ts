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

function demoPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `Demo-${token}!7`;
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

async function permanentlyDeleteUser(admin: any, userId: string) {
  const { data: objects, error: objectError } = await admin.rpc("list_owned_storage_objects_v1", {
    p_user_id: userId,
  });
  if (objectError) throw objectError;

  const byBucket = new Map<string, string[]>();
  for (const row of objects || []) {
    const bucket = String(row.bucket_id || "");
    const name = String(row.name || "");
    if (!bucket || !name) continue;
    const current = byBucket.get(bucket) || [];
    current.push(name);
    byBucket.set(bucket, current);
  }

  for (const [bucket, paths] of byBucket.entries()) {
    for (let offset = 0; offset < paths.length; offset += 500) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 500));
      if (error) throw error;
    }
  }

  const { data: purge, error: purgeError } = await admin.rpc("purge_user_finance_v1", {
    p_user_id: userId,
  });
  if (purgeError) throw purgeError;

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
  if (deleteError) throw deleteError;

  return {
    ok: true,
    deleted_user_id: userId,
    deleted_storage_objects: (objects || []).length,
    purge,
  };
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

  let body: Record<string, unknown> = {};
  let action = "";
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      return json({ error: "Ungültige Anfrage." }, 400, origin);
    }
    action = String(body.action || "create_user");

    if (action === "delete_self") {
      if (String(body.confirmation || "") !== "DELETE") {
        return json({ error: "Bestätigung für die endgültige Löschung fehlt." }, 400, origin);
      }
      const confirmationEmail = String(body.confirmationEmail || "").trim().toLowerCase();
      if (!confirmationEmail || confirmationEmail !== String(caller.email || "").trim().toLowerCase()) {
        return json({ error: "Die eingegebene E-Mail-Adresse stimmt nicht überein." }, 400, origin);
      }
      try {
        const result = await permanentlyDeleteUser(admin, caller.id);
        return json(result, 200, origin);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Konto konnte nicht gelöscht werden." }, 400, origin);
      }
    }
  }

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
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [
      { data: accessRows, error: accessError },
      { data: presenceRows, error: presenceError },
      { data: profileRows, error: profileError },
      { data: activitySummaryRows, error: activitySummaryError },
      { data: activityRows, error: activityError },
    ] = await Promise.all([
      userIds.length
        ? admin.from("user_module_access").select("user_id,module_key,enabled").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("user_presence").select("user_id,last_seen_at,route,app_version,device_label,activity_state,last_interaction_at,session_started_at").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("profiles").select("user_id,display_name,locale").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("user_activity_summary").select("user_id,last_activity_at,last_module,last_action,last_household_id").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("user_activity_events")
            .select("user_id,module_key,action_kind,occurred_at")
            .in("user_id", userIds)
            .gte("occurred_at", since30Days)
            .order("occurred_at", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (accessError) return json({ error: accessError.message }, 400, origin);
    if (presenceError) return json({ error: presenceError.message }, 400, origin);
    if (profileError) return json({ error: profileError.message }, 400, origin);
    if (activitySummaryError) return json({ error: activitySummaryError.message }, 400, origin);
    if (activityError) return json({ error: activityError.message }, 400, origin);

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

    const activitySummaryByUser = new Map<string, any>();
    for (const row of activitySummaryRows || []) activitySummaryByUser.set(row.user_id, row);

    const activityByUser = new Map<string, any[]>();
    for (const row of activityRows || []) {
      const current = activityByUser.get(row.user_id) || [];
      current.push(row);
      activityByUser.set(row.user_id, current);
    }

    return json({
      caller_id: caller.id,
      users: users.map((user) => {
        const presence = presenceByUser.get(user.id) || null;
        const profile = profileByUser.get(user.id) || null;
        const activitySummary = activitySummaryByUser.get(user.id) || null;
        const events = activityByUser.get(user.id) || [];
        const moduleCounts = new Map<string, { module_key: string; count: number; last_at: string }>();
        for (const event of events) {
          const current = moduleCounts.get(event.module_key);
          if (current) current.count += 1;
          else moduleCounts.set(event.module_key, { module_key: event.module_key, count: 1, last_at: event.occurred_at });
        }
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
          activity: {
            last_at: activitySummary?.last_activity_at || null,
            last_module: activitySummary?.last_module || null,
            last_action: activitySummary?.last_action || null,
            last_30_days: events.length,
            modules: [...moduleCounts.values()].sort((a, b) => b.count - a.count || String(b.last_at).localeCompare(String(a.last_at))),
            recent: events.slice(0, 8).map((event) => ({
              module_key: event.module_key,
              action_kind: event.action_kind,
              occurred_at: event.occurred_at,
            })),
          },
        };
      }),
    }, 200, origin);
  }

  if (action === "delete_user") {
    const userId = String(body.userId || "");
    const confirmationEmail = String(body.confirmationEmail || "").trim().toLowerCase();
    if (!userId || !confirmationEmail) return json({ error: "Benutzer und Bestätigungs-E-Mail sind erforderlich." }, 400, origin);
    if (userId === caller.id) return json({ error: "Das eigene Konto bitte über „Mein Profil“ löschen." }, 400, origin);

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    const targetUser = target?.user;
    if (targetError || !targetUser) return json({ error: "Benutzer wurde nicht gefunden." }, 404, origin);
    if (String(targetUser.email || "").trim().toLowerCase() !== confirmationEmail) {
      return json({ error: "Die eingegebene E-Mail-Adresse stimmt nicht überein." }, 400, origin);
    }

    try {
      const result = await permanentlyDeleteUser(admin, userId);
      return json(result, 200, origin);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Benutzer konnte nicht endgültig gelöscht werden." }, 400, origin);
    }
  }

  if (action === "create_demo") {
    const email = String(body.email || "demo@example.com").trim().toLowerCase();
    const requestedLocale = String(body.locale || "de-CH");
    const allowedLocales = new Set(["de-CH", "de-DE", "it-CH", "it-IT", "en-CH", "en-GB"]);
    const locale = allowedLocales.has(requestedLocale) ? requestedLocale : "de-CH";
    if (!email || !email.includes("@")) return json({ error: "Bitte eine gültige Demo-E-Mail-Adresse angeben." }, 400, origin);

    const password = demoPassword();
    let users;
    try { users = await listAllUsers(admin); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Demo-Benutzer konnten nicht geprüft werden." }, 400, origin); }

    let demoUser = users.find((user) => String(user.email || "").toLowerCase() === email) || null;
    let created = false;

    if (!demoUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Finance Demo", locale, demo: true },
      });
      if (error || !data.user) return json({ error: error?.message || "Demo-Benutzer konnte nicht erstellt werden." }, 400, origin);
      demoUser = data.user;
      created = true;
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(demoUser.id, {
        password,
        user_metadata: { ...(demoUser.user_metadata || {}), display_name: "Finance Demo", locale, demo: true },
      });
      if (error || !data.user) return json({ error: error?.message || "Demo-Benutzer konnte nicht aktualisiert werden." }, 400, origin);
      demoUser = data.user;
    }

    const { data: seeded, error: seedError } = await admin.rpc("provision_demo_instance", {
      p_user_id: demoUser.id,
      p_locale: locale,
    });
    if (seedError) return json({ error: seedError.message }, 400, origin);

    const { data: enriched, error: enrichError } = await admin.rpc("enrich_demo_instance_v1", {
      p_user_id: demoUser.id,
    });
    if (enrichError) return json({ error: enrichError.message }, 400, origin);

    return json({
      ok: true,
      created,
      reset: !created,
      email,
      password,
      user_id: demoUser.id,
      household_id: seeded?.household_id || null,
      enriched,
      locale,
    }, 200, origin);
  }

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
    const allowedLocales = new Set(["de-CH", "de-DE", "it-CH", "it-IT", "en-CH", "en-GB"]);
    if (!userId || !allowedLocales.has(locale)) return json({ error: "Ungültige Sprache / Region." }, 400, origin);

    const { error } = await admin
      .from("profiles")
      .update({ locale })
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 400, origin);

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
  const locale = ["de-CH", "de-DE", "it-CH", "it-IT", "en-CH", "en-GB"].includes(String(body.locale || "")) ? String(body.locale) : "de-CH";
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