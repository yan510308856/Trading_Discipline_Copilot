"""Post-trade review HTTP routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import review_service


router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.post(
    "/trades/{trade_id}/review",
    response_model=schemas.ReviewRead,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    trade_id: int, review_data: schemas.ReviewRequest, database: Database
) -> models.Review:
    return review_service.create_review(database, trade_id, review_data)
