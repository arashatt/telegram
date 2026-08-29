# Telegram bot intake — Limoo Host

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

The UI ships in Persian (default, RTL) and English, switched from the header
and remembered in `localStorage`. Layout is RTL-safe through CSS logical
properties, and message bubbles, form fields and receipt values use
`dir="auto"` so a Persian visitor typing English still reads correctly.
Option labels carry both languages in `shared/formSchema.js` because the
Worker renders them into the Telegram message too.

## Layout

```
shared/formSchema.js   fields, option values + labels, validation (client & Worker)
src/i18n.js            UI strings, language context
src/App.jsx            page shell, language switch
src/components/
  Conversation.jsx     stream, SSE reading, orchestration
  RequirementsForm.jsx the inline form
  Receipt.jsx          read-only summary after submitting
worker/
  index.js             routes
  intake.js            prompts, JSON extraction, sanitising
  telegram.js          brief rendering + delivery
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

Untrusted input is treated as such: bodies are capped at 64 KB, every field
is coerced onto the schema before use (so neither a crafted request nor a
hallucinated extraction can introduce an unexpected value), the brief is
re-validated server-side, and `website` is a honeypot — a real visitor never
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
