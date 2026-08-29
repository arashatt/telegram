import { useEffect, useRef, useState } from "react";
import {
  BOT_LANGUAGE_OPTIONS,
  BOT_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  FEATURE_OPTIONS,
  HOSTING_OPTIONS,
  LIMITS,
  SCALE_OPTIONS,
  TIMELINE_OPTIONS,
  emptyForm,
  validateForm,
} from "../../shared/formSchema.js";
import { errorMessage, useI18n } from "../i18n.js";
import { contactFromUser, useSession } from "../session.js";
import TelegramLogin from "./TelegramLogin.jsx";
import "./RequirementsForm.css";

/* Everything behind the disclosure. All of it has a working default, so the
   form is complete without ever opening this. */
const DETAIL_FIELDS = [
  "botName",
  "botType",
  "features",
  "botLanguages",
  "audience",
  "scale",
  "integrations",
  "hosting",
  "timeline",
  "budget",
  "notes",
];

export default function RequirementsForm({ prefill = {}, onSubmit }) {
  const { t, lang } = useI18n();
  const session = useSession();
  // Read at mount so a visitor who signed in from the header before opening
  // the form still gets their details filled in.
  const [form, setForm] = useState(() => {
    const base = { ...emptyForm(), ...prefill };
    return { ...base, ...contactFromUser(session?.user, base) };
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [open, setOpen] = useState(false);
  const [invalidTick, setInvalidTick] = useState(0);
  const honeypot = useRef(null);
  const formRef = useRef(null);

  const prefilled = new Set(Object.keys(prefill));
  const prefilledDetails = DETAIL_FIELDS.some((field) => prefilled.has(field));

  /* Focus has to wait for the commit that paints aria-invalid — querying the
     DOM straight after setErrors finds the pre-render markup. */
  useEffect(() => {
    if (!invalidTick) return;
    formRef.current?.querySelector("[aria-invalid='true']")?.focus();
  }, [invalidTick]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field] && !prev.contactChannel) return prev;
      const next = { ...prev };
      delete next[field];
      if (["email", "telegram", "phone"].includes(field)) delete next.contactChannel;
      return next;
    });
  }

  function toggle(field, value) {
    const current = form[field] ?? [];
    update(
      field,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  }

  /* And subscribe for a sign-in that happens while the form is already open.
     The listener fires from the sign-in handler, never during render. */
  useEffect(
    () =>
      session?.subscribe((user) => {
        setForm((prev) => ({ ...prev, ...contactFromUser(user, prev) }));
        setErrors((prev) => {
          const next = { ...prev };
          delete next.contactChannel;
          if (contactFromUser(user, {}).contactName) delete next.contactName;
          return next;
        });
      }),
    [session]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      // Never leave an error hidden behind the disclosure.
      if (DETAIL_FIELDS.some((field) => found[field])) setOpen(true);
      setInvalidTick((tick) => tick + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(form, { website: honeypot.current?.value ?? "" });
    } catch (err) {
      setSubmitError(err?.message === "rate_limited" ? "rateLimited" : "submitFailed");
      setSubmitting(false);
    }
  }

  const shared = { t, form, errors, update, prefilled, lang };

  return (
    <form className="reqform" onSubmit={handleSubmit} ref={formRef} noValidate>
      <header className="reqform__head">
        <h2>{t("formTitle")}</h2>
        <p>{t("formSubtitle")}</p>
      </header>

      <fieldset className="reqform__section">
        <legend>{t("sectionEssentials")}</legend>

        <Text field="summary" hint="summaryHint" required multiline rows={4} {...shared} />

        <TelegramLogin />

        <div className="reqform__pair">
          <Text field="contactName" required {...shared} />
          <Text field="telegram" placeholder="@username" dir="ltr" {...shared} />
        </div>
        <p className="reqform__hint">{t("contactHint")}</p>
        <div className="reqform__pair">
          <Text field="email" type="email" dir="ltr" {...shared} />
          <Text field="phone" type="tel" dir="ltr" {...shared} />
        </div>
        {errors.contactChannel && (
          <p className="reqform__error" role="alert">
            {errorMessage(t, errors.contactChannel)}
          </p>
        )}
      </fieldset>

      <div className="reqform__more">
        <button
          type="button"
          className="reqform__disclosure"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="reqform-details"
        >
          <span className={`reqform__chevron${open ? " reqform__chevron--open" : ""}`} aria-hidden="true">
            ›
          </span>
          {open ? t("detailsClose") : t("detailsOpen")}
          <span className="reqform__optional">{t("detailsOptional")}</span>
          {prefilledDetails && !open && (
            <span className="field__badge">{t("prefilled")}</span>
          )}
        </button>
        {!open && <p className="reqform__hint">{t("defaultsNote")}</p>}
      </div>

      <div id="reqform-details" className="reqform__reveal" hidden={!open}>
        <fieldset className="reqform__section">
          <legend>{t("sectionBot")}</legend>
          <Text field="botName" hint="botNameHint" {...shared} />
          <Select field="botType" options={BOT_TYPE_OPTIONS} {...shared} />
          <Checks field="features" options={FEATURE_OPTIONS} toggle={toggle} {...shared} />
          <Checks
            field="botLanguages"
            options={BOT_LANGUAGE_OPTIONS}
            toggle={toggle}
            inline
            {...shared}
          />
        </fieldset>

        <fieldset className="reqform__section">
          <legend>{t("sectionScope")}</legend>
          <Text field="audience" hint="audienceHint" {...shared} />
          <Select field="scale" options={SCALE_OPTIONS} {...shared} />
          <Text field="integrations" hint="integrationsHint" multiline rows={2} {...shared} />
          <div className="reqform__pair">
            <Select field="hosting" options={HOSTING_OPTIONS} {...shared} />
            <Select field="timeline" options={TIMELINE_OPTIONS} {...shared} />
          </div>
          <Select field="budget" options={BUDGET_OPTIONS} {...shared} />
          <Text field="notes" multiline rows={3} {...shared} />
        </fieldset>
      </div>

      {/* Honeypot: off-screen and skipped by keyboard, so only a bot fills it. */}
      <input
        ref={honeypot}
        type="text"
        name="website"
        className="reqform__honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <footer className="reqform__foot">
        {Object.keys(errors).length > 0 && (
          <p className="reqform__error" role="alert">
            {t("submitBlocked")}
          </p>
        )}
        {submitError && (
          <p className="reqform__error" role="alert">
            {t(submitError)}
          </p>
        )}
        <button type="submit" className="reqform__submit" disabled={submitting}>
          {submitting ? t("submitting") : t("submit")}
        </button>
      </footer>
    </form>
  );
}

