// Three well-known real landing sites, written for someone meeting lunar landing sites for the
// first time. Each site teaches one idea: an easy equatorial plain, the far side with no view of
// Earth, and the hard, low-Sun south polar region.
//
// Coordinates are from published sources and are registered in docs/CREDITS.md section 5.
// Do not edit them from memory.

export type FamousSite = {
  id: string;
  mission: string;
  placeName: string;
  agency: string;
  landed: string;
  crew: string;
  latDeg: number;
  lonDeg: number;
  region: string;
  /** One-line reason this site is in the list. */
  lesson: string;
  purpose: string;
  sunlight: string;
  earthView: string;
  ground: string;
};

export const FAMOUS_SITES: FamousSite[] = [
  {
    id: "apollo-11",
    mission: "Apollo 11",
    placeName: "Tranquility Base",
    agency: "NASA · United States",
    landed: "20 July 1969",
    crew: "Crewed · 2 astronauts on the surface",
    latDeg: 0.67416,
    lonDeg: 23.47314,
    region: "Near side · close to the equator · Sea of Tranquility",
    lesson: "The easy case: flat ground, with Earth always overhead.",
    purpose: "Land people on the Moon for the first time and bring them home safely, so the safest ground was chosen.",
    sunlight:
      "About 14 Earth days of daylight, then 14 of night. The landing was timed for early lunar morning, when a low Sun gives long shadows that make rocks and craters easy to see.",
    earthView: "Earth stays high in the sky all the time, so a direct radio link is always possible.",
    ground: "A smooth, dark lava plain with gentle slopes and few large boulders.",
  },
  {
    id: "change-4",
    mission: "Chang'e 4",
    placeName: "Von Kármán crater",
    agency: "CNSA · China",
    landed: "3 January 2019",
    crew: "Robotic · lander and Yutu-2 rover",
    latDeg: -45.457,
    lonDeg: 177.589,
    region: "Far side · South Pole-Aitken basin",
    lesson: "The far side: plenty of sunlight, but Earth is never in the sky.",
    purpose: "Make the first ever landing on the far side and study one of the oldest, deepest impact basins on the Moon.",
    sunlight: "A normal day-night cycle: about 14 Earth days of daylight followed by 14 days of darkness and deep cold.",
    earthView:
      "Never visible. The Moon itself blocks the way, so every message travels through a relay satellite parked beyond the Moon.",
    ground: "The fairly flat floor of a large old crater, inside a much bigger basin, dotted with small craters.",
  },
  {
    id: "chandrayaan-3",
    mission: "Chandrayaan-3",
    placeName: "Statio Shiv Shakti",
    agency: "ISRO · India",
    landed: "23 August 2023",
    crew: "Robotic · Vikram lander and Pragyan rover",
    latDeg: -69.373,
    lonDeg: 32.319,
    region: "Near side · south polar region, about 600 km from the pole",
    lesson: "Towards the pole: the Sun and Earth both stay low, and terrain starts to hide them.",
    purpose: "Show a soft landing far from the equator and measure the soil and temperature of the south polar region.",
    sunlight:
      "The Sun never climbs high, so shadows are always long. The mission was planned to work for one lunar day, about 14 Earth days.",
    earthView: "Earth sits low above the northern horizon, where hills and crater rims can block the link.",
    ground: "Rough highland terrain between craters; a level patch had to be picked carefully.",
  },
];
