from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def migrated_database(tmp_path: Path) -> str:
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
    return database_url


@pytest.fixture
def database_session(migrated_database: str) -> Session:
    engine = create_engine(migrated_database)
    with Session(engine) as session:
        yield session