function FieldShell({ field, t, hint, required, errors, prefilled, children }) {
  const error = errorMessage(t, errors[field]);
  return (
    <div className="field">
      <label className="field__label" htmlFor={field}>
        {t(field)}
        {required && <span aria-hidden="true"> *</span>}
        {prefilled.has(field) && <span className="field__badge">{t("prefilled")}</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${field}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${field}-hint`}>
            {t(hint)}
          </p>
        )
      )}
    </div>
  );
}

function describedBy(field, errors, hint) {
  if (errors[field]) return `${field}-error`;
  return hint ? `${field}-hint` : undefined;
}

function Text({
  field,
  t,
  form,
  errors,
  update,
  prefilled,
  hint,
  required,
  multiline,
  rows,
  type = "text",
  dir = "auto",
  placeholder,
}) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <FieldShell {...{ field, t, hint, required, errors, prefilled }}>
      <Tag
        id={field}
        name={field}
        className="field__control"
        value={form[field]}
        rows={multiline ? rows : undefined}
        type={multiline ? undefined : type}
        dir={dir}
        placeholder={placeholder}
        maxLength={LIMITS[field]}
        required={required}
        aria-invalid={errors[field] ? "true" : undefined}
        aria-describedby={describedBy(field, errors, hint)}
        onChange={(event) => update(field, event.target.value)}
      />
    </FieldShell>
  );
}

function Select({ field, t, form, errors, update, prefilled, options, required, lang }) {
  return (
    <FieldShell {...{ field, t, required, errors, prefilled }}>
      <select
        id={field}
        name={field}
        className="field__control"
        value={form[field]}
        required={required}
        aria-invalid={errors[field] ? "true" : undefined}
        aria-describedby={describedBy(field, errors)}
        onChange={(event) => update(field, event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option[lang] ?? option.en}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function Checks({ field, t, form, errors, prefilled, options, toggle, lang, inline }) {
  const selected = form[field] ?? [];
  const error = errorMessage(t, errors[field]);
  return (
    <fieldset className="field field--checks">
      <legend className="field__label">
        {t(field)}
        {prefilled.has(field) && <span className="field__badge">{t("prefilled")}</span>}
      </legend>
      <div className={`checks${inline ? " checks--inline" : ""}`}>
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label key={option.value} className={`check${checked ? " check--on" : ""}`}>
              <input
                type="checkbox"
                name={field}
                value={option.value}
                checked={checked}
                onChange={() => toggle(field, option.value)}
              />
              <span>{option[lang] ?? option.en}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="field__error">{error}</p>}
    </fieldset>
  );
}
