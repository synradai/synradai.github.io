// Safe Intelligence beta — open and file a QR form with no login.
// Deploy to the beta project only (ref rocobdfuvaecrkzsxqub).
// This function refuses to run if SUPABASE_URL contains the live ref.
//
// Gateway verify_jwt is off (supabase/config.toml). Workers have no session.
// The service role is used only after the QR token is checked. The response
// never includes other submissions, other tokens, or a supervisor email.
//
// A failed critical check (yes/no/NA answer "no") files an action for the
// site supervisor. emailHook stays "pending".
// When RESEND_API_KEY and RESEND_FROM are set, a later version can email
// the supervisor. This version does not call Resend and does not use the
// signup mailer.
//
// Keep the default forms in step with beta/lib/qrForms.js.

import { createClient } from "jsr:@supabase/supabase-js@2";

const LIVE_PROJECT_REF = "rgkiagqexoafmtxhrlqo";
const HOUR_LIMIT = 20;
const MAX_BODY = 1_500_000;
const MAX_DATA_URL = 400_000;

const DEFAULT_ORIGINS = [
  "https://synradai.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4174",
  "http://127.0.0.1:4174",
];

const ynna = (id: string, label: string) => ({
  id,
  type: "ynna",
  label,
  required: true,
  critical: true,
  help: "",
  options: [] as string[],
});

const textQ = (id: string, label: string, required: boolean) => ({
  id,
  type: "text",
  label,
  required,
  critical: false,
  help: "",
  options: [] as string[],
});

const DEFAULT_FORMS = [
  {
    id: "take5",
    title: "Take 5",
    questions: [
      textQ("task", "What is the task?", true),
      ynna("stopped", "I stopped and thought about this task"),
      ynna("ppe", "I have the right equipment and PPE"),
      ynna("hazards", "Hazards are controlled"),
      ynna("emergency", "I know the emergency response"),
      ynna("safe", "It is safe to start"),
      textQ("notes", "Notes", false),
      { id: "photo", type: "photo", label: "Photo", required: false, critical: false, help: "", options: [] },
      { id: "sign", type: "signature", label: "Signature", required: true, critical: false, help: "", options: [] },
    ],
  },
  {
    id: "jha",
    title: "JHA",
    questions: [
      textQ("job", "Job or task", true),
      textQ("steps", "Steps and hazards", true),
      ynna("controls", "Controls are in place"),
      ynna("briefed", "People are briefed"),
      ynna("permits", "Permits are in place if this work needs them"),
      ynna("residual", "Residual risk is acceptable"),
      { id: "sign", type: "signature", label: "Signature", required: true, critical: false, help: "", options: [] },
    ],
  },
  {
    id: "prestart",
    title: "Vehicle and plant prestart",
    questions: [
      textQ("asset", "Vehicle or plant", true),
      {
        id: "km",
        type: "number",
        label: "Odometer (km)",
        required: false,
        critical: false,
        help: "Enter kilometres, engine hours, or both.",
        options: [] as string[],
      },
      { id: "hours", type: "number", label: "Engine hours", required: false, critical: false, help: "", options: [] },
      ynna("fluids", "Fluids and leaks are ok"),
      ynna("tyres", "Tyres or tracks are ok"),
      ynna("lights", "Lights and warnings are ok"),
      ynna("guards", "Guards are in place"),
      ynna("brakes", "Brakes are ok"),
      textQ("defects", "Defect notes", false),
      { id: "defect-photo", type: "photo", label: "Defect photo", required: false, critical: false, help: "", options: [] },
      { id: "sign", type: "signature", label: "Signature", required: true, critical: false, help: "", options: [] },
    ],
  },
];

type Question = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  critical: boolean;
  help: string;
  options: string[];
};

type FormDef = { id: string; title: string; questions: Question[] };

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

function cleanForms(value: unknown): FormDef[] {
  if (!Array.isArray(value)) return DEFAULT_FORMS;
  const forms: FormDef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || "").trim();
    const title = String(row.title || "").trim();
    if (!id || !title || !Array.isArray(row.questions)) continue;
    const questions: Question[] = [];
    for (const raw of row.questions) {
      if (!raw || typeof raw !== "object") continue;
      const question = raw as Record<string, unknown>;
      const qid = String(question.id || "").trim();
      const label = String(question.label || "").trim();
      const type = String(question.type || "text");
      if (!qid || !label) continue;
      if (!["ynna", "text", "number", "photo", "signature", "dropdown"].includes(type)) continue;
      const options = Array.isArray(question.options)
        ? question.options.map((option) => String(option || "").trim()).filter(Boolean)
        : [];
      questions.push({
        id: qid,
        type,
        label,
        required: Boolean(question.required),
        critical: type === "ynna" && Boolean(question.critical),
        help: String(question.help || ""),
        options,
      });
    }
    if (questions.length) forms.push({ id, title, questions });
  }
  return forms.length ? forms : DEFAULT_FORMS;
}

