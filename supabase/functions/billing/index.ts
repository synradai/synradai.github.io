// Safety Advisor — billing (Supabase Edge Function, Deno)
// ---------------------------------------------------------------------------
// One authenticated endpoint for a logged-in user to:
//   action 'checkout' → start a subscription (returns a Stripe Checkout URL)
//   action 'portal'   → manage/cancel an existing subscription (portal URL)
//
// Deploy with "Verify JWT" ON (default). Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID
// (SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY are injected automatically.)
//
// Everything is created inside the handler so a missing secret returns a clear
// JSON error instead of crashing the worker on startup.
// ---------------------------------------------------------------------------

import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!STRIPE_SECRET_KEY) return json({ error: "STRIPE_SECRET_KEY is not set in Edge Function secrets." }, 500);
    if (!PRICE_ID) return json({ error: "STRIPE_PRICE_ID is not set in Edge Function secrets." }, 500);

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action === "portal" ? "portal" : "checkout";
    const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : SUPABASE_URL;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile) return json({ error: "No organisation for user" }, 400);
    const { data: org } = await admin.from("organisations").select("*").eq("id", profile.org_id).single();
    if (!org) return json({ error: "Organisation not found" }, 400);

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { org_id: org.id } });
      customerId = customer.id;
      await admin.from("organisations").update({ stripe_customer_id: customerId }).eq("id", org.id);
    }

    if (action === "portal") {
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
      return json({ url: portal.url });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${returnUrl}?billing=success`,
      cancel_url: `${returnUrl}?billing=cancel`,
      allow_promotion_codes: true,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
