import { useMemo, useState } from "react";

import { APIError } from "../api";
import { useRulesQuery } from "../hooks/queries";
import { filterRules } from "../utils/ruleFilters";

function readable(value: string): string {
  return value.replaceAll("_", " ");
}

function errorMessage(error: unknown): string {
  return error instanceof APIError
    ? `${error.code}: ${error.message}`
    : "Could not load the rules library.";
}

export function RulesLibrary() {
  const rulesQuery = useRulesQuery();
  const rules = rulesQuery.data ?? [];
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const isLoading = rulesQuery.isLoading;
  const error = rulesQuery.error ? errorMessage(rulesQuery.error) : "";

  const categories = useMemo(
    () => [...new Set(rules.map((rule) => rule.category))].sort(),
    [rules],
  );
  const filteredRules = useMemo(
    () => filterRules(rules, { query, stage, severity, category }),
    [category, query, rules, severity, stage],
  );

  function clearFilters() {
    setQuery("");
    setStage("all");
    setSeverity("all");
    setCategory("all");
  }

  return (
    <section className="rules-library-page">
      <div className="rules-library-heading">
        <div>
          <p className="eyebrow">Reference</p>
          <h2>Keep the rules visible before emotion makes them negotiable.</h2>
        </div>
        <p>These cards come directly from the same YAML used by the rule engine.</p>
      </div>

      <div className="rules-filter-panel">
        <label className="rules-search">
          Search rules
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, message, checklist…"
          />
        </label>
        <label>
          Stage
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="all">All stages</option>
            <option value="pre_trade">Pre-trade</option>
            <option value="in_trade">In-trade</option>
            <option value="post_trade">Post-trade</option>
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="all">All severities</option>
            <option value="blocker">Blocker</option>
            <option value="warning">Warning</option>
            <option value="reminder">Reminder</option>
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>{readable(item)}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={clearFilters}>
          Clear filters
        </button>
        <span>{filteredRules.length} of {rules.length} rules</span>
      </div>

      {isLoading && <p className="empty-state">Loading rules…</p>}
      {error && <p className="form-message error-message">{error}</p>}
      {!isLoading && !error && filteredRules.length === 0 && (
        <div className="empty-state">
          <strong>No rules match these filters.</strong>
          <p>Try a broader search or clear the filters.</p>
        </div>
      )}

      <div className="rules-card-grid">
        {filteredRules.map((rule) => (
          <article className={`rule-library-card severity-${rule.severity}`} key={rule.id}>
            <div className="rule-card-heading">
              <div>
                <p className="eyebrow">{readable(rule.category)}</p>
                <h3>{rule.name}</h3>
              </div>
              <div className="rule-card-badges">
                <span>{readable(rule.stage)}</span>
                <span>{rule.severity}</span>
              </div>
            </div>

            <p className="rule-library-message">{rule.message}</p>

            <div className="rule-library-section">
              <strong>Checklist</strong>
              <ul>
                {rule.checklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="rule-avoid">
              <strong>Avoid</strong>
              <p>{rule.avoid}</p>
            </div>

            <blockquote className="rule-discipline-sentence">
              {rule.discipline_sentence}
            </blockquote>
          </article>
        ))}
      </div>
    </section>
  );
}
