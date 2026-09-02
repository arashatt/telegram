import {
  CHOICE_FIELDS,
  LIMITS,
  TEXT_FIELDS,
  emptyForm,
} from "../shared/formSchema.js";
import {
  MAX_MODULES,
  MAX_QUESTIONS,
  MODULES,
  MODULE_IDS,
} from "../shared/questionModules.js";

export const MAX_TRANSCRIPT_MESSAGES = 24;
export const MAX_MESSAGE_CHARS = 4000;

const LANGUAGE_RULE = {
  en: "Reply in English.",
  fa: "Reply in Persian (فارسی).",
};

/* The conversation is deliberately short: the visitor's opening message is
   answered once, then the requirements form takes over. The prompt says so
   explicitly, otherwise the model starts its own question-by-question
   interview and duplicates the form. */
export function chatSystemPrompt(lang, formSubmitted) {
  const base = [
    "You are the intake assistant for a studio that builds custom Telegram bots.",
    LANGUAGE_RULE[lang] ?? LANGUAGE_RULE.en,
    "Be warm, concrete and brief: at most three short sentences.",
    "Never invent prices, delivery dates or technical guarantees.",
  ];

  if (formSubmitted) {
    base.push(
      "The visitor has already submitted their requirements form and the team has it.",
      "Answer follow-up questions and note anything new they mention; do not ask them to fill the form again."
    );
  } else {
    base.push(
      "Acknowledge what the visitor described and name one thing that stood out.",
      "A requirements form is opening directly below your reply, so end by inviting them to fill it in.",
      "Do not ask the visitor a list of questions — the form collects the details."
    );
  }

  return base.join(" ");
}

const PREFILL_FIELDS = ["botName", "summary", "botType", "features", "audience", "integrations"];

export function extractionMessages(text, lang) {
  const choices = PREFILL_FIELDS.filter((f) => CHOICE_FIELDS[f])
    .map((f) => `"${f}": one of [${CHOICE_FIELDS[f].options.map((o) => o.value).join(", ")}]`)
    .join("; ");

  return [
    {
      role: "system",
      content: [
        "You extract structured data from a description of a wanted Telegram bot.",
        'Respond with a single JSON object and nothing else — no prose, no code fences.',
        `Keys: "botName" (short string), "summary", "audience" (short string), "integrations" (short string), ${choices}.`,
        `"summary" is the important one: rewrite what the visitor said as a clear, concrete requirement of one to three sentences in ${
          lang === "fa" ? "Persian" : "English"
        }, in their voice, keeping every detail they gave.`,
        "Tidy the wording and fix obvious typos, but never invent a feature, platform, budget or deadline they did not mention.",
        '"features" is an array of the listed values.',
        `"modules" is an array of at most ${MAX_MODULES} ids naming the topics worth asking this visitor about, chosen from: ${MODULE_IDS.map(
          (id) => `${id} (${MODULES[id].en})`
        ).join("; ")}. Pick only what their description actually calls for, most relevant first, and return [] if none fit.`,
        `"questions" is an array of at most ${MAX_QUESTIONS} short follow-up questions to ask them, in ${
          lang === "fa" ? "Persian" : "English"
        } — only for important things their description leaves open that the modules above do not already cover. Each must be one plain sentence ending in a question mark, answerable in a line or two. Return [] rather than padding.`,
        "Omit any key the text does not support. Never guess a value that is not implied by the text.",
      ].join(" "),
    },
    { role: "user", content: text },
  ];
}

/* Models drift: fenced blocks, a leading sentence, trailing commentary. Pull
   the first balanced object out of whatever came back rather than trusting
   the response to be bare JSON. */
export function parseJsonObject(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const value = JSON.parse(text.slice(start, i + 1));
          return value && typeof value === "object" && !Array.isArray(value) ? value : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function cleanText(value, limit) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

/* Coerces anything — model output or client payload — onto the schema. Only
   known keys survive, strings are capped and choice values must exist in the
   option list, so neither a hallucination nor a crafted request can put an
   unexpected value into a brief. */
export function sanitizeForm(input) {
  const form = emptyForm();
  if (!input || typeof input !== "object") return form;

  for (const key of TEXT_FIELDS) {
    if (key in input) form[key] = cleanText(input[key], LIMITS[key]);
  }

  for (const [key, spec] of Object.entries(CHOICE_FIELDS)) {
    const allowed = spec.options.map((o) => o.value);
    const value = input[key];
    if (spec.multiple) {
      if (Array.isArray(value)) {
        form[key] = [...new Set(value.filter((v) => allowed.includes(v)))].slice(
          0,
          allowed.length
        );
      }
    } else if (typeof value === "string" && allowed.includes(value)) {
      form[key] = value;
    }
  }

  return form;
}

/* Keeps only the prefillable subset, so an over-eager extraction can't decide
   the visitor's budget or contact details for them. */
export function sanitizePrefill(input) {
  const full = sanitizeForm(input);
  const prefill = {};
  for (const key of PREFILL_FIELDS) {
    const value = full[key];
    if (Array.isArray(value) ? value.length : value) prefill[key] = value;
  }
  return prefill;
}

export function sanitizeTranscript(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: cleanText(m.content, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content)
    .slice(-MAX_TRANSCRIPT_MESSAGES);
}

export function normalizeLang(value) {
  return value === "fa" ? "fa" : "en";
}
