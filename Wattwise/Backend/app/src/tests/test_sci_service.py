import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import database
from Services.sci_service import SCIService


@pytest.fixture
def setup_measurement_db(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'sci_test.db'}"
    )

    monkeypatch.setattr(database, "engine", engine)

    database.Base.metadata.create_all(engine)

    # Create the project, service and measurement
    with Session(engine) as session:
        project = database.Project(name="Test Project")
        session.add(project)
        session.flush()

        service = database.Service(
            project_id=project.project_id,
            name="Test Service"
        )
        session.add(service)
        session.flush()

        measurement = database.Measurement(
            service_id=service.service_id,
            energy_used=100.0,
            embodied_emissions=20.0,
            functional_unit=10.0,
            carbon_intensity=0.5
        )
        session.add(measurement)
        session.commit()

        service_id = service.service_id
        measurement_id = measurement.measurement_id

    yield engine, service_id, measurement_id

    engine.dispose()


# 1. Test complete measurement-to-SCI flow

@pytest.mark.asyncio
async def test_measurement_sci_database_flow(
    setup_measurement_db
):
    engine, service_id, measurement_id = setup_measurement_db

    service = SCIService()

    # Mock only the external API call
    service.grid_adapter.fetch_live_grid_intensity = lambda: 0.5

    result = await service.process_sci_calculation(service_id)

    # Expected: ((100 * 0.5) + 20) / 10 = 7.0
    assert result["sci_score"] == 7.0
    assert result["carbon_intensity"] == 0.5

    # Verify the score was actually saved in the database
    with Session(engine) as session:
        saved_measurement = session.get(
            database.Measurement, measurement_id
        )

        assert saved_measurement is not None
        assert saved_measurement.sci_score == 7.0


# 2. Test missing measurement

@pytest.mark.asyncio
async def test_missing_measurement(setup_measurement_db):
    _, service_id, _ = setup_measurement_db

    service = SCIService()

    with pytest.raises(KeyError, match="No measurement found"):
        await service.process_sci_calculation(service_id + 999)


# 3. Test missing measurement values

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field",
    ["energy_used", "embodied_emissions", "functional_unit"]
)
async def test_missing_measurement_data(
    setup_measurement_db, field
):
    engine, service_id, _ = setup_measurement_db

    with Session(engine) as session:
        measurement = session.query(
            database.Measurement
        ).filter_by(service_id=service_id).first()

        setattr(measurement, field, None)
        session.commit()

    service = SCIService()

    with pytest.raises(ValueError, match="invalid calculation data"):
        await service.process_sci_calculation(service_id)


# 4. Test invalid measurement values

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field, value",
    [
        ("energy_used", -10.0),
        ("embodied_emissions", -20.0),
        ("functional_unit", 0.0),
    ]
)
async def test_invalid_measurement_data(
    setup_measurement_db, field, value
):
    _, service_id, _ = setup_measurement_db

    engine = setup_measurement_db[0]

    with Session(engine) as session:
        measurement = session.query(
            database.Measurement
        ).filter_by(service_id=service_id).first()

        setattr(measurement, field, value)
        session.commit()

    service = SCIService()
    service.grid_adapter.fetch_live_grid_intensity = lambda: 0.5

    with pytest.raises(ValueError):
        await service.process_sci_calculation(service_id)
