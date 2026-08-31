import { CHOICE_FIELDS, labelFor } from "../shared/formSchema.js";
import {
  labelFor as questionLabel,
  moduleFields,
  optionLabel,
} from "../shared/questionModules.js";

const TELEGRAM_API = "https://api.telegram.org";
/* Telegram caps sendMessage at 4096 characters; leave room for the part
   counter we append when a brief has to be split. */
const CHUNK_LIMIT = 3800;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const FIELD_TITLES = {
  botName: ["Bot name", "نام ربات"],
  summary: ["What it should do", "شرح ربات"],
  botType: ["Category", "دسته‌بندی"],
  features: ["Features", "امکانات"],
  botLanguages: ["Bot languages", "زبان‌های ربات"],
  audience: ["Audience", "مخاطب"],
  scale: ["Expected users", "تعداد کاربران"],
  integrations: ["Integrations", "اتصال‌ها"],
  hosting: ["Hosting", "میزبانی"],
  timeline: ["Timeline", "زمان تحویل"],
  budget: ["Budget", "بودجه"],
  contactName: ["Name", "نام"],
  company: ["Company", "شرکت"],
  email: ["Email", "ایمیل"],
  telegram: ["Telegram", "تلگرام"],
  phone: ["Phone", "تلفن"],
  notes: ["Notes", "توضیحات"],
};

const SECTIONS = [
  ["🤖", ["The bot", "ربات"], ["botName", "summary", "botType", "features", "botLanguages"]],
  ["📐", ["Scope", "دامنه"], ["audience", "scale", "integrations", "hosting", "timeline", "budget"]],
  ["📇", ["Contact", "تماس"], ["contactName", "company", "email", "telegram", "phone", "notes"]],
];

function title(field, lang) {
  const pair = FIELD_TITLES[field];
  if (!pair) return field;
  return lang === "fa" ? pair[1] : pair[0];
}

function renderValue(field, value, lang) {
  if (value == null || value === "") return null;
  const spec = CHOICE_FIELDS[field];
  if (spec?.multiple) {
    if (!Array.isArray(value) || value.length === 0) return null;
    return value.map((v) => labelFor(field, v, lang)).join(lang === "fa" ? "، " : ", ");
  }
  if (spec) return labelFor(field, value, lang);
  return String(value);
}

/* One brief -> an array of HTML lines. Lines are the chunking unit, so each
   one keeps its tags balanced and a split can never land mid-tag. */
export function buildBriefLines(submission) {
  const { form, lang = "en", transcript = [], meta = {}, verified = null } = submission;
  const heading =
    lang === "fa" ? "درخواست جدید ساخت ربات تلگرام" : "New Telegram bot request";

  const lines = [`<b>📨 ${escapeHtml(heading)}</b>`, ""];

  for (const [icon, names, fields] of SECTIONS) {
    const rendered = fields
      .map((field) => [field, renderValue(field, form?.[field], lang)])
      .filter(([, value]) => value !== null);
    if (rendered.length === 0) continue;

    lines.push(`${icon} <b>${escapeHtml(lang === "fa" ? names[1] : names[0])}</b>`);
    for (const [field, value] of rendered) {
      lines.push(`• <b>${escapeHtml(title(field, lang))}:</b> ${escapeHtml(value)}`);
    }
    lines.push("");
  }

  /* The questions this visitor was actually asked, with their answers. Kept
     in its own section because the fields differ from brief to brief. */
  const tailored = [];
  for (const field of moduleFields(submission.modules ?? [])) {
    const value = (submission.answers ?? {})[field.key];
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) continue;
    const rendered = Array.isArray(value)
      ? value.map((v) => optionLabel(field, v, lang)).join(lang === "fa" ? "، " : ", ")
      : field.type === "select"
        ? optionLabel(field, value, lang)
        : value;
    tailored.push([questionLabel(field, lang), rendered]);
  }
  for (const question of submission.questions ?? []) {
    const value = (submission.answers ?? {})[question.key];
    if (value) tailored.push([question.label, value]);
  }

  if (tailored.length) {
    lines.push(
      `🎯 <b>${escapeHtml(lang === "fa" ? "پرسش‌های اختصاصی" : "Tailored questions")}</b>`
    );
    for (const [question, answer] of tailored) {
      lines.push(`• <b>${escapeHtml(question)}</b> ${escapeHtml(answer)}`);
    }
    lines.push("");
  }

  /* A verified identity is worth more than the typed-in contact fields, so it
     is called out separately rather than merged into them. */
  if (verified) {
    const handle = verified.username ? `@${verified.username}` : "—";
    const name = [verified.firstName, verified.lastName].filter(Boolean).join(" ");
    lines.push(
      `✅ <b>${escapeHtml(
        lang === "fa" ? "هویت تأییدشده تلگرام" : "Verified Telegram identity"
      )}</b>`
    );
    lines.push(
      `• ${escapeHtml(handle)}${name ? ` — ${escapeHtml(name)}` : ""} (id <code>${escapeHtml(
        verified.id
      )}</code>)`
    );
    lines.push("");
  }

  if (transcript.length) {
    lines.push(`💬 <b>${escapeHtml(lang === "fa" ? "گفت‌وگو" : "Conversation")}</b>`);
    for (const message of transcript) {
      const who = message.role === "user" ? "👤" : "🤖";
      lines.push(`${who} ${escapeHtml(message.content)}`);
    }
    lines.push("");
  }

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const footer = [stamp, meta.referrer, meta.country].filter(Boolean).join(" · ");
  lines.push(`<i>${escapeHtml(footer)}</i>`);

  return lines;
}

