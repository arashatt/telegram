import { LIMITS, SUMMARY_MIN, validateForm } from "../shared/formSchema.js";
import {
  currentUser,
  handleAuthCallback,
  handleAuthLogout,
  handleAuthMe,
  handleAuthStart,
  isAuthConfigured,
  redirectUri,
} from "./auth.js";
import { clientKey, overLimit } from "./ratelimit.js";
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

/* Overridable without a code change, because the Workers AI catalogue moves
   faster than this repo does. Run `npx wrangler ai models` to see what the
   account actually has, then set CHAT_MODEL / EXTRACT_MODEL in wrangler.jsonc
   vars. Extraction is split out because it wants strict JSON, which is a
   different strength from conversational replies. */
/* Bumped whenever something ships that is hard to confirm from the outside.
   /api/health echoes it, so "is the deploy actually live?" is one request
   rather than an inference from symptoms. */
const BUILD = "2026-08-29-run-worker-first+critical-css";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const chatModel = (env) => env.CHAT_MODEL || DEFAULT_MODEL;
const extractModel = (env) => env.EXTRACT_MODEL || env.CHAT_MODEL || DEFAULT_MODEL;
const MAX_BODY_BYTES = 64 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function tooManyRequests() {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "60", ...CORS },
  });
}

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
  if (await overLimit(env.CHAT_LIMIT, clientKey(request))) return tooManyRequests();

  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  const lang = normalizeLang(body?.lang);
  const messages = sanitizeTranscript(body?.messages);
  if (messages.length === 0) return json({ error: "no_messages" }, 400);

  const stream = await env.AI.run(chatModel(env), {
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

/* The visitor already said what they want, so "What should the bot do?" must
   never come back empty — a refined version when the model manages one, their
   own words otherwise. */
function withSummaryFallback(prefill, text) {
  if (prefill.summary && prefill.summary.length >= SUMMARY_MIN) return prefill;
  return { ...prefill, summary: text.slice(0, LIMITS.summary) };
}

/* Best-effort otherwise: a failed extraction just means the visitor fills the
   rest of the form themselves, so no failure path surfaces an error. */
async function handleExtract(request, env) {
  if (await overLimit(env.CHAT_LIMIT, clientKey(request))) return tooManyRequests();

  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  const lang = normalizeLang(body?.lang);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return json({ prefill: {} });

  try {
    const result = await env.AI.run(extractModel(env), {
      messages: extractionMessages(text, lang),
      max_tokens: 400,
    });
    const parsed = parseJsonObject(result?.response ?? "");
    return json({ prefill: withSummaryFallback(parsed ? sanitizePrefill(parsed) : {}, text) });
  } catch (err) {
    console.error("Prefill extraction failed:", err.message);
    return json({ prefill: withSummaryFallback({}, text) });
  }
}

async function handleRequirements(request, env) {
  if (await overLimit(env.SUBMIT_LIMIT, clientKey(request))) return tooManyRequests();

  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  // Honeypot: a real visitor never sees this field, so anything in it is a
  // bot. Answer as if it worked and drop the submission on the floor.
  if (typeof body?.website === "string" && body.website.trim()) {
    return json({ ok: true, reference: "REQ-000000" });
  }

  const lang = normalizeLang(body?.lang);
  const form = sanitizeForm(body?.form);
  const errors = validateForm(form);
  if (Object.keys(errors).length) return json({ error: "invalid_form", errors }, 422);

  if (!isTelegramConfigured(env) && !env.REQUIREMENTS_WEBHOOK_URL) {
    console.error(
      "No delivery channel configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID under " +
        "Workers & Pages > your Worker > Settings > Variables and Secrets. Check /api/health."
    );
    return json({ error: "delivery_not_configured" }, 503);
  }

  // Read from the signed session cookie, never from the request body: the
  // browser cannot claim an identity it did not actually sign in with.
  const verified = await currentUser(request, env);

  const reference =
    "REQ-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const submission = {
    reference,
    lang,
    form,
    verified,
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

/* Reports which runtime settings the Worker can actually see, so a
   misconfiguration is one request away from being obvious instead of showing
   up as a failed submission.

   Booleans only — never a value, a length, or a prefix. Knowing that delivery
   is configured tells an attacker nothing they could not learn by submitting
   the form. */
function handleHealth(request, env) {
  /* Reported one variable at a time. Delivery needs TELEGRAM_BOT_TOKEN and
     TELEGRAM_CHAT_ID together, and a single combined boolean cannot say which
     of the two is absent — which is exactly the question when it reads false. */
  const checks = {
    ai: Boolean(env.AI),
    assets: Boolean(env.ASSETS),
    TELEGRAM_BOT_TOKEN: Boolean(env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: Boolean(env.TELEGRAM_CHAT_ID),
    TELEGRAM_CLIENT_SECRET: Boolean(env.TELEGRAM_CLIENT_SECRET),
    telegramDelivery: isTelegramConfigured(env),
    telegramSignIn: isAuthConfigured(env),
    webhookMirror: Boolean(env.REQUIREMENTS_WEBHOOK_URL),
    rateLimiters: Boolean(env.CHAT_LIMIT && env.SUBMIT_LIMIT && env.AUTH_LIMIT),
  };

  // Only the things the site cannot do its job without.
  const required = ["ai", "assets", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
  const missing = required.filter((name) => !checks[name]);

  /* A chat id that is present but malformed fails at Telegram rather than
     here, so flag the shapes that are almost always a mistake. */
  const warnings = [];
  const chatId = env.TELEGRAM_CHAT_ID;
  if (chatId && !/^-?\d+$/.test(String(chatId).trim())) {
    warnings.push("TELEGRAM_CHAT_ID is not a plain number — a group id looks like -1001234567890");
  }
  if (chatId && String(chatId) !== String(chatId).trim()) {
    warnings.push("TELEGRAM_CHAT_ID has leading or trailing whitespace");
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  if (token && !/^\d+:[A-Za-z0-9_-]{20,}$/.test(String(token).trim())) {
    warnings.push("TELEGRAM_BOT_TOKEN does not look like a BotFather token (123456789:AA...)");
  }

  return json(
    {
      ok: missing.length === 0,
      build: BUILD,
      // The exact string Telegram must have registered as the redirect URI.
      // A mismatch here is the usual reason sign-in bounces back with an error.
      redirectUri: redirectUri(request, env),
      checks,
      missing,
      warnings: warnings.length ? warnings : undefined,
      hint: missing.length
        ? `Set ${missing.join(" and ")} in Cloudflare > Workers & Pages > your Worker > ` +
          "Settings > Variables and Secrets, then redeploy. Names are case-sensitive."
        : undefined,
      model: chatModel(env),
    },
    missing.length ? 503 : 200
  );
}

const POST_ROUTES = {
  "/api/chat/stream": handleChatStream,
  "/api/extract": handleExtract,
  "/api/requirements": handleRequirements,
  "/api/auth/telegram/logout": handleAuthLogout,
};

/* Browser navigations, not fetches: Telegram redirects into /callback, and
   /start redirects out to Telegram. */
const GET_ROUTES = {
  "/api/health": handleHealth,
  "/api/auth/telegram/start": handleAuthStart,
  "/api/auth/telegram/callback": handleAuthCallback,
  "/api/auth/telegram/me": handleAuthMe,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const getHandler = GET_ROUTES[url.pathname];
    const postHandler = POST_ROUTES[url.pathname];

    if (getHandler || postHandler) {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

      const handler =
        request.method === "GET" || request.method === "HEAD" ? getHandler : postHandler;
      if (!handler) return json({ error: "method_not_allowed" }, 405);

      // Auth endpoints reach outward (discovery, JWKS, token exchange), so
      // they are limited too.
      if (url.pathname.startsWith("/api/auth/telegram/") && url.pathname.endsWith("/me") === false) {
        if (await overLimit(env.AUTH_LIMIT, clientKey(request))) {
          return json({ error: "rate_limited" }, 429);
        }
      }

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
