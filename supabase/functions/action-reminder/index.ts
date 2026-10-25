// Safe Intelligence beta — email an overdue action owner.
// Deploy to the beta project only (ref rocobdfuvaecrkzsxqub).
// This function refuses to run if SUPABASE_URL contains the live ref.
//
// Gateway verify_jwt is off (supabase/config.toml) because the beta project
// signs ES256 tokens. auth.getUser() still runs. The action read is the
// caller's own organisation through row level security.
//
// The signed-in user updates the action, so the hse_records audit trigger
// records the caller. Email uses Resend only when RESEND_API_KEY and
// RESEND_FROM are set. This function does not call the signup mailer.
//
// Secrets (beta project):
//   RESEND_API_KEY
//   RESEND_FROM     verified sender, e.g. Safe Intelligence <notifications@example.com>

import { createClient } from "jsr:@supabase/supabase-js@2";

const LIVE_PROJECT_REF = "rgkiagqexoafmtxhrlqo";

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

function perthToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

    let body: { actionId?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Bad JSON" }, 400);
    }
    const actionId = String(body.actionId || "").trim();
    if (!actionId) return json({ error: "Missing action." }, 400);

    const { data: row, error: readErr } = await userClient
      .from("hse_records")
      .select("id,kind,payload")
      .eq("id", actionId)
      .maybeSingle();
    if (readErr) return json({ error: "Could not read that action." }, 500);
    if (!row || row.kind !== "action") return json({ error: "That action is not in this organisation." }, 404);

    const payload = (row.payload || {}) as { fields?: Record<string, string>; status?: string };
    const fields = payload.fields || {};
    const today = perthToday();
    const due = String(fields.due || "");
    const overdue = /^\d{4}-\d{2}-\d{2}$/.test(due) && due < today && payload.status !== "done";
    if (!overdue) return json({ reminded: false, sent: false, reason: "This action is not overdue." }, 400);
    if (String(fields.remindedOn || "") === today) {
      return json({ reminded: true, sent: false, reason: "Already reminded today." });
    }

    const nextPayload = {
      ...payload,
      fields: { ...fields, remindedOn: today },
      updatedAt: new Date().toISOString(),
    };
    const { error: writeErr } = await userClient
      .from("hse_records")
      .update({ payload: nextPayload, updated_at: nextPayload.updatedAt })
      .eq("id", actionId);
    if (writeErr) return json({ error: "Could not record the reminder." }, 500);

    const apiKey = Deno.env.get("RESEND_API_KEY") || "";
    const from = Deno.env.get("RESEND_FROM") || "";
    const ownerId = String(fields.ownerId || "").trim();
    if (!apiKey || !from) {
      return json({
        reminded: true,
        sent: false,
        reason: "Reminder recorded in the app. Email is not configured on this project yet.",
      });
    }
    if (!ownerId) {
      return json({
        reminded: true,
        sent: false,
        reason: "Reminder recorded in the app. This action has no organisation owner to email.",
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!serviceKey) {
      return json({ reminded: true, sent: false, reason: "Reminder recorded in the app. Email could not be sent." });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: ownerData, error: ownerErr } = await admin.auth.admin.getUserById(ownerId);
    const email = ownerData?.user?.email || "";
    if (ownerErr || !email) {
      return json({
        reminded: true,
        sent: false,
        reason: "Reminder recorded in the app. The owner has no email address.",
      });
    }

    const title = String(fields.title || "Action").slice(0, 180);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Overdue action: ${title}`,
        text: [
          `${title} is overdue.`,
          `Due ${due}. Owner ${String(fields.owner || "").slice(0, 120)}.`,
          "Open the actions register: https://synradai.github.io/beta/#/hse/actions",
        ].join("\n"),
      }),
    });
    if (res.status === 429) {
      return json({
        reminded: true,
        sent: false,
        reason: "The email provider hit its send limit. The reminder is recorded in the app. Try again tomorrow.",
      });
    }
    if (!res.ok) {
      return json({ reminded: true, sent: false, reason: "Reminder recorded in the app. Email could not be sent." });
    }
    return json({ reminded: true, sent: true });
  } catch (error) {
    return json({ error: (error as Error).message || "Could not send the reminder." }, 500);
  }
});
