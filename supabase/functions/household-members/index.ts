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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "Unauthorized" }, 401, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const caller = userData?.user;
  if (userError || !caller) return json({ error: "Unauthorized" }, 401, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400, origin); }

  const householdId = String(body.householdId || "");
  const action = String(body.action || "list");
  if (!householdId) return json({ error: "Haushalt fehlt." }, 400, origin);

  const { data: callerMember, error: memberError } = await admin
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", caller.id)
    .maybeSingle();
  if (memberError || !callerMember) return json({ error: "Forbidden" }, 403, origin);

  if (action === "list") {
    const { data: members, error } = await admin
      .from("household_members")
      .select("user_id,role,created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400, origin);

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (usersError) return json({ error: usersError.message }, 400, origin);
    const byId = new Map(usersData.users.map((u) => [u.id, u]));

    return json({
      members: (members || []).map((m) => {
        const u = byId.get(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          email: u?.email || "",
          display_name: u?.user_metadata?.display_name || "",
          created_at: m.created_at,
        };
      }),
    }, 200, origin);
  }

  if (!["owner", "admin"].includes(callerMember.role)) {
    return json({ error: "Nur Owner/Admin dürfen Mitglieder verwalten." }, 403, origin);
  }

  if (action === "add") {
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "viewer");
    if (!["admin", "editor", "viewer"].includes(role)) return json({ error: "Ungültige Rolle." }, 400, origin);

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (usersError) return json({ error: usersError.message }, 400, origin);
    const user = usersData.users.find((u) => (u.email || "").toLowerCase() === email);
    if (!user) return json({ error: "Benutzer wurde nicht gefunden. Bitte zuerst im Admin-Bereich anlegen." }, 404, origin);

    const { error } = await admin.from("household_members").upsert({
      household_id: householdId,
      user_id: user.id,
      role,
    }, { onConflict: "household_id,user_id" });
    if (error) return json({ error: error.message }, 400, origin);
    return json({ ok: true }, 200, origin);
  }

  if (action === "remove") {
    const userId = String(body.userId || "");
    if (!userId) return json({ error: "Benutzer fehlt." }, 400, origin);

    const { data: target, error: targetError } = await admin
      .from("household_members")
      .select("role")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (targetError || !target) return json({ error: "Mitglied nicht gefunden." }, 404, origin);
    if (target.role === "owner") return json({ error: "Der Owner kann nicht entfernt werden." }, 400, origin);

    const { error } = await admin
      .from("household_members")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 400, origin);
    return json({ ok: true }, 200, origin);
  }

  return json({ error: "Unbekannte Aktion." }, 400, origin);
});
