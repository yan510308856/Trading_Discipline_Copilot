import type { Direction } from "../types";

export interface RiskReward {
  risk: number;
  targetDistance: number;
  targetR: number;
}

export function calculateRiskReward(
  direction: Direction,
  entry: number,
  stop: number,
  target: number,
): RiskReward {
  const risk = direction === "long" ? entry - stop : stop - entry;
  const targetDistance =
    direction === "long" ? target - entry : entry - target;

  return {
    risk,
    targetDistance,
    targetR: risk > 0 ? targetDistance / risk : Number.NaN,
  };
}
