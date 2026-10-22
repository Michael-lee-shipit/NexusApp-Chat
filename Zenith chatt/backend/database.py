from sqlalchemy import create_engine
from sqlalchemy import inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite database file path
SQLALCHEMY_DATABASE_URL = "sqlite:///./chat_app.db"

# Create the SQLite engine (check_same_thread is needed for SQLite in FastAPI)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a session local class for database operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our database models to inherit from
Base = declarative_base()


def migrate_users_schema():
    """Add auth columns to existing SQLite databases without dropping user data."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "email" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
        if "auth_provider" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR"))
        if "auth_subject" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN auth_subject VARCHAR"))
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email COLLATE NOCASE)")
        )
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_auth_identity ON users (auth_provider, auth_subject)")
        )

# Dependency to get the database session in our routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()