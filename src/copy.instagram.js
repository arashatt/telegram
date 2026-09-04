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
    greeting: "Hi — I'm the intake assistant here. Tell me about the Instagram automation you want built: what should it do, and who is it for?",
    placeholder: "Describe what you want built…",

    heroTitle: "Sell in your DMs. See the numbers.",
    heroBody: "Tell us what your Instagram automation should do and get a scoped quote. Catalog browsing and orders inside DMs, saved replies, order records — and a dashboard that reports what actually sold.",
    heroPrimary: "Describe what you want built",

    trustTimelineTitle: "Days for saved replies, weeks with a catalog",

    howTitle: "How it works once it is live",
    howBody: "Your customer only ever sees an Instagram DM. Behind it, the automation is the hub: every DM and order is written to your store, your team reads it in a dashboard, and a weekly report says what actually sold.",
    howMenus: "Quick replies and product cards, so nobody types commands.",
    howScheduled: "A weekly report — revenue, top products, reply times.",
    hubCustomer: "Your customer's DM",

    briefTitle: "Describe what you want built",
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

    demoHeading: "Catalog and orders, inside the DM",
    demoBotLabel: "Active now",
    demoPoint1: "The keyword is public, the order is private. The comment stays on the post as social proof; the catalog goes only to their inbox.",
    demoPoint2: "A comment opens Instagram's 24-hour window, so the automation may reply. Anything after it needs their opt-in — and the flow asks for it.",
    demoCta: "Brief an automation like this",
    hubTeam: "Weekly report",
    hubDatabase: "Orders & events store",
    hubAdmin: "Your dashboard",
    howDatabase: "Stored orders, so a sale is never just a DM.",

    demoLead: "A keyword in your comments opens the catalog in a DM. Try it — the keyword chip and the quick replies are live, and the bot follows whatever you pick.",
    demoPoint3: "Every order is stored against the post that produced it, so the weekly report says which post actually sold — not which one got likes.",
    igDemoStagePost: "Post",
    igDemoStageDm: "DM",
    igDemoLikes: "{n} likes",
    igDemoPostTitle: "New season, six colours",
    igDemoPostCaption: "New season, six colours. Comment {keyword} and we'll open the catalog in your DMs.",
    igDemoCommentsTitle: "Comments",
    igDemoSeed1Who: "@parisa.rt",
    igDemoSeed1Text: "the green one is perfect",
    igDemoSeed2Who: "@davoud_h",
    igDemoSeed2Text: "do you have this in XL?",
    igDemoAutomated: "Automated reply",
    igDemoKeywordChip: "Comment",
    igDemoPublicReply: "Just sent you a DM.",
    igDemoDmGreeting: "Hi! Here's the new season catalog — six colours, in stock now.",
    igDemoChipList: "Show me the catalog",
    igDemoChipShip: "Do you ship?",
    igDemoChipHuman: "Talk to a human",
    igDemoReplyList: "Six colours, $40–75, all in stock. Which one shall I put aside?",
    igDemoReplyShip: "We ship nationwide, 2–3 days. Which city are you in?",
    igDemoReplyHuman: "Passing you to the team now — someone replies within the hour.",
    igDemoLeadTitle: "Order captured",
    igDemoLeadFrom: "From",
    igDemoLeadKeyword: "Keyword",
    igDemoLeadPost: "Post",
    igDemoLeadWants: "Wants",
    igDemoIntentList: "Catalog",
    igDemoIntentShip: "Shipping",
    igDemoIntentHuman: "Human handoff",
    igDemoAccount: "@atelier.rud",
    igDemoCommenter: "@nadia.k",
    igDemoKeyword: "CATALOG",
  },

  fa: {
    siteTitle: "ساخت ربات و اتوماسیون دایرکت اینستاگرام — دریافت قیمت",
    tagline: "اتوماسیون اینستاگرام، مطابق نیاز شما",
    greeting: "سلام — من دستیار ثبت درخواست هستم. درباره اتوماسیون اینستاگرامی که می‌خواهید بگویید: چه کاری انجام دهد و برای چه کسانی است؟",
    placeholder: "آنچه می‌خواهید بسازیم را توضیح دهید…",

    heroTitle: "در دایرکت بفروشید. اعداد را ببینید.",
    heroBody: "بگویید اتوماسیون اینستاگرام شما چه کاری باید بکند تا برآورد دقیق بگیرید. مرور کاتالوگ و ثبت سفارش داخل دایرکت، پاسخ‌های آماده، ثبت سفارش‌ها — و داشبوردی که می‌گوید واقعاً چه چیزی فروخته شده.",
    heroPrimary: "آنچه می‌خواهید بسازیم را توضیح دهید",

    trustTimelineTitle: "چند روز برای پاسخ‌های آماده، چند هفته با کاتالوگ",

    howTitle: "بعد از راه‌اندازی چطور کار می‌کند",
    howBody: "مشتری شما فقط یک دایرکت اینستاگرام می‌بیند. پشت آن، اتوماسیون نقش مرکز را دارد: هر دایرکت و هر سفارش در سامانه شما ثبت می‌شود، تیم شما آن را در داشبورد می‌بیند، و گزارش هفتگی می‌گوید واقعاً چه چیزی فروخته شده.",
    howMenus: "پاسخ‌های سریع و کارت محصول، تا کسی مجبور نباشد دستور تایپ کند.",
    howScheduled: "گزارش هفتگی — درآمد، پرفروش‌ترین‌ها، زمان پاسخ.",
    hubCustomer: "دایرکت مشتری شما",

    briefTitle: "آنچه می‌خواهید بسازیم را توضیح دهید",
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

    demoHeading: "کاتالوگ و سفارش، داخل دایرکت",
    demoBotLabel: "اکنون آنلاین",
    demoPoint1: "کلمهٔ کلیدی عمومی است، سفارش خصوصی. کامنت روی پست می‌ماند و اعتبار می‌سازد؛ کاتالوگ فقط به دایرکت خودشان می‌رود.",
    demoPoint2: "کامنت، بازهٔ ۲۴ ساعتهٔ اینستاگرام را باز می‌کند و اتوماسیون اجازهٔ پاسخ دارد. هر پیامی بعد از آن به رضایت کاربر نیاز دارد — و این مسیر آن را می‌گیرد.",
    demoCta: "درخواست اتوماسیون مشابه",
    hubTeam: "گزارش هفتگی",
    hubDatabase: "انبار سفارش‌ها و رویدادها",
    hubAdmin: "داشبورد شما",
    howDatabase: "سفارش‌های ذخیره‌شده، تا یک فروش فقط یک پیام نباشد.",

    demoLead: "یک کلمه در کامنت‌ها کاتالوگ را در دایرکت باز می‌کند. امتحانش کنید — دکمهٔ کلمهٔ کلیدی و پاسخ‌های سریع واقعی هستند و ربات هر چه انتخاب کنید را دنبال می‌کند.",
    demoPoint3: "هر سفارش به همان پستی که از آن آمده ثبت می‌شود؛ پس گزارش هفتگی می‌گوید کدام پست واقعاً فروش آورده، نه کدام لایک گرفته.",
    igDemoStagePost: "پست",
    igDemoStageDm: "دایرکت",
    igDemoLikes: "{n} لایک",
    igDemoPostTitle: "فصل جدید، شش رنگ",
    igDemoPostCaption: "فصل جدید، شش رنگ. کلمهٔ {keyword} را کامنت کنید تا کاتالوگ را در دایرکت برایتان باز کنیم.",
    igDemoCommentsTitle: "کامنت‌ها",
    igDemoSeed1Who: "@parisa.rt",
    igDemoSeed1Text: "سبزش عالیه",
    igDemoSeed2Who: "@davoud_h",
    igDemoSeed2Text: "سایز XL هم دارید؟",
    igDemoAutomated: "پاسخ خودکار",
    igDemoKeywordChip: "کامنت",
    igDemoPublicReply: "همین حالا برایتان دایرکت فرستادیم.",
    igDemoDmGreeting: "سلام! این کاتالوگ فصل جدید است — شش رنگ، موجود.",
    igDemoChipList: "کاتالوگ را نشانم بده",
    igDemoChipShip: "ارسال دارید؟",
    igDemoChipHuman: "با یک نفر صحبت کنم",
    igDemoReplyList: "شش رنگ، از ۴۰ تا ۷۵ دلار، همه موجود. کدام را کنار بگذارم؟",
    igDemoReplyShip: "به سراسر کشور ارسال داریم، ۲ تا ۳ روز. شهرتان کجاست؟",
    igDemoReplyHuman: "الان به تیم وصلتان می‌کنم — تا یک ساعت آینده پاسخ می‌گیرید.",
    igDemoLeadTitle: "سفارش ثبت شد",
    igDemoLeadFrom: "از",
    igDemoLeadKeyword: "کلمه",
    igDemoLeadPost: "پست",
    igDemoLeadWants: "خواسته",
    igDemoIntentList: "کاتالوگ",
    igDemoIntentShip: "ارسال",
    igDemoIntentHuman: "ارجاع به اپراتور",
    igDemoAccount: "@atelier.rud",
    igDemoCommenter: "@nadia.k",
    igDemoKeyword: "CATALOG",
  },
};
