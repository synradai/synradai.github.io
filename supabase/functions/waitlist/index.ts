// Safe Intelligence — public waitlist signup (Supabase Edge Function, Deno)
// ---------------------------------------------------------------------------
// Takes { email, name, token } from the public waitlist page, verifies the
// Turnstile token with Cloudflare (so bots can't stuff the list), then stores
// the signup. Deploy with "Verify JWT" OFF — it's a public endpoint; security
// comes from the captcha check.
// Secrets: TURNSTILE_SECRET (SUPABASE_URL / _SERVICE_ROLE_KEY auto-injected).
// ---------------------------------------------------------------------------

import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://synradai.github.io", "http://localhost:5173"];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type",
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
    const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET");
    if (!TURNSTILE_SECRET) return json({ error: "TURNSTILE_SECRET not set" }, 500);

    let body: { email?: unknown; name?: unknown; token?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
    const name = String(body.name ?? "").trim().slice(0, 120);
    const token = String(body.token ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (!token) return json({ error: "Verification incomplete — give it a second and try again." }, 400);

    // Verify the captcha token with Cloudflare.
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(TURNSTILE_SECRET)}&response=${encodeURIComponent(token)}`,
    });
    const result = await verify.json().catch(() => null);
    if (!result?.success) return json({ error: "Verification failed — refresh the page and try again." }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("waitlist").insert({ email, name, source: "waitlist-page" });
    // Duplicate email = already on the list = success as far as the visitor cares.
    if (error && !/duplicate|unique/i.test(error.message)) return json({ error: "Could not save — try again shortly." }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
