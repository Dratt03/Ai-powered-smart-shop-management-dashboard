import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load the variables from the .env file
load_dotenv()

# Read the database connection string from environment variables
# If not found, use a default local postgres connection
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/shopkeeper_db"
)

# create_engine is the starting point for SQLAlchemy.
# It handles the actual connection pool to PostgreSQL.
engine = create_engine(DATABASE_URL)

# sessionmaker creates a factory for database sessions.
# A session represents a "workspace" for all operations with the database.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is a class that all our future database models (tables) will inherit from.
Base = declarative_base()

# This helper function gives a database session to an incoming API request
# and ensures the session is closed once the request is finished.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
