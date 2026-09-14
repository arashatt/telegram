import { createContext, useContext } from "react";

/* The dashboard's own words.

   Separate from src/i18n.js on purpose: that dictionary belongs to the two
   marketing pages and carries the Instagram overlay and its invariant test.
   Nothing here is shared with them — a shop owner reading their orders and a
   visitor describing a bot they want built have no vocabulary in common. */

export const DASHBOARD_COPY = {
  en: {
    title: "Shop dashboard",
    signInTitle: "Sign in to your dashboard",
    signInBody:
      "The same Telegram account the studio added to your shop. Nothing else to remember.",
    signInAction: "Sign in with Telegram",
    signInPending: "Opening Telegram…",
    signInFailed: "That did not complete. Try again.",
    signInUnavailable:
      "Sign-in is not configured on this deployment, so the dashboard cannot identify anyone yet.",
    signOut: "Sign out",

    noShopTitle: "No shop yet",
    noShopBody:
      "Your account is not on a shop yet. Send the studio the id below and they will add you.",
    yourId: "Your sign-in id",
    /* Telegram's sign-in gives this site a subject id of its own, scoped to
       this site — it is not the account number @userinfobot reports, and the
       two are different lengths. Saying so here saves the next person the
       afternoon it cost the first one. */
    yourIdNote:
      "This is the id this site knows you by. It is not the shorter number @userinfobot shows — use this one.",
    createShop: "Create a shop",
    createShopName: "Shop name",
    createShopHandle: "Instagram @handle",
    create: "Create",

    dbMissingTitle: "The database is not set up",
    dbMissingBody:
      "No database is bound to this deployment yet, so there is nowhere to keep orders. Create one, put its id in wrangler.jsonc, and this screen becomes your shop — the schema applies itself on the first request.",
    dbMissingId: "Keep this: it is what goes in ADMIN_TELEGRAM_IDS — this number, not a shorter one.",

    tabOrders: "Orders",
    tabCatalog: "Catalog",
    tabReport: "Report",
    tabSettings: "Settings",

    theme: "Switch theme",
    language: "فارسی",

    /* orders */
    all: "All",
    ordersEmpty: "No orders yet",
    ordersEmptyBody:
      "When the automation captures one it appears here, newest first — and so does the conversation behind it.",
    loadMore: "Load more",
    orderFrom: "From",
    orderPost: "Post",
    orderKeyword: "Keyword",
    orderItems: "Items",
    orderTotal: "Total",
    orderTimeline: "What happened",
    orderNote: "Note",
    moveTo: "Move to",
    close: "Close",
    saving: "Saving…",

    /* catalog */
    catalogEmpty: "Nothing in the catalog",
    catalogEmptyBody: "Add what you sell, and the automation can quote it inside a DM.",
    addProduct: "Add a product",
    editProduct: "Edit product",
    productTitle: "Name",
    productSku: "SKU",
    productPrice: "Price",
    productStock: "In stock",
    productActive: "Offered in DMs",
    save: "Save",
    cancel: "Cancel",
    remove: "Delete",
    removeConfirm: "Delete this product?",
    inactive: "Hidden",
    stockLeft: "{n} left",

    /* report */
    reportRange7: "7 days",
    reportRange30: "30 days",
    revenue: "Revenue",
    ordersCount: "Orders",
    customers: "Customers",
    replyTime: "Median reply",
    noReplies: "No replies to measure yet",
    waitingCount: "{n} still waiting",
    vsPrevious: "vs previous {n} days",
    topProducts: "What sold",
    topPosts: "Which post sold it",
    unitsSold: "{n} sold",
    statusBreakdown: "Every order, by status",
    reportEmpty: "Nothing in this range yet",

    /* settings */
    shopSection: "Shop",
    shopName: "Name",
    shopHandle: "Instagram @handle",
    shopCurrency: "Currency",
    membersSection: "Who can see this shop",
    memberAdd: "Add by sign-in id",
    memberId: "Their sign-in id",
    memberRole: "Role",
    roleOwner: "Owner",
    roleStaff: "Staff",
    add: "Add",
    lastOwner: "A shop needs at least one owner.",
    tokensSection: "Automation access",
    tokensBody:
      "The automation posts orders and messages to the endpoint below, with one of these tokens. Each is shown once, here, and never again.",
    tokenCreate: "Create a token",
    tokenLabel: "What is it for?",
    tokenOnce: "Copy it now — this is the only time it is shown.",
    tokenRevoke: "Revoke",
    tokenNever: "never used",
    tokenLastUsed: "last used {when}",
    copy: "Copy",
    copied: "Copied",
    sampleSection: "Sample data",
    sampleBody:
      "Fills an empty shop with a fortnight of plausible orders and conversations, so the dashboard can be looked at before the automation is live. Refused once there are real orders.",
    sampleAction: "Load sample data",
    sampleDone: "Loaded. Open Orders.",

    /* errors */
    errNetwork: "Could not reach the server. Check your connection.",
    errForbidden: "You do not have access to that.",
    errRequired: "Required",
    errNumber: "Enter a number",
    errNegative: "Cannot be negative",
    errHasOrders: "This has been sold, so it is kept. Hide it instead.",
    errShopNotEmpty: "This shop already has orders.",
    /* ---- customers, invoices and getting paid ---- */
    tabCustomers: "Customers",
    tabSetup: "Setup",

    customersSearch: "Search by name, email or @handle",
    customersEmpty: "No customers yet",
    customersEmptyBody:
      "Every brief submitted on the site becomes a customer here, matched by the email or Telegram handle it was sent with.",
    custSignedIn: "Signed in",
    custBriefsN: "{n} briefs",
    custBrief1: "1 brief",
    custInvoicesN: "{n} invoices",
    custInvoice1: "1 invoice",
    custAwaiting: "{n} awaiting payment",
    custPaidNothing: "Nothing paid yet",
    custNoContact: "No contact details",

    backlogTitle: "{n} briefs are stored but undelivered",
    backlogBody:
      "They are safe. Telegram refused them, so nothing was lost — fix the bot token and send them again.",
    backlogRetry: "Send them now",
    backlogSending: "Sending…",
    backlogResult: "{sent} sent, {failed} still failing.",

    custBriefs: "Briefs",
    custInvoices: "Invoices",
    custNoBriefs: "No briefs from this customer.",
    custNoInvoices: "Nothing invoiced yet.",
    custDelivered: "Delivered",
    custUndelivered: "Not delivered",

    invoiceNew: "Raise an invoice",
    invoiceFor: "What it is for",
    invoiceDetail: "Detail (optional)",
    invoiceAmount: "Amount",
    invoiceCurrency: "Currency",
    invoiceAgainst: "Against a brief",
    invoiceAgainstNone: "Not tied to a brief",
    invoiceSendNow: "Send it straight away",
    invoiceRaise: "Raise it",
    invoiceRaising: "Raising…",
    invoiceLink: "Payment link",
    invoiceLinkNote: "Anyone with this link can pay this invoice. Send it to the customer and nobody else.",
    invoiceMarkSent: "Mark as sent",
    invoiceVoid: "Cancel it",
    invoicePaidNote: "Paid invoices cannot be edited.",
    invoiceNoGateway:
      "No payment gateway is configured for this currency, so the link will have nothing to offer.",
    invoiceRial:
      "Amounts in IRR are Rial. The payer sees Toman, which is a tenth of it.",

    payStarted: "Started",
    payPaid: "Paid",
    payFailed: "Failed",

    retry: "Try again",
    loading: "Loading…",
  },

  fa: {
    title: "داشبورد فروشگاه",
    signInTitle: "ورود به داشبورد",
    signInBody: "همان حساب تلگرامی که استودیو به فروشگاه شما اضافه کرده است.",
    signInAction: "ورود با تلگرام",
    signInPending: "در حال باز کردن تلگرام…",
    signInFailed: "کامل نشد. دوباره تلاش کنید.",
    signInUnavailable: "ورود روی این استقرار پیکربندی نشده، پس داشبورد هنوز کسی را نمی‌شناسد.",
    signOut: "خروج",

    noShopTitle: "هنوز فروشگاهی ندارید",
    noShopBody:
      "حساب شما هنوز به فروشگاهی وصل نیست. شناسهٔ زیر را برای استودیو بفرستید تا اضافه‌تان کنند.",
    yourId: "شناسهٔ ورود شما",
    yourIdNote:
      "این شناسه‌ای است که این سایت شما را با آن می‌شناسد؛ با عددِ کوتاه‌ترِ @userinfobot فرق دارد — همین را بفرستید.",
    createShop: "ساخت فروشگاه",
    createShopName: "نام فروشگاه",
    createShopHandle: "آی‌دی اینستاگرام",
    create: "بساز",

    dbMissingTitle: "پایگاه داده راه‌اندازی نشده",
    dbMissingBody:
      "هنوز پایگاه داده‌ای به این استقرار وصل نیست، پس جایی برای نگهداری سفارش‌ها نیست. یکی بسازید و شناسه‌اش را در wrangler.jsonc بگذارید؛ ساختار جدول‌ها خودش در نخستین درخواست ساخته می‌شود.",
    dbMissingId: "این را نگه دارید: همان چیزی است که در ADMIN_TELEGRAM_IDS می‌رود.",

    tabOrders: "سفارش‌ها",
    tabCatalog: "کاتالوگ",
    tabReport: "گزارش",
    tabSettings: "تنظیمات",

    theme: "تغییر پوسته",
    language: "English",

    all: "همه",
    ordersEmpty: "هنوز سفارشی نیست",
    ordersEmptyBody:
      "هر سفارشی که اتوماسیون ثبت کند اینجا می‌آید، تازه‌ترین بالا — همراه با گفت‌وگویی که از آن آمده.",
    loadMore: "بیشتر",
    orderFrom: "از",
    orderPost: "پست",
    orderKeyword: "کلمه",
    orderItems: "اقلام",
    orderTotal: "جمع",
    orderTimeline: "چه اتفاقی افتاد",
    orderNote: "یادداشت",
    moveTo: "تغییر وضعیت به",
    close: "بستن",
    saving: "در حال ذخیره…",

    catalogEmpty: "کاتالوگ خالی است",
    catalogEmptyBody: "آنچه می‌فروشید را اضافه کنید تا اتوماسیون بتواند در دایرکت قیمت بدهد.",
    addProduct: "افزودن محصول",
    editProduct: "ویرایش محصول",
    productTitle: "نام",
    productSku: "کد",
    productPrice: "قیمت",
    productStock: "موجودی",
    productActive: "در دایرکت پیشنهاد شود",
    save: "ذخیره",
    cancel: "انصراف",
    remove: "حذف",
    removeConfirm: "این محصول حذف شود؟",
    inactive: "پنهان",
    stockLeft: "{n} عدد مانده",

    reportRange7: "۷ روز",
    reportRange30: "۳۰ روز",
    revenue: "درآمد",
    ordersCount: "سفارش",
    customers: "مشتری",
    replyTime: "میانهٔ زمان پاسخ",
    noReplies: "هنوز پاسخی برای اندازه‌گیری نیست",
    waitingCount: "{n} هنوز منتظرند",
    vsPrevious: "نسبت به {n} روز قبل",
    topProducts: "چه چیزی فروخته شد",
    topPosts: "کدام پست فروخت",
    unitsSold: "{n} فروش",
    statusBreakdown: "همهٔ سفارش‌ها به تفکیک وضعیت",
    reportEmpty: "در این بازه چیزی نیست",

    shopSection: "فروشگاه",
    shopName: "نام",
    shopHandle: "آی‌دی اینستاگرام",
    shopCurrency: "واحد پول",
    membersSection: "چه کسانی این فروشگاه را می‌بینند",
    memberAdd: "افزودن با شناسهٔ ورود",
    memberId: "شناسهٔ ورود او",
    memberRole: "نقش",
    roleOwner: "مالک",
    roleStaff: "همکار",
    add: "افزودن",
    lastOwner: "هر فروشگاه دست‌کم یک مالک لازم دارد.",
    tokensSection: "دسترسی اتوماسیون",
    tokensBody:
      "اتوماسیون سفارش‌ها و پیام‌ها را با یکی از این توکن‌ها به نشانی زیر می‌فرستد. هر توکن فقط همین یک بار نشان داده می‌شود.",
    tokenCreate: "ساخت توکن",
    tokenLabel: "برای چیست؟",
    tokenOnce: "همین حالا کپی کنید — دیگر نشان داده نمی‌شود.",
    tokenRevoke: "ابطال",
    tokenNever: "استفاده نشده",
    tokenLastUsed: "آخرین استفاده {when}",
    copy: "کپی",
    copied: "کپی شد",
    sampleSection: "داده نمونه",
    sampleBody:
      "یک فروشگاه خالی را با دو هفته سفارش و گفت‌وگوی واقع‌نما پر می‌کند تا پیش از راه‌اندازی اتوماسیون بشود داشبورد را دید.",
    sampleAction: "بارگذاری داده نمونه",
    sampleDone: "انجام شد. سفارش‌ها را ببینید.",

    errNetwork: "ارتباط با سرور برقرار نشد. اتصال را بررسی کنید.",
    errForbidden: "به این بخش دسترسی ندارید.",
    errRequired: "الزامی",
    errNumber: "یک عدد وارد کنید",
    errNegative: "نمی‌تواند منفی باشد",
    errHasOrders: "این محصول فروخته شده و نگه داشته می‌شود. به‌جایش پنهانش کنید.",
    errShopNotEmpty: "این فروشگاه از قبل سفارش دارد.",
    /* ---- مشتری‌ها، صورت‌حساب و پرداخت ---- */
    tabCustomers: "مشتری‌ها",
    tabSetup: "راه‌اندازی",

    customersSearch: "جست‌وجو با نام، ایمیل یا آی‌دی",
    customersEmpty: "هنوز مشتری‌ای نیست",
    customersEmptyBody:
      "هر درخواستی که در سایت ثبت شود اینجا به یک مشتری تبدیل می‌شود؛ با ایمیل یا آی‌دی تلگرامی که با آن فرستاده شده شناخته می‌شود.",
    custSignedIn: "وارد شده",
    custBriefsN: "{n} درخواست",
    custBrief1: "۱ درخواست",
    custInvoicesN: "{n} صورت‌حساب",
    custInvoice1: "۱ صورت‌حساب",
    custAwaiting: "{n} در انتظار پرداخت",
    custPaidNothing: "هنوز پرداختی نداشته",
    custNoContact: "راه تماسی ثبت نشده",

    backlogTitle: "{n} درخواست ذخیره شده ولی فرستاده نشده",
    backlogBody:
      "چیزی از دست نرفته. تلگرام آن‌ها را نپذیرفت — توکن ربات را درست کنید و دوباره بفرستید.",
    backlogRetry: "همین حالا بفرست",
    backlogSending: "در حال ارسال…",
    backlogResult: "{sent} فرستاده شد، {failed} هنوز ناموفق.",

    custBriefs: "درخواست‌ها",
    custInvoices: "صورت‌حساب‌ها",
    custNoBriefs: "از این مشتری درخواستی ثبت نشده.",
    custNoInvoices: "هنوز صورت‌حسابی صادر نشده.",
    custDelivered: "فرستاده شد",
    custUndelivered: "فرستاده نشد",

    invoiceNew: "صدور صورت‌حساب",
    invoiceFor: "بابت چه چیزی",
    invoiceDetail: "توضیح (اختیاری)",
    invoiceAmount: "مبلغ",
    invoiceCurrency: "واحد پول",
    invoiceAgainst: "برای کدام درخواست",
    invoiceAgainstNone: "بدون درخواست مشخص",
    invoiceSendNow: "همین حالا برایش بفرست",
    invoiceRaise: "صدور",
    invoiceRaising: "در حال صدور…",
    invoiceLink: "لینک پرداخت",
    invoiceLinkNote: "هر کسی این لینک را داشته باشد می‌تواند این صورت‌حساب را بپردازد. فقط برای همان مشتری بفرستید.",
    invoiceMarkSent: "علامت‌گذاری به‌عنوان فرستاده‌شده",
    invoiceVoid: "لغو",
    invoicePaidNote: "صورت‌حساب پرداخت‌شده ویرایش نمی‌شود.",
    invoiceNoGateway:
      "برای این واحد پول درگاهی تنظیم نشده، پس لینک پرداخت چیزی برای عرضه ندارد.",
    invoiceRial:
      "مبلغ به ریال وارد می‌شود. آنچه مشتری می‌بیند تومان است، یک‌دهم این عدد.",

    payStarted: "آغاز شد",
    payPaid: "پرداخت شد",
    payFailed: "ناموفق",

    retry: "تلاش دوباره",
    loading: "در حال بارگذاری…",
  },
};

/* {n} and {when} are the only interpolations, and they are positional rather
   than concatenated so a Persian sentence can put the number where Persian
   puts it. */
export function translator(lang) {
  const dict = DASHBOARD_COPY[lang] ?? DASHBOARD_COPY.en;
  return (key, vars) => {
    const value = dict[key] ?? DASHBOARD_COPY.en[key] ?? key;
    if (!vars) return value;
    return Object.entries(vars).reduce(
      (out, [name, replacement]) => out.replaceAll(`{${name}}`, replacement),
      value
    );
  };
}

export const DashContext = createContext({ t: translator("en"), lang: "en" });

export function useDash() {
  return useContext(DashContext);
}
