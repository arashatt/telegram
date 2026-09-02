/* Claude as the intake model.

   Optional by design: with no API key the site behaves exactly as before,
   answering from the Workers AI binding. With a key, Claude serves both the
   conversation and the extraction that fills the form, and Workers AI stays
   as the fallback for any call Claude cannot complete.

   The key is only ever read from the Worker's environment, so it never
   reaches the browser. Set it in the Cloudflare dashboard as type "Secret":
   Workers & Pages > your Worker > Settings > Variables and Secrets. */

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-5";

/* Anthropic's own convention is ANTHROPIC_API_KEY; CLAUDE_API_KEY is accepted
   because that is what the key is called in conversation, and a name that
   looks right but is not read is a bad half-hour. */
export const claudeKey = (env) => env?.ANTHROPIC_API_KEY || env?.CLAUDE_API_KEY || "";

export const hasClaude = (env) => Boolean(claudeKey(env));

export const claudeModel = (env) => env?.CLAUDE_MODEL || DEFAULT_MODEL;

/* ANTHROPIC_BASE_URL points the SDK somewhere other than the API — a
   Cloudflare AI Gateway in front of it, or a stand-in during tests. Unset in
   production, which is the default. */
const client = (env) =>
  new Anthropic({
    apiKey: claudeKey(env),
    /* A visitor is waiting on this. The SDK's default is two retries and a
       ten-minute ceiling, which would spend a minute failing before the
       Workers AI fallback got its turn — one retry, then hand it over. */
    maxRetries: 1,
    ...(env?.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
  });

/* Anthropic takes the system prompt as its own parameter and requires the
   conversation to open on a user turn, so a transcript that starts mid-reply
   is trimmed rather than rejected. */
function conversation(messages) {
  const first = messages.findIndex((m) => m.role === "user");
  return first === -1 ? [] : messages.slice(first);
}

/* Refusals are safety declines, not errors: the response arrives with status
   200 and no content, so it has to be checked before the content is read.
   `fallbacks: "default"` already re-runs a declined request on Anthropic's
   recommended substitute — this only catches a chain that declined
   throughout, and hands the turn back to Workers AI. */
const REFUSED = "claude declined this request";

/* Enabled on both calls so a decline is retried server-side, by category,
   instead of surfacing as a blank reply. */
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

/* Thinking is on by default on this model and stays on: turning it off is
   what makes internal tags leak into a visible answer. Low effort is the
   lever instead — this is a three-sentence acknowledgement, not a hard
   problem — and max_tokens has to leave room for the thinking that still
   happens underneath. */
const CHAT = { maxTokens: 2000, effort: "low", timeout: 20_000 };
const EXTRACT = { maxTokens: 4000, effort: "low", timeout: 30_000 };

const textDelta = (event) =>
  event?.type === "content_block_delta" && event.delta?.type === "text_delta"
    ? event.delta.text
    : "";

/* The browser reads one SSE shape — `data: {"response": "…"}` — whichever
   model answered, so the client never learns which provider is configured
   and neither provider owns the wire format. */
function sseLine(text) {
  return `data: ${JSON.stringify({ response: text })}\n\n`;
}

/* Resolves once the reply is definitely coming, so a bad key, an exhausted
   quota or a refusal still leaves the caller free to fall back to Workers AI.
   After the first token there is no going back — the visitor is already
   reading it — so a later failure just ends the stream. */
export async function streamChat(env, { system, messages }) {
  const stream = client(env).beta.messages.stream({
    ...FALLBACK,
    model: claudeModel(env),
    max_tokens: CHAT.maxTokens,
    output_config: { effort: CHAT.effort },
    system,
    messages: conversation(messages),
  }, { timeout: CHAT.timeout });

  const events = stream[Symbol.asyncIterator]();
  let opening = "";
  let ended = false;

  while (!opening && !ended) {
    const { value, done } = await events.next();
    if (done) ended = true;
    else opening = textDelta(value);
  }

  if (!opening) throw new Error(REFUSED);

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (text) => controller.enqueue(encoder.encode(sseLine(text)));
      try {
        send(opening);
        for (;;) {
          const { value, done } = await events.next();
          if (done) break;
          const text = textDelta(value);
          if (text) send(text);
        }
      } catch (err) {
        // A truncated reply still reads as an answer; the form opens either
        // way, so this is logged rather than surfaced.
        console.error("Claude stream ended early:", err.message);
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/* Returns the model's raw text for the shared JSON parser — the same prompt
   and the same sanitisers as the Workers AI path, so the form is assembled
   identically whichever model filled it in. */
export async function extract(env, messages) {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const message = await client(env).beta.messages.create({
    ...FALLBACK,
    model: claudeModel(env),
    max_tokens: EXTRACT.maxTokens,
    output_config: { effort: EXTRACT.effort },
    system,
    messages: conversation(messages),
  }, { timeout: EXTRACT.timeout });

  if (message.stop_reason === "refusal") throw new Error(REFUSED);

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
