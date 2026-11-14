export const STORY_CHAPTERS = [
  {
    id: "moon", index: "01", label: "Moon", heading: "Read the surface before you land.",
    cards: [
      { kind: "survey", title: "Every site, measured." },
      { kind: "horizon", title: "Stand there first." },
    ],
  },
  {
    id: "earth", index: "02", label: "Earth", heading: "Stay in touch with home.",
    cards: [
      { kind: "forecast", title: "A forecast for the Moon." },
      { kind: "clock", title: "Track the mission clock." },
    ],
  },
  {
    id: "sun", index: "03", label: "Sun", heading: "Plan around the light.",
    cards: [{ kind: "goal", title: "Set your mission goal." }],
  },
] as const;
