export const TOUR_SEEN_KEY = "lunar-quest:guided-tour:v2";
export const TOUR_STEPS = [
  { target: "ai", title: "Start with AI Tools", icon: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z", body: "Open AI Tools for shortcuts to lunar questions. The conversational assistant is not connected in this panel yet." },
  { target: "explore", title: "Find and explore a location", icon: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15", body: "Search for a place or coordinates, save a landing-site marker, or measure a path between points. Opening another toolbar closes the previous one." },
  { target: "analysis", title: "Understand and compare sites", icon: "M5 20V10m7 10V4m7 16v-7M3 20h18", body: "Science shows terrain, sunlight and other surface layers. Evaluate helps you score, compare and export saved sites. Save at least two sites to compare them; model layers are estimates." },
  { target: "views", title: "Choose 2D or 3D", icon: "M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", body: "Use 2D to pan across the flat map, or 3D to orbit the Moon. Scroll or pinch to zoom. Click the surface outside a selection tool to enter first person." },
  { target: "timeline", title: "Watch the light change", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 2", body: "Slide the timeline or press Play to move through time and watch sunlight and shadows change. Now returns to the current time. All times are UTC." },
  { target: null, title: "Enjoy Lunar Quest!", icon: "m5 12 4 4L19 6", body: "Thank you for taking the tutorial. Enjoy exploring our platform! Home resets the view while keeping saved sites. Choose Tutorial whenever you want to replay this guide." },
] as const;
