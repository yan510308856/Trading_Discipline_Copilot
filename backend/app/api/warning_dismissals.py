from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.warning_dismissal_service import dismiss_warning, undo_dismissal

router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.post(
    "/warning-dismissals",
    response_model=schemas.WarningDismissalRead,
    status_code=status.HTTP_201_CREATED,
)
def create_warning_dismissal(
    payload: schemas.WarningDismissalCreate, database: Database
):
    return dismiss_warning(database, payload)


@router.delete(
    "/warning-dismissals/{dismissal_key:path}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_warning_dismissal(dismissal_key: str, database: Database) -> None:
    undo_dismissal(database, dismissal_key)
