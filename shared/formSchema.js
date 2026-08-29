/* Shared between the React client and the Cloudflare Worker so the field
   list, the option keys and the validation rules can never drift apart.
   Option labels carry both languages here rather than in src/i18n.js: the
   Worker needs them too, to render the Telegram message. */

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
   them generically instead of naming each one twice. */
export const CHOICE_FIELDS = {
  botType: { options: BOT_TYPE_OPTIONS, multiple: false },
  features: { options: FEATURE_OPTIONS, multiple: true },
  botLanguages: { options: BOT_LANGUAGE_OPTIONS, multiple: true },
  scale: { options: SCALE_OPTIONS, multiple: false },
  hosting: { options: HOSTING_OPTIONS, multiple: false },
  timeline: { options: TIMELINE_OPTIONS, multiple: false },
  budget: { options: BUDGET_OPTIONS, multiple: false },
};

export const TEXT_FIELDS = Object.keys(LIMITS);

export function emptyForm() {
  return {
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
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEGRAM_RE = /^@?[A-Za-z][A-Za-z0-9_]{3,31}$/;

/* Returns { field: errorCode }; an empty object means the form is valid.
   Codes are translated client-side so the Worker stays language-agnostic. */
export function validateForm(form) {
  const errors = {};
  const str = (key) => (typeof form?.[key] === "string" ? form[key].trim() : "");

  for (const key of TEXT_FIELDS) {
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

  for (const [key, spec] of Object.entries(CHOICE_FIELDS)) {
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

export function labelFor(field, value, lang = "en") {
  const spec = CHOICE_FIELDS[field];
  if (!spec) return value;
  const match = spec.options.find((o) => o.value === value);
  return match ? match[lang] ?? match.en : value;
}
