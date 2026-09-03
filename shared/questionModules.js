/* Tailored questions.

   A shop bot and a booking bot need different things asked, so the form is
   assembled per visitor rather than being one fixed list. The model does not
   invent fields: it picks from this curated bank, which keeps every label
   bilingual, every option value server-validatable, and the rendered UI
   predictable. Where the bank does not fit, it may write up to
   MAX_QUESTIONS free-text follow-ups instead — plain text, nothing that can
   change how the page behaves.

   Modules stay small on purpose. The form was overwhelming once already; the
   point here is questions that are more relevant, not more of them. */

import { isInstagram } from "./platforms.js";

export const MAX_MODULES = 2;
export const MAX_QUESTIONS = 3;
export const MAX_QUESTION_CHARS = 160;
export const MAX_ANSWER_CHARS = 600;

const f = (key, type, en, fa, options) => ({ key, type, en, fa, options });
const o = (value, en, fa) => ({ value, en, fa });

export const MODULES = {
  shop: {
    on: ["telegram", "instagram"],
    en: "Selling & payments",
    fa: "فروش و پرداخت",
    fields: [
      f("shop.catalogue", "select", "How many products?", "چند محصول دارید؟", [
        o("few", "Under 20", "کمتر از ۲۰"),
        o("dozens", "20 – 200", "۲۰ تا ۲۰۰"),
        o("hundreds", "200 – 2,000", "۲۰۰ تا ۲٬۰۰۰"),
        o("thousands", "Over 2,000", "بیش از ۲٬۰۰۰"),
        o("unsure", "Not sure yet", "هنوز مشخص نیست"),
      ]),
      f("shop.payment", "text", "Which payment method or gateway?", "روش یا درگاه پرداخت؟"),
      f("shop.delivery", "select", "What are you delivering?", "چه چیزی تحویل می‌دهید؟", [
        o("physical", "Physical goods", "کالای فیزیکی"),
        o("digital", "Digital goods", "محصول دیجیتال"),
        o("both", "Both", "هر دو"),
        o("service", "A service", "خدمات"),
      ]),
    ],
  },

  support: {
    on: ["telegram", "instagram"],
    en: "Support workload",
    fa: "بار پشتیبانی",
    fields: [
      f("support.volume", "select", "Roughly how many questions a day?", "روزانه تقریباً چند پرسش؟", [
        o("low", "Under 10", "کمتر از ۱۰"),
        o("medium", "10 – 100", "۱۰ تا ۱۰۰"),
        o("high", "100 – 1,000", "۱۰۰ تا ۱٬۰۰۰"),
        o("veryHigh", "Over 1,000", "بیش از ۱٬۰۰۰"),
        o("unsure", "Not sure yet", "هنوز مشخص نیست"),
      ]),
      f("support.hours", "select", "When must it answer?", "چه زمانی باید پاسخ دهد؟", [
        o("always", "Around the clock", "شبانه‌روزی"),
        o("business", "Business hours", "ساعات اداری"),
        o("unsure", "Not decided", "تصمیم نگرفته‌ایم"),
      ]),
      f("support.handoff", "select", "Hand over to a human?", "انتقال به اپراتور انسانی؟", [
        o("yes", "Yes, when needed", "بله، در صورت نیاز"),
        o("no", "No, bot only", "خیر، فقط ربات"),
        o("unsure", "Not sure yet", "هنوز مشخص نیست"),
      ]),
    ],
  },

  booking: {
    on: ["telegram", "instagram"],
    en: "Bookings",
    fa: "رزرو و نوبت",
    fields: [
      f("booking.resources", "text", "What is being booked?", "چه چیزی رزرو می‌شود؟"),
      f("booking.calendar", "text", "Any calendar to sync with?", "با چه تقویمی همگام شود؟"),
      f("booking.payment", "select", "Payment at booking?", "پرداخت هنگام رزرو؟", [
        o("none", "No payment", "بدون پرداخت"),
        o("deposit", "Deposit only", "فقط بیعانه"),
        o("full", "Pay in full", "پرداخت کامل"),
      ]),
    ],
  },

  notifications: {
    on: ["telegram"],
    en: "Alerts & notifications",
    fa: "اطلاع‌رسانی و هشدار",
    fields: [
      f("notifications.source", "text", "Where do the events come from?", "رویدادها از کجا می‌آیند؟"),
      f("notifications.frequency", "select", "How often?", "با چه تناوبی؟", [
        o("realtime", "As they happen", "لحظه‌ای"),
        o("hourly", "Hourly", "ساعتی"),
        o("daily", "Daily", "روزانه"),
        o("weekly", "Weekly", "هفتگی"),
      ]),
      f("notifications.audience", "select", "Who receives them?", "چه کسانی دریافت می‌کنند؟", [
        o("all", "Everyone", "همه"),
        o("segments", "Specific groups", "گروه‌های مشخص"),
        o("individual", "Per person", "هر فرد جداگانه"),
      ]),
    ],
  },

  community: {
    on: ["telegram"],
    en: "Group & channel management",
    fa: "مدیریت گروه و کانال",
    fields: [
      f("community.size", "text", "How many members?", "چند عضو دارید؟"),
      f("community.moderation", "checks", "What should it police?", "چه چیزی را کنترل کند؟", [
        o("spam", "Spam and links", "هرزنامه و لینک"),
        o("captcha", "Join verification", "تأیید عضویت"),
        o("welcome", "Welcome messages", "پیام خوش‌آمد"),
        o("roles", "Roles and permissions", "نقش‌ها و دسترسی‌ها"),
        o("reports", "Member reports", "گزارش اعضا"),
      ]),
    ],
  },

  content: {
    on: ["telegram", "instagram"],
    en: "Content",
    fa: "محتوا",
    fields: [
      f("content.source", "text", "Where does the content come from?", "محتوا از کجا می‌آید؟"),
      f("content.schedule", "select", "How is it published?", "چگونه منتشر می‌شود؟", [
        o("manual", "Manually", "دستی"),
        o("scheduled", "On a schedule", "زمان‌بندی‌شده"),
        o("triggered", "Triggered by events", "بر اساس رویداد"),
      ]),
    ],
  },

  automation: {
    on: ["telegram", "instagram"],
    en: "Internal automation",
    fa: "اتوماسیون داخلی",
    fields: [
      f("automation.systems", "text", "Which systems must it talk to?", "به چه سامانه‌هایی وصل شود؟"),
      f("automation.users", "select", "Who will use it?", "چه کسانی استفاده می‌کنند؟", [
        o("few", "A handful of people", "چند نفر"),
        o("team", "One team", "یک تیم"),
        o("company", "The whole company", "کل شرکت"),
      ]),
    ],
  },

  miniapp: {
    on: ["telegram"],
    en: "Mini App",
    fa: "مینی‌اپ",
    fields: [
      f("miniapp.screens", "text", "What screens does it need?", "چه صفحاتی لازم دارد؟"),
      f("miniapp.auth", "select", "How do people sign in?", "کاربران چگونه وارد می‌شوند؟", [
        o("telegram", "Telegram account only", "فقط حساب تلگرام"),
        o("own", "Your own accounts", "حساب‌های سامانه شما"),
        o("none", "No sign-in", "بدون ورود"),
      ]),
    ],
  },

  ai: {
    on: ["telegram", "instagram"],
    en: "AI replies",
    fa: "پاسخ‌های هوش مصنوعی",
    fields: [
      f("ai.knowledge", "textarea", "What should it know about?", "درباره چه چیزی بداند؟"),
      f("ai.tone", "select", "How should it sound?", "لحن آن چگونه باشد؟", [
        o("friendly", "Friendly", "صمیمی"),
        o("formal", "Formal", "رسمی"),
        o("concise", "Short and factual", "کوتاه و دقیق"),
      ]),
    ],
  },

  data: {
    on: ["telegram", "instagram"],
    en: "Data & reporting",
    fa: "داده و گزارش",
    fields: [
      f("data.records", "text", "What needs storing?", "چه اطلاعاتی ذخیره شود؟"),
      f("data.reports", "select", "What reporting do you need?", "چه گزارشی لازم دارید؟", [
        o("none", "None", "هیچ"),
        o("simple", "Simple summaries", "خلاصه‌های ساده"),
        o("dashboard", "A dashboard", "داشبورد"),
      ]),
    ],
  },

  comments: {
    on: ["instagram"],
    en: "Comments & stories",
    fa: "کامنت و استوری",
    fields: [
      f("comments.trigger", "text", "Which words or posts should trigger a reply?", "چه کلمه یا پستی پاسخ خودکار بگیرد؟"),
      f("comments.reply", "select", "Where should the reply go?", "پاسخ کجا داده شود؟", [
        o("dm", "Into a direct message", "در دایرکت"),
        o("public", "As a public comment reply", "به‌صورت پاسخ عمومی"),
        o("both", "Both", "هر دو"),
      ]),
      f("comments.stories", "select", "Handle story replies and mentions?", "پاسخ استوری و منشن هم باشد؟", [
        o("yes", "Yes", "بله"),
        o("no", "No", "خیر"),
        o("unsure", "Not sure yet", "هنوز مشخص نیست"),
      ]),
    ],
  },

  leads: {
    on: ["instagram"],
    en: "Lead capture",
    fa: "جذب مشتری",
    fields: [
      f("leads.qualify", "text", "What must you know before a lead is worth following up?", "پیش از پیگیری، چه اطلاعاتی از مشتری لازم دارید؟"),
      f("leads.destination", "text", "Where should the leads land?", "اطلاعات مشتری‌ها کجا ذخیره شود؟"),
    ],
  },

  /* Instagram cannot push freely: outside a 24-hour window since the person
     last wrote, a message needs their opt-in. The question is therefore about
     consent, not cadence — which is why this is a separate module from the
     Telegram "notifications" one rather than a reworded version of it. */
  broadcasts: {
    on: ["instagram"],
    en: "Follow-ups & broadcasts",
    fa: "پیگیری و پیام گروهی",
    fields: [
      f("broadcasts.purpose", "text", "What would you send after the first conversation?", "بعد از گفتگوی اول چه پیامی می‌فرستید؟"),
      f("broadcasts.optin", "select", "How will people opt in to hear from you?", "کاربران چطور رضایت می‌دهند؟", [
        o("inchat", "Asked in the chat", "در همان گفتگو پرسیده می‌شود"),
        o("existing", "We already have consent", "از قبل رضایت گرفته‌ایم"),
        o("unsure", "Not sure yet", "هنوز مشخص نیست"),
      ]),
    ],
  },
};

