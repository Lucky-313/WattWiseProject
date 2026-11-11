function createDemoSeries() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    const wave = Math.sin(index * 0.58);
    const energy = 12.5 + 2.2 * Math.sin(index * 0.39) + (index % 5) * 0.35;
    const intensity = 240 + 62 * wave + (index % 4) * 11;
    const apiCalls =
      82000 + (index % 7) * 5400 + Math.round(9000 * Math.cos(index * 0.31));
    const embodied = 180 + (index % 6) * 24 + Math.round(45 * Math.sin(index * 0.27));
    const emissions = (energy * intensity + embodied) / 1000;

    return {
      date,
      apiCalls,
      energy,
      intensity,
      embodied,
      emissions,
      sci: (energy * intensity + embodied) / apiCalls,
    };
  });
}

export const DEMO_SERIES = createDemoSeries();
