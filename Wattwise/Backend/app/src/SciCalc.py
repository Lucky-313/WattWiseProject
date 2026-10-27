def calculate_sci(energy_kwh, carbon_intensity, embodied_emissions, functional_units):
    # Return SCI using energy, grid intensity, emissions, and unit count.
    #checks values are allowed
    if energy_kwh < 0:

        raise ValueError("Energy cannot be negative")

    if carbon_intensity < 0:

        raise ValueError("Carbon intensity cannot be negative")


    if embodied_emissions < 0:

        raise ValueError("Embodied emissions cannot be negative")

    if functional_units <= 0:

        raise ValueError("Functional units must be greater than zero")

    #Calculates SCI - ((E * I) + M) / R
    sci = ((energy_kwh * carbon_intensity) + embodied_emissions) / functional_units

    return sci
