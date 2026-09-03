/* What the Instagram site says differently.

   Only the keys that change. Everything else — errors, buttons, validation,
   the scope and contact sections, most of the demo — is about the engagement
   rather than the platform, and comes from src/i18n.js unchanged. A key here
   that does not exist there is a typo, and the invariant test catches it.

   The sign-in keys are deliberately absent: the sign-in really is Telegram's
   on both sites, and calling it anything else would be a lie to the visitor.

   Two of these are corrections, not translations. `howMenus` described inline
   keyboards, which Instagram does not have; `howScheduled` promised messages
   "delivered where people already are", which is false on Instagram, where
   anything outside a 24-hour window since the person last wrote needs their
   opt-in. */

export const instagramCopy = {
  en: {
    siteTitle: "Custom Instagram Bot & DM Automation — Get a Quote",
    tagline: "Instagram automations, built to your spec",
    greeting:
      "Hi — I'm the intake assistant here. Tell me about the Instagram automation you want built: what should it do, and who is it for?",
    placeholder: "Describe the automation you want…",

    heroTitle: "Custom Instagram bot development",
    heroBody:
      "Tell us what your Instagram automation should do and get a scoped quote. DM auto-replies, comment-to-DM, lead capture, bookings, product enquiries and support.",
    heroPrimary: "Describe the automation you want",

    trustTimelineTitle: "Days for a simple DM flow, weeks with a catalogue",

    howTitle: "How the automation works once it is live",
    howBody:
      "Your customer only ever sees an Instagram DM. Behind it, the automation is the hub: it reads and writes your records, gives your team an admin panel, and pings your own chat the moment something needs a person.",
    howMenus: "Quick replies and ice breakers, so nobody has to type a question.",
    howScheduled:
      "Follow-ups inside Instagram's 24-hour window, and opt-in broadcasts after it.",
    hubCustomer: "Your customer in Instagram",

    briefTitle: "Describe the automation you want",
    sectionTailored: "About your automation",
    sectionBot: "About the automation",
    formTitle: "Automation requirements",

    botName: "Project title",
    summary: "What should the automation do?",
    botType: "Automation category",
    botLanguages: "Languages it should speak",
    audienceHint: "e.g. our shop's customers, new followers, existing clients.",

    igHandle: "Which Instagram account?",
    igHandleHint: "The account the automation will run on. An @handle is fine.",
    igAccount: "Is it a Business or Creator account?",
    igAccountHint:
      "Instagram only allows automation on a professional account. Switching from personal is free and takes a minute.",

    demoHeading: "Table booking, in a DM",
    demoBotLabel: "Active now",
    demoPoint1:
      "Party size and time come from tapped quick replies — nothing to mistype, nothing to parse.",
    demoPoint2:
      "The quick replies are built from your live table availability, so a double booking cannot be offered.",
    demoCta: "Brief an automation like this",
  },

  fa: {
    siteTitle: "ساخت ربات و اتوماسیون دایرکت اینستاگرام — دریافت قیمت",
    tagline: "اتوماسیون اینستاگرام، مطابق نیاز شما",
    greeting:
      "سلام — من دستیار ثبت درخواست هستم. درباره اتوماسیون اینستاگرامی که می‌خواهید بگویید: چه کاری انجام دهد و برای چه کسانی است؟",
    placeholder: "آنچه می‌خواهید را توضیح دهید…",

    heroTitle: "ساخت ربات اختصاصی اینستاگرام",
    heroBody:
      "بگویید اتوماسیون اینستاگرام شما چه کاری باید بکند تا برآورد دقیق بگیرید. پاسخ خودکار دایرکت، کامنت به دایرکت، جذب مشتری، رزرو، پرسش درباره محصول و پشتیبانی.",
    heroPrimary: "اتوماسیون مورد نظرتان را توضیح دهید",

    trustTimelineTitle: "چند روز برای یک مسیر ساده دایرکت، چند هفته با کاتالوگ",

    howTitle: "بعد از راه‌اندازی چطور کار می‌کند",
    howBody:
      "مشتری شما فقط یک دایرکت اینستاگرام می‌بیند. پشت آن، اتوماسیون نقش مرکز را دارد: اطلاعات شما را می‌خواند و می‌نویسد، به تیم شما پنل مدیریت می‌دهد، و هر جا نیاز به آدم باشد به چت خودتان خبر می‌دهد.",
    howMenus: "پاسخ‌های سریع و پرسش‌های آماده، تا کسی مجبور نباشد سؤالش را تایپ کند.",
    howScheduled:
      "پیگیری در بازه ۲۴ ساعته اینستاگرام، و پیام گروهی پس از آن با رضایت کاربر.",
    hubCustomer: "مشتری شما در اینستاگرام",

    briefTitle: "اتوماسیون مورد نظرتان را توضیح دهید",
    sectionTailored: "درباره اتوماسیون شما",
    sectionBot: "درباره اتوماسیون",
    formTitle: "مشخصات اتوماسیون",

    botName: "عنوان پروژه",
    summary: "اتوماسیون چه کاری باید انجام دهد؟",
    botType: "دسته‌بندی اتوماسیون",
    botLanguages: "زبان‌هایی که باید پاسخ دهد",
    audienceHint: "مثلاً مشتریان فروشگاه، دنبال‌کنندگان جدید، مشتریان فعلی.",

    igHandle: "کدام اکانت اینستاگرام؟",
    igHandleHint: "اکانتی که اتوماسیون روی آن اجرا می‌شود. نوشتن آی‌دی کافی است.",
    igAccount: "اکانت بیزینس است یا کریتور؟",
    igAccountHint:
      "اینستاگرام فقط روی اکانت حرفه‌ای اجازه اتوماسیون می‌دهد. تغییر از شخصی رایگان و یک‌دقیقه‌ای است.",

    demoHeading: "رزرو میز، داخل دایرکت",
    demoBotLabel: "اکنون آنلاین",
    demoPoint1:
      "تعداد نفرات و ساعت از پاسخ‌های سریع می‌آید — نه غلط تایپی، نه نیاز به تحلیل متن.",
    demoPoint2:
      "پاسخ‌های سریع از میزهای واقعاً خالی شما ساخته می‌شود، پس رزرو تکراری اصلاً پیشنهاد نمی‌شود.",
    demoCta: "درخواست اتوماسیون مشابه",
  },
};
