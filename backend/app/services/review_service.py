"""Post-trade review scoring and persistence."""

from __future__ import annotations

from pathlib import Path
from typing import Any, TypedDict

import yaml
from sqlalchemy.orm import Session

from app import models, schemas
from app.errors import APIError
from app.services.trade_service import calculate_final_r, get_trade


DEFAULT_SCORING_RULES_PATH = (
    Path(__file__).parents[1] / "rules" / "discipline_scoring_rules.yaml"
)


class ScoringResult(TypedDict):
    score: int
    score_band: str
    triggered_rules: list[str]
    veto_reason: str | None


def load_scoring_rules(
    path: Path | str = DEFAULT_SCORING_RULES_PATH,
) -> dict[str, Any]:
    """Load the scoring configuration from YAML."""

    with Path(path).open(encoding="utf-8") as rules_file:
        rules = yaml.safe_load(rules_file) or {}

    required_keys = {
        "base_score",
        "min_score",
        "max_score",
        "penalties",
        "bonuses",
        "veto_rules",
        "score_bands",
    }
    missing_keys = required_keys - rules.keys()
    if missing_keys:
        raise ValueError(
            f"Scoring YAML is missing keys: {', '.join(sorted(missing_keys))}"
        )
    return rules


def _score_band(score: int, bands: list[dict[str, Any]]) -> str:
    for band in sorted(bands, key=lambda item: item["min"], reverse=True):
        if score >= int(band["min"]):
            return str(band["label"])
    raise ValueError("Scoring YAML must define a score band at or below min_score")


def calculate_discipline_score(
    mistake_tags: list[str],
    positive_actions: list[str],
    path: Path | str = DEFAULT_SCORING_RULES_PATH,
) -> ScoringResult:
    """Apply vetoes first, otherwise add configured penalties and bonuses."""

    rules = load_scoring_rules(path)
    mistakes = set(mistake_tags)
    actions = set(positive_actions)

    for veto in rules["veto_rules"]:
        if veto["tag"] in mistakes:
            score = int(veto["score"])
            return {
                "score": score,
                "score_band": _score_band(score, rules["score_bands"]),
                "triggered_rules": [f"veto:{veto['tag']}"],
                "veto_reason": str(veto["reason"]),
            }

    score = int(rules["base_score"])
    triggered_rules: list[str] = []
    for tag, value in rules["penalties"].items():
        if tag in mistakes:
            score += int(value)
            triggered_rules.append(f"penalty:{tag}")
    for action, value in rules["bonuses"].items():
        if action in actions:
            score += int(value)
            triggered_rules.append(f"bonus:{action}")

    score = max(int(rules["min_score"]), min(int(rules["max_score"]), score))
    return {
        "score": score,
        "score_band": _score_band(score, rules["score_bands"]),
        "triggered_rules": triggered_rules,
        "veto_reason": None,
    }


def classify_trade(
    score: int,
    final_r: float,
    good_trade_min_score: int,
    followed_plan: str = "yes",
) -> str:
    followed_enough = followed_plan in {"yes", "partial"}
    quality = (
        "good_trade"
        if score >= good_trade_min_score and followed_enough
        else "bad_trade"
    )
    outcome = "winner" if final_r > 0 else "loser"
    return f"{quality}_{outcome}"


def create_review(
    database: Session, trade_id: int, review_data: schemas.ReviewRequest
) -> models.Review:
    """Score and persist a review for a closed trade."""

    trade = get_trade(database, trade_id)
    if trade.status != "closed":
        raise APIError(
            409,
            "INVALID_TRADE_STATE",
            "Only closed trades can be reviewed.",
            {"trade_id": trade.id, "current_status": trade.status},
        )
    if trade.review is not None:
        raise APIError(
            409,
            "REVIEW_ALREADY_EXISTS",
            "This trade already has a review.",
            {"trade_id": trade_id},
        )

    positive_actions = list(
        dict.fromkeys([*review_data.positive_actions, "completed_post_trade_review"])
    )
    scoring = calculate_discipline_score(review_data.mistake_tags, positive_actions)
    rules = load_scoring_rules()
    final_r = calculate_final_r(trade, review_data.exit_price)
    classification = classify_trade(
        scoring["score"],
        final_r,
        int(rules["good_trade_min_score"]),
        review_data.followed_plan,
    )

    review = models.Review(
        trade_id=trade_id,
        followed_plan=review_data.followed_plan,
        discipline_score=scoring["score"],
        mistake_tags=review_data.mistake_tags,
        positive_actions=positive_actions,
        lesson=review_data.lesson,
        notes=review_data.notes,
        score_band=scoring["score_band"],
        triggered_rules=scoring["triggered_rules"],
        veto_reason=scoring["veto_reason"],
        trade_classification=classification,
    )
    trade.exit_price = review_data.exit_price
    trade.exit_reason = review_data.exit_reason
    trade.final_r = final_r
    trade.followed_plan = review_data.followed_plan
    trade.discipline_score = scoring["score"]
    database.add(review)
    database.commit()
    database.refresh(review)
    return review
