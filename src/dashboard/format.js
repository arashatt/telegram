/* Formatting the dashboard does in more than one place.

   Money lives in shared/orderSchema.js because the Worker needs it too; these
   are browser-only. */

/* "4 minutes ago", "۳ روز پیش" — Intl picks the unit and the wording, so
   neither language needs a table of plurals here. */
export function relativeTime(at, lang = "en") {
  const seconds = Math.round((Number(at) - Date.now()) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat(lang === "fa" ? "fa-IR" : "en-US", {
    numeric: "auto",
  });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(Math.round(seconds), "second");
}

/* A duration, not a moment: "4m", "1h 20m". Used for reply times, where the
   number is the point and the unit is the smaller half of it. */
export function duration(ms, lang = "en") {
  if (ms === null || ms === undefined) return "—";
  const number = (value) => new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US").format(value);
  const minutes = Math.round(Number(ms) / 60000);
  if (minutes < 1) return lang === "fa" ? "کمتر از یک دقیقه" : "under a minute";
  if (minutes < 60) return lang === "fa" ? `${number(minutes)} دقیقه` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (lang === "fa") {
    return rest ? `${number(hours)} ساعت و ${number(rest)} دقیقه` : `${number(hours)} ساعت`;
  }
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function count(value, lang = "en") {
  return new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US").format(Number(value ?? 0));
}

/* The change against the previous window, as a percentage. Null when there is
   nothing to compare against — "up ∞%" from a zero baseline is not a fact. */
export function delta(current, previous) {
  const now = Number(current ?? 0);
  const before = Number(previous ?? 0);
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}
