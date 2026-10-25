// Safe Intelligence beta — one-off Airtable copy.
// Deploy to the beta project only (ref rocobdfuvaecrkzsxqub).
// This function refuses to run if SUPABASE_URL contains the live ref.
//
// The personal access token arrives in the request body, is used for this
// call, and is not saved. Nothing here writes the token to the database,
// storage, or logs.
//
// Gateway verify_jwt is off (supabase/config.toml) because the beta project
// signs ES256 tokens. auth.getUser() still runs.

import { createClient } from "jsr:@supabase/supabase-js@2";

const LIVE_PROJECT_REF = "rgkiagqexoafmtxhrlqo";
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

const DEFAULT_ORIGINS = [
  "https://synradai.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4174",
  "http://127.0.0.1:4174",
];

function allowedOrigins() {
  const extra = (Deno.env.get("BETA_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function clientApiKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default || Object.values(parsed).find(Boolean) || "";
  } catch {
    return raw.startsWith("sb_publishable_") ? raw : "";
  }
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, 500);
  }
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(", ").slice(0, 500);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const named = record.name || record.email || record.url;
    if (typeof named === "string") return named.slice(0, 500);
  }
  return "";
}

async function airtableGet(path: string, token: string) {
  const response = await fetch(`https://api.airtable.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    return { ok: false as const, status: 401, error: "Airtable refused that token. It was not saved." };
  }
  if (response.status === 403) {
    return { ok: false as const, status: 400, error: "That token cannot read this base. It was not saved." };
  }
  if (response.status === 404) {
    return { ok: false as const, status: 404, error: "Airtable could not find that base or table." };
  }
  if (response.status === 429) {
    return { ok: false as const, status: 429, error: "Airtable is busy. Wait a minute and try the copy again." };
  }
  if (!response.ok) {
    return { ok: false as const, status: 502, error: "Airtable did not return that copy." };
  }
  const data = await response.json();
  return { ok: true as const, data };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (supabaseUrl.includes(LIVE_PROJECT_REF)) {
      return json({ error: "Refusing to run on the live Safe Intelligence project." }, 403);
    }
    const anonKey = clientApiKey();
    if (!supabaseUrl || !anonKey) return json({ error: "Supabase env is not set" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    let body: { token?: string; baseId?: string; tableName?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Bad JSON" }, 400);
    }

    const token = String(body.token || "").trim();
    const baseId = String(body.baseId || "").trim();
    const tableName = String(body.tableName || "").trim();
    if (!token || token.length > 200 || /\s/.test(token)) {
      return json({ error: "Paste an Airtable personal access token." }, 400);
    }
    if (!/^app[a-zA-Z0-9]+$/.test(baseId) || baseId.length > 32) {
      return json({ error: "That base ID does not look right." }, 400);
    }
    if (tableName && (tableName.length > 200 || /[\r\n]/.test(tableName))) {
      return json({ error: "That table name does not look right." }, 400);
    }

    if (!tableName) {
      const listed = await airtableGet(`/v0/meta/bases/${baseId}/tables`, token);
      if (!listed.ok) return json({ error: listed.error }, listed.status);
      const tables = Array.isArray(listed.data?.tables) ? listed.data.tables : [];
      return json({
        tables: tables.map((table: { id?: string; name?: string; fields?: { name?: string }[] }) => ({
          id: String(table.id || ""),
          name: String(table.name || ""),
          fields: (table.fields || []).map((field) => String(field.name || "")).filter(Boolean),
        })),
      });
    }

    const fields = new Set<string>();
    const rows: { id: string; fields: Record<string, string> }[] = [];
    let offset = "";
    let truncated = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
      if (offset) query.set("offset", offset);
      const encoded = encodeURIComponent(tableName);
      const listed = await airtableGet(`/v0/${baseId}/${encoded}?${query.toString()}`, token);
      if (!listed.ok) return json({ error: listed.error }, listed.status);
      const records = Array.isArray(listed.data?.records) ? listed.data.records : [];
      for (const record of records) {
        const raw = (record?.fields || {}) as Record<string, unknown>;
        const flat: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw)) {
          fields.add(key);
          flat[key] = cellText(value);
        }
        rows.push({ id: String(record?.id || ""), fields: flat });
      }
      offset = String(listed.data?.offset || "");
      if (!offset) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }

    return json({ fields: [...fields], rows, truncated });
  } catch {
    return json({ error: "Could not import that copy." }, 500);
  }
});
