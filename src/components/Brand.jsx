/* Signature mark: a lemon slice. It doubles as the assistant avatar and, in
   wedge form, as the typing indicator, so the "thinking" state stays on-brand
   instead of a generic dot bounce. */
export function LemonMark({ size = 24, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="14"
        fill={filled ? "var(--color-yellow)" : "none"}
        stroke="var(--color-yellow-deep)"
        strokeWidth="2"
      />
      <path
        d="M16 4 L16 28 M16 16 L27 9 M16 16 L27 23 M16 16 L5 9 M16 16 L5 23"
        stroke={filled ? "var(--color-paper)" : "var(--color-yellow-deep)"}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TypingMark({ label }) {
  return (
    <span className="typing" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}
