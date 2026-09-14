import { LIMITS, SUMMARY_MIN, validateForm } from "../shared/formSchema.js";
import { platformId } from "../shared/platforms.js";
import {
  sanitizeAnswers,
  sanitizeModules,
  sanitizeQuestions,
} from "../shared/questionModules.js";
import {
  clientId,
  currentUser,
  handleAuthCallback,
  handleAuthLogout,
  handleAuthMe,
  handleAuthStart,
  isAuthConfigured,
  redirectUri,
} from "./auth.js";
import { claudeModel, extract as claudeExtract, hasClaude, streamChat } from "./claude.js";
import { handleApp, isAppRoute } from "./app.js";
import { handlePay, isPayRoute } from "./pay.js";
import { configuredGateways } from "./gateways/index.js";
import {
  briefCounts,
  ensureReady,
  hasDb,
  linkBriefCustomer,
  markBriefDelivered,
  markBriefFailed,
  storeBrief,
} from "./db.js";
import { CORS, json, readBody } from "./http.js";
import { clientKey, overLimit } from "./ratelimit.js";
import {
  canMessageVisitor,
  deliverBrief,
  diagnoseTelegram,
  isTelegramConfigured,
  notifyVisitor,
} from "./telegram.js";
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
const BUILD = "2026-09-14-invoices-and-payments";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const chatModel = (env) => env.CHAT_MODEL || DEFAULT_MODEL;
const extractModel = (env) => env.EXTRACT_MODEL || env.CHAT_MODEL || DEFAULT_MODEL;

/* Which model actually answers. Claude when a key is configured, the Workers
   AI binding otherwise — and the binding stays the fallback either way, so a
   revoked key degrades the replies rather than the site. */
const servingModel = (env) => (hasClaude(env) ? claudeModel(env) : chatModel(env));

function tooManyRequests() {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "60", ...CORS },
  });
}

async function handleChatStream(request, env) {
  if (await overLimit(env.CHAT_LIMIT, clientKey(request))) return tooManyRequests();

  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);
  if (invalid) return json({ error: "invalid_json" }, 400);

  const lang = normalizeLang(body?.lang);
  const messages = sanitizeTranscript(body?.messages);
  if (messages.length === 0) return json({ error: "no_messages" }, 400);

  const submitted = Boolean(body?.formSubmitted);
  const platform = platformId(body?.platform);
  const sse = (stream) =>
    new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        ...CORS,
      },
    });

  if (hasClaude(env)) {
    try {
      return sse(
        await streamChat(env, {
          system: chatSystemPrompt(lang, submitted, { reasoning: true, platform }),
          messages,
        })
      );
    } catch (err) {
      // Nothing has been sent to the visitor yet, so the Workers AI binding
      // can still answer this turn.
      console.error("Claude chat unavailable, using Workers AI:", err.message);
    }
  }

  const stream = await env.AI.run(chatModel(env), {
    messages: [
      { role: "system", content: chatSystemPrompt(lang, submitted, { platform }) },
      ...messages,
    ],
    max_tokens: 400,
    stream: true,
  });

  // env.AI.run with stream:true already returns an SSE-formatted
  // ReadableStream — pass it straight through.
  return sse(stream);
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

  const platform = platformId(body?.platform);
  const prompt = extractionMessages(text, lang, platform);

  /* Same prompt, same parser, same sanitisers for both models — only the one
     that answers differs, so a form built by Claude and a form built by
     Workers AI are assembled identically. */
  async function raw() {
    if (hasClaude(env)) {
      try {
        return await claudeExtract(env, prompt);
      } catch (err) {
        console.error("Claude extraction unavailable, using Workers AI:", err.message);
      }
    }
    const result = await env.AI.run(extractModel(env), { messages: prompt, max_tokens: 400 });
    return result?.response ?? "";
  }

  try {
    const parsed = parseJsonObject(await raw());
    return json({
      prefill: withSummaryFallback(parsed ? sanitizePrefill(parsed, platform) : {}, text),
      modules: sanitizeModules(parsed?.modules, platform),
      questions: sanitizeQuestions(parsed?.questions),
    });
  } catch (err) {
    console.error("Prefill extraction failed:", err.message);
    return json({ prefill: withSummaryFallback({}, text), modules: [], questions: [] });
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
  const platform = platformId(body?.platform);
  const form = sanitizeForm(body?.form, platform);

  /* The tailored part of the form is rebuilt from the plan the browser sends
     back, then answers are filtered against it — so a crafted request cannot
     smuggle in fields that were never offered. */
  const modules = sanitizeModules(body?.modules, platform);
  const questions = sanitizeQuestions(body?.questions);
  const answers = sanitizeAnswers(body?.answers, modules, questions, platform);

  const errors = validateForm(form, platform);
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
    platform,
    form,
    modules,
    questions,
    answers,
    verified,
    transcript: sanitizeTranscript(body?.transcript),
    meta: {
      referrer: request.headers.get("referer") ?? "",
      country: request.cf?.country ?? "",
      receivedAt: new Date().toISOString(),
    },
  };

  /* Recorded before it is sent anywhere.

     A frozen Telegram account once turned every submission here into a lost
     lead: the brief was built, refused by Telegram, and dropped on the floor.
     Whether a messenger is reachable has nothing to do with whether the
     studio should keep the enquiry, so the database — when there is one —
     gets it first, and delivery becomes the second thing that happens rather
     than the only thing.

     Storage failing is never allowed to fail a submission; the visitor has
     done their part either way. */
  const recorded = await recordBrief(env, submission);

  const { results } = await deliverBrief(env, submission);
  const delivered = results.some((r) => r.ok);
  await noteDelivery(env, recorded, reference, delivered, results);

  /* 502 only when the brief is now nowhere: not delivered *and* not kept.
     Telling somebody their submission failed when it is safely stored and
     waiting to be retried would be a lie, and would cost the studio the
     enquiry a second time when they gave up rather than resubmitting. */
  if (!delivered && !recorded) return json({ error: "delivery_failed" }, 502);

  // Courtesy note to the visitor's own Telegram. Awaited so a failure is
  // logged, but never allowed to fail the submission.
  const notified = await notifyVisitor(env, submission);

  return json({ ok: true, reference, notified: notified.sent, delivered });
}