/* Group lines into <=CHUNK_LIMIT blocks. A single line longer than the limit
   is hard-split, but field values are length-capped upstream so that is a
   guard rather than the normal path. */
export function chunkLines(lines, limit = CHUNK_LIMIT) {
  const chunks = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trimEnd());
    current = "";
  };

  for (const line of lines) {
    const pieces =
      line.length <= limit ? [line] : (line.match(new RegExp(`[\\s\\S]{1,${limit}}`, "g")) ?? []);
    for (const piece of pieces) {
      if (current.length + piece.length + 1 > limit) push();
      current += piece + "\n";
    }
  }
  push();

  return chunks.length ? chunks : ["(empty)"];
}

async function sendMessage(env, text) {
  const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(env.TELEGRAM_TOPIC_ID
        ? { message_thread_id: Number(env.TELEGRAM_TOPIC_ID) }
        : {}),
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(
      `Telegram sendMessage failed (${res.status}): ${body.description ?? "unknown error"}`
    );
  }
  return body;
}

export function isTelegramConfigured(env) {
  return Boolean(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_CHAT_ID);
}

/* Delivers a brief to every configured channel. Telegram is the primary one;
   REQUIREMENTS_WEBHOOK_URL is an optional mirror for teams that also want the
   raw JSON in their own system. Succeeds if at least one channel accepts. */
export async function deliverBrief(env, submission) {
  const results = [];

  if (isTelegramConfigured(env)) {
    try {
      const chunks = chunkLines(buildBriefLines(submission));
      for (let i = 0; i < chunks.length; i++) {
        const suffix =
          chunks.length > 1 ? `\n<i>(${i + 1}/${chunks.length})</i>` : "";
        await sendMessage(env, chunks[i] + suffix);
      }
      results.push({ channel: "telegram", ok: true });
    } catch (err) {
      console.error("Telegram delivery failed:", err.message);
      results.push({ channel: "telegram", ok: false, error: err.message });
    }
  }

  if (env?.REQUIREMENTS_WEBHOOK_URL) {
    try {
      const res = await fetch(env.REQUIREMENTS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.REQUIREMENTS_WEBHOOK_SECRET
            ? { authorization: `Bearer ${env.REQUIREMENTS_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify(submission),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
      results.push({ channel: "webhook", ok: true });
    } catch (err) {
      console.error("Webhook delivery failed:", err.message);
      results.push({ channel: "webhook", ok: false, error: err.message });
    }
  }

  return { configured: results.length > 0, results };
}
