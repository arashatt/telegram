/* Zarinpal, over its v4 REST API.

   Three steps, and the third is the one that matters: request an authority,
   send the payer to StartPay, and then *verify* — a payer returning with
   `Status=OK` has only told us what their browser was given, and Zarinpal does
   not consider the money yours until verify.json says so. */

import { jsonHeaders, upstream } from "./upstream.js";
import { rialAmount } from "./rial.js";

const API = "https://payment.zarinpal.com/pg/v4/payment";
const START = "https://payment.zarinpal.com/pg/StartPay";

export const id = "zarinpal";

export const configured = (env) => Boolean(env?.ZARINPAL_MERCHANT_ID);

/* Zarinpal answers `{ data: {...}, errors: [] }` on success and puts an object
   in `errors` on failure — so `errors` being an array is itself the signal. */
function complaint(body) {
  const errors = body?.errors;
  if (Array.isArray(errors)) return `code ${body?.data?.code ?? "?"}`;
  const code = errors?.code ?? "?";
  const message = errors?.message ?? "unknown error";
  return `${code}: ${message}`;
}

export async function start(env, invoice, urls) {
  if (!configured(env)) return { error: "not_configured" };
  const amount = rialAmount(invoice);
  if (amount === null) return { error: "currency" };

  const res = await upstream(`${API}/request.json`, {
    headers: jsonHeaders,
    body: JSON.stringify({
      merchant_id: env.ZARINPAL_MERCHANT_ID,
      amount,
      /* Named explicitly; see worker/gateways/rial.js. */
      currency: "IRR",
      callback_url: urls.returnUrl,
      description: (invoice.title || invoice.reference).slice(0, 200),
    }),
  });

  if (res.error) return { error: res.error, detail: res.detail };
  const data = res.data?.data ?? {};
  if (Number(data.code) !== 100 || !data.authority) {
    return { error: "rejected", detail: complaint(res.data) };
  }
  return { redirectUrl: `${START}/${data.authority}`, gatewayRef: String(data.authority) };
}

/* The authority travels in the callback URL, so it is readable before the
   invoice is known — which is how the route finds the invoice at all. */
export const callbackRef = (query) => {
  const authority = String(query?.get?.("Authority") ?? "").trim();
  return authority || null;
};

export async function settle(env, { invoice, query }) {
  const authority = callbackRef(query);
  if (!authority) return { status: "invalid", detail: "no authority" };

  /* NOK is the ordinary shape of somebody changing their mind at the bank. It
     is recorded as a failed attempt, not swallowed: a payer who says "I tried
     and it did not work" should be visible in the payments table. */
  const status = String(query.get("Status") ?? "");
  if (status !== "OK") {
    return { status: "failed", gatewayRef: authority, detail: `cancelled (${status || "no status"})` };
  }

  const amount = rialAmount(invoice);
  if (amount === null) return { status: "invalid", gatewayRef: authority, detail: "currency" };

  const res = await upstream(`${API}/verify.json`, {
    headers: jsonHeaders,
    body: JSON.stringify({ merchant_id: env.ZARINPAL_MERCHANT_ID, amount, authority }),
  });

  /* An unreachable Zarinpal is not a failed payment — the money may well have
     moved. Left unsettled so a later retry of the same authority can still
     verify it, rather than written off. */
  if (res.error) return { status: "pending", gatewayRef: authority, detail: res.detail ?? res.error };

  const data = res.data?.data ?? {};
  const code = Number(data.code);
  /* 100 is verified now; 101 is "already verified", which happens whenever a
     payer refreshes the return page. Both mean paid. */
  if (code === 100 || code === 101) {
    return {
      status: "paid",
      gatewayRef: authority,
      detail: `zarinpal ref ${data.ref_id ?? "—"}${code === 101 ? " (already verified)" : ""}`,
    };
  }
  return { status: "failed", gatewayRef: authority, detail: complaint(res.data) };
}
