from sqlalchemy.orm import Session
from database import engine, Project

# Connect to the database
with Session(engine) as session:

    # Create a sample project
    project = Project(
        name="WattWise Demo",
        description="Testing the WattWise database",
        status="Active"
    )

    # Save the project
    session.add(project)
    session.commit()

    print("Sample project added successfully!")
    print("Project ID:", project.project_id)



# Test adding a service to our project

from database import Service

new_service = Service(
    project_id=1,
    name="Demo Cloud Service",
    type="Cloud Computing",
    provider="AWS",
    region="UK"
)

session.add(new_service)
session.commit()

print("Sample service added successfully!")
print("Service ID:", new_service.service_id)


# Test adding a measurement to our service

from database import Measurement

new_measurement = Measurement(
    service_id=1,
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