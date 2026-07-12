from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.get("/workflow-events", response_model=list[schemas.WorkflowEventRead])
def workflow_events(
    database: Database,
    event_type: Optional[str] = None,
    trade_id: Optional[int] = Query(default=None, gt=0),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[models.WorkflowEvent]:
    statement = select(models.WorkflowEvent)
    if event_type:
        statement = statement.where(models.WorkflowEvent.event_type == event_type)
    if trade_id:
        statement = statement.where(models.WorkflowEvent.trade_id == trade_id)
    if date_from:
        statement = statement.where(models.WorkflowEvent.occurred_at >= date_from)
    if date_to:
        statement = statement.where(models.WorkflowEvent.occurred_at <= date_to)
    return list(database.scalars(statement.order_by(models.WorkflowEvent.occurred_at.desc(), models.WorkflowEvent.id.desc()).limit(limit).offset(offset)))
