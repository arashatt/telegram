/* Which of the two intake sites a visitor is on.

   The sites are the same funnel with different subject matter: one collects
   requirements for Telegram bots, the other for Instagram bots. Rather than
   forking the tree, every platform-dependent choice — copy, form options,
   question bank, accent colour, the demo's chrome, the Worker's prompts —
   resolves through this one discriminator.

   Shared with the Worker because a submission carries its platform, and the
   Worker validates the answers against that platform's option sets. */

export const PLATFORMS = ["telegram", "instagram"];

export const DEFAULT_PLATFORM = "telegram";

/* A selector among known values, never interpolated into a prompt, a URL or
   markup. Anything unrecognised — absent, misspelt, or crafted — falls back to
   the original site rather than erroring, so an older client that sends no
   platform at all keeps working. */
export function platformId(value) {
  return PLATFORMS.includes(value) ? value : DEFAULT_PLATFORM;
}

export const isInstagram = (value) => platformId(value) === "instagram";

/* The team reads both kinds of brief in one Telegram chat, so each brief says
   which site it came from. Bilingual here rather than in src/i18n.js because
   the Worker renders the message and never loads the client dictionary. */
export const PLATFORM_LABELS = {
  telegram: { en: "Telegram", fa: "تلگرام" },
  instagram: { en: "Instagram", fa: "اینستاگرام" },
};

export function platformLabel(platform, lang) {
  const entry = PLATFORM_LABELS[platformId(platform)];
  return lang === "fa" ? entry.fa : entry.en;
}
