// Safe Intelligence beta — Grok AI proxy (Supabase Edge Function, Deno).
// ---------------------------------------------------------------------------
// NOT DEPLOYED. Leave this here until the new beta project exists.
// Do not deploy it to the live project (ref rgkiagqexoafmtxhrlqo). The
// function refuses to run if SUPABASE_URL contains that ref.
//
// Deploy (beta project only):
//   supabase functions deploy generate-grok --project-ref <beta-ref>
//
// Secrets:
//   XAI_API_KEY          required for the default provider
//   XAI_TEXT_MODEL       optional, default grok-4.7 (text)
//   XAI_VISION_MODEL     optional, default grok-4.7 (image input; same model.
//                        grok-4.7 accepts text and images on the Responses API)
//   AI_PROVIDER          xai (default) | anthropic
//   AI_FALLBACK          none (default) | anthropic
//                        anthropic is used only when this flag is set and
//                        xAI fails with a network / 429 / 5xx error
//   ANTHROPIC_API_KEY    required only for the Claude flag
//   CLAUDE_MODEL         optional, default claude-sonnet-4-6
//   AI_DAILY_LIMIT       optional, default 80 (public.ai_usage via bump_ai_usage)
//
// grok-4.7 is documented on POST /v1/responses. Chat completions is the
// legacy endpoint and does not carry this model's reasoning field, so a
// high default effort can return an empty answer. This function calls
// /v1/responses with reasoning.effort "low".
//
// Gateway verify_jwt is off for this function (supabase/config.toml).
// The beta project signs ES256 tokens, which that gateway check rejects.
// The auth.getUser() check below stays.
//
// This function does not check billing or the free-trial clock, and it does
// not return 402. The beta field test is not gated on the 14-day trial.
// Leave quick-worker (Anthropic + billing) deployed as it is.
//
// Returns the same { content: [{ type, text }] } shape as the live proxy
// so callers can read content[0].text. Also returns provider and model.
// ---------------------------------------------------------------------------

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  SYSTEM,
  anthropicShape,
  assertImagesOk,
  resolveProvider,
  selectModel,
  outputTokenBudget,
  REASONING_EFFORT,
  textFromAnthropic,
  textFromResponses,
  toAnthropicMessages,
  toOpenAIMessages,
  toResponsesInput,
} from "./convert.js";

const LIVE_PROJECT_REF = "rgkiagqexoafmtxhrlqo";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT")) || 80;
const MAX_BODY_CHARS = 8_000_000;

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

    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: "Request too large" }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Bad JSON" }, 400);
    }

    let messages;
    try {
      messages = toOpenAIMessages(body);
      assertImagesOk(messages);
    } catch (error) {
      return json({ error: (error as Error).message }, 400);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!serviceKey) return json({ error: "Rate limiter unavailable — try again shortly." }, 503);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: count, error: rlErr } = await admin.rpc("bump_ai_usage", { uid: userData.user.id });
    if (rlErr || typeof count !== "number") {
      return json({ error: "Rate limiter unavailable — try again shortly." }, 503);
    }
    if (count > DAILY_LIMIT) return json({ error: "Daily AI limit reached. Try again tomorrow." }, 429);

    const providerFlag = Deno.env.get("AI_PROVIDER") || "xai";
    const fallbackFlag = Deno.env.get("AI_FALLBACK") || "none";
    const first = resolveProvider({ provider: providerFlag, fallback: fallbackFlag, xaiFailed: false });

    const callXai = async () => {
      const key = Deno.env.get("XAI_API_KEY") || "";
      if (!key) return { ok: false, status: 500, error: "XAI_API_KEY not set" };
      const { model, task } = selectModel(body, {
        textModel: Deno.env.get("XAI_TEXT_MODEL") || undefined,
        visionModel: Deno.env.get("XAI_VISION_MODEL") || undefined,
      });
      const max = outputTokenBudget(body.maxTokens);
      let res: Response;
      try {
        res = await fetch("https://api.x.ai/v1/responses", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            instructions: SYSTEM,
            input: toResponsesInput(messages),
            reasoning: { effort: REASONING_EFFORT },
            max_output_tokens: max,
            store: false,
          }),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (error) {
        return { ok: false, status: 502, error: `xAI network error: ${(error as Error).message}`, model, task };
      }
      const data = await res.json().catch(() => null);
      const text = textFromResponses(data);
      if (!res.ok || !text) {
        return { ok: false, status: res.status, error: "Grok request failed", model, task, retryable: res.status === 429 || res.status >= 500 };
      }
      return { ok: true, model, task, text };
    };

    const callClaude = async () => {
      const key = Deno.env.get("ANTHROPIC_API_KEY") || "";
      if (!key) return { ok: false, status: 500, error: "ANTHROPIC_API_KEY not set" };
      const model = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-6";
      const max = Math.min(Math.max(Number(body.maxTokens) || 1200, 1), 4000);
      let anthropicMessages;
      try {
        anthropicMessages = toAnthropicMessages(body);
      } catch (error) {
        return { ok: false, status: 400, error: (error as Error).message };
      }
      let res: Response;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: max,
            system: SYSTEM,
            messages: anthropicMessages,
          }),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (error) {
        return { ok: false, status: 502, error: `Claude network error: ${(error as Error).message}`, model };
      }
      const data = await res.json().catch(() => null);
      const text = textFromAnthropic(data);
      if (!res.ok || !text) return { ok: false, status: res.status, error: "Claude request failed", model };
      return { ok: true, model, text };
    };

    if (first === "anthropic") {
      const result = await callClaude();
      if (!result.ok) return json({ error: result.error }, result.status || 502);
      return json(anthropicShape(result.text, { provider: "anthropic", model: result.model, fallback: false }));
    }

    const xai = await callXai();
    if (xai.ok) {
      return json(anthropicShape(xai.text, { provider: "xai", model: xai.model, task: xai.task, fallback: false }));
    }

    const canFallback = resolveProvider({
      provider: providerFlag,
      fallback: fallbackFlag,
      xaiFailed: Boolean(xai.retryable || xai.status === 502),
    }) === "anthropic";
    if (canFallback) {
      const claude = await callClaude();
      if (claude.ok) {
        return json(anthropicShape(claude.text, { provider: "anthropic", model: claude.model, fallback: true }));
      }
    }

    return json({ error: xai.error || "Grok request failed" }, xai.status || 502);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
