# Telegram bot intake

A conversational intake site for a studio that builds custom Telegram bots.
A visitor describes the bot they want in a full-page conversation; the
assistant replies, a requirements form opens inline in the same stream
pre-filled from what they just wrote, and the finished brief is delivered to
the team's Telegram chat.

Built with React + Vite, served from a single Cloudflare Worker that also
hosts the API. The assistant runs on Claude when an Anthropic API key is
configured, and on Workers AI otherwise — see [Choosing a
model](#choosing-a-model).

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

## Design

The visual language is documented as a skill:
`.claude/skills/telegram-native-design/SKILL.md`. Read it before adding or
restyling any UI — it carries the tokens, type scale, radii, motion timings and
the RTL rules, so new work matches rather than drifts.

The short version: every value resolves through a token in `src/index.css`,
light on `:root` and dark redefining only what differs, which is what makes the
theme a single `data-theme` attribute. Theme follows `prefers-color-scheme`
with a header toggle, and like the language it is not persisted.

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
| `ANTHROPIC_API_KEY` | Secret | no | Claude answers the conversation and fills the form when set. Unset means Workers AI, as before. `CLAUDE_API_KEY` is accepted under the same meaning. |
| `CLAUDE_MODEL` | Text | no | Override the Claude model. Defaults to `claude-opus-5`. |
| `ANTHROPIC_BASE_URL` | Text | no | Point the SDK at a gateway instead of the API. Unset in normal use. |
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
  "checks": { "ai": true, "assets": true, "claude": true, "telegramDelivery": true,
              "telegramSignIn": true, "webhookMirror": false, "rateLimiters": true },
  "missing": [],
  "chatProvider": "claude",
  "model": "claude-opus-5",
  "fallbackModel": "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }
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

The swap plays behind a veil: an opaque cross-fade of the page ground. The
language and `dir` change at 420ms of a 900ms timeline, while the veil is at
full opacity, so the RTL/LTR reflow is never seen — which is the whole point,
and why no separate page fade is needed. A short notice says what happened, and
`role="status"` reads it to a screen reader. Because nothing depends on an
animation finishing, the global reduced-motion reset degrades it safely with no
per-component exceptions.

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

`openid` alone yields only `sub` — an id and nothing else. The scope is
`openid profile phone`: `profile` carries name, username and photo, `phone`
carries the number. Telegram asks the visitor to consent to the phone
separately and they may decline, which still signs them in — every claim is
optional downstream. Set `TELEGRAM_OIDC_SCOPE` to replace the list wholesale,
e.g. `openid profile` to stop asking for the number.

A verified phone fills the form's phone field, and appears in the brief. It
never overwrites a number the visitor typed themselves.

### Messaging the visitor back

`telegram:bot_access` is also requested. Bots cannot open a conversation, so
without it there is no way to reach someone who has never messaged you; this
scope is the exception, granted at sign-in.

Using it needs `TELEGRAM_LOGIN_BOT_TOKEN`: the token of **the bot behind the
OIDC client**, which is usually a different bot from the one that delivers
briefs. Only that bot was granted access to this person, so
`TELEGRAM_BOT_TOKEN` will not work here.

With it set, a submitted brief also sends the visitor a short confirmation
carrying their reference, in the language they used. It is best-effort: the
brief is already delivered by then, so a blocked bot or a failed send is logged
and never turns a successful submission into an error. Without it, nothing is
sent — and the scope is then asking for a permission nothing uses, so trim
`TELEGRAM_OIDC_SCOPE` if you do not intend to.

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
src/App.jsx            page shell, language switch
src/components/
  Conversation.jsx     stream, SSE reading, orchestration
  RequirementsForm.jsx the inline form
  Receipt.jsx          read-only summary after submitting
  TelegramLogin.jsx    popup sign-in, verified server-side
  Landing.jsx          hero, live demo, trust strip, how-it-works, footer
  BotMark.jsx          animated hero mark
  HubDiagram.jsx       animated how-it-works diagram
  Icons.jsx            inline SVG glyphs
  CodeFilm.jsx         looping film of the Worker build (landing)
  BookingDemo.jsx      tappable booking-bot phone mock-up (landing)
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

## Two sites

`/` collects requirements for **Telegram bots**. `/instagram` collects them for
**Instagram automations** — the same funnel, the same components, the same
Worker, with the subject matter swapped. Nothing on the main page links to it,
so it is reachable only by its URL, and it carries `noindex` so it stays out of
search until it has a domain of its own.

They are one codebase with a `platform` discriminator (`shared/platforms.js`),
not a fork. What it selects:

| What | Where |
| --- | --- |
| Copy | `src/copy.instagram.js` overrides ~25 of the keys in `src/i18n.js` |
| Bot types and features | `choiceFieldsFor(platform)` in `shared/formSchema.js` |
| The question bank | modules are tagged `on: [...]` in `shared/questionModules.js` |
| Accent colour | `[data-platform="instagram"]` in `src/index.css` |
| The demo's chrome | `.bkd--instagram` in `src/components/BookingDemo.css` |
| The Worker's prompts and the brief heading | `worker/intake.js`, `worker/telegram.js` |

The client sends `platform` with every API call; the Worker runs it through
`platformId()` first, which falls back to `telegram` for anything it does not
recognise. That matters for more than copy: the platform chooses **which
allow-list a submission is validated against**, so a Telegram-only feature
value in an Instagram submission is dropped rather than trusted.

Both sites deliver to the same Telegram chat, and each brief's heading says
which one it came from. Sign-in is Telegram's on both, because that is what it
actually is.

Each page is its own HTML entry (`index.html`, `instagram.html`), built via
`environments.client.build.rollupOptions.input` in `vite.config.js` — scoped to
the client environment because the Cloudflare plugin builds the Worker as a
second environment and would otherwise be handed the HTML entries too. That is
what gives each page its own `<title>`, description and robots rule; a shared
SPA route could not.

### Moving the Instagram page to its own domain

Nothing here blocks it. The same Worker serves both, so a new domain needs its
root mapped to `instagram.html`; the page itself reads its platform from its
entry point, not from the URL, so it does not care what path it is served at.

## The live demo

`BookingDemo.jsx` is a phone-shaped mock-up of a booking bot on the landing
page, above the trust cards. It plays a scripted chat on a loop, and the
keyboard is real: tapping a party size or a time takes the flow down that
branch, and the confirmation, booking code, guest count and reminder all
follow the choice.

Three things it does that a decorative animation would not:

- It pauses while scrolled out of view and resumes when scrolled back.
- Under `prefers-reduced-motion: reduce` it never plays or loops by itself,
  but the keyboard still answers a tap — the visitor drives it instead of
  watching it. A JavaScript sequence is the one thing the global CSS
  reduced-motion reset cannot reach, so the component reads the preference
  itself.
- Its screen height is capped against the viewport on narrow screens, so the
  tappable keyboard cannot fall off the bottom of a short phone.

Every string in it comes from `src/i18n.js`, the scripted chat included, so
it follows the page language like the rest of the landing copy. The one
exception is the booking reference: an identifier people read aloud and type
back, so it stays Latin and `dir="ltr"` in both languages.

## Choosing a model

Two providers, chosen by whether a key is present.

**Claude, when `ANTHROPIC_API_KEY` is set.** It answers the conversation and
does the extraction that fills the form — the same prompts and the same
sanitisers as the Workers AI path, so only the quality of the answer changes.
The default model is `claude-opus-5`; `CLAUDE_MODEL` overrides it.

The key is read from the Worker's environment and used only inside the Worker,
so it never reaches the browser. Add it in the dashboard as type **Secret**,
never in `wrangler.jsonc`.

Requests are sent with adaptive thinking left on at `low` effort. Turning
thinking off is what makes a model leak its internal tags into a visible
answer; lowering the effort is the cheaper lever and keeps the reply fast.
`max_tokens` is set well above the three sentences the prompt asks for,
because the thinking that happens underneath draws on the same budget.
Server-side refusal fallbacks are enabled, so a request Claude's safety
classifiers decline is re-run on Anthropic's recommended substitute rather
than coming back blank.

**Workers AI otherwise — and as the fallback either way.** If Claude is
unreachable, rate-limited, mis-keyed or declines the turn, the Worker logs why
and answers from `env.AI` instead. Nothing has been sent to the visitor at that
point, so the fallback is invisible to them. This is why the site keeps working
if the key is ever revoked.

`CHAT_MODEL` and `EXTRACT_MODEL` name the Workers AI models. They are vars, not
constants, because the Workers AI catalogue changes faster than this repo; the
default is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

```sh
npx wrangler ai models        # what your account can actually run
```

They are split because extraction wants strict JSON and instruction-following,
which is a different strength from conversational replies — it is reasonable to
point them at different models.

Either provider costs money per turn, which is what the per-IP rate limits in
[Abuse and DDoS](#abuse-and-ddos) are protecting.

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
