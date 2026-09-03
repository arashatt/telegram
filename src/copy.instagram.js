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

    demoHeading: "Comment to DM, end to end",
    demoBotLabel: "Active now",
    demoPoint1: "The keyword is public, the answer is private. The comment stays on the post as social proof; the price list goes only to their inbox.",
    demoPoint2: "A comment opens Instagram's 24-hour window, so the automation may reply. Anything after it needs their opt-in — and the flow asks for it.",
    demoCta: "Brief an automation like this",

    demoLead: "A keyword in your comments becomes a private conversation. Try it — the keyword chip and the quick replies are live, and the bot follows whatever you pick.",
    demoPoint3: "Every keyword comment is logged against the post it came from, so you learn which post actually sells — not just which one got likes.",
    igDemoStagePost: "Post",
    igDemoStageDm: "DM",
    igDemoLikes: "{n} likes",
    igDemoPostTitle: "New season, six colours",
    igDemoPostCaption: "New season, six colours. Comment {keyword} and we'll send the list straight to your DMs.",
    igDemoCommentsTitle: "Comments",
    igDemoSeed1Who: "@parisa.rt",
    igDemoSeed1Text: "the green one is perfect",
    igDemoSeed2Who: "@davoud_h",
    igDemoSeed2Text: "do you have this in XL?",
    igDemoAutomated: "Automated reply",
    igDemoKeywordChip: "Comment",
    igDemoPublicReply: "Just sent you a DM.",
    igDemoDmGreeting: "Hi! You asked about prices on our new season post — here's the list.",
    igDemoChipList: "Send the price list",
    igDemoChipShip: "Do you ship?",
    igDemoChipHuman: "Talk to a human",
    igDemoReplyList: "Here you go — six colours, $40–75. Which one are you after?",
    igDemoReplyShip: "We ship nationwide, 2–3 days. Which city are you in?",
    igDemoReplyHuman: "Passing you to the team now — someone replies within the hour.",
    igDemoLeadTitle: "Lead captured",
    igDemoLeadFrom: "From",
    igDemoLeadKeyword: "Keyword",
    igDemoLeadPost: "Post",
    igDemoLeadWants: "Wants",
    igDemoIntentList: "Price list",
    igDemoIntentShip: "Shipping",
    igDemoIntentHuman: "Human handoff",
    igDemoAccount: "@atelier.rud",
    igDemoCommenter: "@nadia.k",
    igDemoKeyword: "PRICE",
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

    demoHeading: "از کامنت تا دایرکت، از ابتدا تا انتها",
    demoBotLabel: "اکنون آنلاین",
    demoPoint1: "کلمهٔ کلیدی عمومی است، پاسخ خصوصی. کامنت روی پست می‌ماند و اعتبار می‌سازد؛ لیست قیمت فقط به دایرکت خودشان می‌رود.",
    demoPoint2: "کامنت، بازهٔ ۲۴ ساعتهٔ اینستاگرام را باز می‌کند و اتوماسیون اجازهٔ پاسخ دارد. هر پیامی بعد از آن به رضایت کاربر نیاز دارد — و این مسیر آن را می‌گیرد.",
    demoCta: "درخواست اتوماسیون مشابه",

    demoLead: "یک کلمه در کامنت‌ها به یک گفت‌وگوی خصوصی تبدیل می‌شود. امتحانش کنید — دکمهٔ کلمهٔ کلیدی و پاسخ‌های سریع واقعی هستند و ربات هر چه انتخاب کنید را دنبال می‌کند.",
    demoPoint3: "هر کامنت با کلمهٔ کلیدی، به همان پستی که از آن آمده ثبت می‌شود؛ پس می‌فهمید کدام پست واقعاً فروش می‌آورد، نه کدام لایک گرفته.",
    igDemoStagePost: "پست",
    igDemoStageDm: "دایرکت",
    igDemoLikes: "{n} لایک",
    igDemoPostTitle: "فصل جدید، شش رنگ",
    igDemoPostCaption: "فصل جدید، شش رنگ. کلمهٔ {keyword} را کامنت کنید تا لیست را در دایرکت برایتان بفرستیم.",
    igDemoCommentsTitle: "کامنت‌ها",
    igDemoSeed1Who: "@parisa.rt",
    igDemoSeed1Text: "سبزش عالیه",
    igDemoSeed2Who: "@davoud_h",
    igDemoSeed2Text: "سایز XL هم دارید؟",
    igDemoAutomated: "پاسخ خودکار",
    igDemoKeywordChip: "کامنت",
    igDemoPublicReply: "همین حالا برایتان دایرکت فرستادیم.",
    igDemoDmGreeting: "سلام! زیر پست فصل جدید سراغ قیمت‌ها را گرفتید — این لیست است.",
    igDemoChipList: "لیست قیمت را بفرست",
    igDemoChipShip: "ارسال دارید؟",
    igDemoChipHuman: "با یک نفر صحبت کنم",
    igDemoReplyList: "بفرمایید — شش رنگ، از ۴۰ تا ۷۵ دلار. کدام را می‌خواهید؟",
    igDemoReplyShip: "به سراسر کشور ارسال داریم، ۲ تا ۳ روز. شهرتان کجاست؟",
    igDemoReplyHuman: "الان به تیم وصلتان می‌کنم — تا یک ساعت آینده پاسخ می‌گیرید.",
    igDemoLeadTitle: "سرنخ ثبت شد",
    igDemoLeadFrom: "از",
    igDemoLeadKeyword: "کلمه",
    igDemoLeadPost: "پست",
    igDemoLeadWants: "خواسته",
    igDemoIntentList: "لیست قیمت",
    igDemoIntentShip: "ارسال",
    igDemoIntentHuman: "ارجاع به اپراتور",
    igDemoAccount: "@atelier.rud",
    igDemoCommenter: "@nadia.k",
    igDemoKeyword: "PRICE",
  },
};
