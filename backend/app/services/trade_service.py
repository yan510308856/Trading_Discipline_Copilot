"""Trade persistence operations."""

from sqlalchemy.orm import Session

from app import models, schemas


def create_planned_trade(database: Session, trade_data: schemas.TradeCreate) -> models.Trade:
    """Persist a new trade plan in the initial planned state."""

    trade = models.Trade(**trade_data.model_dump(), status="planned")
    database.add(trade)
    database.commit()
    database.refresh(trade)
    return trade
