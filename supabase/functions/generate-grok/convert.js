// Shared by the beta edge function and the node tests.
// Maps the app's prompt shape onto xAI's OpenAI-compatible chat API,
// and back into the { content: [{ text }] } shape the app already reads.

export const DEFAULT_TEXT_MODEL = "grok-4.7";
export const DEFAULT_VISION_MODEL = "grok-4.7";

export const SYSTEM = `You are the Safe Intelligence beta assistant for a Western Australian HSE adviser.
Use current WA law: Work Health and Safety Act 2020 (WA), WHS (General) Regulations 2022, WHS (Mines) Regulations 2022, and WHS (Petroleum and Geothermal Energy Operations) Regulations 2022 when the site is PAGEO.
The Mines Safety and Inspection Act 1994 stays in force for the mines safety levy only. Do not cite it for a safety duty.
Never cite the Occupational Safety and Health Act 1984 or the Occupational Safety and Health Regulations 1996.
The regulator is WorkSafe, within LGIRS.
WHS (General) Regulations r.154 to r.162 are not used in WA. Energised electrical work is under the Electricity (Licensing) Regulations 1991.
When a pinpoint is uncertain, mark it UNVERIFIED. Call legal concerns possible issues to verify, not findings of breach.
Refer to people by role, not by name. Do not invent names.`;

function imagePart(url) {
  return {
    type: "image_url",
    image_url: { url, detail: "high" },
  };
}

function anthropicPartToOpenAI(part) {
  if (!part || typeof part !== "object") return null;
  if (part.type === "text") return { type: "text", text: String(part.text || "") };
  if (part.type === "image_url" && part.image_url?.url) return imagePart(part.image_url.url);
  if (part.type === "image" && part.source?.data) {
    const media = part.source.media_type || "image/jpeg";
    return imagePart(`data:${media};base64,${part.source.data}`);
  }
  return null;
}

function asImageUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.url === "string") return value.url;
  return "";
}

export function toOpenAIMessages(body) {
  const source = body || {};
  if (Array.isArray(source.messages) && source.messages.length) {
    return source.messages.map((message) => {
      if (typeof message?.content === "string") return { role: message.role || "user", content: message.content };
      const content = (Array.isArray(message?.content) ? message.content : []).map(anthropicPartToOpenAI).filter(Boolean);
      return { role: message.role || "user", content };
    });
  }

  const images = (Array.isArray(source.images) ? source.images : []).map(asImageUrl).filter(Boolean);

  if (typeof source.prompt === "string") {
    if (!images.length) return [{ role: "user", content: source.prompt }];
    return [{
      role: "user",
      content: [...images.map(imagePart), { type: "text", text: source.prompt }],
    }];
  }

  if (Array.isArray(source.prompt)) {
    const content = source.prompt.map(anthropicPartToOpenAI).filter(Boolean);
    for (const url of images) content.unshift(imagePart(url));
    return [{ role: "user", content }];
  }

  throw new Error("Missing prompt");
}

export function hasImage(body) {
  try {
    return toOpenAIMessages(body).some((message) =>
      Array.isArray(message.content) && message.content.some((part) => part.type === "image_url")
    );
  } catch {
    return false;
  }
}

export function selectModel(body, env = {}) {
  const textModel = env.textModel || DEFAULT_TEXT_MODEL;
  const visionModel = env.visionModel || DEFAULT_VISION_MODEL;
  const vision = body?.task === "vision" || hasImage(body);
  return { task: vision ? "vision" : "text", model: vision ? visionModel : textModel };
}

export function assertImagesOk(messages) {
  let count = 0;
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type !== "image_url") continue;
      count += 1;
      const url = part.image_url?.url || "";
      const dataOk = /^data:image\/(jpeg|jpg|png);base64,/i.test(url);
      const httpsOk = /^https:\/\//i.test(url);
      if (!dataOk && !httpsOk) throw new Error("Images must be jpeg or png.");
    }
  }
  if (count > 6) throw new Error("Too many images (max 6).");
}

export function resolveProvider({ provider, fallback, xaiFailed }) {
  const chosen = String(provider || "xai").toLowerCase();
  if (chosen === "anthropic") return "anthropic";
  if (xaiFailed && String(fallback || "none").toLowerCase() === "anthropic") return "anthropic";
  return "xai";
}

// grok-4.7 is called through the Responses API. max_output_tokens counts
// reasoning tokens as well as the answer, so the budget has a floor.
export const REASONING_EFFORT = "low";

export function outputTokenBudget(requested) {
  const asked = Number(requested);
  const base = Number.isFinite(asked) && asked > 0 ? asked : 4000;
  return Math.min(Math.max(base, 4000), 8000);
}

export function toResponsesInput(messages) {
  return (messages || [])
    .filter((message) => message && message.role !== "system")
    .map((message) => {
      if (typeof message.content === "string") {
        return { role: message.role || "user", content: message.content };
      }
      const content = (Array.isArray(message.content) ? message.content : []).map((part) => {
        if (part?.type === "text") return { type: "input_text", text: String(part.text || "") };
        if (part?.type === "image_url" && part.image_url?.url) {
          return { type: "input_image", image_url: part.image_url.url, detail: part.image_url.detail || "high" };
        }
        return null;
      }).filter(Boolean);
      return { role: message.role || "user", content };
    });
}

export function textFromResponses(data) {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const output = Array.isArray(data?.output) ? data.output : [];
  const chunks = [];
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === "string" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("");
}

export function textFromOpenAI(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  return "";
}

export function textFromAnthropic(data) {
  const block = data?.content?.find?.((part) => part?.text) || data?.content?.[0];
  return typeof block?.text === "string" ? block.text : "";
}

function openAIContentToAnthropic(content) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    const url = part.image_url?.url || "";
    const match = url.match(/^data:(.+);base64,(.+)$/);
    if (!match) return { type: "text", text: "[image omitted — Claude fallback needs a data URL]" };
    return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
  });
}

export function toAnthropicMessages(body) {
  return toOpenAIMessages(body).map((message) => ({
    role: "user",
    content: openAIContentToAnthropic(message.content),
  }));
}

export function anthropicShape(text, extra = {}) {
  return { content: [{ type: "text", text }], ...extra };
}
