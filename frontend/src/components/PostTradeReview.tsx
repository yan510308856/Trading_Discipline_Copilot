import { useMemo, useState } from "react";

import { APIError, createReview } from "../api";
import { useTrades } from "../hooks/useTrades";
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
import { DeleteTradeButton } from "./DeleteTradeButton";
import {
  HorizonFilter,
  type HorizonFilterValue,
  horizonForApi,
} from "./HorizonFilter";

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

interface ReviewFormProps {
  trade: Trade;
  onReviewed: (review: Review) => void;
}

function ReviewForm({ trade, onReviewed }: ReviewFormProps) {
  const [followedPlan, setFollowedPlan] = useState<FollowedPlan>("yes");
  const [mistakeTags, setMistakeTags] = useState<string[]>([]);
  const [positiveActions, setPositiveActions] = useState<string[]>([]);
  const [lesson, setLesson] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: ReviewPayload = {
      followed_plan: followedPlan,
      mistake_tags: mistakeTags,
      positive_actions: positiveActions,
      lesson: lesson.trim() || null,
      notes: notes.trim() || null,
    };

    setIsSaving(true);
    setError("");
    try {
      onReviewed(await createReview(trade.id, payload));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="review-card" onSubmit={handleSubmit}>
      <div className="form-grid three-columns">
        <div><span>Exit price</span><strong>{trade.exit_price ?? "—"}</strong></div>
        <div><span>Exit reason</span><strong>{trade.exit_reason?.replaceAll("_", " ") ?? "—"}</strong></div>
        <div><span>Final R</span><strong>{trade.final_r?.toFixed(2) ?? "—"}</strong></div>
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

      <button className="primary-button" disabled={isSaving}>
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
  onReviewed: (tradeId: number, review: Review) => void;
  onDeleted: (tradeId: number) => void;
}

function TradeReviewAccordion({ trade, onReviewed, onDeleted }: TradeReviewAccordionProps) {
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
          onReviewed={(review) => onReviewed(trade.id, review)}
        />
      )}
      <DeleteTradeButton trade={trade} onDeleted={onDeleted} />
    </details>
  );
}

export function PostTradeReview() {
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilterValue>("all");
  const { trades, setTrades, isLoading, error } = useTrades(
    "closed",
    horizonForApi(horizonFilter),
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
  ) {
    setTrades((current) =>
      current.map((trade) =>
        trade.id === tradeId
          ? {
              ...trade,
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
    setHorizonFilter("all");
    setStartDate("");
    setEndDate("");
  }

  return (
    <section className="review-page">
      <div className="review-page-heading">
        <div>
          <p className="eyebrow">Post-trade</p>
          <h2>Review closed trades.</h2>
        </div>
        <p>Filter the history, then grade execution quality.</p>
      </div>

      <div className="review-filters" aria-label="Trade history filters">
        <HorizonFilter value={horizonFilter} onChange={setHorizonFilter} />
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
            onDeleted={(tradeId) =>
              setTrades((current) => current.filter((item) => item.id !== tradeId))
            }
          />
        ))}
      </div>
    </section>
  );
}
