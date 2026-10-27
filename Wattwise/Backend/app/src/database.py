from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

# Connect to our SQLite database
engine = create_engine("sqlite:///wattwise.db")

# Base class for creating database tables
Base = declarative_base()


# PROJECT TABLE
class Project(Base):
    __tablename__ = "projects"

    project_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)

# SERVICE TABLE
class Service(Base):
    __tablename__ = "services"

    service_id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.project_id"), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50))
    provider = Column(String(100))
    region = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)

# Create the database tables
if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("WattWise database created successfully!")