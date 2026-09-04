/* Small inline SVGs, added the same way the existing glyphs are — no icon-font
   dependency. public/icons.svg is an unused leftover sprite, not a system in
   use, so these live here with the components that need them. */

/* The project's chat-bubble mark. Drawn at 32x32; callers scale it. */
export function BubbleMark({ size = 20, fill = "#fff", dots = "var(--tg-blue)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
        fill={fill}
      />
      <circle cx="10.5" cy="14" r="1.8" fill={dots} />
      <circle cx="16" cy="14" r="1.8" fill={dots} />
      <circle cx="21.5" cy="14" r="1.8" fill={dots} />
    </svg>
  );
}

export function PlaneGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

export function MoonIcon({ size = 17 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function CheckIcon({ size = 12, strokeWidth = 3 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* The post's action row. PlaneGlyph already covers share and send, so only
   these two were missing. Generic stroke shapes: a heart and a rounded speech
   bubble are the universal social vocabulary, and neither reproduces any
   platform's own iconography. */
export function HeartGlyph({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 7.5 6Z" />
    </svg>
  );
}

export function CommentGlyph({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.8 9.8 0 0 1-2.8-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
    </svg>
  );
}

/* The Instagram page's mark: a camera frame, drawn here rather than borrowed.
   Stroked so it reads on the gradient chip and on a light ground alike. */
export function CameraMark({ size = 19, stroke = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke={stroke}
      strokeWidth="2.7"
      aria-hidden="true"
    >
      <rect x="3.2" y="3.2" width="25.6" height="25.6" rx="8" />
      <circle cx="16" cy="16" r="6.3" />
      <circle cx="23.6" cy="8.4" r="1.9" fill={stroke} stroke="none" />
    </svg>
  );
}

/* Send, as an up-arrow. Instagram's own send affordance is not a paper plane,
   and the plane stays reserved for the Telegram sign-in on both sites. */
export function ArrowSend({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20V5" />
      <path d="m5.6 11.4 6.4-6.4 6.4 6.4" />
    </svg>
  );
}

/* One send glyph, chosen by site. Callers already hold `platform` from
   useI18n(), so this keeps the choice out of every call site's markup. */
export function SendGlyph({ size, platform }) {
  return platform === "instagram" ? <ArrowSend size={size} /> : <PlaneGlyph size={size} />;
}
