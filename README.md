# Telegram bot intake

A conversational intake site for a studio that builds custom Telegram bots.
A visitor describes the bot they want in a full-page conversation; the
assistant replies, a requirements form opens inline in the same stream
pre-filled from what they just wrote, and the finished brief is delivered to
the team's Telegram chat.

Built with React + Vite, served from a single Cloudflare Worker that also
hosts the API and calls Workers AI.

## The flow

1. **Opening message.** The page is a conversation, not a corner widget —
   the assistant greets the visitor and they describe the bot they want.
2. **One reply, then the form.** The opening message goes to two endpoints at
   once: `/api/chat/stream` for a short streamed reply, and `/api/extract`
   for a structured guess at the answers. When the reply finishes, the
   requirements form appears as a card in the stream with those guesses
   already filled in and badged *from your message*, so the visitor is
   correcting a draft rather than facing a blank form. The system prompt
   tells the model the form is coming, so it does not run its own interview.
3. **Submission.** `/api/requirements` re-validates the brief server-side,
   renders it, and posts it to Telegram. The form is then replaced in the
   stream by a read-only receipt with a reference code, and the composer
   re-opens for follow-up questions.

## Delivery

Briefs go to Telegram via the Bot API (`sendMessage`, HTML parse mode).
Values are HTML-escaped and long briefs are split across messages at line
boundaries so a split never lands mid-tag.

## Runtime configuration

All runtime settings are read from the Worker environment, and in production
they live in one place:

> **Workers & Pages → your Worker → Settings → Variables and Secrets**

Add each as type **Secret** (encrypted and write-only) rather than Text, then
redeploy so the new values are picked up.