async function recordBrief(env, submission) {
  if (!hasDb(env)) return false;
  try {
    await ensureReady(env.DB);
    await storeBrief(env.DB, submission);
    /* Attached to a person in the same breath as it is stored, so a brief is
       never an anonymous row waiting for a backfill to notice it. This is what
       "what has this customer ordered before?" reads. */
    await linkBriefCustomer(env.DB, submission.reference, submission);
    return true;
  } catch (err) {
    console.error("Could not record the brief:", err.stack ?? err.message);
    return false;
  }
}

/* Bookkeeping only — a failure here must not change what the visitor is
   told, because by this point the brief has already been kept or sent. */
async function noteDelivery(env, recorded, reference, delivered, results) {
  if (!recorded) return;
  try {
    if (delivered) {
      await markBriefDelivered(env.DB, reference);
    } else {
      await markBriefFailed(
        env.DB,
        reference,
        results.map((r) => r.error).filter(Boolean).join("; ") || "no delivery channel configured"
      );
    }
  } catch (err) {
    console.error("Could not update the brief's delivery state:", err.message);
  }
}

/* Every setting this Worker reads, so "is it there?" is answerable for a name
   that is not one of the required few. Order is the order they matter in. */
const SETTING_NAMES = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_TOPIC_ID",
  "TELEGRAM_CLIENT_ID",
  "TELEGRAM_CLIENT_SECRET",
  "TELEGRAM_REDIRECT_URI",
  "TELEGRAM_OIDC_ISSUER",
  "TELEGRAM_OIDC_SCOPE",
  "TELEGRAM_LOGIN_BOT_TOKEN",
  "ADMIN_TELEGRAM_IDS",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ZARINPAL_MERCHANT_ID",
  "ZIBAL_MERCHANT",
  "PAYMENTS_CURRENCY_FA",
  "SITE_ORIGIN",
  "ANTHROPIC_API_KEY",
  "CLAUDE_API_KEY",
  "CLAUDE_MODEL",
  "ANTHROPIC_BASE_URL",
  "REQUIREMENTS_WEBHOOK_URL",
  "REQUIREMENTS_WEBHOOK_SECRET",
  "CHAT_MODEL",
  "EXTRACT_MODEL",
];

/* "absent" and "empty" are different problems and Boolean() hides that. A
   variable created with no value still occupies its name — Cloudflare refuses
   to add a second one with it, and the panel gives an existing-but-blank entry
   nothing to show — while every check here reads it as missing. Naming the
   state is the difference between a five-minute fix and an afternoon.

   Presence only. No value, no length, no prefix. */