/* Modules the given site offers. A Telegram-only module reaching an Instagram
   submission (or the reverse) would ask a question that was never on screen,
   so every entry point filters by platform rather than trusting the id. */
export function modulesFor(platform) {
  const site = isInstagram(platform) ? "instagram" : "telegram";
  return Object.fromEntries(
    Object.entries(MODULES).filter(([, module]) => module.on.includes(site))
  );
}

export function moduleIdsFor(platform) {
  return Object.keys(modulesFor(platform));
}

export function moduleFields(ids = [], platform) {
  const bank = modulesFor(platform);
  return ids.flatMap((id) => bank[id]?.fields ?? []);
}

export function fieldByKey(ids, key, platform) {
  return moduleFields(ids, platform).find((field) => field.key === key) ?? null;
}

/* Only ids from this site's bank, deduplicated and capped — a model that asks
   for every module does not get to rebuild the overwhelming form. */
export function sanitizeModules(input, platform) {
  if (!Array.isArray(input)) return [];
  const bank = modulesFor(platform);
  return [...new Set(input.filter((id) => typeof id === "string" && bank[id]))].slice(
    0,
    MAX_MODULES
  );
}

/* Model-authored follow-ups. Plain text only, stripped of anything that could
   read as markup, length-capped, and given ids we control rather than any the
   model supplies. */
