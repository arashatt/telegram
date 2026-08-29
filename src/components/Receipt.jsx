import { CHOICE_FIELDS, labelFor } from "../../shared/formSchema.js";
import { useI18n } from "../i18n.js";
import { Mark } from "./Brand.jsx";

const listSeparator = (lang) => (lang === "fa" ? "، " : ", ");

const SUMMARY_ORDER = [
  "botName",
  "summary",
  "botType",
  "features",
  "botLanguages",
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
export default function Receipt({ form, reference }) {
  const { t, lang } = useI18n();

  const rows = SUMMARY_ORDER.map((field) => {
    const value = form[field];
    const spec = CHOICE_FIELDS[field];
    if (spec?.multiple) {
      return Array.isArray(value) && value.length
        ? [field, value.map((v) => labelFor(field, v, lang)).join(listSeparator(lang))]
        : null;
    }
    if (!value) return null;
    return [field, spec ? labelFor(field, value, lang) : value];
  }).filter(Boolean);

  return (
    <div className="receipt">
      <div className="receipt__head">
        <Mark size={22} filled />
        <div>
          <h2 className="receipt__title">{t("sentTitle")}</h2>
          <p className="receipt__body">{t("sentBody")}</p>
        </div>
        {reference && <code className="receipt__ref">{reference}</code>}
      </div>

      <h3 className="receipt__heading">{t("summaryHeading")}</h3>
      <dl className="receipt__list">
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
