/* Shared between the React client and the Cloudflare Worker so the field
   list, the option keys and the validation rules can never drift apart.
   Option labels carry both languages here rather than in src/i18n.js: the
   Worker needs them too, to render the Telegram message. */

import { isInstagram } from "./platforms.js";

export const LIMITS = {
  botName: 80,
  summary: 2000,
  audience: 300,
  integrations: 600,
  notes: 2000,
  contactName: 120,
  company: 120,
  email: 160,
  telegram: 64,
  phone: 40,
  igHandle: 40,
};

export const SUMMARY_MIN = 20;

const opt = (value, en, fa) => ({ value, en, fa });

export const BOT_TYPE_OPTIONS = [
  opt("unsure", "Not sure yet", "هنوز مشخص نیست"),
  opt("support", "Customer support", "پشتیبانی مشتری"),
  opt("shop", "Shop / e-commerce", "فروشگاه اینترنتی"),
  opt("notifications", "Notifications & alerts", "اطلاع‌رسانی و هشدار"),
  opt("community", "Community / group management", "مدیریت گروه و کامیونیتی"),
  opt("booking", "Booking & reservations", "رزرو و نوبت‌دهی"),
  opt("content", "Content delivery", "انتشار محتوا"),
  opt("forms", "Surveys & forms", "نظرسنجی و فرم"),
  opt("finance", "Crypto / finance", "ارز دیجیتال و مالی"),
  opt("automation", "Internal automation", "اتوماسیون داخلی"),
  opt("game", "Game / entertainment", "بازی و سرگرمی"),
  opt("other", "Something else", "موارد دیگر"),
];

export const FEATURE_OPTIONS = [
  opt("menus", "Inline keyboards & menus", "کیبورد و منوی این‌لاین"),
  opt("payments", "Payments", "پرداخت درون‌بات"),
  opt("media", "File & media handling", "ارسال و دریافت فایل"),
  opt("database", "Database / stored records", "پایگاه داده و ذخیره اطلاعات"),
  opt("admin", "Admin dashboard", "پنل مدیریت"),
  opt("multilang", "Multi-language replies", "پاسخ چندزبانه"),
  opt("scheduled", "Scheduled / recurring messages", "پیام زمان‌بندی‌شده"),
  opt("groups", "Group & channel moderation", "مدیریت گروه و کانال"),
  opt("ai", "AI-generated replies", "پاسخ‌های هوش مصنوعی"),
  opt("analytics", "Analytics & reporting", "گزارش‌گیری و آمار"),
  opt("api", "Third-party API integration", "اتصال به سرویس‌های دیگر"),
  opt("auth", "User accounts & login", "حساب کاربری و ورود"),
  opt("webapp", "Telegram Mini App / Web App", "مینی‌اپ تلگرام"),
];

/* Instagram automation is a different product from a Telegram bot, so the two
   lists that describe *what is being built* are replaced rather than reworded.
   Everything else — languages, scale, hosting, timeline, budget — is about the
   engagement, not the platform, and is shared. */
export const INSTAGRAM_BOT_TYPE_OPTIONS = [
  opt("unsure", "Not sure yet", "هنوز مشخص نیست"),
  opt("dm", "DM auto-reply & FAQ", "پاسخ خودکار دایرکت و پرسش‌های پرتکرار"),
  opt("leads", "Lead capture & qualifying", "جذب و غربال مشتری راغب"),
  opt("comments", "Comment automation (comment-to-DM)", "پاسخ خودکار به کامنت (کامنت به دایرکت)"),
  opt("shop", "Product enquiries & orders", "پرسش درباره محصول و ثبت سفارش"),
  opt("booking", "Bookings & appointments", "رزرو و نوبت‌دهی"),
  opt("support", "Customer support", "پشتیبانی مشتری"),
  opt("creator", "Creator / fan replies", "پاسخ به دنبال‌کنندگان"),
  opt("other", "Something else", "موارد دیگر"),
];

