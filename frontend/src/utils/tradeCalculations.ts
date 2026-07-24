import type {
  Direction,
  TradeEntryExecution,
  TradeExecution,
} from "../types";

export function optionUnderlyingDirection(
  action: Direction,
  optionType: "call" | "put" | null,
): Direction {
  if (optionType === null) return action;
  const isBullish =
    (action === "long" && optionType === "call") ||
    (action === "short" && optionType === "put");
  return isBullish ? "long" : "short";
}

export function resolvedUnderlyingDirection(
  action: Direction,
  optionType: "call" | "put" | null,
  entryPrice: number,
  stopPrice: number,
): Direction {
  const expected = optionUnderlyingDirection(action, optionType);
  const expectedRisk = expected === "long"
    ? entryPrice - stopPrice
    : stopPrice - entryPrice;
  if (expectedRisk > 0) return expected;
  return stopPrice < entryPrice ? "long" : "short";
}
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

export interface AddPositionPreview {
  newTotalQuantity: number;
  newRemainingQuantity: number;
  newWeightedAverageEntry: number;
  incrementalRisk: number;
  newTotalRisk: number;
}

export function calculateAddPositionPreview(
  currentTotalQuantity: number,
  currentRemainingQuantity: number,
  currentAverageEntry: number,
  currentTotalRisk: number,
  addPrice: number,
  addQuantity: number,
  stopAtAdd: number,
): AddPositionPreview {
  const newTotalQuantity = currentTotalQuantity + addQuantity;
  return {
    newTotalQuantity: roundToTwoDecimals(newTotalQuantity),
    newRemainingQuantity: roundToTwoDecimals(
      currentRemainingQuantity + addQuantity,
    ),
    newWeightedAverageEntry: roundToTwoDecimals(
      (
        currentAverageEntry * currentTotalQuantity
        + addPrice * addQuantity
      ) / newTotalQuantity,
    ),
    incrementalRisk: roundToTwoDecimals(
      Math.abs(addPrice - stopAtAdd) * addQuantity,
    ),
    newTotalRisk: roundToTwoDecimals(
      currentTotalRisk + Math.abs(addPrice - stopAtAdd) * addQuantity,
    ),
  };
}

export function calculateAggregateUnderlyingR(
  direction: Direction,
  entries: TradeEntryExecution[],
  exits: TradeExecution[],
  currentPrice: number | null,
): number | null {
  if (entries.length === 0) return null;
  const entered = entries.reduce(
    (sum, entry) => sum + entry.underlying_price * entry.quantity,
    0,
  );
  const exited = exits.reduce(
    (sum, execution) =>
      sum + execution.price * (execution.quantity ?? 0),
    0,
  );
  const totalQuantity = entries.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  );
  const exitedQuantity = exits.reduce(
    (sum, execution) => sum + (execution.quantity ?? 0),
    0,
  );
  const remaining = Math.max(0, totalQuantity - exitedQuantity);
  if (remaining > 0 && currentPrice === null) return null;
  const risk = entries.reduce(
    (sum, entry) =>
      sum
      + Math.abs(entry.underlying_price - entry.stop_at_entry) * entry.quantity,
    0,
  );
  if (risk <= 0) return null;
  const marked = (currentPrice ?? 0) * remaining;
  const pnl = direction === "long"
    ? exited + marked - entered
    : entered - exited - marked;
  return pnl / risk;
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
        : Math.max(roundToTwoDecimals(initialQuantity - partialExitQuantity), 0),
  };
}

export interface ExecutionProfitPoint {
  execution: TradeExecution;
  profit: number;
  cumulativeProfit: number;
}

export function calculateExecutionProfitCurve(
  direction: Direction,
  entryPrice: number,
  executions: TradeExecution[],
  useOptionPrices = false,
  multiplier = 1,
): ExecutionProfitPoint[] {
  let cumulativeProfit = 0;
  return executions
    .filter((execution) => execution.quantity !== null && (!useOptionPrices || execution.option_price !== null))
    .map((execution) => {
      const exitPrice = useOptionPrices ? execution.option_price ?? 0 : execution.price;
      const priceChange = direction === "long"
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;
      const profit = roundToTwoDecimals(priceChange * (execution.quantity ?? 0) * multiplier);
      cumulativeProfit = roundToTwoDecimals(cumulativeProfit + profit);
      return { execution, profit, cumulativeProfit };
    });
}
