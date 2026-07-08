from pathlib import Path

import yaml

from app.services.review_service import calculate_discipline_score, classify_trade


def test_penalties_and_bonuses_are_loaded_from_yaml(tmp_path: Path) -> None:
    rules_path = tmp_path / "scoring.yaml"
    rules_path.write_text(
        yaml.safe_dump(
            {
                "base_score": 80,
                "min_score": 0,
                "max_score": 100,
                "veto_rules": [],
                "penalties": {"chased_entry": -25},
                "bonuses": {"followed_stop": 10},
                "score_bands": [
                    {"min": 70, "label": "Good"},
                    {"min": 0, "label": "Needs review"},
                ],
            }
        ),
        encoding="utf-8",
    )

    result = calculate_discipline_score(
        ["chased_entry"], ["followed_stop"], rules_path
    )

    assert result == {
        "score": 65,
        "score_band": "Needs review",
        "triggered_rules": ["penalty:chased_entry", "bonus:followed_stop"],
        "veto_reason": None,
    }


def test_veto_overrides_other_scoring_rules() -> None:
    result = calculate_discipline_score(
        ["no_stop_loss", "no_trade_plan"], ["followed_planned_stop"]
    )

    assert result["score"] == 0
    assert result["triggered_rules"] == ["veto:no_stop_loss"]
    assert result["veto_reason"] is not None


def test_trade_quality_is_independent_from_profit_and_loss() -> None:
    assert classify_trade(90, -1.0, 70) == "good_trade_loser"
    assert classify_trade(40, 2.0, 70) == "bad_trade_winner"
    assert classify_trade(100, 2.0, 70, "no") == "bad_trade_winner"
