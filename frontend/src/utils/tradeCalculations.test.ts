import { describe, expect, it } from "vitest";

import {
  calculateCurrentR,
  calculatePositionBreakdown,
  calculateRiskReward,
} from "./tradeCalculations";

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

describe("calculateCurrentR", () => {
  it("calculates current R for long and short trades", () => {
    expect(calculateCurrentR("long", 5000, 4990, 5010)).toBe(1);
    expect(calculateCurrentR("short", 5000, 5010, 4980)).toBe(2);
  });

  it("returns NaN when the original risk is invalid", () => {
    expect(Number.isNaN(calculateCurrentR("long", 5000, 5010, 5020))).toBe(
      true,
    );
  });
});

describe("calculatePositionBreakdown", () => {
  it("derives the runner quantity from initial and exited quantity", () => {
    expect(calculatePositionBreakdown(3, 1)).toEqual({
      initial: 3,
      taken: 1,
      runner: 2,
    });
  });

  it("never returns a negative runner quantity", () => {
    expect(calculatePositionBreakdown(1, 2).runner).toBe(0);
  });
});
