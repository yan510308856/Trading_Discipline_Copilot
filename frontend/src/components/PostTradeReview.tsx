import { useEffect, useMemo, useState } from "react";

import { APIError, createReview, getTrades } from "../api";
import type {
  FollowedPlan,
  Review,
  ReviewPayload,
  Trade,
  TradeClassification,
} from "../types";
import {
  filterAndSortReviewTrades,
  type ReviewFilter,
} from "../utils/reviewFilters";
import { calculateCurrentR } from "../utils/tradeCalculations";

const mistakeOptions = [
  ["no_stop_loss", "No stop loss (veto)"],
  [
    "revenge_reverse_after_stop_without_new_setup",
    "Revenge reversal without a new setup (veto)",
  ],
  ["revenge_reverse_after_stop", "Revenge reversal after stop"],
  ["green_trade_to_red_without_review", "Allowed a green trade to turn red"],
  ["chased_breakout_without_ft", "Chased breakout without follow-through"],
  ["tr_extreme_chasing", "Chased a trading-range extreme"],
  ["no_trade_plan", "No trade plan"],
  ["oversized_position", "Oversized position"],
] as const;

const positiveActionOptions = [
  ["completed_pre_trade_checklist", "Completed the pre-trade checklist"],
  ["followed_planned_stop", "Followed the planned stop"],
  [
    "took_partial_or_protected_runner",
    "Took partial profit or protected the runner",
  ],
] as const;

const classificationLabels: Record<TradeClassification, string> = {
  good_trade_winner: "Good trade, winner",
  good_trade_loser: "Good trade, loser",
  bad_trade_winner: "Bad trade, winner",
  bad_trade_loser: "Bad trade, loser",
};