function presence(value) {
  if (value === undefined || value === null) return "absent";
  return String(value).trim() === "" ? "empty" : "set";
}

/* Reports which runtime settings the Worker can actually see, so a
   misconfiguration is one request away from being obvious instead of showing
   up as a failed submission.

   Booleans only — never a value, a length, or a prefix. Knowing that delivery
   is configured tells an attacker nothing they could not learn by submitting
   the form. */
async function handleHealth(request, env) {
  /* Reported one variable at a time. Delivery needs TELEGRAM_BOT_TOKEN and
     TELEGRAM_CHAT_ID together, and a single combined boolean cannot say which
     of the two is absent — which is exactly the question when it reads false. */
  const checks = {
    ai: Boolean(env.AI),
    assets: Boolean(env.ASSETS),
    TELEGRAM_BOT_TOKEN: Boolean(env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: Boolean(env.TELEGRAM_CHAT_ID),
    TELEGRAM_CLIENT_SECRET: Boolean(env.TELEGRAM_CLIENT_SECRET),
    claude: hasClaude(env),
    telegramDelivery: isTelegramConfigured(env),
    telegramSignIn: isAuthConfigured(env),
    webhookMirror: Boolean(env.REQUIREMENTS_WEBHOOK_URL),
    visitorDm: canMessageVisitor(env),
    rateLimiters: Boolean(env.CHAT_LIMIT && env.SUBMIT_LIMIT && env.AUTH_LIMIT),
    /* The dashboard's database. Absent is a valid deploy — the two intake
       pages never touch it — so it is reported but not required. */
    dashboardDb: hasDb(env),
    dashboardAdmins: Boolean(env.ADMIN_TELEGRAM_IDS),
    /* Which gateways could take money today. Empty is a valid deploy — the
       site quoted by hand for a year before this existed — so it is reported
       and never required. */
    payments: configuredGateways(env).length > 0,
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
  /* Telegram's OAuth issuer is bot-based: the client_id it receives *is* a bot
     id, which is why it answers "bot_id invalid" rather than anything about
     clients when the value is not one. A bot id is the digits before the colon
     in the bot's token, so both mistakes worth catching are shape mistakes. */
  const oidcId = clientId(env);
  if (env.TELEGRAM_CLIENT_SECRET && !env.TELEGRAM_CLIENT_ID) {
    warnings.push(
      "TELEGRAM_CLIENT_ID is unset, so the built-in default bot id is being used. " +
        "Set it to the numeric part of your own bot's token — the digits before the colon."
    );
  }
  if (!/^\d+$/.test(String(oidcId))) {
    warnings.push(
      "TELEGRAM_CLIENT_ID is not a plain number. Telegram signs in against a bot id: " +
        "the digits before the colon in the bot token, not the whole token and not a @username. " +
        "Telegram reports anything else as \"bot_id invalid\"."
    );
  }
  /* The number that says "delivery is broken" without anyone reading a log.
     Briefs are kept when Telegram refuses them, which means a broken bot is
     now silent from the visitor's side — this is where that silence becomes
     audible. Wrapped because a database hiccup must not take health down with
     it, and because the table does not exist until the first submission after
     the migration. */
  let briefs;
  try {
    if (hasDb(env)) briefs = await briefCounts(env.DB);
  } catch (err) {
    console.error("Could not count stored briefs:", err.message);
  }
  if (briefs?.undelivered > 0) {
    warnings.push(
      `${briefs.undelivered} brief${briefs.undelivered === 1 ? " is" : "s are"} stored but not ` +
        "delivered. Check /api/health/telegram for the reason, fix it, then POST /api/app/briefs/retry."
    );
  }

  /* The Worker always sends a redirect_uri, so "redirect_uri required" from
     Telegram means the value it sent was empty or unusable — which only
     happens when TELEGRAM_REDIRECT_URI is set to something that is not an
     absolute URL. Checked here because the override exists precisely for
     deployments where the request origin cannot be trusted, and a typo in it
     is otherwise invisible. */
  const override = env.TELEGRAM_REDIRECT_URI;
  if (override !== undefined && override !== null && String(override).trim() !== String(override)) {
    warnings.push("TELEGRAM_REDIRECT_URI has leading or trailing whitespace");
  }
  if (override && String(override).trim()) {
    let parsed;
    try {
      parsed = new URL(String(override).trim());
    } catch {
      /* Left undefined: the branch below treats unparseable and unusable the
         same way, because Telegram does. */
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
      warnings.push(
        "TELEGRAM_REDIRECT_URI is not an absolute URL. It must be the full " +
          "https://host/api/auth/telegram/callback, not a domain or a path — Telegram reports " +
          'anything it cannot use as "redirect_uri required".'
      );
    } else if (!parsed.pathname.endsWith("/api/auth/telegram/callback")) {
      warnings.push(
        "TELEGRAM_REDIRECT_URI does not end in /api/auth/telegram/callback, which is the only " +
          "path this Worker answers the sign-in on."
      );
    } else if (parsed.origin !== new URL(request.url).origin) {
      warnings.push(
        `TELEGRAM_REDIRECT_URI points at ${parsed.origin} but this Worker is serving ` +
          `${new URL(request.url).origin}. Unset it unless a proxy makes the request origin wrong.`
      );
    }
  }

  const settings = Object.fromEntries(
    SETTING_NAMES.map((name) => [name, presence(env[name])])
  );
  const blank = SETTING_NAMES.filter((name) => settings[name] === "empty");
  if (blank.length) {
    warnings.push(
      `${blank.join(", ")} exist${blank.length === 1 ? "s" : ""} but ${
        blank.length === 1 ? "its value is" : "their values are"
      } empty. That is why Cloudflare says the name is taken while nothing shows ` +
        "in the panel and every check here reads it as missing — edit the existing entry " +
        "rather than adding a new one."
    );
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
      // The other half of that pair, and public — it travels in the
      // authorization URL as a query parameter. Reported because a client id
      // that does not match the registered app fails sign-in with nothing to
      // see: the secret is present, the redirect is right, and it still bounces.
      clientId: clientId(env),
      origin: new URL(request.url).origin,
      checks,
      // Every name this Worker reads, as absent / empty / set. An "empty" here
      // is a variable that exists with no value: the name is taken, the panel
      // has nothing to show for it, and every check above reads it as missing.
      settings,
      // Present only when a database is bound. `undelivered` above zero is the
      // one number here that means somebody's enquiry is sitting unread.
      briefs,
      missing,
      warnings: warnings.length ? warnings : undefined,
      hint: missing.length
        ? `Set ${missing.join(" and ")} in Cloudflare > Workers & Pages > your Worker > ` +
          "Settings > Variables and Secrets, then redeploy. Names are case-sensitive."
        : undefined,
      model: servingModel(env),
      // Which binding is answering, so a key that is set but rejected is
      // still visible as "claude: true" with Workers AI replies in the logs.
      chatProvider: hasClaude(env) ? "claude" : "workers-ai",
      fallbackModel: chatModel(env),
    },
    missing.length ? 503 : 200
  );
}

/* When /api/health says both Telegram settings are present and a brief still
   will not deliver, the reason is Telegram's and only Telegram can give it.
   This asks.

   The read is public because it answers in booleans and Telegram's own error
   text — nothing an attacker could not learn by submitting the form. Actually
   *sending* a test message is not: it would let anyone use this Worker to put
   messages in somebody's chat, so it needs a signed-in session. */
async function handleTelegramCheck(request, env) {
  if (await overLimit(env.AUTH_LIMIT, clientKey(request))) return json({ error: "rate_limited" }, 429);

  const wantsSend = new URL(request.url).searchParams.get("send") === "1";
  const signedIn = wantsSend ? await currentUser(request, env) : null;
  if (wantsSend && !signedIn) {
    return json(
      {
        error: "sign_in_required",
        hint: "Sending a test message needs a signed-in session. Sign in on the site first, then reload this with ?send=1.",
      },
      401
    );
  }

  const report = await diagnoseTelegram(env, { send: wantsSend });
  return json(report, report.ok ? 200 : 503);
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
  "/api/health/telegram": handleTelegramCheck,
  "/api/auth/telegram/start": handleAuthStart,
  "/api/auth/telegram/callback": handleAuthCallback,
  "/api/auth/telegram/me": handleAuthMe,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* The dashboard's own API. Kept in its own module and matched by prefix
       because it is the only part of this Worker with path parameters, its own
       tenancy rules and a database behind it. */
    if (isAppRoute(url.pathname)) return handleApp(request, env, url);

    /* The payer's side: a link somebody was sent, and the gateways calling
       back about it. No session, its own module, and the only routes here that
       a stranger is meant to reach. */
    if (isPayRoute(url.pathname)) return handlePay(request, env, url);

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
