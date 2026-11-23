"""Unit tests for SciCalc.calculate_sci."""
import pytest

from SciCalc import calculate_sci


class TestCalculateSci:
    def test_basic_calculation(self):
        sci = calculate_sci(energy_kwh=100, carbon_intensity=0.5, embodied_emissions=20, functional_units=10)
        expected = ((100 * 0.5) + 20) / 10  # 70 / 10 = 7.0
        assert sci == expected

    def test_negative_energy_raises(self):
        with pytest.raises(ValueError, match="Energy cannot be negative"):
            calculate_sci(energy_kwh=-10, carbon_intensity=0.5, embodied_emissions=20, functional_units=10)

    def test_negative_carbon_intensity_raises(self):
        with pytest.raises(ValueError, match="Carbon intensity cannot be negative"):
            calculate_sci(energy_kwh=100, carbon_intensity=-0.5, embodied_emissions=20, functional_units=10)

    def test_negative_embodied_emissions_raises(self):
        with pytest.raises(ValueError, match="Embodied emissions cannot be negative"):
            calculate_sci(energy_kwh=100, carbon_intensity=0.5, embodied_emissions=-20, functional_units=10)

    def test_zero_functional_units_raises(self):
        with pytest.raises(ValueError, match="Functional units must be greater than zero"):
            calculate_sci(energy_kwh=100, carbon_intensity=0.5, embodied_emissions=20, functional_units=0)

    def test_negative_functional_units_raises(self):
        with pytest.raises(ValueError, match="Functional units must be greater than zero"):
            calculate_sci(energy_kwh=100, carbon_intensity=0.5, embodied_emissions=20, functional_units=-5)

    def test_result_is_float(self):
        sci = calculate_sci(energy_kwh=10, carbon_intensity=0.3, embodied_emissions=5, functional_units=2)
        assert isinstance(sci, float)