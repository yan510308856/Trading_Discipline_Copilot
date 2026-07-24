"""Persist and undo dismissals for currently active warning occurrences."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.errors import APIError
from app.services.attention_service import build_attention_items


def dismiss_warning(
    database: Session, payload: schemas.WarningDismissalCreate
) -> models.WarningDismissal:
    active = next(
        (
            item for item in build_attention_items(database, include_dismissed=True)
            if item["dismissible"]
            and item["dismissal_key"] == payload.dismissal_key
            and item["occurrence_key"] == payload.occurrence_key
        ),
        None,
    )
    if active is None:
        raise APIError(
            409,
            "WARNING_NOT_DISMISSIBLE",
            "The key does not identify a currently active dismissible warning.",
            {"dismissal_key": payload.dismissal_key},
        )
    existing = database.scalar(
        select(models.WarningDismissal).where(
            models.WarningDismissal.dismissal_key == payload.dismissal_key
        )
    )
    if existing is not None:
        return existing
    dismissal = models.WarningDismissal(
        dismissal_key=payload.dismissal_key,
        occurrence_key=payload.occurrence_key,
        source_type=active["source_type"],
        source_id=active.get("source_id"),
        trade_id=active.get("trade_id"),
        rule_id=active.get("rule_id"),
    )
    database.add(dismissal)
    database.commit()
    database.refresh(dismissal)
    return dismissal


def undo_dismissal(database: Session, dismissal_key: str) -> None:
    dismissal = database.scalar(
        select(models.WarningDismissal).where(
            models.WarningDismissal.dismissal_key == dismissal_key
        )
    )
    if dismissal is None:
        raise APIError(404, "WARNING_DISMISSAL_NOT_FOUND", "Warning dismissal was not found.", {})
    database.delete(dismissal)
    database.commit()