function assess(form: FormDef, answers: Record<string, unknown>, personName: string) {
  const errors: string[] = [];
  if (!personName.trim()) errors.push("Add your name.");
  const failed: { id: string; label: string }[] = [];
  for (const question of form.questions) {
    const value = answers[question.id];
    const empty = value == null || value === "";
    if (question.type === "ynna") {
      const picked = value === "yes" || value === "no" || value === "na";
      if (question.required && !picked) errors.push(`${question.label} needs an answer.`);
      if (question.critical && value === "no") failed.push({ id: question.id, label: question.label });
    } else if (question.type === "dropdown") {
      const picked = typeof value === "string" && question.options.includes(value);
      if (!empty && !picked) errors.push(`${question.label} is not one of the options.`);
      if (question.required && !picked) errors.push(`${question.label} needs an answer.`);
    } else if (question.type === "number") {
      if (!empty && Number.isNaN(Number(value))) errors.push(`${question.label} needs a number.`);
      if (question.required && empty) errors.push(`${question.label} needs an answer.`);
    } else if (question.required && empty) {
      errors.push(`${question.label} needs an answer.`);
    }
  }
  return { errors, failed, stopped: failed.length > 0 };
}

function dataUrlBytes(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) return null;
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: match[1].toLowerCase() };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Send a POST request." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Form filing is not configured." }, 500);
  if (supabaseUrl.includes(LIVE_PROJECT_REF)) return json({ ok: false, error: "Refusing the live project." }, 500);

  const apiKey = clientApiKey();
  const sentKey = req.headers.get("apikey") || "";
  if (!apiKey || sentKey !== apiKey) return json({ ok: false, error: "This form is not available." }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: "That form is too large." }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "That form could not be read." }, 400);
  }

  const token = String(body.token || "");
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return json({ ok: false, error: "This code is not valid." }, 404);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: code } = await admin
    .from("qr_codes")
    .select("id, org_id, site_id, target_type, target_id, label, active")
    .eq("token", token)
    .maybeSingle();

  if (!code || !code.active) return json({ ok: false, error: "This code is not valid." }, 404);
  if (code.target_type !== "form") return json({ ok: false, error: "This code is not a form yet." }, 404);

  const { data: site } = await admin
    .from("sites")
    .select("id, name, client_name, logo_path, ruleset, supervisor_id")
    .eq("id", code.site_id)
    .maybeSingle();
  if (!site) return json({ ok: false, error: "This code is not valid." }, 404);

  const { data: config } = await admin
    .from("app_config")
    .select("value, version")
    .eq("org_id", code.org_id)
    .eq("key", "qr_forms")
    .maybeSingle();
  const forms = cleanForms(config?.value);
  const form = forms.find((item) => item.id === code.target_id);
  if (!form) return json({ ok: false, error: "This form is no longer available." }, 404);
  const version = Number(config?.version || 0);

  if (body.op === "open") {
    let logoUrl = "";
    if (site.logo_path) {
      const signed = await admin.storage.from("site-logos").createSignedUrl(site.logo_path, 3600);
      logoUrl = signed.data?.signedUrl || "";
    }
    return json({
      ok: true,
      targetType: "form",
      label: code.label || "",
      siteName: site.name || "",
      clientName: site.client_name || "",
      logoUrl,
      form: { id: form.id, title: form.title, version, questions: form.questions },
    });
  }

  if (body.op !== "submit") return json({ ok: false, error: "Unknown request." }, 400);

  const personName = String(body.personName || "").trim().slice(0, 160);
  const company = String(body.company || "").trim().slice(0, 160);
  const role = String(body.role || "").trim().slice(0, 160);
  const incoming = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
  const flat: Record<string, unknown> = {};
  for (const question of form.questions) {
    const value = incoming[question.id];
    if (typeof value === "string" && value.startsWith("data:") && value.length > MAX_DATA_URL) {
      return json({ ok: false, error: "A photo on this form is too large." }, 413);
    }
    flat[question.id] = typeof value === "string" ? value : value == null ? "" : String(value);
  }

  const result = assess(form, flat, personName);
  if (result.errors.length) return json({ ok: false, error: result.errors[0] }, 400);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("qr_id", code.id)
    .gte("created_at", since);
  if ((count || 0) >= HOUR_LIMIT) {
    return json({ ok: false, error: "Too many forms from this code in the last hour." }, 429);
  }

  const submissionId = crypto.randomUUID();
  const snapshot: Record<string, unknown> = {};
  for (const question of form.questions) {
    let stored: unknown = flat[question.id] ?? "";
    if ((question.type === "photo" || question.type === "signature") && typeof stored === "string" && stored.startsWith("data:")) {
      const parsed = dataUrlBytes(stored);
      if (!parsed) return json({ ok: false, error: "A photo on this form could not be read." }, 400);
      const path = `${code.org_id}/${submissionId}/${question.id}`;
      const uploaded = await admin.storage.from("form-evidence").upload(path, parsed.bytes, {
        contentType: parsed.contentType,
        upsert: false,
      });
      if (uploaded.error) return json({ ok: false, error: "A photo could not be stored." }, 500);
      stored = { path, contentType: parsed.contentType };
    } else if (typeof stored === "string") {
      stored = stored.slice(0, 4000);
    }
    snapshot[question.id] = { id: question.id, label: question.label, type: question.type, value: stored };
  }

  const inserted = await admin.from("form_submissions").insert({
    id: submissionId,
    org_id: code.org_id,
    site_id: code.site_id,
    qr_id: code.id,
    form_id: form.id,
    form_version: version,
    form_title: form.title,
    area_label: code.label || "",
    person_name: personName,
    company,
    role,
    answers: snapshot,
    failed: result.failed,
    stopped: result.stopped,
  }).select("id").single();
  if (inserted.error) return json({ ok: false, error: "The form could not be filed." }, 500);

  let actionId: string | null = null;
  if (result.stopped) {
    let userId = "";
    let ownerId = "";
    let ownerName = "Site supervisor";
    if (site.supervisor_id) {
      const supervisor = await admin
        .from("profiles")
        .select("id, full_name, org_id")
        .eq("id", site.supervisor_id)
        .maybeSingle();
      if (supervisor.data && supervisor.data.org_id === code.org_id) {
        userId = supervisor.data.id;
        ownerId = supervisor.data.id;
        ownerName = supervisor.data.full_name || "Site supervisor";
      }
    }
    if (!userId) {
      const admins = await admin
        .from("profiles")
        .select("id, full_name")
        .eq("org_id", code.org_id)
        .eq("role", "admin")
        .limit(1);
      const first = admins.data?.[0];
      if (first) {
        userId = first.id;
        if (!ownerId) ownerName = first.full_name || ownerName;
      }
    }
    if (userId) {
      actionId = `stop-${submissionId}`;
      const now = new Date().toISOString();
      const failedLabels = result.failed.map((item) => item.label).join("; ");
      const payload = {
        id: actionId,
        kind: "action",
        source: "qr",
        createdAt: now,
        updatedAt: now,
        ruleset: site.ruleset || "general",
        severity: null,
        path: null,
        status: "open",
        siteId: code.site_id,
        fields: {
          title: `Stop the job — ${form.title} — ${code.label || "site"}`,
          owner: ownerName,
          ownerId,
          due: perthToday(),
          note: `${personName} stopped on: ${failedLabels}`,
          occurredAt: now.slice(0, 16),
          emailHook: "pending",
        },
        links: [{ id: submissionId, kind: "form_submission" }],
        flags: [],
        correctiveActions: [],
        closeOut: null,
        fiveWhys: null,
        icam: false,
        icamReasons: [],
      };
      const action = await admin.from("hse_records").insert({
        id: actionId,
        org_id: code.org_id,
        user_id: userId,
        site_id: code.site_id,
        kind: "action",
        payload,
        updated_at: now,
      });
      if (action.error) {
        actionId = null;
      } else {
        await admin.from("form_submissions").update({ action_id: actionId }).eq("id", submissionId);
      }
    }
  }

  return json({
    ok: true,
    stopped: result.stopped,
    failed: result.failed,
    actionId,
  });
});
