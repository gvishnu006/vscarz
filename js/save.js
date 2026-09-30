/* ============================================================
   VSCARZ  ·  save.js   (points, driver level, garage, records)
   Progress is stored in localStorage — no server needed.
   ============================================================ */

const D = window.VSCARZ_DATA;
const SAVE_KEY = "vscarz.save.v1";

function xpNeeded(level) {
  const l = Math.max(0, level - 1);
  return Math.round(600 + 400 * l + 90 * l * l);
}

function freshSave(withBonus) {
  return {
    v: 1,
    firstRun: false,
    points: withBonus ? D.ECONOMY.startPoints : 0,
    xp: 0,
    driverLevel: 1,
    owned: ["swift"],
    selected: "swift",
    races: 0,
    wins: 0,
    crashes: 0,
    bestScore: 0,
    bestDrift: 0,
    totalDistance: 0,
    best: {},            // levelId -> { score, time, drift }
    records: {},         // carId -> { races, best, wins }
    settings: { sfx: true, music: true, shake: true, quality: "high" }
  };
}

let SAVE = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave(true);          // first ever visit: welcome bonus
    const parsed = JSON.parse(raw);
    const s = Object.assign(freshSave(false), parsed);
    s.settings = Object.assign(freshSave(false).settings, parsed.settings || {});
    if (!Array.isArray(s.owned) || !s.owned.length) s.owned = ["swift"];
    if (!s.owned.includes(s.selected)) s.selected = s.owned[0];
    if (typeof s.points !== "number" || !isFinite(s.points)) s.points = 0;
    if (typeof s.xp !== "number" || !isFinite(s.xp)) s.xp = 0;
    if (typeof s.driverLevel !== "number" || s.driverLevel < 1) s.driverLevel = 1;
    return s;
  } catch (e) {
    return freshSave(true);
  }
}

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("vscarz:save"));
}

// write the first save straight away so progress survives a refresh
persist();

function getCar(id) {
  return D.CARS.find(c => c.id === id) || D.CARS[0];
}
function selectedCar() { return getCar(SAVE.selected); }
function ownsCar(id) { return SAVE.owned.includes(id); }

function xpProgress() {
  const base = xpNeeded(SAVE.driverLevel);
  const into = SAVE.xp - xpTotalBefore(SAVE.driverLevel);
  return { cur: into, need: base, pct: Math.max(0, Math.min(1, into / base)) };
}
function xpTotalBefore(level) {
  let t = 0;
  for (let i = 1; i < level; i++) t += xpNeeded(i);
  return t;
}
function title() {
  return D.DRIVER_TITLES[Math.min(D.DRIVER_TITLES.length - 1, SAVE.driverLevel - 1)];
}

function isLevelUnlocked(level) { return SAVE.driverLevel >= level.unlock; }

function buyCar(id) {
  const car = getCar(id);
  if (ownsCar(id)) return { ok: false, msg: "Already in your garage." };
  if (SAVE.points < car.price) return { ok: false, msg: "Not enough points." };
  SAVE.points -= car.price;
  SAVE.owned.push(id);
  SAVE.selected = id;
  persist();
  return { ok: true, msg: car.name + " unlocked!" };
}

function equipCar(id) {
  if (!ownsCar(id)) return { ok: false, msg: "You do not own that car." };
  SAVE.selected = id;
  persist();
  return { ok: true, msg: getCar(id).name + " equipped." };
}

function recordRun(res) {
  // res: { levelId, carId, score, drift, distance, time, finished, health }
  const pts = Math.round(res.score * D.ECONOMY.pointPerScore * (res.finished ? 1 : D.ECONOMY.levelUpKeepPoints));
  const xp = Math.round(res.score * D.ECONOMY.xpPerScore);
  const before = SAVE.driverLevel;

  SAVE.points += pts;
  SAVE.xp += xp;
  SAVE.races++;
  SAVE.totalDistance += Math.round(res.distance);
  SAVE.bestScore = Math.max(SAVE.bestScore, Math.round(res.score));
  SAVE.bestDrift = Math.max(SAVE.bestDrift, Math.round(res.drift));
  if (res.finished) SAVE.wins++;
  else SAVE.crashes++;

  const lv = SAVE.best[res.levelId];
  if (!lv || res.score > lv.score) {
    SAVE.best[res.levelId] = { score: Math.round(res.score), time: res.time, drift: Math.round(res.drift) };
  }
  const rec = SAVE.records[res.carId] || { races: 0, best: 0, wins: 0 };
  rec.races++;
  rec.wins += res.finished ? 1 : 0;
  rec.best = Math.max(rec.best, Math.round(res.score));
  SAVE.records[res.carId] = rec;

  let levelsGained = 0;
  while (SAVE.xp >= xpTotalBefore(SAVE.driverLevel) + xpNeeded(SAVE.driverLevel)) {
    SAVE.driverLevel++;
    levelsGained++;
  }
  persist();
  return { points: pts, xp: xp, levelsGained, driverLevel: SAVE.driverLevel, fromLevel: before };
}

function resetAll() {
  SAVE = freshSave(true);
  persist();
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}
function fmtNum(n) { return Math.round(n).toLocaleString("en-US"); }

window.VS = {
  get save() { return SAVE; },
  D, K, getCar, selectedCar, ownsCar, xpNeeded, xpProgress, title,
  isLevelUnlocked, buyCar, equipCar, recordRun, resetAll, persist,
  fmtTime, fmtNum
};
