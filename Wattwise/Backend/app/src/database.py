from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float
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

# MEASUREMENT TABLE
class Measurement(Base):
    __tablename__ = "measurements"

    measurement_id = Column(Integer, primary_key=True)

    service_id = Column(
        Integer,
        ForeignKey("services.service_id"),
        nullable=False
    )

    timestamp = Column(DateTime, default=datetime.now)
    energy_used = Column(Float)
    carbon_intensity = Column(Float)
    embodied_emissions = Column(Float)
    functional_unit = Column(Float)
    sci_score = Column(Float)

# VARIABLE TABLE
class Variable(Base):
    __tablename__ = "variables"

    variable_id = Column(Integer, primary_key=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.project_id"),
        nullable=False
    )

    name = Column(String(100), nullable=False)
    value = Column(Float)
    unit = Column(String(50))
    description = Column(Text)

# Create the database tables
if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("WattWise database created successfully!")