import { useEffect, useRef, useState } from "react";
import "./ChatWidget.css";

const GREETING =
  "Hi! I can help you spec out a Telegram bot — what would you like it to do?";

export default function ChatWidget({ endpoint, companyName = "us" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || submitted) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep any partial line for next chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const json = JSON.parse(payload);
            const token =
              json.response ?? json.choices?.[0]?.delta?.content ?? null;

            if (token) {
              full += token;
              setStreamingText(full);
            } else if (Object.keys(json).length) {
              // Unrecognized chunk shape — log once so we can see the
              // actual keys this model/endpoint is sending.
              console.warn("Unhandled stream chunk shape:", json);
            }
          } catch {
            // ignore malformed/partial JSON chunks
          }
        }
      }

      // Commit the finished reply as a normal message and clear the
      // in-progress buffer.
      setMessages((prev) => [...prev, { role: "assistant", content: full }]);
      setStreamingText("");
    } catch (err) {
      setError("Couldn't reach the assistant. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chatwidget-root" onKeyDown={handleKeyDown}>
      {open && (
        <div
          className="chatwidget-panel"
          role="dialog"
          aria-label={`Chat with ${companyName}`}
        >
          <header className="chatwidget-header">
            <div className="chatwidget-header-title">
              <LemonMark size={22} />
              <span>{companyName}</span>
            </div>
            <button
              type="button"
              className="chatwidget-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <ul className="chatwidget-messages" ref={listRef}>
            {messages.map((m, i) => (
              <li
                key={i}
                className={`chatwidget-bubble chatwidget-bubble--${m.role}`}
              >
                {m.content}
              </li>
            ))}

            {sending && (
              <li className="chatwidget-bubble chatwidget-bubble--assistant chatwidget-typing">
                {streamingText ? streamingText : <TypingMark />}
              </li>
            )}

            {submitted && (
              <li className="chatwidget-confirmation">
                <LemonMark size={18} filled />
                <span>Request sent — we'll follow up soon.</span>
              </li>
            )}
          </ul>

          {error && <div className="chatwidget-error">{error}</div>}

          <form className="chatwidget-input-row" onSubmit={sendMessage}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                submitted ? "Request already sent" : "Describe what you need…"
              }
              disabled={sending || submitted}
              aria-label="Message"
            />
            <button
              type="submit"
              disabled={sending || submitted || !input.trim()}
              aria-label="Send message"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chatwidget-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        <LemonMark size={26} filled={!open} />
      </button>
    </div>
  );
}

/* Signature mark: a lemon slice — the launcher icon, and its wedges double
   as the typing indicator so the "thinking" state stays on-brand instead
   of a generic dot bounce. */
function LemonMark({ size = 24, filled = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
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

function TypingMark() {
  return (
    <span className="chatwidget-typing-wedges" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </span>
  );
}
