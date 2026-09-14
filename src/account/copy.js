import { createContext, useContext } from "react";

/* The words the two customer-facing screens need — /account and /pay.

   A third dictionary, not a branch of either existing one. src/i18n.js belongs
   to the marketing pages and src/dashboard/copy.js to the shop dashboard;
   somebody reading their own invoice has no vocabulary in common with either,
   and folding them together would mean every change to one had to be checked
   against screens it has nothing to do with. */

export const ACCOUNT_COPY = {
  en: {
    title: "Your bots and invoices",
    payTitle: "Pay an invoice",
    language: "فارسی",
    theme: "Switch theme",

    signInTitle: "Sign in to see your work",
    signInBody:
      "The same Telegram account you briefed us from. Everything you have asked for, and anything outstanding, is behind it.",
    signInAction: "Sign in with Telegram",
    signInPending: "Opening Telegram…",
    signInFailed: "That did not complete. Try again.",
    signInUnavailable: "Sign-in is not configured on this site yet.",
    signOut: "Sign out",

    yours: "Yours",
    briefs: "What you have asked for",
    briefsEmpty: "Nothing yet",
    briefsEmptyBody:
      "Anything you brief us on the site appears here. If you briefed us with a different email or Telegram account, sign in with that one instead.",
    invoices: "Invoices",
    invoicesEmpty: "Nothing to pay",
    invoicesEmptyBody: "When we quote you for a piece of work, the invoice shows up here.",
    payNow: "Pay this",
    delivered: "Received",
    pending: "Sending",

    /* ---- the payment page ---- */
    payFor: "For",
    payAmount: "Amount",
    payReference: "Reference",
    payDue: "Due",
    payChoose: "Choose how to pay",
    payGoing: "Taking you to {gateway}…",
    payDone: "Paid. Thank you.",
    payDoneBody: "Nothing else to do — we have the payment and a receipt is on its way.",
    payVoid: "This invoice was cancelled",
    payVoidBody: "Nothing is owed on it. If that is a surprise, reply to the message it came in.",
    payDraft: "This invoice is not ready yet",
    payDraftBody: "It has not been sent. Check back, or ask us for it.",
    payNotFound: "We cannot find that invoice",
    payNotFoundBody:
      "The link may be incomplete, or the invoice may have been withdrawn. Use the link exactly as it was sent to you.",
    payNoGateway: "No payment method is available for this invoice",
    payNoGatewayBody: "Reply to the message this link came in and we will arrange it another way.",
    payFailed: "That payment did not go through",
    payFailedBody: "Nothing was taken. You can try again, or use another method.",
    payPending: "We are still confirming this payment",
    payPendingBody:
      "Your bank may have taken it. Do not pay again yet — refresh this page in a minute, and talk to us if it has not settled.",
    payChecking: "Checking…",
    payRefresh: "Check again",
    payCancelled: "You came back without paying",
    payCancelledBody: "Nothing was taken. The invoice is still open when you want it.",
    /* Names no gateway: more than one is usually offered, and naming the
       first would be wrong for whoever picks the second. */
    paySafe: "You will be taken to your payment provider to finish. We never see your card.",
    payTomanNote: "Charged as {rial}.",
  },

  fa: {
    title: "ربات‌ها و صورت‌حساب‌های شما",
    payTitle: "پرداخت صورت‌حساب",
    language: "English",
    theme: "تغییر پس‌زمینه",

    signInTitle: "برای دیدن کارهایتان وارد شوید",
    signInBody:
      "با همان حساب تلگرامی که درخواست را فرستادید. هرچه خواسته‌اید و هر پرداخت باز، پشت همین ورود است.",
    signInAction: "ورود با تلگرام",
    signInPending: "در حال باز کردن تلگرام…",
    signInFailed: "کامل نشد. دوباره تلاش کنید.",
    signInUnavailable: "ورود روی این سایت هنوز تنظیم نشده است.",
    signOut: "خروج",

    yours: "شما",
    briefs: "آنچه خواسته‌اید",
    briefsEmpty: "هنوز چیزی نیست",
    briefsEmptyBody:
      "هر درخواستی که در سایت ثبت کنید اینجا می‌آید. اگر با ایمیل یا حساب تلگرام دیگری درخواست داده‌اید، با همان وارد شوید.",
    invoices: "صورت‌حساب‌ها",
    invoicesEmpty: "چیزی برای پرداخت نیست",
    invoicesEmptyBody: "وقتی برای کاری قیمت بدهیم، صورت‌حسابش همین‌جا می‌آید.",
    payNow: "پرداخت",
    delivered: "دریافت شد",
    pending: "در حال ارسال",

    payFor: "بابت",
    payAmount: "مبلغ",
    payReference: "شماره",
    payDue: "مهلت",
    payChoose: "روش پرداخت را انتخاب کنید",
    payGoing: "در حال انتقال به {gateway}…",
    payDone: "پرداخت شد. ممنون.",
    payDoneBody: "کار دیگری لازم نیست — پرداخت رسید و رسیدش برایتان می‌آید.",
    payVoid: "این صورت‌حساب لغو شده",
    payVoidBody: "چیزی بابتش بدهکار نیستید. اگر غیرمنتظره است، به همان پیامی که این لینک در آن آمده پاسخ دهید.",
    payDraft: "این صورت‌حساب هنوز آماده نیست",
    payDraftBody: "هنوز فرستاده نشده. بعداً سر بزنید یا از ما بخواهید.",
    payNotFound: "این صورت‌حساب پیدا نشد",
    payNotFoundBody:
      "شاید لینک کامل نیست یا صورت‌حساب پس گرفته شده. دقیقاً همان لینکی را باز کنید که برایتان فرستاده شده.",
    payNoGateway: "برای این صورت‌حساب راه پرداختی در دسترس نیست",
    payNoGatewayBody: "به پیامی که این لینک در آن آمده پاسخ دهید تا راه دیگری هماهنگ کنیم.",
    payFailed: "پرداخت انجام نشد",
    payFailedBody: "مبلغی کم نشد. می‌توانید دوباره تلاش کنید یا روش دیگری را امتحان کنید.",
    payPending: "هنوز در حال تأیید پرداخت هستیم",
    payPendingBody:
      "ممکن است بانک مبلغ را برداشته باشد. فعلاً دوباره پرداخت نکنید — یک دقیقه بعد این صفحه را تازه کنید و اگر تسویه نشد به ما بگویید.",
    payChecking: "در حال بررسی…",
    payRefresh: "بررسی دوباره",
    payCancelled: "بدون پرداخت برگشتید",
    payCancelledBody: "مبلغی کم نشد. هر وقت خواستید صورت‌حساب باز است.",
    paySafe: "برای تکمیل پرداخت به درگاه منتقل می‌شوید. ما هیچ‌وقت کارت شما را نمی‌بینیم.",
    payTomanNote: "مبلغ برداشتی: {rial}.",

    loading: "در حال بارگذاری…",
    retry: "تلاش دوباره",
    errNetwork: "ارتباط با سرور برقرار نشد. اتصال را بررسی کنید.",
  },
};

/* English keys the Persian dictionary shares by falling through. */
ACCOUNT_COPY.en.loading = "Loading…";
ACCOUNT_COPY.en.retry = "Try again";
ACCOUNT_COPY.en.errNetwork = "Could not reach the server. Check your connection.";

export function translator(lang) {
  const dict = ACCOUNT_COPY[lang] ?? ACCOUNT_COPY.en;
  return (key, vars) => {
    const value = dict[key] ?? ACCOUNT_COPY.en[key] ?? key;
    if (!vars) return value;
    return Object.entries(vars).reduce(
      (out, [name, replacement]) => out.replaceAll(`{${name}}`, replacement),
      value
    );
  };
}

export const AccountContext = createContext({ t: translator("en"), lang: "en" });

export function useAccount() {
  return useContext(AccountContext);
}
