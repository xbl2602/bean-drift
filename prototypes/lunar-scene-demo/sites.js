// The places you can stand: one list for the home page (cards), nav.js (location menu) and the scene loaders.
// Add a place here, give it a page (lola.html / apollo11.html set window.__SITE) and it shows up everywhere.

// The Earth meshes are built once around this fixed spot in the sky and then moved by the time slider (scene-three.js).
// Real angular radius is ~0.95 deg; drawn 1.7x larger so it still reads at a 46 deg field of view.
export const LUNAR_SKY = { earth: { az: 108, el: 4.2, dist: 45000, angRad: 1.6 }, skyRadius: 55000 };
export const LUNAR_VIEW = { fov: 46, near: 0.1, far: 60000 };

export const SITES = [
  {
    id: 'pole', href: 'lola.html', page: 'lola.html', spot: '',
    name: 'South Pole', nameZh: '月球南极', where: '90°S · rim of Shackleton crater',
    blurb: 'Standing on the pole itself. The Sun skims the horizon, the crater floor next door never sees daylight, and Earth is hidden behind the terrain most of the year.',
    data: 'NASA LOLA laser altimetry, 10 m/px', tags: ['polar', 'permanent shadow'], thumb: 'thumbs/pole.jpg',
  },
  {
    id: 'pole-a', href: 'lola.html?spot=a', page: 'lola.html', spot: 'a',
    name: 'South Pole · Ridge A', nameZh: '南极 · 平缓地带 A', where: '89.71°S, 62.5°E · 8.9 km from the pole',
    blurb: 'Gentle ground picked from the real terrain: the Sun is above the horizon 72% of the year and Earth 79%, both at once 55%.',
    data: 'NASA LOLA laser altimetry, 10 m/px', tags: ['polar', 'power + comms'], thumb: 'thumbs/pole-a.jpg',
  },
  {
    id: 'pole-b', href: 'lola.html?spot=b', page: 'lola.html', spot: 'b',
    name: 'South Pole · Ridge B', nameZh: '南极 · 平缓地带 B', where: '89.61°S, 75.8°E · 11.9 km from the pole',
    blurb: 'Even flatter (mean slope 3.4°), with a little less sunlight: Sun 63% of the year, Earth 60%.',
    data: 'NASA LOLA laser altimetry, 10 m/px', tags: ['polar', 'flat'], thumb: 'thumbs/pole-b.jpg',
  },
  {
    id: 'apollo11', href: 'apollo11.html', page: 'apollo11.html', spot: '',
    name: 'Apollo 11 · Tranquility Base', nameZh: '赤道 · 阿波罗 11 号静海基地', where: '0.67°N, 23.47°E · Mare Tranquillitatis',
    blurb: 'The equator: a two-week day and a two-week night, the Sun climbing all the way overhead, Earth hanging high in the sky and never setting.',
    data: 'LROC NAC stereo terrain model, 2 m/px', tags: ['equatorial', 'day / night'], thumb: 'thumbs/apollo11.jpg',
  },
];

// which entry is this page? (page file name + ?spot=)
export const currentSite = () => {
  const file = location.pathname.split('/').pop() || 'index.html', spot = new URLSearchParams(location.search).get('spot') || '';
  return SITES.find((s) => s.page === file && s.spot === spot) || SITES.find((s) => s.page === file) || null;
};
