from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import get_db
from app.main import app


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


@pytest.fixture
def api_client(migrated_database: str) -> TestClient:
    engine = create_engine(
        migrated_database, connect_args={"check_same_thread": False}
    )
    test_session = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_db():
        with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
