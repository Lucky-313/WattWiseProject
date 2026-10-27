import { useState } from "react";

export default function Simulation() {
  const [energy, setEnergy] = useState(50);
  const [intensity, setIntensity] = useState(50);
  const [embodied, setEmbodied] = useState(50);
  const [units, setUnits] = useState(50);

  const sliders = [
    ["Energy (E)", energy, setEnergy],
    ["Carbon intensity (I)", intensity, setIntensity],
    ["Embodied emissions (M)", embodied, setEmbodied],
    ["Functional units (R)", units, setUnits],
  ];

  function reset() {
    setEnergy(50);
    setIntensity(50);
    setEmbodied(50);
    setUnits(50);
  }

  return (
    <section>
      <h2>Simulation</h2>
      <p>Move the sliders to see how changes could affect the SCI score.</p>

      {sliders.map(([label, value, setValue]) => (
        <div key={label}>
          <label>
            {label}:{" "}
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />{" "}
            {value}%
          </label>
        </div>
      ))}

      <div>
        <button onClick={reset}>Reset</button>
      </div>

      <h3>Original SCI</h3>
      <p>--</p>
      <h3>Simulated SCI</h3>
      <p>--</p>
      <h3>Difference</h3>
      <p>-- %</p>
    </section>
  );
}
