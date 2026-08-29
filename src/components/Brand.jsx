/* Signature mark: a chat bubble, matching what the page actually is — a
   conversation. It doubles as the assistant avatar, and the three dots
   inside it reappear as the typing indicator so the "thinking" state is a
   variation on the mark rather than a generic dot bounce. */
export function Mark({ size = 24, filled = false }) {
  const dots = filled ? "var(--color-paper)" : "var(--color-yellow-deep)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
        fill={filled ? "var(--color-yellow)" : "none"}
        stroke="var(--color-yellow-deep)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="14" r="1.8" fill={dots} />
      <circle cx="16" cy="14" r="1.8" fill={dots} />
      <circle cx="21.5" cy="14" r="1.8" fill={dots} />
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
