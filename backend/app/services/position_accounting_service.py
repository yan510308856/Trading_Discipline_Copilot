"""Decimal-based position accounting for entry and exit execution histories."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from app import models
from app.errors import APIError
from app.services.option_contract_service import resolved_underlying_direction


QUANTITY_STEP = Decimal("0.01")
OUTPUT_STEP = Decimal("0.0001")


def decimal_value(value: object | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def normalized_quantity(value: object | None) -> Decimal:
    return decimal_value(value).quantize(QUANTITY_STEP, rounding=ROUND_HALF_UP)


def _output(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(OUTPUT_STEP, rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class PositionSummary:
    initial_quantity: Decimal
    added_quantity: Decimal
    total_entry_quantity: Decimal
    total_exit_quantity: Decimal
    remaining_quantity: Decimal
    weighted_average_entry: Decimal | None
    total_underlying_risk: Decimal
    add_count: int
    uses_legacy_fallback: bool
    accounting_consistent: bool

    def as_api_dict(self) -> dict[str, float | int | bool | None]:
        return {
            "initial_quantity": _output(self.initial_quantity),
            "added_quantity": _output(self.added_quantity),
            "total_entry_quantity": _output(self.total_entry_quantity),
            "total_exit_quantity": _output(self.total_exit_quantity),
            "remaining_quantity": _output(self.remaining_quantity),
            "weighted_average_entry": _output(self.weighted_average_entry),
            "total_underlying_risk": _output(self.total_underlying_risk),
            "add_count": self.add_count,
            "uses_legacy_fallback": self.uses_legacy_fallback,
            "accounting_consistent": self.accounting_consistent,
        }


def position_summary(trade: models.Trade) -> PositionSummary:
    entries = list(trade.entry_executions)
    uses_legacy_fallback = not entries
    if entries:
        initial_quantity = sum(
            (
                normalized_quantity(item.quantity)
                for item in entries
                if item.entry_kind == "initial"
            ),
            Decimal("0.00"),
        )
        added_quantity = sum(
            (
                normalized_quantity(item.quantity)
                for item in entries
                if item.entry_kind == "add"
            ),
            Decimal("0.00"),
        )
        total_entry_quantity = initial_quantity + added_quantity
        weighted_numerator = sum(
            (
                decimal_value(item.underlying_price)
                * normalized_quantity(item.quantity)
                for item in entries
            ),
            Decimal("0"),
        )
        weighted_average_entry = (
            weighted_numerator / total_entry_quantity
            if total_entry_quantity > 0
            else None
        )
        total_underlying_risk = sum(
            (
                abs(
                    decimal_value(item.underlying_price)
                    - decimal_value(item.stop_at_entry)
                )
                * normalized_quantity(item.quantity)
                for item in entries
            ),
            Decimal("0"),
        )
    else:
        initial_quantity = normalized_quantity(trade.position_size)
        added_quantity = Decimal("0.00")
        total_entry_quantity = initial_quantity
        entry_price = decimal_value(
            trade.actual_entry
            if trade.actual_entry is not None
            else trade.planned_entry
        )
        weighted_average_entry = entry_price if initial_quantity > 0 else None
        total_underlying_risk = (
            abs(entry_price - decimal_value(trade.stop_loss)) * initial_quantity
            if initial_quantity > 0
            else Decimal("0")
        )

    total_exit_quantity = sum(
        (normalized_quantity(item.quantity) for item in trade.executions),
        Decimal("0.00"),
    )
    remaining_quantity = total_entry_quantity - total_exit_quantity
    initial_count = sum(item.entry_kind == "initial" for item in entries)
    accounting_consistent = (
        remaining_quantity >= 0
        and (uses_legacy_fallback or initial_count == 1)
        and (trade.status != "closed" or remaining_quantity == 0)
    )
    return PositionSummary(
        initial_quantity=initial_quantity,
        added_quantity=added_quantity,
        total_entry_quantity=total_entry_quantity,
        total_exit_quantity=total_exit_quantity,
        remaining_quantity=remaining_quantity,
        weighted_average_entry=weighted_average_entry,
        total_underlying_risk=total_underlying_risk,
        add_count=sum(item.entry_kind == "add" for item in entries),
        uses_legacy_fallback=uses_legacy_fallback,
        accounting_consistent=accounting_consistent,
    )


def aggregate_underlying_r(
    trade: models.Trade, mark_price: float | Decimal | None = None
) -> float:
    """Calculate aggregate underlying R from every entry and exit execution."""

    entries = list(trade.entry_executions)
    if not entries:
        raise APIError(
            409,
            "ENTRY_EXECUTIONS_REQUIRED",
            "Entry execution history is required for aggregate Underlying R.",
            {"trade_id": trade.id},
        )
    summary = position_summary(trade)
    if not summary.accounting_consistent:
        raise APIError(
            409,
            "POSITION_ACCOUNTING_INCONSISTENT",
            "Entry and exit quantities are inconsistent.",
            {"trade_id": trade.id},
        )
    if summary.total_underlying_risk <= 0:
        raise APIError(
            422,
            "INVALID_RISK_DISTANCE",
            "Entry stops must define positive total underlying risk.",
            {"trade_id": trade.id},
        )
    if summary.remaining_quantity > 0 and mark_price is None:
        raise APIError(
            422,
            "CURRENT_PRICE_REQUIRED",
            "Current underlying price is required for an open-position R calculation.",
            {"trade_id": trade.id},
        )

    entry_value = sum(
        (
            decimal_value(item.underlying_price)
            * normalized_quantity(item.quantity)
            for item in entries
        ),
        Decimal("0"),
    )
    exit_value = sum(
        (
            decimal_value(item.price) * normalized_quantity(item.quantity)
            for item in trade.executions
        ),
        Decimal("0"),
    )
    marked_value = decimal_value(mark_price) * summary.remaining_quantity
    first_entry = entries[0]
    direction = resolved_underlying_direction(
        trade.market,
        trade.direction,
        trade.option_type,
        float(first_entry.underlying_price),
        float(first_entry.stop_at_entry),
    )
    pnl = (
        exit_value + marked_value - entry_value
        if direction == "long"
        else entry_value - exit_value - marked_value
    )
    return round(float(pnl / summary.total_underlying_risk), 4)
