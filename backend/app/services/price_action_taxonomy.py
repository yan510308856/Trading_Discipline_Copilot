"""Canonical price-action contract and legacy compatibility mapping."""

from __future__ import annotations

import json
from pathlib import Path

TAXONOMY_PATH = Path(__file__).parents[3] / "shared" / "price_action_taxonomy.json"
with TAXONOMY_PATH.open(encoding="utf-8") as taxonomy_file:
    TAXONOMY_CONTRACT = json.load(taxonomy_file)

MARKET_STATES = tuple(item["value"] for item in TAXONOMY_CONTRACT["market_state"])
TRADE_THESES = tuple(item["value"] for item in TAXONOMY_CONTRACT["trade_thesis"])
ENTRY_TRIGGERS = tuple(item["value"] for item in TAXONOMY_CONTRACT["entry_trigger"])
LOCATION_TAGS = tuple(item["value"] for item in TAXONOMY_CONTRACT["location_tag"])

CONTEXT_TO_STATE = {
    "strong_trend": "strong_trend", "narrow_channel": "narrow_channel",
    "weak_trend": "broad_channel", "broad_channel": "broad_channel",
    "trading_range": "trading_range", "breakout_mode": "breakout_mode",
    "uncertain": "unclear", "opening_range": "unclear", "gap_open": "unclear",
}
SETUP_TO_CLASSIFICATION = {
    "breakout": ("breakout", "other"), "pullback": ("pullback_continuation", "other"),
    "failed_breakout": ("failed_breakout", "other"), "reversal": ("major_reversal", "other"),
    "left_side_bottom_pick": ("major_reversal", "other"), "early_reversal": ("major_reversal", "other"),
    "bottom_pick": ("major_reversal", "other"), "h1_h2_l1_l2": ("other", "h1_h2_l1_l2"),
    "wedge": ("other", "wedge"), "double_top_bottom": ("other", "double_top_bottom"),
    "inside_bar_triangle": ("other", "inside_bar_triangle"), "opening_range": ("other", "other"),
    "gap_open": ("other", "other"), "other": ("other", "other"),
}
THESIS_TO_SETUP = {
    "pullback_continuation": "pullback", "breakout": "breakout", "breakout_pullback": "breakout",
    "failed_breakout": "failed_breakout", "range_reversal": "reversal", "major_reversal": "reversal", "other": "other",
}
STATE_TO_CONTEXT = {
    "strong_trend": "strong_trend", "narrow_channel": "narrow_channel", "broad_channel": "broad_channel",
    "trading_range": "trading_range", "breakout_mode": "breakout_mode", "unclear": "uncertain",
}
UNCONFIRMED_SETUPS = {"left_side_bottom_pick", "early_reversal", "bottom_pick"}


def ordered_location_tags(values: list[str] | None) -> list[str]:
    selected = set(values or [])
    return [value for value in LOCATION_TAGS if value in selected]


def classification_from_legacy(setup: str | None, context: str | None) -> dict:
    thesis, trigger = SETUP_TO_CLASSIFICATION.get(setup or "", ("other", "other"))
    tags = [value for value in (context, setup) if value in {"opening_range", "gap_open"}]
    return {
        "market_state": CONTEXT_TO_STATE.get(context or "", "unclear"),
        "trade_thesis": thesis,
        "entry_trigger": trigger,
        "location_tags": ordered_location_tags(tags),
        "location_decision": "selected" if tags else None,
        "reversal_confirmation": "unconfirmed" if setup in UNCONFIRMED_SETUPS else None,
        "is_unconfirmed_reversal": setup in UNCONFIRMED_SETUPS,
    }


def add_legacy_mirrors(data: dict) -> dict:
    if data.get("trade_thesis"):
        mirrored = THESIS_TO_SETUP.get(data["trade_thesis"])
        if mirrored:
            data["setup"] = mirrored
    if data.get("market_state"):
        mirrored = STATE_TO_CONTEXT.get(data["market_state"])
        if mirrored:
            data["market_context"] = mirrored
    return data
