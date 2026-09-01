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
