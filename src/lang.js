/* Persian/Arabic script ranges. A message counts as Persian only when it has
   a few such letters *and* they outweigh any Latin ones, so an English
   sentence containing one Persian word or an emoji never flips the site. */
const PERSIAN = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN = /[A-Za-z]/g;
const MIN_PERSIAN_LETTERS = 3;

export function looksPersian(text) {
  if (typeof text !== "string") return false;
  const persian = (text.match(PERSIAN) ?? []).length;
  if (persian < MIN_PERSIAN_LETTERS) return false;
  return persian >= (text.match(LATIN) ?? []).length;
}

/* The browser's own language preference — Settings > Languages, which is what
   navigator.languages exposes. Keyboard layout is deliberately NOT readable by
   a web page, so this is the closest honest signal. Anything starting with
   "fa" counts (fa, fa-IR, fa-AF). */
export function prefersPersian(languages) {
  const list = languages ?? (typeof navigator === "undefined" ? [] : navigator.languages) ?? [];
  return list.some((tag) => /^fa(-|$)/i.test(String(tag)));
}

