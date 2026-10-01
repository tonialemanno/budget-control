import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function cors(origin: string | null) {
  const allowed =
    origin === "https://aione-test.pages.dev" ||
    Boolean(origin?.match(/^https:\/\/[a-z0-9-]+\.aione-test\.pages\.dev$/i)) ||
    Boolean(origin?.match(/^http:\/\/localhost(?::\d+)?$/i));
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://aione-test.pages.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405, origin);

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const url = new URL("https://data.snb.ch/api/cube/devkum/data/json/en");
  url.searchParams.set("dimSel", "D0(M0),D1(EUR1,GBP1,USD1)");
  url.searchParams.set("fromDate", monthKey(from));
  url.searchParams.set("toDate", monthKey(now));

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return json({ error: `SNB HTTP ${response.status}` }, 502, origin);
    const payload = await response.json();
    const rates: Record<string, number> = { CHF: 1 };
    const dates: Record<string, string> = {};

    for (const series of payload?.timeseries || []) {
      const key = String(series?.metadata?.key || "");
      const currency = key.match(/,(EUR1|GBP1|USD1)\}/)?.[1]?.replace("1", "");
      if (!currency) continue;
      const values = (series?.values || []).filter((row: Record<string, unknown>) => Number.isFinite(Number(row?.value)));
      const last = values.at(-1);
      if (!last) continue;
      rates[currency] = Number(last.value);
      dates[currency] = String(last.date || "");
    }

    if (!rates.EUR || !rates.USD || !rates.GBP) {
      return json({ error: "SNB-Antwort enthielt nicht alle benötigten Währungen." }, 502, origin);
    }

    const asOf = Object.values(dates).sort().at(-1) || null;
    return json({
      base: "CHF",
      rates,
      as_of: asOf,
      source: "SNB",
      method: "monthly_average_11am_chf",
      source_url: "https://data.snb.ch/en/topics/ziredev/cube/devkum",
    }, 200, origin);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "SNB FX konnte nicht geladen werden." }, 502, origin);
  }
});
