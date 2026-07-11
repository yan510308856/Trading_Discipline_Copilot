from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.attention_service import build_attention_items

router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/attention", response_model=schemas.AttentionResponse)
def attention_center(
    database: Database,
    trade_horizon: Optional[schemas.TradeHorizon] = Query(default=None),
) -> dict:
    items = build_attention_items(database, trade_horizon)
    counts = {severity: sum(item["severity"] == severity for item in items) for severity in ("blocker", "warning", "reminder")}
    return {"items": items, "actionable_count": len(items), "counts": counts}
