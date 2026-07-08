import { describe, expect, it } from "vitest";

import { calculateRiskReward } from "./tradeCalculations";

describe("calculateRiskReward", () => {
  it("calculates risk and target R for a long trade", () => {
    expect(calculateRiskReward("long", 5000, 4990, 5020)).toEqual({
      risk: 10,
      targetDistance: 20,
      targetR: 2,
    });
  });

  it("calculates risk and target R for a short trade", () => {
    expect(calculateRiskReward("short", 5000, 5010, 4980)).toEqual({
      risk: 10,
      targetDistance: 20,
      targetR: 2,
    });
  });

  it("marks an invalid stop direction with non-positive risk", () => {
    const result = calculateRiskReward("long", 5000, 5010, 5020);

    expect(result.risk).toBe(-10);
    expect(Number.isNaN(result.targetR)).toBe(true);
  });
});
