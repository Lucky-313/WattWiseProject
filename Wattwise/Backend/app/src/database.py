from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Date, ForeignKey, Float, Boolean, UniqueConstraint, inspect
from sqlalchemy.orm import declarative_base, Session
from datetime import datetime
from pathlib import Path

# Find the main WattWiseProject folder
BASE_DIR = Path(__file__).resolve().parents[4]

# Connect to the original SQLite database
DATABASE_PATH = BASE_DIR / "wattwise.db"

engine = create_engine(f"sqlite:///{DATABASE_PATH}")

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
    passcode_hash = Column(String(255))
    input_method = Column(String(20), nullable=False, default="manual")
    sci_summary = Column(Float)
    created_at = Column(DateTime, default=datetime.now)


class DashboardImport(Base):
    __tablename__ = "dashboard_imports"

    import_id = Column(Integer, primary_key=True, autoincrement=True)
    dashboard_id = Column(
        Integer, ForeignKey("dashboards.dashboard_id"), nullable=False, index=True
    )
    filename = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

class DashboardDailyMetric(Base):
    __tablename__ = "dashboard_daily_metrics"
    __table_args__ = (
        UniqueConstraint("dashboard_id", "measured_on", name="uq_dashboard_metric_day"),
    )

    metric_id = Column(Integer, primary_key=True, autoincrement=True)
    dashboard_id = Column(
        Integer, ForeignKey("dashboards.dashboard_id"), nullable=False, index=True
    )
    measured_on = Column(Date, nullable=False)
    energy_kwh = Column(Float, nullable=False)
    carbon_intensity_gco2_kwh = Column(Float, nullable=False)
    embodied_emissions_gco2e = Column(Float, nullable=False)
    api_calls = Column(Float, nullable=False)
    sci_score = Column(Float, nullable=False)
    emissions_gco2e = Column(Float, nullable=False)

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
    is_active = Column(Boolean, nullable=False, default=True)

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
    source_date = Column(String(10))
    metric_key = Column(String(40))
    observed_value = Column(Float)
    max_threshold_limit = Column(Float)
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

# USER TABLE
class User(Base):
    __tablename__ = "USER"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    created_at = Column(DateTime, default=datetime.now)



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
            "infra_id": measurement.service_id,
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

#Create a new user account
def create_user(name, email, password_hash):

    with Session(engine) as session:

        new_user= User(
            name=name,
            email=email,
            password_hash=password_hash
        )

        session.add(new_user)
        session.commit()
        session.refresh(new_user)

        return new_user


# find user using their email
def get_user_by_email(email):

    with Session(engine) as session:

        return session.query(User).filter(User.email == email).first()

# find user using their ID
def get_user_by_id(user_id):

    with Session(engine) as session:

        return session.query(User).filter(User.user_id == user_id).first()


def initialize_database():
    Base.metadata.create_all(engine)
    dashboard_columns = {
        column["name"] for column in inspect(engine).get_columns("dashboards")
    }
    new_columns = {
        "passcode_hash": "VARCHAR(255)",
        "input_method": "VARCHAR(20) NOT NULL DEFAULT 'manual'",
        "sci_summary": "FLOAT",
        "created_at": "DATETIME",
    }
    with engine.begin() as connection:
        for column_name, column_type in new_columns.items():
            if column_name not in dashboard_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE dashboards ADD COLUMN {column_name} {column_type}"
                )
        sla_log_columns = {
            column["name"] for column in inspect(engine).get_columns("sla_logs")
        }
        new_sla_log_columns = {
            "source_date": "VARCHAR(10)",
            "metric_key": "VARCHAR(40)",
            "observed_value": "FLOAT",
            "max_threshold_limit": "FLOAT",
        }
        for column_name, column_type in new_sla_log_columns.items():
            if column_name not in sla_log_columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE sla_logs ADD COLUMN {column_name} {column_type}"
                )
        sla_rule_columns = {
            column["name"] for column in inspect(engine).get_columns("sla_rules")
        }
        if "is_active" not in sla_rule_columns:
            connection.exec_driver_sql(
                "ALTER TABLE sla_rules ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
            )


# Create the database tables
if __name__ == "__main__":
    initialize_database()
    print("WattWise database created successfully!")