function errorMessage(error: unknown): string {
  return error instanceof APIError
    ? `${error.code}: ${error.message}`
    : "The review could not be saved. Confirm that the backend is running.";
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function formatDateTime(value: string | null): string {
  if (value === null) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function calculateTradeFinalR(trade: Trade, exitPrice: number): number {
  return calculateCurrentR(
    trade.direction,
    trade.actual_entry ?? trade.planned_entry,
    trade.stop_loss,
    exitPrice,
  );
}

interface ReviewFormProps {
  trade: Trade;
  onReviewed: (review: Review, payload: ReviewPayload) => void;
}

function ReviewForm({ trade, onReviewed }: ReviewFormProps) {
  const [exitPrice, setExitPrice] = useState(trade.exit_price?.toString() ?? "");
  const [exitReason, setExitReason] = useState(trade.exit_reason ?? "manual_exit");
  const [followedPlan, setFollowedPlan] = useState<FollowedPlan>("yes");
  const [mistakeTags, setMistakeTags] = useState<string[]>([]);
  const [positiveActions, setPositiveActions] = useState<string[]>([]);
  const [lesson, setLesson] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const parsedExitPrice = Number(exitPrice);
  const calculatedFinalR = calculateTradeFinalR(trade, parsedExitPrice);
  const isValid =
    exitPrice.trim() !== "" &&
    Number.isFinite(parsedExitPrice) &&
    Number.isFinite(calculatedFinalR);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;

    const payload: ReviewPayload = {
      exit_price: parsedExitPrice,
      exit_reason: exitReason,
      followed_plan: followedPlan,
      mistake_tags: mistakeTags,
      positive_actions: positiveActions,
      lesson: lesson.trim() || null,
      notes: notes.trim() || null,
    };

    setIsSaving(true);
    setError("");
    try {
      onReviewed(await createReview(trade.id, payload), payload);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="review-card" onSubmit={handleSubmit}>
      <div className="form-grid three-columns">
        <label>
          Exit price *
          <input
            type="number"
            step="any"
            value={exitPrice}
            onChange={(event) => setExitPrice(event.target.value)}
          />
        </label>
        <label>
          Exit reason *
          <select
            value={exitReason}
            onChange={(event) => setExitReason(event.target.value)}
          >
            <option value="target_hit">Target hit</option>
            <option value="stop_hit">Stop hit</option>
            <option value="manual_exit">Manual exit</option>
            <option value="runner_stop">Runner stop</option>
            <option value="invalidated_setup">Invalidated setup</option>
            <option value="time_exit">Time exit</option>
            <option value="emotional_exit">Emotional exit</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Final R (calculated)
          <input
            value={Number.isFinite(calculatedFinalR) ? calculatedFinalR.toFixed(2) : "—"}
            readOnly
            aria-readonly="true"
          />
        </label>
      </div>

      <fieldset>
        <legend>Execution quality</legend>
        <label>
          Followed plan
          <select
            value={followedPlan}
            onChange={(event) =>
              setFollowedPlan(event.target.value as FollowedPlan)
            }
          >
            <option value="yes">Yes</option>
            <option value="partial">Partially</option>
            <option value="no">No</option>
          </select>
        </label>

        <div className="review-option-columns">
          <div>
            <strong>Mistake tags</strong>
            <div className="review-check-list">
              {mistakeOptions.map(([value, label]) => (
                <label className="check-row" key={value}>
                  <input
                    type="checkbox"
                    checked={mistakeTags.includes(value)}
                    onChange={() =>
                      setMistakeTags(toggleValue(mistakeTags, value))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <strong>Positive actions</strong>
            <div className="review-check-list">
              {positiveActionOptions.map(([value, label]) => (
                <label className="check-row" key={value}>
                  <input
                    type="checkbox"
                    checked={positiveActions.includes(value)}
                    onChange={() =>
                      setPositiveActions(toggleValue(positiveActions, value))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <div className="form-grid two-columns">
        <label>
          Lesson
          <textarea
            rows={4}
            value={lesson}
            onChange={(event) => setLesson(event.target.value)}
            placeholder="What will I repeat or change next time?"
          />
        </label>
        <label>
          Notes
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Context worth remembering"
          />
        </label>
      </div>

      <button className="primary-button" disabled={isSaving || !isValid}>
        {isSaving ? "Scoring review…" : "Save and Score Review"}
      </button>
      {error && <p className="form-message error-message">{error}</p>}
    </form>
  );
}

function ReviewedTrade({ trade, review }: { trade: Trade; review: Review }) {
  return (
    <article className="review-card reviewed-trade">
      <div className={`review-result ${review.veto_reason ? "veto-result" : ""}`}>
        <div>
          <span>Discipline score</span>
          <strong>{review.discipline_score}</strong>
          <small>{review.score_band}</small>
        </div>
        <div>
          <span>Classification</span>
          <strong>{classificationLabels[review.trade_classification]}</strong>
          {review.veto_reason && <small>{review.veto_reason}</small>}
        </div>
      </div>

      <div className="review-facts">
        <div><span>Opened</span><strong>{formatDateTime(trade.opened_at)}</strong></div>
        <div><span>Closed</span><strong>{formatDateTime(trade.closed_at)}</strong></div>
        <div><span>Entry</span><strong>{trade.actual_entry ?? trade.planned_entry}</strong></div>
        <div><span>Exit</span><strong>{trade.exit_price ?? "—"}</strong></div>
        <div><span>Final R</span><strong>{trade.final_r ?? "—"}</strong></div>
        <div><span>Followed plan</span><strong>{review.followed_plan}</strong></div>
      </div>

      {(review.mistake_tags.length > 0 || review.positive_actions.length > 0) && (
        <div className="review-tag-groups">
          {review.mistake_tags.length > 0 && (
            <div>
              <strong>Mistakes</strong>
              <div className="review-tags">
                {review.mistake_tags.map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}
              </div>
            </div>
          )}
          {review.positive_actions.length > 0 && (
            <div>
              <strong>Positive actions</strong>
              <div className="review-tags positive-tags">
                {review.positive_actions.map((action) => <span key={action}>{action.replaceAll("_", " ")}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {(review.lesson || review.notes) && (
        <div className="review-written-notes">
          {review.lesson && <div><span>Lesson</span><p>{review.lesson}</p></div>}
          {review.notes && <div><span>Notes</span><p>{review.notes}</p></div>}
        </div>
      )}
    </article>
  );
}

interface TradeReviewAccordionProps {
  trade: Trade;
  onReviewed: (tradeId: number, review: Review, payload: ReviewPayload) => void;
}

function TradeReviewAccordion({ trade, onReviewed }: TradeReviewAccordionProps) {
  return (
    <details className="trade-accordion review-accordion">
      <summary className="trade-summary review-summary">
        <div>
          <p className="eyebrow">Closed {formatDateTime(trade.closed_at)}</p>
          <h3>{trade.symbol} <span>{trade.direction}</span></h3>
        </div>
        <div className="review-summary-meta">
          {trade.review && <strong>{trade.review.discipline_score}/100</strong>}
          <span className={`trade-status ${trade.has_review ? "reviewed" : "closed"}`}>
            {trade.has_review ? "Reviewed" : "Ready to review"}
          </span>
        </div>
      </summary>

      {trade.review ? (
        <ReviewedTrade trade={trade} review={trade.review} />
      ) : (
        <ReviewForm
          trade={trade}
          onReviewed={(review, payload) => onReviewed(trade.id, review, payload)}
        />
      )}
    </details>
  );
}

export function PostTradeReview() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void getTrades()
      .then((loadedTrades) => {
        setTrades(loadedTrades.filter((trade) => trade.status === "closed"));
        setError("");
      })
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredTrades = useMemo(
    () => filterAndSortReviewTrades(trades, {
      reviewStatus: reviewFilter,
      startDate,
      endDate,
    }),
    [endDate, reviewFilter, startDate, trades],
  );

  function handleReviewed(
    tradeId: number,
    review: Review,
    payload: ReviewPayload,
  ) {
    setTrades((current) =>
      current.map((trade) =>
        trade.id === tradeId
          ? {
              ...trade,
              exit_price: payload.exit_price,
              exit_reason: payload.exit_reason,
              final_r: (() => {
                const result = calculateTradeFinalR(trade, payload.exit_price);
                return Number.isFinite(result) ? Number(result.toFixed(4)) : null;
              })(),
              followed_plan: review.followed_plan,
              discipline_score: review.discipline_score,
              has_review: true,
              review,
            }
          : trade,
      ),
    );
  }

  function clearFilters() {
    setReviewFilter("all");
    setStartDate("");
    setEndDate("");
  }

  return (
    <section className="review-page">
      <div className="review-page-heading">
        <div>
          <p className="eyebrow">Post-trade</p>
          <h2>Grade the process, not just the P&amp;L.</h2>
        </div>
        <p>A disciplined loss can be a good trade. A rule-breaking win is still a bad trade.</p>
      </div>

      <div className="review-filters" aria-label="Trade history filters">
        <label>
          Review status
          <select
            value={reviewFilter}
            onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}
          >
            <option value="all">All closed trades</option>
            <option value="pending">Pending review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </label>
        <label>
          Closed from
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          Closed through
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={clearFilters}>Clear filters</button>
        <span>{filteredTrades.length} trade{filteredTrades.length === 1 ? "" : "s"}</span>
      </div>

      {isLoading && <p className="empty-state">Loading closed trades…</p>}
      {error && <p className="form-message error-message">{error}</p>}
      {!isLoading && !error && filteredTrades.length === 0 && (
        <div className="empty-state">
          <strong>No closed trades match these filters.</strong>
          <p>Clear the filters or close an open trade to add it to this history.</p>
        </div>
      )}
      <div className="review-list">
        {filteredTrades.map((trade) => (
          <TradeReviewAccordion
            key={trade.id}
            trade={trade}
            onReviewed={handleReviewed}
          />
        ))}
      </div>
    </section>
  );
}
