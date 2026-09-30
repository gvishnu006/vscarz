/* ============================================================
   VSCARZ  ·  data.js
   All game content in one place. Edit freely.
   ============================================================ */

const CARS = [
  {
    id: "swift",
    name: "VSCARZ Swift",
    tier: "Starter",
    tagline: "Your first ride. Light, honest, quick to learn.",
    price: 0,
    stats: { speed: 3, accel: 4, grip: 5, nitro: 3 },
    body: "#2f7cf6",
    accent: "#9fd0ff",
    rim: "#e8eefc",
    sprite: "assets/cars/swift.svg",
    topSpeed: 188,
    zeroTo: 7.1
  },
  {
    id: "vortex",
    name: "VSCARZ Vortex",
    tier: "Pro",
    tagline: "Mid-engine balance that eats corners for breakfast.",
    price: 1200,
    stats: { speed: 5, accel: 5, grip: 5, nitro: 5 },
    body: "#17c9a3",
    accent: "#b6fff0",
    rim: "#f2fffb",
    sprite: "assets/cars/vortex.svg",
    topSpeed: 226,
    zeroTo: 5.4
  },
  {
    id: "blaze",
    name: "VSCARZ Blaze",
    tier: "Pro",
    tagline: "Straight-line violence with a huge rear wing.",
    price: 2400,
    stats: { speed: 7, accel: 6, grip: 4, nitro: 6 },
    body: "#ff7a1a",
    accent: "#ffd7a8",
    rim: "#fff4e6",
    sprite: "assets/cars/blaze.svg",
    topSpeed: 262,
    zeroTo: 4.3
  },
  {
    id: "nitrox",
    name: "VSCARZ Nitro-X",
    tier: "Pro",
    tagline: "Built for the drift king. Ice cold steering, huge boost.",
    price: 3800,
    stats: { speed: 6, accel: 7, grip: 3, nitro: 10 },
    body: "#c026d3",
    accent: "#f7c6ff",
    rim: "#fdeaff",
    sprite: "assets/cars/nitrox.svg",
    topSpeed: 248,
    zeroTo: 3.9
  },
  {
    id: "phantom",
    name: "VSCARZ Phantom GT",
    tier: "Legend",
    tagline: "Long hood, twin turbos, terrifying top end.",
    price: 8500,
    stats: { speed: 9, accel: 8, grip: 6, nitro: 7 },
    body: "#1f2a44",
    accent: "#8ea2d8",
    rim: "#dbe6ff",
    sprite: "assets/cars/phantom.svg",
    topSpeed: 306,
    zeroTo: 3.2
  },
  {
    id: "hyperion",
    name: "VSCARZ Hyperion S",
    tier: "Legend",
    tagline: "The flagship. Carbon everything, active aero, no mercy.",
    price: 14500,
    stats: { speed: 10, accel: 10, grip: 8, nitro: 9 },
    body: "#f5c518",
    accent: "#fff3b0",
    rim: "#ffffff",
    sprite: "assets/cars/hyperion.svg",
    topSpeed: 348,
    zeroTo: 2.6
  }
];

/* ---------------- LEVELS / TRACKS ---------------- */

