// Safety Advisor / SafeIntel — AI proxy (Supabase Edge Function, Deno)
// ---------------------------------------------------------------------------
// Holds the Anthropic key server-side, requires a logged-in user, enforces a
// per-user daily rate limit, validates input, then proxies the call. Returns
// Anthropic's raw response shape unchanged so the frontend parsing is the same.
//
// Deploy:  redeploy this function (it's the AI one) after running
//          migration-ratelimit.sql.
// Secrets: ANTHROPIC_API_KEY  (SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY
//          are injected automatically).
// ---------------------------------------------------------------------------

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-6";
const DAILY_LIMIT = 150;            // AI calls per user per day
const MAX_PROMPT_CHARS = 200_000;   // reject absurdly large prompts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain at launch
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

    // 2. Validate input.
    let body: { prompt?: unknown; maxTokens?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const { prompt, maxTokens } = body ?? {};
    if (!prompt) return json({ error: "Missing prompt" }, 400);
    if (typeof prompt !== "string" && !Array.isArray(prompt)) return json({ error: "Invalid prompt" }, 400);
    if (JSON.stringify(prompt).length > MAX_PROMPT_CHARS) return json({ error: "Prompt too large" }, 413);
    const max = Math.min(Math.max(Number(maxTokens) || 1000, 1), 4000);

    // 3. Per-user daily rate limit (atomic increment in the DB).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: count } = await admin.rpc("bump_ai_usage", { uid: user.id });
    if (typeof count === "number" && count > DAILY_LIMIT) {
      return json({ error: "Daily AI limit reached. Try again tomorrow." }, 429);
    }

    // 4. Call Anthropic with the SERVER's key.
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
    return json(data, res.status);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
