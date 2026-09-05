import { createContext, useContext } from "react";
import { instagramCopy } from "./copy.instagram.js";
import { PlatformContext } from "./platform.js";
import { platformId } from "../shared/platforms.js";

export const LANGS = ["en", "fa"];
export const DEFAULT_LANG = "en";

export function dirFor(lang) {
  return lang === "fa" ? "rtl" : "ltr";
}

export const translations = {
  en: {
    siteTitle: "Custom Telegram Bot Development — Get a Quote",
    tagline: "Telegram bots, built to your spec",
    greeting:
      "Hi — I'm the intake assistant here. Tell me about the Telegram bot you want built: what should it do, and who is it for?",
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

    switchedToFa: "Switched to Persian.",

    themeToggle: "Switch theme",
    online: "online",
    typingStatus: "typing…",

    /* The install banner. Android and iOS get different words because they
       offer different things: Chrome can install the site on request, Safari
       can only be pointed at its own Share menu. */
    installTitle: "Install this as an app",
    installBody: "Opens full screen, and keeps working when the signal drops.",
    installAction: "Install",
    installDismiss: "Not now",
    installIosTitle: "Add this to your home screen",
    installIosBody: "Tap Share, then “Add to Home Screen”.",

    heroKicker: "Intake takes about two minutes",
    heroTitle: "Custom Telegram bot development",
    heroBody:
      "Tell us what your Telegram bot should do and get a scoped quote. Shops, customer support, bookings, notifications, moderation, surveys and internal automation.",
    heroPrimary: "Describe the bot you want",
    heroSecondary: "See how it works",

    trustTimelineKicker: "Timeline",
    trustTimelineTitle: "Days for a simple bot, weeks with payments",
    trustTimelineBody:
      "Tell us your deadline in the brief and we will say whether it is realistic.",
    trustLanguagesKicker: "Languages",
    trustLanguagesTitle: "English, Arabic, Turkish, and more",
    trustLanguagesBody:
      "Multi-language replies, and this page follows your language too.",
    trustHostingKicker: "Hosting",
    trustHostingTitle: "We host it, or you do",
    trustHostingBody: "Undecided is a fine answer — the form defaults to it.",

    filmTitle: "What we actually build",
    filmBody:
      "The Worker behind this page: rate limiting, the intake prompt, and the brief that lands in your team's chat.",
    howTitle: "How the bot works once it is live",
    howBody:
      "Your customer only ever sees a Telegram chat. Behind it, the bot is the hub: it reads and writes your records, gives your team an admin panel, and pings your own chat the moment something needs a person.",
    howMenus: "Inline keyboards and menus, so nobody types commands.",
    howDatabase: "Stored records, so an order is never just a message.",
    howScheduled: "Scheduled messages and alerts, delivered where people already are.",

    hubCustomer: "Your customer in Telegram",
    hubAdmin: "Admin panel",
    hubDatabase: "Database",
    hubTeam: "Your team's chat",

    briefTitle: "Describe the bot you want",
    briefSub:
      "The assistant asks what it needs to, fills in a short form from what you said, and sends the brief to our team.",

    footerNote: "Nothing is persisted — a fresh load is a fresh conversation.",
    footerLink: "Start the brief",


    sectionEssentials: "The essentials",
    sectionTailored: "About your bot",
    tailoredNote: "A few questions picked for what you described. All optional.",
    detailsOpen: "Add more detail",
    detailsClose: "Hide extra detail",
    detailsOptional: "optional",
    defaultsNote:
      "Everything else already has a sensible default — open the details only if you want to change something.",

    telegramLoginTitle: "Sign in with Telegram",
    telegramLoginAction: "Sign in",
    telegramLoginPending: "Waiting…",
    telegramLoginHint:
      "Optional. Opens a Telegram window, fills in your name and username, and confirms to us that the account is really yours.",
    telegramSignedIn: "Signed in as",
    signOut: "Sign out",
    telegramLoginFailed: "That Telegram sign-in couldn't be verified. You can still fill in the form by hand.",

    rateLimited: "That's a lot of requests at once — please wait a moment and try again.",

    demoKicker: "Live demo",
    demoHeading: "Table booking, in chat",
    demoLead:
      "Try it — the buttons are live. Pick a different time and the bot follows you.",
    demoBadge: "live demo",
    demoVenue: "Anar Kitchen",
    demoVenueCode: "AK",
    demoBotLabel: "bot",
    demoComposer: "Message",
    demoTyping: "Bot is typing",
    demoGreet1: "Evening. I can hold a table for you tonight.",
    demoGreet2: "How many of you are coming?",
    demoGuests: "{n} guests",
    demoGuestsMany: "5 or more",
    demoFree: "Tonight, for {who}. These times are still free:",
    demoConfirmed: "Table confirmed",
    demoWhere: "Where",
    demoWhen: "When",
    demoGuestsLabel: "Guests",
    demoCode: "Code",
    demoWhenValue: "Tonight, {time}",
    demoReminder: "Reminder set",
    demoPoint1:
      "Party size and time come from tapped buttons — nothing to mistype, nothing to parse.",
    demoPoint2:
      "The keyboard is built from your live table availability, so a double booking cannot be offered.",
    demoPoint3:
      "The guest keeps a confirmation with a reference code, and a reminder before the table is held.",
    demoCta: "Brief a bot like this",
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
    siteTitle: "ساخت ربات اختصاصی تلگرام — دریافت قیمت",
    tagline: "ربات تلگرام، دقیقاً مطابق نیاز شما",
    greeting:
      "سلام! من دستیار ثبت سفارش هستم. درباره رباتی که می‌خواهید بسازیم بگویید: قرار است چه کاری انجام دهد و مخاطبش چه کسی است؟",
    placeholder: "رباتی که می‌خواهید را توضیح دهید…",
    placeholderAfterForm: "نکته دیگری هست که باید بدانیم؟",
    send: "ارسال",
    sending: "در حال ارسال",
    you: "شما",
    assistant: "دستیار",
    thinking: "در حال فکر کردن…",
    networkError: "ارتباط با دستیار برقرار نشد. اتصال خود را بررسی و دوباره تلاش کنید.",
    retry: "تلاش دوباره",

    switchedToFa: "زبان سایت به فارسی تغییر کرد.",

    themeToggle: "تغییر پوسته",
    online: "آنلاین",
    typingStatus: "در حال نوشتن…",

    installTitle: "نصب به‌صورت اپلیکیشن",
    installBody: "تمام‌صفحه باز می‌شود و بدون اینترنت هم بالا می‌آید.",
    installAction: "نصب",
    installDismiss: "الان نه",
    installIosTitle: "افزودن به صفحهٔ اصلی",
    installIosBody: "روی دکمهٔ هم‌رسانی بزنید و «Add to Home Screen» را انتخاب کنید.",

    heroKicker: "ثبت سفارش حدود دو دقیقه طول می‌کشد",
    heroTitle: "ساخت ربات اختصاصی تلگرام",
    heroBody:
      "بگویید ربات تلگرام شما چه کاری باید انجام دهد تا برآورد دقیق دریافت کنید. فروشگاه، پشتیبانی مشتری، رزرو، اطلاع‌رسانی، مدیریت گروه، نظرسنجی و اتوماسیون داخلی.",
    heroPrimary: "ربات مورد نظرتان را توضیح دهید",
    heroSecondary: "ببینید چطور کار می‌کند",

    trustTimelineKicker: "زمان تحویل",
    trustTimelineTitle: "چند روز برای ربات ساده، چند هفته با پرداخت",
    trustTimelineBody:
      "مهلت خود را در فرم بنویسید تا بگوییم آیا واقع‌بینانه است یا نه.",
    trustLanguagesKicker: "زبان‌ها",
    trustLanguagesTitle: "فارسی، انگلیسی، عربی، ترکی",
    trustLanguagesBody:
      "پاسخ‌های چندزبانه — و این صفحه هم از زبان شما پیروی می‌کند.",
    trustHostingKicker: "میزبانی",
    trustHostingTitle: "ما میزبانی می‌کنیم، یا خودتان",
    trustHostingBody: "«هنوز تصمیم نگرفته‌ایم» هم پاسخ درستی است — پیش‌فرض فرم همین است.",

    filmTitle: "چیزی که واقعاً می‌سازیم",
    filmBody:
      "همان Worker پشت این صفحه: محدودسازی درخواست، پرامپت ثبت سفارش، و درخواستی که در چت تیم شما می‌نشیند.",
    howTitle: "ربات پس از راه‌اندازی چگونه کار می‌کند",
    howBody:
      "مشتری شما فقط یک گفت‌وگوی تلگرامی می‌بیند. پشت آن، ربات نقش هسته را دارد: اطلاعات شما را می‌خواند و می‌نویسد، به تیمتان پنل مدیریت می‌دهد، و هر وقت کاری به یک انسان نیاز داشت به چت خودتان خبر می‌دهد.",
    howMenus: "کیبورد و منوی این‌لاین، تا کسی مجبور به تایپ دستور نباشد.",
    howDatabase: "ذخیره اطلاعات، تا یک سفارش فقط یک پیام نباشد.",
    howScheduled: "پیام‌ها و هشدارهای زمان‌بندی‌شده، همان‌جا که مخاطب حضور دارد.",

    hubCustomer: "مشتری شما در تلگرام",
    hubAdmin: "پنل مدیریت",
    hubDatabase: "پایگاه داده",
    hubTeam: "چت تیم شما",

    briefTitle: "ربات مورد نظرتان را توضیح دهید",
    briefSub:
      "دستیار هر چه لازم باشد می‌پرسد، از گفته‌های شما فرم کوتاهی را پر می‌کند و درخواست را به تیم ما می‌فرستد.",

    footerNote: "هیچ اطلاعاتی ذخیره نمی‌شود — هر بار باز کردن صفحه یعنی گفت‌وگویی تازه.",
    footerLink: "شروع ثبت سفارش",


    sectionEssentials: "موارد ضروری",
    sectionTailored: "درباره ربات شما",
    tailoredNote: "چند پرسش متناسب با چیزی که توضیح دادید. همه اختیاری هستند.",
    detailsOpen: "افزودن جزئیات بیشتر",
    detailsClose: "بستن جزئیات",
    detailsOptional: "اختیاری",
    defaultsNote:
      "بقیه موارد از قبل مقدار پیش‌فرض مناسبی دارند — فقط اگر می‌خواهید چیزی را تغییر دهید، جزئیات را باز کنید.",

    telegramLoginTitle: "ورود با تلگرام",
    telegramLoginAction: "ورود",
    telegramLoginPending: "در انتظار…",
    telegramLoginHint:
      "اختیاری. پنجره تلگرام باز می‌شود، نام و نام کاربری شما را پر می‌کند و برای ما تأیید می‌کند که حساب واقعاً متعلق به شماست.",
    telegramSignedIn: "واردشده به‌عنوان",
    signOut: "خروج",
    telegramLoginFailed: "ورود تلگرام تأیید نشد. می‌توانید فرم را دستی پر کنید.",

    rateLimited: "درخواست‌ها خیلی پرتعداد است — لحظه‌ای صبر کنید و دوباره تلاش کنید.",

    demoKicker: "نمونهٔ زنده",
    demoHeading: "رزرو میز، داخل چت",
    demoLead:
      "امتحانش کنید — دکمه‌ها واقعی هستند. زمان دیگری انتخاب کنید تا ربات همراهتان بیاید.",
    demoBadge: "نمونهٔ زنده",
    demoVenue: "آشپزخانه انار",
    demoVenueCode: "AK",
    demoBotLabel: "ربات",
    demoComposer: "پیام",
    demoTyping: "ربات در حال نوشتن است",
    demoGreet1: "عصر بخیر. می‌توانم امشب یک میز برایتان نگه دارم.",
    demoGreet2: "چند نفر تشریف می‌آورید؟",
    demoGuests: "{n} نفر",
    demoGuestsMany: "۵ نفر یا بیشتر",
    demoFree: "امشب، برای {who}. این ساعت‌ها هنوز آزاد است:",
    demoConfirmed: "میز رزرو شد",
    demoWhere: "کجا",
    demoWhen: "کی",
    demoGuestsLabel: "تعداد",
    demoCode: "کد",
    demoWhenValue: "امشب، {time}",
    demoReminder: "یادآور تنظیم شد",
    demoPoint1:
      "تعداد نفرات و ساعت از دکمه‌ها می‌آید — نه غلط تایپی، نه نیاز به تحلیل متن.",
    demoPoint2:
      "دکمه‌ها از میزهای واقعاً خالی شما ساخته می‌شود، پس رزرو تکراری اصلاً پیشنهاد نمی‌شود.",
    demoPoint3:
      "مهمان یک تأییدیه با کد پیگیری می‌گیرد و پیش از رسیدن وقت، یادآور دریافت می‌کند.",
    demoCta: "درخواست ربات مشابه",
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

/* The Telegram dictionary is the base and is never edited for the second site;
   the Instagram site is that dictionary with ~25 keys replaced. Keeping it an
   overlay rather than a second full dictionary means a copy change made for
   one site reaches the other unless it was deliberately overridden — which is
   the behaviour you want when 80% of the words are shared.

   Keys prefixed `ig` exist only in the overlay: they label fields that appear
   on the Instagram site alone. */
export function dictFor(platform, lang) {
  const base = translations[lang] ?? translations[DEFAULT_LANG];
  if (platformId(platform) !== "instagram") return base;
  return { ...base, ...(instagramCopy[lang] ?? instagramCopy.en) };
}

export function useI18n() {
  const { lang, setLang } = useContext(LangContext);
  const platform = platformId(useContext(PlatformContext));
  const dict = dictFor(platform, lang);
  const t = (key) => dict[key] ?? dictFor(platform, "en")[key] ?? key;
  return { lang, setLang, t, dir: dirFor(lang), platform };
}

/* Validation codes from shared/formSchema.js -> translation keys. */
export function errorMessage(t, code) {
  if (!code) return null;
  return t("err" + code.charAt(0).toUpperCase() + code.slice(1));
}
