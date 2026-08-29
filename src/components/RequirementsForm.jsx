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
import "./RequirementsForm.css";

export default function RequirementsForm({ prefill = {}, onSubmit }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(() => ({ ...emptyForm(), ...prefill }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [invalidTick, setInvalidTick] = useState(0);
  const honeypot = useRef(null);
  const formRef = useRef(null);

  /* Focus has to wait for the commit that paints aria-invalid — querying the
     DOM straight after setErrors finds the pre-render markup. */
  useEffect(() => {
    if (!invalidTick) return;
    formRef.current?.querySelector("[aria-invalid='true']")?.focus();
  }, [invalidTick]);

  const prefilled = new Set(Object.keys(prefill));

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

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setInvalidTick((tick) => tick + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(form, { website: honeypot.current?.value ?? "" });
    } catch {
      setSubmitError("submitFailed");
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
        <legend>{t("sectionBot")}</legend>
        <Text field="botName" hint="botNameHint" required {...shared} />
        <Text field="summary" hint="summaryHint" required multiline rows={4} {...shared} />
        <Select field="botType" options={BOT_TYPE_OPTIONS} required {...shared} />
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
          <Select field="timeline" options={TIMELINE_OPTIONS} required {...shared} />
        </div>
        <Select field="budget" options={BUDGET_OPTIONS} {...shared} />
      </fieldset>

      <fieldset className="reqform__section">
        <legend>{t("sectionContact")}</legend>
        <div className="reqform__pair">
          <Text field="contactName" required {...shared} />
          <Text field="company" {...shared} />
        </div>
        <p className="reqform__hint">{t("contactHint")}</p>
        <div className="reqform__pair">
          <Text field="email" type="email" dir="ltr" {...shared} />
          <Text field="telegram" placeholder="@username" dir="ltr" {...shared} />
        </div>
        <Text field="phone" type="tel" dir="ltr" {...shared} />
        {errors.contactChannel && (
          <p className="reqform__error" role="alert">
            {errorMessage(t, errors.contactChannel)}
          </p>
        )}
        <Text field="notes" multiline rows={3} {...shared} />
      </fieldset>

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
        <option value="">{t("choosePlaceholder")}</option>
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
            <label
              key={option.value}
              className={`check${checked ? " check--on" : ""}`}
            >
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
