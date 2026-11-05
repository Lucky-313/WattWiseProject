from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import declarative_base, Session
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

    # DASHBOARD TABLE
class Dashboard(Base):
    __tablename__ = "dashboards"

    dashboard_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    owner_id = Column(Integer)
    is_demo = Column(Boolean, default=False)

    # SLA RULE TABLE
class SLA_Rule(Base):
    __tablename__ = "sla_rules"

    sla_id = Column(Integer, primary_key=True)

    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.dashboard_id"),
        nullable=False
    )

    target_metric = Column(String(100), nullable=False)
    max_threshold_limit = Column(Float, nullable=False)

    # SLA LOG TABLE
class SLA_Log(Base):
    __tablename__ = "sla_logs"

    log_id = Column(Integer, primary_key=True)

    sla_id = Column(
        Integer,
        ForeignKey("sla_rules.sla_id"),
        nullable=False
    )

    timestamp = Column(DateTime, default=datetime.now)
    peak_value = Column(Float)
    percentage_difference = Column(Float)
    message = Column(Text)

# LOGBOOK TABLE
class Logbook(Base):
    __tablename__ = "logbooks"

    logbook_id = Column(Integer, primary_key=True)

    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.dashboard_id"),
        nullable=False
    )

    created_at = Column(DateTime, default=datetime.now)
    description = Column(Text)

    # REPORT TABLE
class Report(Base):
    __tablename__ = "reports"

    report_id = Column(Integer, primary_key=True)

    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.dashboard_id"),
        nullable=False
    )

    report_name = Column(String(100), nullable=False)
    report_type = Column(String(50))
    generated_at = Column(DateTime, default=datetime.now)
    content = Column(Text)

    # GET MEASUREMENT DATA
def get_measurement(service_id):
    with Session(engine) as session:
        measurement = (
            session.query(Measurement)
            .filter(Measurement.service_id == service_id)
            .order_by(Measurement.timestamp.desc())
            .first()
        )

        if measurement is None:
            return None

        return {
            "measurement_id": measurement.measurement_id,
            "service_id": measurement.service_id,
            "energy_used": measurement.energy_used,
            "carbon_intensity": measurement.carbon_intensity,
            "embodied_emissions": measurement.embodied_emissions,
            "functional_unit": measurement.functional_unit,
            "sci_score": measurement.sci_score
        }

        # STORE SCI SCORE
def store_sci_score(measurement_id, sci_score):
    with Session(engine) as session:
        measurement = session.query(Measurement).filter(
            Measurement.measurement_id == measurement_id
        ).first()

        if measurement is None:
            raise ValueError("Measurement not found")

        measurement.sci_score = sci_score
        session.commit()

        return True

# Create the database tables
if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("WattWise database created successfully!")