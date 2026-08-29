import { validateForm } from "../shared/formSchema.js";
import { deliverBrief, isTelegramConfigured } from "./telegram.js";
import {
  chatSystemPrompt,
  extractionMessages,
  normalizeLang,
  parseJsonObject,
  sanitizeForm,
  sanitizePrefill,
  sanitizeTranscript,
} from "./intake.js";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_BODY_BYTES = 64 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { tooLarge: true };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { invalid: true };
  }
}

async function handleChatStream(request, env) {
  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  const lang = normalizeLang(body?.lang);
  const messages = sanitizeTranscript(body?.messages);
  if (messages.length === 0) return json({ error: "no_messages" }, 400);

  const stream = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: chatSystemPrompt(lang, Boolean(body?.formSubmitted)) },
      ...messages,
    ],
    max_tokens: 400,
    stream: true,
  });

  // env.AI.run with stream:true already returns an SSE-formatted
  // ReadableStream — pass it straight through.
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      ...CORS,
    },
  });
}

/* Best-effort: a failed extraction just means the visitor fills the form from
   scratch, so every failure path returns an empty prefill rather than an error
   the UI would have to explain. */
async function handleExtract(request, env) {
  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  const lang = normalizeLang(body?.lang);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return json({ prefill: {} });

  try {
    const result = await env.AI.run(MODEL, {
      messages: extractionMessages(text, lang),
      max_tokens: 400,
    });
    const parsed = parseJsonObject(result?.response ?? "");
    return json({ prefill: parsed ? sanitizePrefill(parsed) : {} });
  } catch (err) {
    console.error("Prefill extraction failed:", err.message);
    return json({ prefill: {} });
  }
}

async function handleRequirements(request, env) {
  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  // Honeypot: a real visitor never sees this field, so anything in it is a
  // bot. Answer as if it worked and drop the submission on the floor.
  if (typeof body?.website === "string" && body.website.trim()) {
    return json({ ok: true, reference: "LB-000000" });
  }

  const lang = normalizeLang(body?.lang);
  const form = sanitizeForm(body?.form);
  const errors = validateForm(form);
  if (Object.keys(errors).length) return json({ error: "invalid_form", errors }, 422);

  if (!isTelegramConfigured(env) && !env.REQUIREMENTS_WEBHOOK_URL) {
    console.error(
      "No delivery channel configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (see README)."
    );
    return json({ error: "delivery_not_configured" }, 503);
  }

  const reference = "LB-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const submission = {
    reference,
    lang,
    form,
    transcript: sanitizeTranscript(body?.transcript),
    meta: {
      referrer: request.headers.get("referer") ?? "",
      country: request.cf?.country ?? "",
      receivedAt: new Date().toISOString(),
    },
  };

  const { results } = await deliverBrief(env, submission);
  if (!results.some((r) => r.ok)) return json({ error: "delivery_failed" }, 502);

  return json({ ok: true, reference });
}

const ROUTES = {
  "/api/chat/stream": handleChatStream,
  "/api/extract": handleExtract,
  "/api/requirements": handleRequirements,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const handler = ROUTES[url.pathname];

    if (handler) {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

      try {
        return await handler(request, env);
      } catch (err) {
        console.error(`${url.pathname} failed:`, err.stack ?? err.message);
        return json({ error: "server_error" }, 500);
      }
    }

    // Everything else: serve the built React app
    return env.ASSETS.fetch(request);
  },
};
