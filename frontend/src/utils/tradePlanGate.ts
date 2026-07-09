import type {
  DailyReadinessData,
  RuleAlert,
  RuleStatus,
  TradeFormState,
} from "../types";

interface RiskRewardSummary {
  risk: number;
  targetR: number;
}

export function localTradeAlert(
  ruleId: string,
  severity: RuleAlert["severity"],
  message: string,
  disciplineSentence: string,
): RuleAlert {
  return {
    rule_id: ruleId,
    severity,
    message,
    checklist: [],
    discipline_sentence: disciplineSentence,
    next_actions: [],
    ui_hints: {},
    requires_acknowledgement: severity === "warning",
  };
}

export function buildLocalTradeAlerts(
  form: TradeFormState,
  riskReward: RiskRewardSummary | null,
  dailyReadiness: DailyReadinessData | null,
): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const missingFields = [
    ["symbol", form.symbol],
    ["setup", form.setup],
    ["market context", form.market_context],
    ["planned entry", form.planned_entry],
    ["target 1", form.target_1],
  ].filter(([, value]) => value.trim() === "");

  if (missingFields.length > 0) {
    alerts.push(
      localTradeAlert(
        "complete_required_trade_fields",
        "blocker",
        `Complete required fields: ${missingFields.map(([name]) => name).join(", ")}.`,
        "A complete plan is a prerequisite for a deliberate trade.",
      ),
    );
  }

  if (
    form.trade_horizon === "intraday" &&
    dailyReadiness &&
    !dailyReadiness.is_cleared_for_intraday
  ) {
    alerts.push(
      localTradeAlert(
        "daily_intraday_readiness_required",
        "blocker",
        "Daily intraday readiness is incomplete.",
        "No new intraday trade before today's readiness checklist is cleared.",
      ),
    );
  }

  if (riskReward && riskReward.risk <= 0) {
    alerts.push(
      localTradeAlert(
        "invalid_trade_risk",
        "blocker",
        "The stop is on the wrong side of entry for this direction.",
        "If the invalidation point does not create positive risk, the structure is not valid.",
      ),
    );
  } else if (riskReward && riskReward.targetR < 1) {
    alerts.push(
      localTradeAlert(
        "low_initial_reward_to_risk",
        "warning",
        "Target 1 offers less than 1R of initial reward.",
        "Small reward should not require full-sized risk.",
      ),
    );
  }

  return alerts;
}

export function statusFromAlerts(alerts: RuleAlert[]): RuleStatus {
  if (alerts.some((alert) => alert.severity === "blocker")) return "blocked";
  return alerts.length > 0 ? "warning" : "allowed";
}

export function isCreateTradePlanDisabled(
  status: RuleStatus,
  requiresWarningAcknowledgement: boolean,
  warningsAcknowledged: boolean,
  isEvaluating: boolean,
  isSubmitting: boolean,
): boolean {
  return (
    status === "blocked" ||
    (requiresWarningAcknowledgement && !warningsAcknowledged) ||
    isEvaluating ||
    isSubmitting
  );
}
