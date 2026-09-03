import { choiceFieldsFor, labelFor } from "../../shared/formSchema.js";
import {
  labelFor as questionLabel,
  moduleFields,
  optionLabel,
} from "../../shared/questionModules.js";
import { useI18n } from "../i18n.js";
import { CheckIcon } from "./Icons.jsx";

const listSeparator = (lang) => (lang === "fa" ? "، " : ", ");

const SUMMARY_ORDER = [
  "botName",
  "summary",
  "botType",
  "features",
  "botLanguages",
  "igHandle",
  "igAccount",
  "audience",
  "scale",
  "integrations",
  "hosting",
  "timeline",
  "budget",
  "contactName",
  "company",
  "email",
  "telegram",
  "phone",
  "notes",
];

/* Replaces the form in the stream once the brief is away: same information,
   read-only, so the visitor can still see exactly what the team received. */
export default function Receipt({ form, reference, modules = [], questions = [], answers = {} }) {
  const { t, lang, platform } = useI18n();
  const choiceFields = choiceFieldsFor(platform);

  const rows = SUMMARY_ORDER.map((field) => {
    const value = form[field];
    const spec = choiceFields[field];
    if (spec?.multiple) {
      return Array.isArray(value) && value.length
        ? [field, value.map((v) => labelFor(field, v, lang, platform)).join(listSeparator(lang))]
        : null;
    }
    if (!value) return null;
    return [field, spec ? labelFor(field, value, lang, platform) : value];
  }).filter(Boolean);

  /* Rendered from the same plan the form used, so the receipt shows exactly
     the questions this visitor was asked. */
  const tailored = [
    ...moduleFields(modules, platform).map((field) => {
      const value = answers[field.key];
      if (value == null || value === "" || (Array.isArray(value) && !value.length)) return null;
      const rendered = Array.isArray(value)
        ? value.map((v) => optionLabel(field, v, lang)).join(listSeparator(lang))
        : field.type === "select"
          ? optionLabel(field, value, lang)
          : value;
      return [field.key, questionLabel(field, lang), rendered];
    }),
    ...questions.map((question) =>
      answers[question.key] ? [question.key, question.label, answers[question.key]] : null
    ),
  ].filter(Boolean);

  return (
    <div className="receipt">
      <div className="receipt__head">
        <span className="receipt__tick">
          <CheckIcon size={17} strokeWidth={2.5} />
        </span>
        <div>
          <h2 className="receipt__title">{t("sentTitle")}</h2>
          <p className="receipt__body">{t("sentBody")}</p>
        </div>
        {reference && <code className="receipt__ref">{reference}</code>}
      </div>

      <h3 className="receipt__heading">{t("summaryHeading")}</h3>
      <dl className="receipt__list">
        {tailored.map(([key, question, value]) => (
          <div key={key} className="receipt__row">
            <dt>{question}</dt>
            <dd dir="auto">{value}</dd>
          </div>
        ))}
        {rows.map(([field, value]) => (
          <div key={field} className="receipt__row">
            <dt>{t(field)}</dt>
            <dd dir="auto">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
