/* ============================================================
   VSCARZ  ·  garage.js  (showroom turntable + shop)
   ============================================================ */

(function () {
  const D = window.VSCARZ_DATA;
  let selected = window.VS.save.selected;
  if (!selected) selected = D.CARS[0].id;

  const el = id => document.getElementById(id);

  function show(id) {
    selected = id;
    const car = window.VS.getCar(id);
    const owned = window.VS.ownsCar(id);
    const equipped = window.VS.save.selected === id;

    el("showImg").src = car.sprite;
    el("showCar").style.setProperty("--c1", car.body);
    el("stageBig").style.setProperty("--c1", car.body);
    el("showPlate").textContent = car.name.replace("VSCARZ ", "");
    el("shName").textContent = car.name;
    el("shTier").textContent = car.tier;
    el("shTier").className = "chip " + tierClass(car.tier);
    el("shPrice").textContent = car.price === 0 ? "FREE" : window.VS.fmtNum(car.price) + " pts";
    el("shDesc").textContent = car.tagline;
    el("shSpeed").innerHTML = car.topSpeed + ' <small style="font-size:12px">km/h</small>';
    el("shAccel").innerHTML = car.zeroTo.toFixed(1) + ' <small style="font-size:12px">s</small>';
    el("shBars").innerHTML = barsHTML(car);

    const rec = window.VS.save.records[id];
    const buy = el("btnBuy"), drive = el("btnDrive"), note = el("shNote");

    if (owned) {
      buy.textContent = equipped ? "Equipped" : "Equip this car";
      buy.disabled = equipped;
      drive.disabled = false;
      note.innerHTML = rec
        ? `Races ${rec.races} · Wins ${rec.wins} · Best ${window.VS.fmtNum(rec.best)}`
        : "Owned. Take it out and set a record.";
    } else {
      buy.textContent = window.VS.save.points >= car.price
        ? `Buy for ${window.VS.fmtNum(car.price)} pts`
        : `Need ${window.VS.fmtNum(car.price - window.VS.save.points)} more pts`;
      buy.disabled = window.VS.save.points < car.price;
      drive.disabled = true;
      note.textContent = "Not owned yet — buy it with points from racing.";
    }
    paintGrid();
  }

  function paintGrid() {
    el("shopGrid").innerHTML = D.CARS.map(c => carCardHTML(c, { sel: c.id === selected, clickable: true })).join("");
    el("shopGrid").querySelectorAll("[data-car]").forEach(n => {
      n.addEventListener("click", () => {
        show(n.dataset.car);
        el("showroom").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  el("btnBuy").addEventListener("click", () => {
    const car = window.VS.getCar(selected);
    const res = window.VS.ownsCar(selected)
      ? window.VS.equipCar(selected)
      : window.VS.buyCar(selected);
    toast(res.msg, res.ok ? "good" : "bad");
    renderHud();
    show(selected);
  });

  el("btnDrive").addEventListener("click", () => {
    if (!window.VS.ownsCar(selected)) return;
    const r = window.VS.equipCar(selected);
    if (!r.ok) return toast(r.msg, "bad");
    renderHud();
    location.href = "play.html";
  });

  el("btnReset").addEventListener("click", () => {
    if (confirm("Reset ALL progress? Points, ranks, cars and records will be deleted.")) {
      window.VS.resetAll();
      selected = "swift";
      renderHud();
      show("swift");
      paintRecords();
      toast("Progress reset", "good");
    }
  });

  function paintRecords() {
    const s = window.VS.save;
    el("records").innerHTML =
      `Races <b>${s.races}</b> · Wins <b>${s.wins}</b> · Crashes <b>${s.crashes}</b> · ` +
      `Distance <b>${window.VS.fmtNum(s.totalDistance)}m</b> · ` +
      `Best score <b>${window.VS.fmtNum(s.bestScore)}</b> · Best drift <b>${window.VS.fmtNum(s.bestDrift)}</b>` +
      (s.races ? "" : " — head to the track.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    show(selected);
    paintRecords();
  });
})();