export const INSTAGRAM_FEATURE_OPTIONS = [
  opt("autoreply", "Automatic DM replies", "پاسخ خودکار دایرکت"),
  opt("commentdm", "Comment-to-DM", "کامنت به دایرکت"),
  opt("storyreply", "Story reply & mention handling", "پاسخ به استوری و منشن"),
  opt("icebreakers", "Ice breakers & quick replies", "پرسش‌های آماده و پاسخ سریع"),
  opt("menu", "Persistent menu", "منوی ثابت"),
  opt("leadform", "Lead capture form", "فرم جذب مشتری"),
  opt("handoff", "Handover to a human agent", "انتقال به اپراتور انسانی"),
  opt("catalogue", "Product catalogue & links", "کاتالوگ محصول و لینک"),
  opt("paylinks", "Payment links", "لینک پرداخت"),
  opt("crm", "CRM or sheet sync", "اتصال به CRM یا شیت"),
  opt("broadcast", "Opt-in broadcasts", "پیام گروهی با رضایت کاربر"),
  opt("ai", "AI answers from your content", "پاسخ‌های هوش مصنوعی از محتوای شما"),
];

/* Instagram's Messaging API only works on a professional account, so this is a
   qualifying question rather than a detail: "Personal" means there is a
   prerequisite before any work can start. */
export const IG_ACCOUNT_OPTIONS = [
  opt("business", "Business", "بیزینس"),
  opt("creator", "Creator", "کریتور"),
  opt("personal", "Personal", "شخصی"),
  opt("unsure", "Not sure", "مطمئن نیستم"),
];

export const BOT_LANGUAGE_OPTIONS = [
  opt("fa", "Persian", "فارسی"),
  opt("en", "English", "انگلیسی"),
  opt("ar", "Arabic", "عربی"),
  opt("tr", "Turkish", "ترکی"),
  opt("other", "Other", "سایر"),
];

export const SCALE_OPTIONS = [
  opt("lt100", "Under 100 users", "کمتر از ۱۰۰ کاربر"),
  opt("lt1k", "100 – 1,000 users", "۱۰۰ تا ۱٬۰۰۰ کاربر"),
  opt("lt10k", "1,000 – 10,000 users", "۱٬۰۰۰ تا ۱۰٬۰۰۰ کاربر"),
  opt("lt100k", "10,000 – 100,000 users", "۱۰٬۰۰۰ تا ۱۰۰٬۰۰۰ کاربر"),
  opt("gt100k", "Over 100,000 users", "بیش از ۱۰۰٬۰۰۰ کاربر"),
  opt("unknown", "Not sure yet", "هنوز مشخص نیست"),
];

export const HOSTING_OPTIONS = [
  opt("provider", "You host it for us", "شما میزبانی کنید"),
  opt("client", "We host it ourselves", "خودمان میزبانی می‌کنیم"),
  opt("undecided", "Undecided", "هنوز تصمیم نگرفته‌ایم"),
];

export const TIMELINE_OPTIONS = [
  opt("asap", "As soon as possible", "در اسرع وقت"),
  opt("weeks2", "Within 2 weeks", "تا ۲ هفته"),
  opt("month1", "Within a month", "تا یک ماه"),
  opt("months3", "Within 3 months", "تا ۳ ماه"),
  opt("flexible", "Flexible", "انعطاف‌پذیر"),
];

export const BUDGET_OPTIONS = [
  opt("lt500", "Under $500", "کمتر از ۵۰۰ دلار"),
  opt("500to1500", "$500 – $1,500", "۵۰۰ تا ۱٬۵۰۰ دلار"),
  opt("1500to4000", "$1,500 – $4,000", "۱٬۵۰۰ تا ۴٬۰۰۰ دلار"),
  opt("4000to10000", "$4,000 – $10,000", "۴٬۰۰۰ تا ۱۰٬۰۰۰ دلار"),
  opt("gt10000", "Over $10,000", "بیش از ۱۰٬۰۰۰ دلار"),
  opt("unsure", "Not sure yet", "هنوز مشخص نیست"),
];

/* Every select/checkbox field, so validation and message rendering can walk
   them generically instead of naming each one twice.

   Platform-aware: the two lists describing what is being built are swapped,
   and Instagram adds the account-type question. Everything that reads a
   submission — the form, the validator, the Worker's sanitiser and the brief
   renderer — must resolve this against the *submitting* platform, or an
   answer offered on one site is silently dropped on the other. */