const THEMES = {
  dawn: {
    name: "Desert Dawn",
    sky: ["#1b1030", "#5b2a4e", "#e0764a"],
    ground: "#a07a45",
    groundAlt: "#966f3d",
    groundLine: "#c19a5d",
    road: "#4a4f5c",
    roadAlt: "#454a57",
    edge: "#e9edf5",
    rumble: ["#e5484d", "#f6f7fb"],
    lane: "#f2f4f8",
    fog: "#e8a06a",
    props: ["rock", "cactus", "bush"],
    weather: "dust",
    lights: false
  },
  sunset: {
    name: "Sunset Ridge",
    sky: ["#2a1250", "#a02a5c", "#ff9a4a"],
    ground: "#4e7a3a",
    groundAlt: "#486f34",
    groundLine: "#6c9c4b",
    road: "#464b58",
    roadAlt: "#414652",
    edge: "#f0f3fa",
    rumble: ["#f2f2f2", "#d94f4f"],
    lane: "#ffe9a8",
    fog: "#ff9f6b",
    props: ["pine", "bush", "rock"],
    weather: "none",
    lights: false
  },
  nightcity: {
    name: "Neon City",
    sky: ["#03040c", "#0b1030", "#241a5c"],
    ground: "#1a2130",
    groundAlt: "#171d2a",
    groundLine: "#232c3d",
    road: "#262b36",
    roadAlt: "#22272f",
    edge: "#4de2ff",
    rumble: ["#39e0ff", "#7b5cff"],
    lane: "#ffd166",
    fog: "#3a2f7a",
    props: ["building", "neon", "bush"],
    weather: "none",
    lights: true
  },
  rain: {
    name: "Rain Forest",
    sky: ["#0d1a16", "#1d3a30", "#2f5a48"],
    ground: "#2c5c3a",
    groundAlt: "#285434",
    groundLine: "#3a7048",
    road: "#3a4046",
    roadAlt: "#353b41",
    edge: "#d8e6e0",
    rumble: ["#e9f3ef", "#3f8f5f"],
    lane: "#e8fff2",
    fog: "#5d8f78",
    props: ["pine", "palm", "bush"],
    weather: "rain",
    lights: true
  },
  mountain: {
    name: "Mountain Pass",
    sky: ["#101a2e", "#2c3f5e", "#7f9dc0"],
    ground: "#5a5f68",
    groundAlt: "#545962",
    groundLine: "#6d737d",
    road: "#3d424c",
    roadAlt: "#383d46",
    edge: "#eef2f8",
    rumble: ["#e05a4a", "#f2f4f8"],
    lane: "#ffffff",
    fog: "#8fa6bd",
    props: ["rock", "pine", "guard"],
    weather: "none",
    lights: false
  },
  storm: {
    name: "Storm Highway",
    sky: ["#070a12", "#141c2b", "#2b3a4f"],
    ground: "#2a3038",
    groundAlt: "#262b33",
    groundLine: "#343b45",
    road: "#333840",
    roadAlt: "#2e333b",
    edge: "#dfe7f2",
    rumble: ["#f0f3f8", "#3b4756"],
    lane: "#ffd166",
    fog: "#4a5a70",
    props: ["guard", "wind", "rock"],
    weather: "storm",
    lights: true
  },
  canyon: {
    name: "Canyon Run",
    sky: ["#2b1020", "#7a2a20", "#e07a3c"],
    ground: "#8a4a2c",
    groundAlt: "#7f4327",
    groundLine: "#a35c36",
    road: "#4a4038",
    roadAlt: "#443b33",
    edge: "#f6e6d6",
    rumble: ["#e5484d", "#f6efe6"],
    lane: "#ffe0b2",
    fog: "#d1804a",
    props: ["rock", "cactus", "boulder"],
    weather: "dust",
    lights: false
  },
  grandprix: {
    name: "VSCARZ Grand Prix",
    sky: ["#05060f", "#101a3d", "#2a3a7a"],
    ground: "#15161f",
    groundAlt: "#13141c",
    groundLine: "#1e2030",
    road: "#2b2d38",
    roadAlt: "#272932",
    edge: "#7ee8ff",
    rumble: ["#ffffff", "#ff3d81"],
    lane: "#ffffff",
    fog: "#33407a",
    props: ["stand", "banner", "neon"],
    weather: "sparks",
    lights: true
  }
};

const LEVELS = [
  { id: "lv1",  n: 1, name: "Dusty Outpost",  theme: "dawn",       len: 1500, diff: 1, reward: 220,  unlock: 1, traffic: 0.30, gap: 200 },
  { id: "lv2",  n: 2, name: "Sunset Ridge",   theme: "sunset",     len: 1900, diff: 1, reward: 320,  unlock: 2, traffic: 0.38, gap: 185 },
  { id: "lv3",  n: 3, name: "Neon City",      theme: "nightcity",  len: 2300, diff: 2, reward: 460,  unlock: 3, traffic: 0.46, gap: 170 },
  { id: "lv4",  n: 4, name: "Rain Forest",    theme: "rain",       len: 2700, diff: 2, reward: 620,  unlock: 4, traffic: 0.52, gap: 160 },
  { id: "lv5",  n: 5, name: "Mountain Pass",  theme: "mountain",   len: 3100, diff: 3, reward: 820,  unlock: 6, traffic: 0.58, gap: 152 },
  { id: "lv6",  n: 6, name: "Storm Highway",   theme: "storm",      len: 3500, diff: 4, reward: 1050, unlock: 8, traffic: 0.64, gap: 145 },
  { id: "lv7",  n: 7, name: "Canyon Run",     theme: "canyon",     len: 4000, diff: 4, reward: 1350, unlock: 10, traffic: 0.70, gap: 138 },
  { id: "lv8",  n: 8, name: "Grand Prix",     theme: "grandprix",  len: 4600, diff: 5, reward: 2000, unlock: 12, traffic: 0.78, gap: 130 }
];

/* ---------------- ECONOMY ---------------- */

const ECONOMY = {
  pointPerScore: 0.6,     // spendable currency from a run
  xpPerScore: 0.4,        // driver level progress from a run
  levelUpKeepPoints: 0.55,// crash penalty: keep this share of points
  checkpointPoints: 200,
  nearMissPoints: 30,
  startPoints: 500        // welcome bonus, first time only
};

const DRIVER_TITLES = [
  "Rookie", "Pocket Racer", "Street Runner", "Circuit Rookie", "Tuner",
  "Drift Ace", "Grid Fighter", "Pro Driver", "Elite Racer", "Track Master",
  "Grand Prix Legend", "VSCARZ Champion"
];

/* ---------------- ENGINE CONSTANTS ---------------- */

const K = {
  VW: 1280, VH: 720,
  TRACK_W: 760,
  ZOOM: 0.8,
  HORIZON: 150,
  PLAYER_Y: 568,
  DEPTH: 460,
  DRAW: 3400,
  SLICES: 150,
  CAR_W: 140,
  CAR_H: 232,
  CAR_HIT_W: 96,
  CAR_HIT_H: 176,
  OFFROAD_MARGIN: 42,
  KMH: 0.2
};

window.VSCARZ_DATA = { CARS, LEVELS, THEMES, ECONOMY, DRIVER_TITLES, K };
