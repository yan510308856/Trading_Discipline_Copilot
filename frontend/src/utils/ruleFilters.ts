import type { RuleDefinition } from "../types";

export interface RuleFilters {
  query: string;
  stage: string;
  severity: string;
  category: string;
}

export function filterRules(
  rules: RuleDefinition[],
  filters: RuleFilters,
): RuleDefinition[] {
  const query = filters.query.trim().toLowerCase();

  return rules.filter((rule) => {
    if (filters.stage !== "all" && rule.stage !== filters.stage) return false;
    if (filters.severity !== "all" && rule.severity !== filters.severity) {
      return false;
    }
    if (filters.category !== "all" && rule.category !== filters.category) {
      return false;
    }
    if (!query) return true;

    const searchableText = [
      rule.name,
      rule.category,
      rule.message,
      rule.avoid,
      rule.discipline_sentence,
      ...rule.checklist,
    ]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(query);
  });
}
