import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_decision_migration_preserves_existing_data_and_downgrades():
    path = Path(__file__).resolve().parents[1] / "alembic/versions/20261005_decisions.py"
    spec = importlib.util.spec_from_file_location("decision_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id CHAR(32) PRIMARY KEY, full_name TEXT)"))
        connection.execute(text("INSERT INTO users VALUES ('fixture','Test User')"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            assert {"twin_states", "decision_runs", "decision_events"}.issubset(inspect(connection).get_table_names())
            assert connection.execute(text("SELECT full_name FROM users")).scalar() == "Test User"
            assert inspect(connection).get_foreign_keys("decision_runs")[1]["referred_table"] in ("users", "twin_states")
            module.downgrade()
            assert inspect(connection).get_table_names() == ["users"]
    engine.dispose()
