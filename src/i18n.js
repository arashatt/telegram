import { createContext, useContext } from "react";

export const LANGS = ["en", "fa"];
export const DEFAULT_LANG = "fa";
export const STORAGE_KEY = "limoo.lang";

export function dirFor(lang) {
  return lang === "fa" ? "rtl" : "ltr";
}

export const translations = {
  en: {
    brand: "Limoo Host",
    tagline: "Telegram bots, built to your spec",
    langToggle: "فارسی",
    langToggleLabel: "Switch to Persian",

    greeting:
      "Hi — I'm the intake assistant at Limoo Host. Tell me about the Telegram bot you want built: what should it do, and who is it for?",
    placeholder: "Describe the bot you want…",
    placeholderAfterForm: "Anything else we should know?",
    send: "Send",
    sending: "Sending",
    you: "You",
    assistant: "Assistant",
    thinking: "Thinking…",
    networkError:
      "Couldn't reach the assistant. Check your connection and try again.",
    retry: "Try again",
    startOver: "Start over",
    startOverConfirm: "Clear this conversation and start a new one?",

    formIntro:
      "Great — a few details and I'll hand this straight to the team. The parts I could pick up from your message are already filled in.",
    formTitle: "Bot requirements",
    prefilled: "from your message",
    formSubtitle: "Fields marked * are required.",
    sectionBot: "About the bot",
    sectionScope: "Scope & scale",
    sectionContact: "Contact & logistics",

    botName: "Bot name or project title",
    botNameHint: "A working name is fine — we can change it later.",
    summary: "What should the bot do?",
    summaryHint: "The more concrete, the better the estimate.",
    botType: "Bot category",
    features: "Features you need",
    botLanguages: "Languages the bot should speak",
    audience: "Who will use it?",
    audienceHint: "e.g. our shop's customers, internal staff, channel members.",
    scale: "Expected number of users",
    integrations: "Systems it must connect to",
    integrationsHint: "Payment gateways, CRM, your own API, spreadsheets…",
    hosting: "Hosting",
    timeline: "Timeline",
    budget: "Budget range",
    contactName: "Your name",
    company: "Company or brand",
    email: "Email",
    telegram: "Telegram username",
    phone: "Phone",
    contactHint: "Give us at least one way to reach you.",
    notes: "Anything else",

    choosePlaceholder: "Choose…",
    submit: "Send my requirements",
    submitting: "Sending…",
    submitBlocked: "Please fix the highlighted fields.",
    submitFailed: "We couldn't send your requirements. Please try again.",
    edit: "Edit answers",

    errRequired: "This field is required.",
    errTooShort: "Please add a little more detail.",
    errTooLong: "This is too long.",
    errInvalidEmail: "That doesn't look like an email address.",
    errInvalidTelegram: "Use your @username, 5–32 letters, digits or _.",
    errInvalid: "Please pick one of the options.",
    errContactRequired: "Add an email, Telegram username or phone number.",

    sentTitle: "Requirements sent",
    sentBody:
      "Our team has your brief and will get back to you shortly. You can keep chatting below if you remember something else.",
    summaryHeading: "What we received",
    notProvided: "—",
  },

  fa: {
    brand: "لیموهاست",
    tagline: "ربات تلگرام، دقیقاً مطابق نیاز شما",
    langToggle: "English",
    langToggleLabel: "تغییر به انگلیسی",

    greeting:
      "سلام! من دستیار ثبت سفارش لیموهاست هستم. درباره رباتی که می‌خواهید بسازیم بگویید: قرار است چه کاری انجام دهد و مخاطبش چه کسی است؟",
    placeholder: "رباتی که می‌خواهید را توضیح دهید…",
    placeholderAfterForm: "نکته دیگری هست که باید بدانیم؟",
    send: "ارسال",
    sending: "در حال ارسال",
    you: "شما",
    assistant: "دستیار",
    thinking: "در حال فکر کردن…",
    networkError: "ارتباط با دستیار برقرار نشد. اتصال خود را بررسی و دوباره تلاش کنید.",
    retry: "تلاش دوباره",
    startOver: "شروع دوباره",
    startOverConfirm: "این گفت‌وگو پاک شود و از نو شروع کنیم؟",

    formIntro:
      "عالی — چند جزئیات بگیرم و درخواست شما را مستقیم به تیم می‌سپارم. مواردی که از پیام شما قابل برداشت بود، از قبل پر شده‌اند.",
    formTitle: "مشخصات ربات",
    prefilled: "برگرفته از پیام شما",
    formSubtitle: "فیلدهای ستاره‌دار (*) الزامی هستند.",
    sectionBot: "درباره ربات",
    sectionScope: "دامنه و مقیاس",
    sectionContact: "تماس و جزئیات اجرایی",

    botName: "نام ربات یا عنوان پروژه",
    botNameHint: "یک نام موقت هم کافی است؛ بعداً قابل تغییر است.",
    summary: "ربات باید چه کاری انجام دهد؟",
    summaryHint: "هرچه دقیق‌تر بنویسید، برآورد ما دقیق‌تر خواهد بود.",
    botType: "دسته‌بندی ربات",
    features: "امکانات مورد نیاز",
    botLanguages: "زبان‌هایی که ربات باید پشتیبانی کند",
    audience: "چه کسانی از آن استفاده می‌کنند؟",
    audienceHint: "مثلاً مشتریان فروشگاه، کارکنان داخلی، اعضای کانال.",
    scale: "تعداد کاربران پیش‌بینی‌شده",
    integrations: "اتصال به چه سامانه‌هایی لازم است؟",
    integrationsHint: "درگاه پرداخت، CRM، API خودتان، فایل‌های اکسل…",
    hosting: "میزبانی",
    timeline: "زمان تحویل",
    budget: "بازه بودجه",
    contactName: "نام شما",
    company: "شرکت یا برند",
    email: "ایمیل",
    telegram: "نام کاربری تلگرام",
    phone: "شماره تماس",
    contactHint: "حداقل یک راه ارتباطی وارد کنید.",
    notes: "توضیحات تکمیلی",

    choosePlaceholder: "انتخاب کنید…",
    submit: "ارسال درخواست",
    submitting: "در حال ارسال…",
    submitBlocked: "لطفاً فیلدهای مشخص‌شده را اصلاح کنید.",
    submitFailed: "ارسال درخواست انجام نشد. لطفاً دوباره تلاش کنید.",
    edit: "ویرایش پاسخ‌ها",

    errRequired: "تکمیل این فیلد الزامی است.",
    errTooShort: "لطفاً کمی بیشتر توضیح دهید.",
    errTooLong: "متن واردشده بیش از حد طولانی است.",
    errInvalidEmail: "قالب ایمیل درست نیست.",
    errInvalidTelegram: "نام کاربری با @ و ۵ تا ۳۲ حرف، رقم یا _ باشد.",
    errInvalid: "لطفاً یکی از گزینه‌ها را انتخاب کنید.",
    errContactRequired: "ایمیل، نام کاربری تلگرام یا شماره تماس وارد کنید.",

    sentTitle: "درخواست ارسال شد",
    sentBody:
      "تیم ما درخواست شما را دریافت کرد و به‌زودی پاسخ می‌دهد. اگر نکته‌ای به ذهنتان رسید، همین‌جا بنویسید.",
    summaryHeading: "خلاصه اطلاعات دریافتی",
    notProvided: "—",
  },
};

export const LangContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function useI18n() {
  const { lang, setLang } = useContext(LangContext);
  const dict = translations[lang] ?? translations[DEFAULT_LANG];
  const t = (key) => dict[key] ?? translations.en[key] ?? key;
  return { lang, setLang, t, dir: dirFor(lang) };
}

/* Validation codes from shared/formSchema.js -> translation keys. */
export function errorMessage(t, code) {
  if (!code) return null;
  return t("err" + code.charAt(0).toUpperCase() + code.slice(1));
}
