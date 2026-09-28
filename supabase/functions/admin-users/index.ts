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
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) return json({ error: error.message }, 400, origin);

    return json({
      users: data.users.map((user) => ({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || "",
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        confirmed_at: user.email_confirmed_at,
      })),
    }, 200, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400, origin);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayName = String(body.displayName || "").trim();

  if (!email || !email.includes("@")) return json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, 400, origin);
  if (password.length < 8) return json({ error: "Das temporäre Passwort muss mindestens 8 Zeichen lang sein." }, 400, origin);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) return json({ error: error.message }, 400, origin);

  return json({
    user: {
      id: data.user.id,
      email: data.user.email,
      display_name: data.user.user_metadata?.display_name || "",
      created_at: data.user.created_at,
      confirmed_at: data.user.email_confirmed_at,
    },
  }, 201, origin);
});
