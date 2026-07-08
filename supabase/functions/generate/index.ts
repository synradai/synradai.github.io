// Safety Advisor / SafeIntel — AI proxy (Supabase Edge Function, Deno)
// ---------------------------------------------------------------------------
// Holds the Anthropic key server-side, requires a logged-in user WITH an
// active subscription or unexpired trial, enforces a per-user daily rate
// limit, validates input, then proxies the call. Returns Anthropic's raw
// response shape unchanged so the frontend parsing is the same.
//
// Deploy:  redeploy this function (deployed as "quick-worker") after running
//          migration-ratelimit.sql.
// Secrets: ANTHROPIC_API_KEY  (SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY
//          are injected automatically).
// ---------------------------------------------------------------------------

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-6";
// AI calls per user per day. Tunable via the AI_DAILY_LIMIT secret so the cap
// can be raised as revenue scales — no redeploy needed.
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT")) || 150;
const MAX_PROMPT_CHARS = 200_000;   // reject absurdly large prompts

// Only the app itself may call this from a browser (plus local dev).
const ALLOWED_ORIGINS = ["https://synradai.github.io", "http://localhost:5173"];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

    // 1. Require a logged-in user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Not authenticated" }, 401);

    // 2. Require an active subscription or unexpired trial (server-side —
    //    the client paywall alone can be bypassed by calling this endpoint
    //    directly, which would run up the Anthropic bill for free).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile) return json({ error: "No organisation for user" }, 403);
    const { data: org } = await admin.from("organisations")
      .select("subscription_status, trial_ends_at").eq("id", profile.org_id).single();
    const subActive = org && (org.subscription_status === "active" || org.subscription_status === "trialing");
    const trialActive = org && org.trial_ends_at && new Date(org.trial_ends_at).getTime() > Date.now();
    if (!subActive && !trialActive) {
      return json({ error: "Subscription required. Your free trial has ended." }, 402);
    }

    // 3. Validate input.
    let body: { prompt?: unknown; maxTokens?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const { prompt, maxTokens } = body ?? {};
    if (!prompt) return json({ error: "Missing prompt" }, 400);
    if (typeof prompt !== "string" && !Array.isArray(prompt)) return json({ error: "Invalid prompt" }, 400);
    if (JSON.stringify(prompt).length > MAX_PROMPT_CHARS) return json({ error: "Prompt too large" }, 413);
    const max = Math.min(Math.max(Number(maxTokens) || 1000, 1), 4000);

    // 4. Per-user daily rate limit (atomic increment in the DB). Fail CLOSED:
    //    if the limiter is missing/broken we refuse rather than allow
    //    unmetered spending.
    const { data: count, error: rlErr } = await admin.rpc("bump_ai_usage", { uid: user.id });
    if (rlErr || typeof count !== "number") {
      return json({ error: "Rate limiter unavailable — try again shortly." }, 503);
    }
    if (count > DAILY_LIMIT) {
      return json({ error: "Daily AI limit reached. Try again tomorrow." }, 429);
    }

    // 5. Call Anthropic with the SERVER's key.
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: MODEL, max_tokens: max, messages: [{ role: "user", content: prompt }] }),
      });
    } catch (e) {
      return json({ error: `Upstream network error: ${(e as Error).message}` }, 502);
    }

    const data = await res.json().catch(() => null);
    if (!data) return json({ error: `Bad response from Anthropic (HTTP ${res.status})` }, 502);

    // Record per-user token usage — makes heavy users visible long before the
    // monthly spend cap is threatened. Best-effort: never fails the request.
    if (res.ok) {
      const tin = Number(data?.usage?.input_tokens) || 0;
      const tout = Number(data?.usage?.output_tokens) || 0;
      if (tin || tout) {
        try { await admin.rpc("add_ai_tokens", { uid: user.id, tin, tout }); } catch (_) { /* best effort */ }
      }
    }

    return json(data, res.status);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
