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

Set these as Worker secrets (see `.dev.vars.example`, and copy it to
`.dev.vars` for local runs):

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | Bot token from [@BotFather](https://t.me/BotFather). |
| `TELEGRAM_CHAT_ID` | yes | Where briefs land: your user id, or a group/channel id such as `-1001234567890`. The bot must be a member able to post. |
| `TELEGRAM_TOPIC_ID` | no | Post into one topic of a forum-style group. |
| `REQUIREMENTS_WEBHOOK_URL` | no | Also POST the raw JSON brief here. |
| `REQUIREMENTS_WEBHOOK_SECRET` | no | Sent as `Authorization: Bearer …` with that webhook. |

```sh
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

With no channel configured, `/api/requirements` returns `503
delivery_not_configured` and logs why, rather than accepting a brief it
cannot deliver.

## Languages

The site starts in English and there is no language button. When a visitor
writes Persian, it switches to Persian and stays there: `src/lang.js` counts
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
in English, and there is no control to go back mid-session.

Layout is RTL-safe through CSS logical properties, and message bubbles, form
fields and receipt values use `dir="auto"` so a Persian visitor typing English
still reads correctly. Option labels carry both languages in
`shared/formSchema.js` because the Worker renders them into the Telegram
message too.

## Keeping the form small

Only three things are ever required: what the bot should do (prefilled from
the opening message), a name, and one way to reply. Every other field has a
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

The client secret and the `id_token` never reach the browser, and the browser
never asserts an identity: `/api/requirements` reads the session cookie itself
rather than trusting anything in the request body. Session and transaction
cookies are domain-separated, so neither can be replayed as the other.

Sign-in runs in a **popup**, not a full-page redirect — the conversation and a
half-filled form live only in memory, and navigating away would lose them. If
the popup is blocked, it falls back to a redirect.

To turn it on, register the redirect URI
`https://<your-domain>/api/auth/telegram/callback` with Telegram, then set
`TELEGRAM_CLIENT_SECRET` as a Worker secret. `TELEGRAM_CLIENT_ID` is public and
lives in `wrangler.jsonc`. Without the secret, no sign-in button is rendered.

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

## Endpoints

| Route | Body | Returns |
| --- | --- | --- |
| `POST /api/chat/stream` | `{ messages, lang, formSubmitted }` | SSE token stream |
| `POST /api/extract` | `{ text, lang }` | `{ prefill }` — `{}` on any failure |
| `POST /api/requirements` | `{ form, lang, transcript, website }` | `{ ok, reference }` |
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
