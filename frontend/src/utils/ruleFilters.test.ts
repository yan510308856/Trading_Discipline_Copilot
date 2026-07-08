import { describe, expect, it } from "vitest";

import type { RuleDefinition } from "../types";
import { filterRules } from "./ruleFilters";

function rule(
  id: string,
  stage: RuleDefinition["stage"],
  severity: RuleDefinition["severity"],
  category: string,
): RuleDefinition {
  return {
    id,
    name: id.replaceAll("_", " "),
    category,
    stage,
    severity,
    trigger: {},
    conditions: [],
    message: `${id} message`,
    checklist: ["Confirm the setup"],
    avoid: "Chasing",
    discipline_sentence: "Follow the plan.",
    enabled: true,
  };
}

const rules = [
  rule("stop_loss", "pre_trade", "blocker", "risk_control"),
  rule("breakout_follow_through", "pre_trade", "warning", "price_action"),
  rule("protect_runner", "in_trade", "reminder", "trade_management"),
];

describe("filterRules", () => {
  it("combines stage, severity, and category filters", () => {
    const result = filterRules(rules, {
      query: "",
      stage: "pre_trade",
      severity: "warning",
      category: "price_action",
    });

    expect(result.map((item) => item.id)).toEqual(["breakout_follow_through"]);
  });

  it("searches rule copy and checklist text case-insensitively", () => {
    expect(
      filterRules(rules, {
        query: "RUNNER",
        stage: "all",
        severity: "all",
        category: "all",
      }).map((item) => item.id),
    ).toEqual(["protect_runner"]);

    expect(
      filterRules(rules, {
        query: "confirm the setup",
        stage: "all",
        severity: "all",
        category: "all",
      }),
    ).toHaveLength(3);
  });
});
