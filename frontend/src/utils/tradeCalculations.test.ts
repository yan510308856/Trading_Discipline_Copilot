import { describe, expect, it } from "vitest";

import {
  calculateAddPositionPreview,
  calculateAggregateUnderlyingR,
  calculateCurrentR,
  calculateExecutionProfitCurve,
  calculatePositionBreakdown,
  calculateRiskReward,
  optionUnderlyingDirection,
  resolvedUnderlyingDirection,
} from "./tradeCalculations";

describe("position scaling calculations", () => {
  const entries = [
    { id: 1, trade_id: 1, executed_at: "2026-07-24T10:00:00Z", entry_kind: "initial" as const, underlying_price: 100, quantity: 2, stop_at_entry: 95, option_price: null, reason: "initial_plan", notes: null, created_at: "2026-07-24T10:00:00Z" },
    { id: 2, trade_id: 1, executed_at: "2026-07-24T11:00:00Z", entry_kind: "add" as const, underlying_price: 110, quantity: 1, stop_at_entry: 100, option_price: 2, reason: "breakout_confirmation", notes: null, created_at: "2026-07-24T11:00:00Z" },
  ];

  it("previews weighted average and underlying risk", () => {
    expect(calculateAddPositionPreview(2, 2, 100, 10, 110, 1, 100)).toEqual({
      newTotalQuantity: 3,
      newRemainingQuantity: 3,
      newWeightedAverageEntry: 103.33,
      incrementalRisk: 10,
      newTotalRisk: 20,
    });
  });

  it("calculates aggregate long R without option premium values", () => {
    expect(calculateAggregateUnderlyingR("long", entries, [], 112)).toBe(1.3);
    expect(calculateAggregateUnderlyingR(
      "long",
      entries.map((entry) => ({ ...entry, option_price: 999 })),
      [],
      112,
    )).toBe(1.3);
  });
});

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

  it("rounds risk and R values to two decimals", () => {
    expect(calculateRiskReward("long", 10.1, 9.8, 10.7)).toEqual({
      risk: 0.3,
      targetDistance: 0.6,
      targetR: 2,
    });
  });
});

describe("optionUnderlyingDirection", () => {
  it("maps buy call and sell put to bullish underlying direction", () => {
    expect(optionUnderlyingDirection("long", "call")).toBe("long");
    expect(optionUnderlyingDirection("short", "put")).toBe("long");
  });

  it("maps buy put and sell call to bearish underlying direction", () => {
    expect(optionUnderlyingDirection("long", "put")).toBe("short");
    expect(optionUnderlyingDirection("short", "call")).toBe("short");
  });
});

describe("resolvedUnderlyingDirection", () => {
  it("uses legacy entry/stop structure when old option data conflicts", () => {
    expect(resolvedUnderlyingDirection("long", "put", 111, 110)).toBe("long");
    expect(resolvedUnderlyingDirection("short", "put", 111, 112)).toBe("short");
  });
});

describe("calculateExecutionProfitCurve", () => {
  const executions = [
    { id: 1, trade_id: 1, executed_at: "2026-07-10T10:00:00Z", execution_type: "partial" as const, price: 105, quantity: 2, exit_reason: "partial_profit" as const, option_price: null },
    { id: 2, trade_id: 1, executed_at: "2026-07-10T11:00:00Z", execution_type: "final" as const, price: 98, quantity: 1, exit_reason: "stop_hit" as const, option_price: null },
  ];

  it("builds cumulative gross profit for a long trade", () => {
    expect(calculateExecutionProfitCurve("long", 100, executions).map((point) => point.cumulativeProfit)).toEqual([10, 8]);
  });

  it("reverses price-change direction for a short trade", () => {
    expect(calculateExecutionProfitCurve("short", 100, executions).map((point) => point.profit)).toEqual([-10, 2]);
  });

  it("uses option premiums and the 100-share contract multiplier", () => {
    const optionExecutions = executions.map((execution, index) => ({ ...execution, option_price: index === 0 ? 2.5 : 1.5 }));
    expect(calculateExecutionProfitCurve("long", 2, optionExecutions, true, 100).map((point) => point.profit)).toEqual([100, -50]);
  });

  it("calculates a sold option as profitable when its premium falls", () => {
    const soldPutExit = [{ ...executions[0], quantity: 1, option_price: 1.5 }];
    expect(calculateExecutionProfitCurve("short", 2, soldPutExit, true, 100)[0].profit).toBe(50);
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

  it("rounds remaining quantity to the product's two-decimal convention", () => {
    expect(calculatePositionBreakdown(5, 4.94).runner).toBe(0.06);
  });
});
