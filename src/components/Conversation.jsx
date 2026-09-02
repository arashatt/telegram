import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";
import { looksPersian } from "../lang.js";
import RequirementsForm from "./RequirementsForm.jsx";
import Receipt from "./Receipt.jsx";
import { BubbleMark, PlaneGlyph } from "./Icons.jsx";
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
    /* Only moves anything when the stream has a height of its own. At full
       width the stream grows instead and the document is the scroller, so
       this is a no-op there rather than the thing keeping the newest message
       in view. */
    const scroller = bottomRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [items, streamingText, busy]);

  useEffect(() => {
    // preventScroll matters now that a landing page sits above the chat:
    // a plain focus() scrolls the composer into view on load and the visitor
    // never sees the hero.
    inputRef.current?.focus({ preventScroll: true });
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
        if (!res.ok) return { prefill: {}, modules: [], questions: [] };
        const data = await res.json();
        return {
          prefill: data.prefill ?? {},
          modules: data.modules ?? [],
          questions: data.questions ?? [],
        };
      } catch {
        return { prefill: {}, modules: [], questions: [] };
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
        const plan = prefillPromise ? await prefillPromise : null;

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
          if (plan) {
            next.push({
              id: makeId(),
              type: "form",
              prefill: plan.prefill,
              modules: plan.modules,
              questions: plan.questions,
            });
          }
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
        modules: extras.modules ?? [],
        questions: extras.questions ?? [],
        answers: extras.answers ?? {},
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
          ? {
              id: item.id,
              type: "receipt",
              form,
              reference: data.reference,
              modules: item.modules,
              questions: item.questions,
              answers: extras.answers ?? {},
            }
          : item
      )
    );
    inputRef.current?.focus({ preventScroll: true });
  }

  const showForm = items.some((item) => item.type === "form");
  const composerDisabled = busy || (showForm && !submitted);

  return (
    <div className="conversation">
      <header className="chathead">
        <span className="chathead__disc">
          <BubbleMark size={20} />
        </span>
        <span className="chathead__meta">
          <span className="chathead__name">{t("assistant")}</span>
          <span className="chathead__status">{busy ? t("typingStatus") : t("online")}</span>
        </span>
      </header>

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
                  <RequirementsForm
                    prefill={item.prefill}
                    modules={item.modules}
                    questions={item.questions}
                    onSubmit={submitRequirements}
                  />
                </li>
              );
            }
            return (
              <li key={item.id} className="conversation__card">
                <Receipt
                  form={item.form}
                  reference={item.reference}
                  modules={item.modules}
                  questions={item.questions}
                  answers={item.answers}
                />
              </li>
            );
          })}

          {busy && (
            <Bubble role="assistant" live>
              {streamingText || (
                <span className="typing" role="status" aria-label={t("thinking")}>
                  <span />
                  <span />
                  <span />
                </span>
              )}
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
          aria-label={t("send")}
        >
          <PlaneGlyph size={20} />
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children, live = false }) {
  const { t } = useI18n();
  return (
    <li
      className={`bubble bubble--${role}`}
      dir="auto"
      aria-live={live ? "polite" : undefined}
      aria-label={role === "assistant" ? t("assistant") : t("you")}
    >
      {children}
    </li>
  );
}
