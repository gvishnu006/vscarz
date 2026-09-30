/* ============================================================
   VSCARZ  ·  site.js  (shared UI helpers for landing + garage)
   ============================================================ */

function toast(msg, kind) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = "show " + (kind || "");
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ""), 2600);
}

function barsHTML(car) {
  const rows = [["SPD", "speed"], ["ACC", "accel"], ["GRP", "grip"], ["NTR", "nitro"]];
  return rows.map(([label, key]) => `
    <div class="bar">
      <span>${label}</span>
      <span class="t"><i style="width:${(car.stats[key] / 10) * 100}%"></i></span>
      <span class="n">${car.stats[key]}</span>
    </div>`).join("");
}

function tierClass(tier) {
  return tier === "Starter" ? "t-starter" : tier === "Pro" ? "t-pro" : "t-legend";
}

function carCardHTML(car, opts) {
  opts = opts || {};
  const owned = window.VS.ownsCar(car.id);
  const eq = window.VS.save.selected === car.id;
  return `
  <div class="card carcard ${opts.sel ? "sel" : ""}" data-car="${car.id}" ${opts.clickable ? 'style="cursor:pointer"' : ""}>
    <div class="top" style="--c1:${car.body}">
      <span class="tier ${tierClass(car.tier)}">${car.tier}</span>
      ${owned ? `<span class="own-tag ${eq ? "eq" : ""}">${eq ? "Equipped" : "Owned"}</span>` : ""}
      <img src="${car.sprite}" alt="${car.name}" loading="lazy">
    </div>
    <div class="body">
      <h3>${car.name}</h3>
      <div class="tagline">${car.tagline}</div>
      <div class="bars">${barsHTML(car)}</div>
      <div class="price">${car.price === 0 ? "FREE" : window.VS.fmtNum(car.price) + " pts"}</div>
    </div>
  </div>`;
}

function levelNoStyle(level) {
  const th = window.VSCARZ_DATA.THEMES[level.theme];
  return `background:linear-gradient(150deg, ${th.sky[2]}, ${th.sky[1]})`;
}

function renderHud() {
  const bar = document.getElementById("hudbar");
  if (bar) {
    const s = window.VS.save;
    const p = window.VS.xpProgress();
    bar.innerHTML = `
      <div class="card">
        <img src="${window.VS.selectedCar().sprite}" alt="" style="width:56px">
        <div><div class="k">Driving</div><div class="v">${window.VS.selectedCar().name}</div></div>
      </div>
      <div class="card">
        <div><div class="k">Points</div><div class="v" style="color:var(--gold)">${window.VS.fmtNum(s.points)}</div></div>
      </div>
      <div class="card xpbar">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-end">
          <div><div class="k">Driver Rank ${s.driverLevel} · ${window.VS.title()}</div>
          <div class="v" style="font-size:15px">${window.VS.fmtNum(p.cur)} / ${window.VS.fmtNum(p.need)} XP</div></div>
          <a class="btn btn-primary" style="padding:9px 18px;font-size:13px" href="play.html">RACE</a>
        </div>
        <div class="track"><div class="fill" style="width:${(p.pct * 100).toFixed(1)}%"></div></div>
      </div>`;
  }
  const np = document.getElementById("navPts");
  if (np) np.textContent = window.VS.fmtNum(window.VS.save.points);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set("sPts", window.VS.fmtNum(window.VS.save.points));
  set("sLv", "Lv " + window.VS.save.driverLevel);
  set("sTracks", window.VSCARZ_DATA.LEVELS.length);
  set("sCars", window.VSCARZ_DATA.CARS.length);
}

window.addEventListener("vscarz:save", renderHud);

document.addEventListener("DOMContentLoaded", () => {
  renderHud();
  const mb = document.getElementById("menuBtn");
  const nl = document.getElementById("navLinks");
  if (mb && nl) mb.addEventListener("click", () => nl.classList.toggle("open"));
  document.addEventListener("click", e => {
    if (nl && e.target.closest(".nav-links a")) nl.classList.remove("open");
  });
});