| Name | Type | Required | Purpose |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Secret | yes | Delivers briefs. Token from [@BotFather](https://t.me/BotFather). |
| `TELEGRAM_CHAT_ID` | Secret | yes | Where briefs land — user id, or a group/channel id such as `-1001234567890`. |
| `TELEGRAM_CLIENT_SECRET` | Secret | for sign-in | OIDC client secret. Unset means no sign-in button. |
| `TELEGRAM_CLIENT_ID` | Text | no | Public; defaults to `8928298590` in code. |
| `TELEGRAM_TOPIC_ID` | Text | no | Post into one topic of a forum group. |
| `TELEGRAM_REDIRECT_URI` | Text | no | Pin the OIDC redirect behind a proxy or custom domain. |
| `REQUIREMENTS_WEBHOOK_URL` | Text | no | Mirror the raw JSON brief elsewhere. |
| `CHAT_MODEL` / `EXTRACT_MODEL` | Text | no | Override the Workers AI models. |

`wrangler.jsonc` deliberately declares **no `vars` block**: values there
overwrite dashboard-set variables on every deploy, which would silently undo a
change made in the panel.

### Checking it worked

```sh
curl https://<your-domain>/api/health
```

It reports which settings the Worker can actually see — booleans only, never a
value — and returns `503` while anything required is missing:

```json
{ "ok": true,
  "checks": { "ai": true, "assets": true, "telegramDelivery": true,
              "telegramSignIn": true, "webhookMirror": false, "rateLimiters": true },
  "missing": [],
  "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }
```

For local runs, copy `.dev.vars.example` to `.dev.vars` (gitignored).

With no channel configured, `/api/requirements` returns `503
delivery_not_configured` and logs why, rather than accepting a brief it
cannot deliver.

## Languages

The site starts in English and there is no language button.

A visitor whose **browser** asks for Persian (`navigator.languages` contains
`fa`, `fa-IR`, `fa-AF`) gets Persian from the first paint, with no animation —
nothing is changing for them. Note this is the browser's *language preference*,
not the keyboard layout: a web page cannot read keyboard layout, by design.

For everyone else the site stays English until they write Persian, at which
point it switches and stays there: `src/lang.js` counts
Persian-script letters against Latin ones and needs at least three of them to
outweigh the Latin, so "I want a ربات" does not flip the page and a stray
emoji never does.

The swap plays as a sunset: the sky deepens, the sun sets, stars come out and
the moon rises, then it lifts back to daylight in the new language. The change
happens at peak night — 700ms into a 1400ms timeline — while the page is hidden
behind the overlay, so the RTL/LTR reflow is never seen. The page's own fade is
shorter and uses opacity only; a transform would shift layout and can flash a
scrollbar. Under `prefers-reduced-motion` the celestial parts are dropped for a
brief neutral veil, since the global animation reset would otherwise freeze the
overlay mid-frame. A short notice says what happened, and `role="status"` reads
it to a screen reader.

The switch is one-way by design: nothing is persisted, so every visit starts
from the browser's own preference, and there is no control to go back
mid-session.

**The served HTML is always English** — `<html lang="en">` and an English
`<title>`. Persian only ever appears after the bundle runs and only for a
visitor who wants it, so a non-Persian visitor never sees Persian in the tab,
on load or on refresh.

Layout is RTL-safe through CSS logical properties, and message bubbles, form
fields and receipt values use `dir="auto"` so a Persian visitor typing English
still reads correctly. Option labels carry both languages in
`shared/formSchema.js` because the Worker renders them into the Telegram
message too.

## Going home

The brand at the start of the header is a plain link to `/`. Nothing is
persisted, so a fresh load is a fresh conversation.

## The form is built per visitor

A shop bot and a booking bot need different things asked, so the tailored
middle of the form is assembled from what the visitor described.

The model does not invent fields. `shared/questionModules.js` holds a curated
bank of small, bilingual modules — selling & payments, support workload,
bookings, alerts, group management, content, automation, Mini App, AI replies,
data & reporting — and extraction returns at most two module ids from it, plus
up to three short follow-up questions it writes itself for anything the bank
does not cover.

That split is deliberate: curated modules keep every label bilingual and every
option value server-validatable, while the free-text follow-ups cover the long
tail. Model-written questions are treated as untrusted text — stripped of
markup, length-capped, and given ids we assign rather than any the model sends.

Answers are filtered against the plan on submit, so a request cannot smuggle in
answers to fields that were never offered. Everything tailored is optional; the
caps (two modules, three questions) exist so this cannot grow back into the
form that was overwhelming in the first place.

## Keeping the form small

Only three things are ever required: what the bot should do, a name, and one
way to reply.

**"What should the bot do?" is never empty.** The opening message goes to
`/api/extract`, which asks the model to rewrite it as a clear, concrete
requirement in the visitor's own voice — tidying wording and typos, never
inventing a feature, budget or deadline. If extraction fails or comes back
too thin, the field falls back to their raw message, so the field is populated
either way. Every other field has a
working default — category, scale, hosting, timeline and budget all start on
"not sure" or "flexible" rather than empty — and they live behind an "Add more
detail" disclosure that is collapsed by default. A visitor who opens the form,
signs in with Telegram and presses send has sent a valid brief.

Validation mirrors that: `validateForm` in `shared/formSchema.js` checks the
three essentials and nothing else. If an error ever does land in a collapsed
field, the disclosure opens automatically rather than hiding it.

## Telegram sign-in

Optional, and off unless configured. Telegram runs a standard OpenID Connect
provider at `oauth.telegram.org`; this uses the Authorization Code flow with
PKCE. The older Login Widget — an iframe posting a payload signed with the bot
token — is deprecated and is not used here.

The whole exchange happens in the Worker:

1. `GET /api/auth/telegram/start` mints `state`, `nonce` and a PKCE verifier,
   seals them in a short-lived signed cookie, and redirects to Telegram.
2. Telegram redirects back to `/api/auth/telegram/callback`, which checks
   `state`, exchanges the code (with the client secret and the PKCE verifier),
   then verifies the `id_token` against Telegram's JWKS — signature, issuer,
   audience, `azp`, expiry and `nonce`.
3. The verified identity is stored in an HMAC-signed, HttpOnly session cookie.
   `GET /api/auth/telegram/me` reports who is signed in.

### Reading the signed-in user

`openid` alone yields only `sub` — an id and nothing else — so the scope is
`openid profile`, which is what carries name, username and photo. Add `phone`
to `TELEGRAM_OIDC_SCOPE` if you also want the phone number; Telegram asks the
visitor to consent to that separately.

Where the identity shows up:

| Place | How |
| --- | --- |
| In the browser | `GET /api/auth/telegram/me` → `{ user, configured }` |
| In the Worker | `currentUser(request, env)` |
| In your Telegram chat | every brief carries a **Verified Telegram identity** line |

If a provider keeps profile claims out of the `id_token`, the callback tops up
from the UserInfo endpoint — only when the profile is thin, only filling gaps,
and only if the returned `sub` matches the `id_token`, as the spec requires.
The claim *names* received are logged (never their values), so
`npx wrangler tail` shows exactly what a scope actually granted.

The client secret and the `id_token` never reach the browser, and the browser
never asserts an identity: `/api/requirements` reads the session cookie itself
rather than trusting anything in the request body. Session and transaction
cookies are domain-separated, so neither can be replayed as the other.

The session is page-wide, held in `src/session.js`: the header offers sign-in
from the moment someone lands, the requirements form consumes the same session,
and signing in from either place updates both. Signing out is offered in the
header too. Sign-in runs in a **popup**, not a full-page redirect — the conversation and a
half-filled form live only in memory, and navigating away would lose them. If
the popup is blocked, it falls back to a redirect.

To turn it on, register the redirect URI
`https://<your-domain>/api/auth/telegram/callback` with Telegram, then set
`TELEGRAM_CLIENT_SECRET` in the dashboard (see **Runtime configuration**).
Without it, no sign-in button is rendered.

A verified sign-in fills in the name and username and counts as a way to reach
the visitor. It never overwrites a name they already typed.

## Abuse and DDoS

Two different problems, handled in two different places — worth being precise
about which is which.

**Volumetric DDoS is not handled in this code, and cannot be.** By the time a
request reaches the Worker the traffic has already been accepted. Cloudflare
absorbs that at the edge, automatically and unmetered on every plan. Turning
on **Bot Fight Mode** and a **WAF rate-limiting rule** in the dashboard is
worth doing; both act before the Worker runs.

**What this code does protect against is abuse and the bill behind it.** Each
chat or extract call costs a Workers AI inference, so a scripted loop is
otherwise free money to burn. `worker/ratelimit.js` applies per-IP caps via
Cloudflare's rate-limiting bindings, configured in `wrangler.jsonc`:

| Binding | Endpoints | Cap |
| --- | --- | --- |
| `CHAT_LIMIT` | `/api/chat/stream`, `/api/extract` | 12 / minute |
| `SUBMIT_LIMIT` | `/api/requirements` | 4 / minute |
| `AUTH_LIMIT` | `/api/auth/telegram/start`, `/callback` | 8 / minute |

The check runs before any AI call or delivery, so a throttled request costs
nothing. Over the cap returns `429` with `Retry-After`, which the UI shows as
"wait a moment" rather than a generic failure. A missing binding or a limiter
outage fails open — degraded protection beats a site that will not load.

Alongside that: 64 KB body cap, every field coerced onto the schema, the brief
re-validated server-side, and a honeypot field.

## Layout

```
shared/formSchema.js   fields, option values + labels, validation (client & Worker)
src/i18n.js            UI strings, language context
src/lang.js            Persian-script detection
src/daynight.css       the sunset transition
src/App.jsx            page shell, language switch
src/components/
  Conversation.jsx     stream, SSE reading, orchestration
  RequirementsForm.jsx the inline form
  Receipt.jsx          read-only summary after submitting
  TelegramLogin.jsx    popup sign-in, verified server-side
  DayNight.jsx         sunset overlay for the language change
worker/
  index.js             routes
  intake.js            prompts, JSON extraction, sanitising
  telegram.js          brief rendering + delivery
  auth.js              OIDC start / callback / me
  oidc.js              discovery, PKCE, JWKS, id_token verification
  session.js           HMAC-signed cookies
  ratelimit.js         per-IP caps
```

`shared/formSchema.js` is imported by both sides on purpose: the field list,
the allowed option values and the validation rules exist once, so the form
and the Worker cannot disagree about what a valid brief is.

## Choosing a model

`CHAT_MODEL` and `EXTRACT_MODEL` are vars, not constants, because the Workers
AI catalogue changes faster than this repo. The default is
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

```sh
npx wrangler ai models        # what your account can actually run
```

Then set either name in `wrangler.jsonc` under `vars`. They are split because
extraction wants strict JSON and instruction-following, which is a different
strength from conversational replies — it is reasonable to point them at
different models.

## SEO

Critical CSS is inlined in `<head>` and the webfont stylesheet is loaded
asynchronously, so the first paint is never an unstyled document — the fonts
are served from a host that is slow or blocked for a good share of this site's
audience, and a render-blocking link there meant the fallback markup appeared
bare.

The page ships static, crawlable content inside `#root` that React replaces on
load: an `h1`, what gets built, and how it works. Crawlers that do not execute
JavaScript still get a real description of the page, and it says the same thing
the rendered app does.

Also in place: a descriptive `<title>` and meta description, canonical URL,
Open Graph and Twitter tags, two JSON-LD blocks (`ProfessionalService` and
`FAQPage`), plus `robots.txt`, `sitemap.xml` and `llms.txt`.

**Before launch, replace `example.com`** in `index.html` (canonical, `og:url`,
JSON-LD), `public/robots.txt` and `public/sitemap.xml` with the real domain,
and add an `og.png` to `public/`.

## A note on asset routing

`wrangler.jsonc` sets `assets.run_worker_first: ["/api/*"]`. Without it,
`not_found_handling: "single-page-application"` makes the asset router answer
browser *navigations* to `/api/…` with `index.html` before the Worker runs.
`fetch()` calls were unaffected, so only the two API routes that are real
navigations broke — the sign-in popup and the OIDC callback, both landing on
the home page.

## Endpoints

| Route | Body | Returns |
| --- | --- | --- |
| `POST /api/chat/stream` | `{ messages, lang, formSubmitted }` | SSE token stream |
| `POST /api/extract` | `{ text, lang }` | `{ prefill }` — `{}` on any failure |
| `POST /api/requirements` | `{ form, lang, transcript, website }` | `{ ok, reference }` |
| `GET /api/health` | — | `{ ok, checks, missing }` — config state, no values |
| `GET /api/auth/telegram/start` | — | `302` to Telegram |
| `GET /api/auth/telegram/callback` | `?code&state` | popup-closing page, sets session |
| `GET /api/auth/telegram/me` | — | `{ user, configured }` |
| `POST /api/auth/telegram/logout` | — | `{ ok }` |

Untrusted input is treated as such: bodies are capped at 64 KB, every field
is coerced onto the schema before use (so neither a crafted request nor a
hallucinated extraction can introduce an unexpected value), the brief is
re-validated server-side, identity is read from the signed session cookie
rather than the request body, and `website` is a honeypot — a real visitor never
sees it, so a filled one is accepted and dropped.

## Development

```sh
npm install
npm run dev      # Vite dev server
npm run preview  # build, then run the Worker locally with wrangler
npm run deploy   # build and deploy to Cloudflare
npm run lint
```

`npm run dev` and `npm run preview` need a Cloudflare account for the Workers
AI binding; the chat and prefill endpoints call `env.AI`.
