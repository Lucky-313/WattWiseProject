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
    const emissions = (energy * intensity) / 1000;

    return {
      date,
      apiCalls,
      energy,
      intensity,
      emissions,
      sci: (emissions * 1000) / apiCalls,
    };
  });
}

export const DEMO_SERIES = createDemoSeries();
