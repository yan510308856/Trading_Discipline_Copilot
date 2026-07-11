"""Canonical option contract display generation."""

from __future__ import annotations

from datetime import date


def build_option_contract(symbol: str, option_type: str, expiration: date, strike: float) -> str:
    strike_text = f"{strike:.2f}".rstrip("0").rstrip(".")
    suffix = "C" if option_type == "call" else "P"
    return f"{symbol.strip().upper()} {expiration.isoformat()} {strike_text}{suffix}"


def underlying_direction(market: str, action: str, option_type: str | None) -> str:
    """Map option action/type to the expected underlying price direction."""
    if market != "options" or option_type is None:
        return action
    bullish = (action == "long" and option_type == "call") or (
        action == "short" and option_type == "put"
    )
    return "long" if bullish else "short"


def resolved_underlying_direction(
    market: str,
    action: str,
    option_type: str | None,
    entry_price: float,
    stop_price: float,
) -> str:
    """Use stored price structure only as recovery for legacy conflicting options."""
    expected = underlying_direction(market, action, option_type)
    expected_risk = (
        entry_price - stop_price
        if expected == "long"
        else stop_price - entry_price
    )
    if expected_risk > 0:
        return expected
    return "long" if stop_price < entry_price else "short"
