import type { Direction } from "../types";
import { roundToTwoDecimals } from "./decimal";

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
    risk: roundToTwoDecimals(risk),
    targetDistance: roundToTwoDecimals(targetDistance),
    targetR: risk > 0 ? roundToTwoDecimals(targetDistance / risk) : Number.NaN,
  };
}

export function calculateCurrentR(
  direction: Direction,
  entry: number,
  initialStop: number,
  currentPrice: number,
): number {
  const risk =
    direction === "long" ? entry - initialStop : initialStop - entry;
  if (risk <= 0) return Number.NaN;

  return direction === "long"
    ? (currentPrice - entry) / risk
    : (entry - currentPrice) / risk;
}

export function calculatePositionBreakdown(
  initialQuantity: number | null,
  partialExitQuantity: number,
): { initial: number | null; taken: number; runner: number | null } {
  return {
    initial: initialQuantity,
    taken: partialExitQuantity,
    runner:
      initialQuantity === null
        ? null
        : Math.max(initialQuantity - partialExitQuantity, 0),
  };
}