export function choiceFieldsFor(platform) {
  const fields = {
    botType: { options: BOT_TYPE_OPTIONS, multiple: false },
    features: { options: FEATURE_OPTIONS, multiple: true },
    botLanguages: { options: BOT_LANGUAGE_OPTIONS, multiple: true },
    scale: { options: SCALE_OPTIONS, multiple: false },
    hosting: { options: HOSTING_OPTIONS, multiple: false },
    timeline: { options: TIMELINE_OPTIONS, multiple: false },
    budget: { options: BUDGET_OPTIONS, multiple: false },
  };

  if (isInstagram(platform)) {
    fields.botType = { options: INSTAGRAM_BOT_TYPE_OPTIONS, multiple: false };
    fields.features = { options: INSTAGRAM_FEATURE_OPTIONS, multiple: true };
    fields.igAccount = { options: IG_ACCOUNT_OPTIONS, multiple: false };
  }

  return fields;
}

export const TEXT_FIELDS = Object.keys(LIMITS);

/* Instagram-only text fields. Kept out of the Telegram site's list so a
   crafted submission cannot put an "Instagram account" row on a Telegram
   brief — the platform picks the allow-list for text exactly as it does for
   the choice fields. */
const INSTAGRAM_TEXT_FIELDS = ["igHandle"];

export function textFieldsFor(platform) {
  return isInstagram(platform)
    ? TEXT_FIELDS
    : TEXT_FIELDS.filter((key) => !INSTAGRAM_TEXT_FIELDS.includes(key));
}

export function emptyForm(platform) {
  const form = {
    botName: "",
    summary: "",
    botType: "unsure",
    features: [],
    botLanguages: [],
    audience: "",
    scale: "unknown",
    integrations: "",
    hosting: "undecided",
    timeline: "flexible",
    budget: "unsure",
    contactName: "",
    company: "",
    email: "",
    telegram: "",
    phone: "",
    notes: "",
  };

  /* Only on the Instagram site: an unanswered choice left out of the object
     entirely is skipped by the brief renderer, where a default value would
     print a row nobody filled in. */
  if (isInstagram(platform)) {
    form.igHandle = "";
    form.igAccount = "unsure";
  }

  return form;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEGRAM_RE = /^@?[A-Za-z][A-Za-z0-9_]{3,31}$/;

/* Returns { field: errorCode }; an empty object means the form is valid.
   Codes are translated client-side so the Worker stays language-agnostic. */
export function validateForm(form, platform) {
  const errors = {};
  const str = (key) => (typeof form?.[key] === "string" ? form[key].trim() : "");

  for (const key of textFieldsFor(platform)) {
    if (str(key).length > LIMITS[key]) errors[key] = "tooLong";
  }

  /* Deliberately short: everything else has a usable default, so the form can
     be sent after two fields plus a way to reply. */
  if (!str("summary")) errors.summary = "required";
  else if (str("summary").length < SUMMARY_MIN) errors.summary = "tooShort";
  if (!str("contactName")) errors.contactName = "required";

  const email = str("email");
  if (email && !EMAIL_RE.test(email)) errors.email = "invalidEmail";

  const telegram = str("telegram");
  if (telegram && !TELEGRAM_RE.test(telegram)) errors.telegram = "invalidTelegram";

  if (!email && !telegram && !str("phone")) errors.contactChannel = "contactRequired";

  for (const [key, spec] of Object.entries(choiceFieldsFor(platform))) {
    const allowed = new Set(spec.options.map((o) => o.value));
    const value = form?.[key];
    if (spec.multiple) {
      if (value != null && !Array.isArray(value)) errors[key] = "invalid";
      else if (Array.isArray(value) && value.some((v) => !allowed.has(v)))
        errors[key] = "invalid";
    } else if (value && !allowed.has(value)) {
      errors[key] = "invalid";
    }
  }

  return errors;
}

export function labelFor(field, value, lang = "en", platform) {
  const spec = choiceFieldsFor(platform)[field];
  if (!spec) return value;
  const match = spec.options.find((o) => o.value === value);
  return match ? match[lang] ?? match.en : value;
}
