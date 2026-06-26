// Safety Advisor — Stripe webhook (Supabase Edge Function, Deno)
// ---------------------------------------------------------------------------
// Stripe calls this when a subscription is created, paid, changed, or
// cancelled, and it updates the organisation's subscription_status.
//
// IMPORTANT: deploy with "Verify JWT" OFF — Stripe calls this without a
// Supabase login. Security comes from verifying Stripe's signature.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// (SUPABASE_URL / _SERVICE_ROLE_KEY are injected automatically.)
// ---------------------------------------------------------------------------

import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!STRIPE_SECRET_KEY) return new Response("STRIPE_SECRET_KEY not set", { status: 500 });
    if (!WEBHOOK_SECRET) return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing signature", { status: 400 });

    const raw = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider());
    } catch (e) {
      return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
    }

    const applySubscription = async (sub: Stripe.Subscription) => {
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await admin.from("organisations").update({
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }).eq("stripe_customer_id", customerId);
    };

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          await applySubscription(await stripe.subscriptions.retrieve(session.subscription as string));
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }
});
