/* The unit both Iranian gateways are paid in, in one place.

   This is the 10x bug waiting in every Iranian integration. Prices are *quoted*
   in Toman, the currency code is IRR which is the *Rial*, and 1 Toman = 10
   Rial. Get it wrong in one direction and a customer is charged ten times the
   price; get it wrong in the other and the studio is paid a tenth of it.

   The rule here, which is the only rule:

   - The database stores ISO 4217. IRR has no minor unit
     (`MINOR_UNITS.IRR = 0` in shared/orderSchema.js), so `amount_cents` on an
     IRR invoice is a whole number of **Rial**.
   - Zibal accepts Rial and only Rial.
   - Zarinpal accepts either, and which one is a *setting in the merchant's
     panel* — so it is told `currency: "IRR"` on every request rather than left
     to a default that could silently divide by ten.
   - Toman exists only on screen, where Persian readers expect it. That is
     `formatToman` in shared/invoiceSchema.js, and it never touches a request.

   So nothing here multiplies or divides. That is the point: the conversion is
   pinned at both ends instead of applied somewhere in the middle. */

export const RIAL_PER_TOMAN = 10;

/* The amount to put in a gateway request, or null when this invoice is not
   something an Iranian gateway can take. Rejecting a USD invoice here rather
   than converting it is deliberate — a made-up exchange rate in a payment
   request is a worse failure than a button that says no. */
export function rialAmount(invoice) {
  if (String(invoice?.currency ?? "").toUpperCase() !== "IRR") return null;
  const amount = Number(invoice.amountCents);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}
