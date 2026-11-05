
from sqlalchemy.orm import Session
from database import engine, Project, Service, Measurement

# Connect to the database
with Session(engine) as session:

    # Create a sample project
    project = Project(
        name="WattWise Demo",
        description="Testing the WattWise database",
        status="Active"
    )

    session.add(project)
    session.flush()

    print("Sample project added successfully!")
    print("Project ID:", project.project_id)

    # Create a service linked to this project
    new_service = Service(
        project_id=project.project_id,
        name="Demo Cloud Service",
        type="Cloud Computing",
        provider="AWS",
        region="UK"
    )

    session.add(new_service)
    session.flush()

    print("Sample service added successfully!")
    print("Service ID:", new_service.service_id)

    # Create a measurement linked to this service
    new_measurement = Measurement(
        service_id=new_service.service_id,
        energy_used=150.5,
        carbon_intensity=129,
        embodied_emissions=25.0,
        functional_unit=100,
        sci_score=0.0
    )

    session.add(new_measurement)
    session.commit()

    print("Sample measurement added successfully!")
    print("Measurement ID:", new_measurement.measurement_id)

    # Create a sample dashboard
    from database import Dashboard, SLA_Rule, SLA_Log, Logbook, Report

    dashboard = Dashboard(
        name="WattWise Demo Dashboard",
        owner_id=1,
        is_demo=True
    )

    session.add(dashboard)
    session.flush()

    print("Dashboard added! ID:", dashboard.dashboard_id)

    # Create an SLA rule
    sla_rule = SLA_Rule(
        dashboard_id=dashboard.dashboard_id,
        target_metric="Energy Usage",
        max_threshold_limit=200.0
    )

    session.add(sla_rule)
    session.flush()

    print("SLA Rule added! ID:", sla_rule.sla_id)

    # Create an SLA log
    sla_log = SLA_Log(
        sla_id=sla_rule.sla_id,
        peak_value=220.0,
        percentage_difference=10.0,
        message="Energy usage exceeded the SLA threshold"
    )

    session.add(sla_log)

    # Create a logbook entry
    logbook = Logbook(
        dashboard_id=dashboard.dashboard_id,
        description="Demo dashboard created for testing"
    )

    session.add(logbook)

    # Create a report
    report = Report(
        dashboard_id=dashboard.dashboard_id,
        report_name="WattWise Demo Report",
        report_type="SCI Summary",
        content="Sample report for database testing"
    )

    session.add(report)

    session.commit()

    print("SLA Log, Logbook and Report added successfully!")
print("Database testing completed!")