export function sanitizeQuestions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => (typeof entry === "string" ? entry : entry?.label))
    .filter((label) => typeof label === "string")
    .map((label) => label.replace(/[<>]/g, "").replace(/\s+/g, " ").trim())
    .filter((label) => label.length >= 8 && label.length <= MAX_QUESTION_CHARS)
    .slice(0, MAX_QUESTIONS)
    .map((label, index) => ({ key: `q${index + 1}`, label }));
}

/* Answers are keyed by field, so anything not offered to this visitor is
   dropped rather than trusted. */
export function sanitizeAnswers(answers, modules, questions, platform) {
  const clean = {};
  if (!answers || typeof answers !== "object") return clean;

  for (const field of moduleFields(modules, platform)) {
    const value = answers[field.key];
    if (field.type === "checks") {
      if (!Array.isArray(value)) continue;
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      const picked = [...new Set(value.filter((v) => allowed.has(v)))];
      if (picked.length) clean[field.key] = picked;
    } else if (field.type === "select") {
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      if (typeof value === "string" && allowed.has(value)) clean[field.key] = value;
    } else if (typeof value === "string" && value.trim()) {
      clean[field.key] = value.trim().slice(0, MAX_ANSWER_CHARS);
    }
  }

  for (const question of questions ?? []) {
    const value = answers[question.key];
    if (typeof value === "string" && value.trim()) {
      clean[question.key] = value.trim().slice(0, MAX_ANSWER_CHARS);
    }
  }

  return clean;
}

export function labelFor(field, lang) {
  return (lang === "fa" ? field.fa : field.en) ?? field.en;
}

export function optionLabel(field, value, lang) {
  const match = (field.options ?? []).find((option) => option.value === value);
  return match ? (lang === "fa" ? match.fa : match.en) : value;
}
