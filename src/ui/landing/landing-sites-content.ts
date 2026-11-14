// Three well-known real landing sites, written for someone meeting lunar landing sites for the
// first time. Each card keeps only four facts: coordinates, where, who and purpose.
//
// Coordinates are from published sources and are registered in docs/CREDITS.md section 5.
// Photos are NASA Lunar Reconnaissance Orbiter camera images (also in docs/CREDITS.md).
// Do not edit coordinates from memory.

export type FamousSite = {
  id: string;
  mission: string;
  placeName: string;
  landed: string;
  latDeg: number;
  lonDeg: number;
  where: string;
  who: string;
  purpose: string;
  photo: { src: string; alt: string; caption: string };
};

export const FAMOUS_SITES: FamousSite[] = [
  {
    id: "apollo-11",
    mission: "Apollo 11",
    placeName: "Tranquility Base",
    landed: "20 July 1969",
    latDeg: 0.67416,
    lonDeg: 23.47314,
    where: "Near side · Sea of Tranquility",
    who: "NASA, USA · 2 astronauts on the surface",
    purpose: "First people on the Moon, so the flattest, safest ground was chosen.",
    photo: {
      src: "/landing/site-apollo-11-lroc.png",
      alt: "Orbiter photo of the Apollo 11 landing site, with the lander and equipment labelled",
      caption: "Seen from orbit · the lander (LM) and its equipment are labelled",
    },
  },
  {
    id: "change-4",
    mission: "Chang'e 4",
    placeName: "Von Kármán crater",
    landed: "3 January 2019",
    latDeg: -45.457,
    lonDeg: 177.589,
    where: "Far side · South Pole-Aitken basin",
    who: "CNSA, China · lander and Yutu-2 rover",
    purpose: "First landing on the far side, to study one of the oldest, deepest basins.",
    photo: {
      src: "/landing/site-change-4-lroc.png",
      alt: "Orbiter photo of the Chang'e 4 landing site with arrows pointing at the lander and the rover",
      caption: "Seen from orbit · arrows mark the lander and rover, 468 m across",
    },
  },
  {
    id: "chandrayaan-3",
    mission: "Chandrayaan-3",
    placeName: "Statio Shiv Shakti",
    landed: "23 August 2023",
    latDeg: -69.373,
    lonDeg: 32.319,
    where: "Near side · south polar region, about 600 km from the pole",
    who: "ISRO, India · Vikram lander and Pragyan rover",
    purpose: "Show a soft landing near the pole and measure the soil and its temperature.",
    photo: {
      src: "/landing/site-chandrayaan-3-lroc.png",
      alt: "Orbiter photo of rough, crater-dotted highland ground around the Chandrayaan-3 lander at the centre",
      caption: "Seen from orbit · the lander sits at the centre, 1,738 m across",
    },
  },
];
