/* One door in front of three gateways.

   Everywhere else in the Worker asks this module which gateways apply and tells
   it to start or settle a payment. Nothing outside `worker/gateways/` imports
   Stripe, Zarinpal or Zibal directly, so adding a fourth is one file and one
   line of this one. */

import { gatewayId, gatewaysForLang } from "../../shared/invoiceSchema.js";
import * as stripe from "./stripe.js";
import * as zarinpal from "./zarinpal.js";
import * as zibal from "./zibal.js";

const MODULES = { stripe, zarinpal, zibal };

export const gatewayModule = (id) => MODULES[gatewayId(id)] ?? null;

/* Which gateways this deployment *could* use — keys present, regardless of who
   is looking. `/api/health` reports this so an unconfigured gateway is visible
   as a missing key rather than as a button that does nothing. */
export const configuredGateways = (env) =>
  Object.keys(MODULES).filter((id) => MODULES[id].configured(env));

/* Which gateways this payer is offered: the ones appropriate to the language
   of the page they are reading, intersected with the ones that have keys.
   A gateway missing its keys is invisible rather than broken, and the payment
   page says so in words when the intersection is empty. */
export const gatewaysFor = (env, lang) =>
  gatewaysForLang(lang).filter((id) => MODULES[id].configured(env));

/* Whether a gateway can take *this* invoice, which is not the same question as
   whether it is configured: the Iranian gateways settle Rial and nothing else,
   so a USD invoice must not offer them however well their keys are set. */
export function gatewaysForInvoice(env, invoice, lang) {
  const iranian = String(invoice?.currency ?? "").toUpperCase() === "IRR";
  return gatewaysFor(env, lang).filter((id) => (id === "stripe" ? !iranian : iranian));
}

export async function startPayment(env, { gateway, invoice, urls }) {
  const module = gatewayModule(gateway);
  if (!module) return { error: "unknown_gateway" };
  if (!module.configured(env)) return { error: "not_configured" };
  return module.start(env, invoice, urls);
}

/* The reference a redirect callback carries, read before the invoice is known —
   it is what the route looks the payment up by. Stripe has none: it confirms by
   webhook and its return URL is not evidence of anything. */
export function callbackRef(gateway, query) {
  const module = gatewayModule(gateway);
  return module?.callbackRef ? module.callbackRef(query) : null;
}

/* Returns one of:
     { status: "paid" | "failed", gatewayRef, detail }  — settle the payment
     { status: "pending", … }   — upstream unreachable, leave it open to retry
     { status: "ignored", … }   — a well-formed event we do not act on
     { status: "invalid", … }   — not to be trusted; record nothing
   The route maps those onto HTTP; no gateway decides its own status code. */
export async function settlePayment(env, { gateway, ...context }) {
  const module = gatewayModule(gateway);
  if (!module) return { status: "invalid", detail: "unknown_gateway" };
  if (!module.configured(env)) return { status: "invalid", detail: "not_configured" };
  return module.settle(env, context);
}
