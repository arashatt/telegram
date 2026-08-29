import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";
import { looksPersian } from "../lang.js";
import RequirementsForm from "./RequirementsForm.jsx";
import Receipt from "./Receipt.jsx";
import { Mark, TypingMark } from "./Brand.jsx";
import "./Conversation.css";

let nextId = 0;
const makeId = () => `item-${nextId++}`;

/* Reads the Workers AI SSE stream, handing each new token to onToken so the
   reply lands word by word instead of in one jump. */
async function readStream(response, onToken) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    try {
      const json = JSON.parse(payload);
      const token = json.response ?? json.choices?.[0]?.delta?.content ?? "";
      if (token) {
        full += token;
        onToken(full);
      }
    } catch {
      // Partial or malformed chunk — the next read will complete it.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consume);
  }
  consume(buffer);

  return full;
}

export default function Conversation() {
  const { t, lang, setLang } = useI18n();

  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lastUserMessage = useRef("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items, streamingText, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const transcript = useCallback(
    () =>
      items
        .filter((item) => item.type === "message")
        .map(({ role, content }) => ({ role, content })),
    [items]
  );

  /* The opening message does double duty: it drives the reply *and* the form
     prefill, so both requests go out together and the form is ready by the
     time the reply finishes streaming. */
  const fetchPrefill = useCallback(
    async (text) => {
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang }),
        });
        if (!res.ok) return {};
        const data = await res.json();
        return data.prefill ?? {};
      } catch {
        return {};
      }
    },
    [lang]
  );

  const send = useCallback(
    async (text, { retry = false } = {}) => {
      // The form is owed until one exists in the stream — so a first turn that
      // failed still gets its form when the visitor retries, and a retry never
      // repeats the user's bubble, which is already there.
      const needsForm = !items.some(
        (item) => item.type === "form" || item.type === "receipt"
      );
      lastUserMessage.current = text;

      // The site follows the visitor's language: writing Persian switches it,
      // once, with no button to press.
      if (looksPersian(text)) setLang("fa");

      const history = retry
        ? transcript()
        : [...transcript(), { role: "user", content: text }];

      if (!retry) {
        setItems((prev) => [
          ...prev,
          { id: makeId(), type: "message", role: "user", content: text },
        ]);
      }
      setInput("");
      setBusy(true);
      setError(null);
      setStreamingText("");

      const prefillPromise = needsForm ? fetchPrefill(text) : null;

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            lang,
            formSubmitted: submitted,
          }),
        });
        if (res.status === 429) {
          setError("rate");
          return;
        }
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

        const reply = await readStream(res, setStreamingText);
        const prefill = prefillPromise ? await prefillPromise : null;

        setItems((prev) => {
          const next = [...prev];
          if (reply.trim()) {
            next.push({
              id: makeId(),
              type: "message",
              role: "assistant",
              content: reply.trim(),
            });
          }
          if (prefill) next.push({ id: makeId(), type: "form", prefill });
          return next;
        });
      } catch {
        setError("network");
      } finally {
        setStreamingText("");
        setBusy(false);
      }
    },
    [fetchPrefill, items, lang, setLang, submitted, transcript]
  );

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    send(text);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  async function submitRequirements(form, extras = {}) {
    const res = await fetch("/api/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form,
        lang,
        transcript: transcript(),
        website: extras.website ?? "",
      }),
      credentials: "same-origin",
    });
    if (res.status === 429) throw new Error("rate_limited");
    if (!res.ok) throw new Error(`Submit failed (${res.status})`);
    const data = await res.json();

    setSubmitted(true);
    setItems((prev) =>
      prev.map((item) =>
        item.type === "form"
          ? { id: item.id, type: "receipt", form, reference: data.reference }
          : item
      )
    );
    inputRef.current?.focus();
  }

  const showForm = items.some((item) => item.type === "form");
  const composerDisabled = busy || (showForm && !submitted);

  return (
    <div className="conversation">
      <div className="conversation__scroll">
        <ol className="conversation__stream">
          <Bubble role="assistant">{t("greeting")}</Bubble>

          {items.map((item) => {
            if (item.type === "message") {
              return (
                <Bubble key={item.id} role={item.role}>
                  {item.content}
                </Bubble>
              );
            }
            if (item.type === "form") {
              return (
                <li key={item.id} className="conversation__card">
                  <p className="conversation__card-intro">{t("formIntro")}</p>
                  <RequirementsForm prefill={item.prefill} onSubmit={submitRequirements} />
                </li>
              );
            }
            return (
              <li key={item.id} className="conversation__card">
                <Receipt form={item.form} reference={item.reference} />
              </li>
            );
          })}

          {busy && (
            <Bubble role="assistant" live>
              {streamingText || <TypingMark label={t("thinking")} />}
            </Bubble>
          )}

          {error && (
            <li className="conversation__error" role="alert">
              <span>{error === "rate" ? t("rateLimited") : t("networkError")}</span>
              <button
                type="button"
                onClick={() => send(lastUserMessage.current, { retry: true })}
              >
                {t("retry")}
              </button>
            </li>
          )}
        </ol>
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="composer__input"
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={submitted ? t("placeholderAfterForm") : t("placeholder")}
          disabled={composerDisabled}
          aria-label={t("placeholder")}
        />
        <button
          type="submit"
          className="composer__send"
          disabled={composerDisabled || !input.trim()}
        >
          {busy ? t("sending") : t("send")}
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children, live = false }) {
  const { t } = useI18n();
  return (
    <li className={`bubble bubble--${role}`}>
      {role === "assistant" && (
        <span className="bubble__avatar" aria-hidden="true">
          <Mark size={20} filled />
        </span>
      )}
      <div
        className="bubble__body"
        dir="auto"
        aria-live={live ? "polite" : undefined}
        aria-label={role === "assistant" ? t("assistant") : t("you")}
      >
        {children}
      </div>
    </li>
  );
}
