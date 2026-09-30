/* ============================================================
   VSCARZ  ·  landing.js  (hero road FX + lineup rendering)
   ============================================================ */

(function heroFX() {
  const cv = document.getElementById("roadfx");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = 1, stars = [], streaks = [], horizon = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.max(1, W * DPR); cv.height = Math.max(1, H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    horizon = H * 0.52;
    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W, y: Math.random() * horizon,
      r: Math.random() * 1.5 + .3, s: Math.random() * 0.6 + 0.15
    }));
    streaks = Array.from({ length: 60 }, () => newStreak(true));
  }

  function newStreak(seed) {
    return {
      z: seed ? Math.random() : 1,
      lane: (Math.random() * 2 - 1),
      sp: 0.0028 + Math.random() * 0.006
    };
  }

  let t = 0;
  function frame() {
    ctx.clearRect(0, 0, W, H);

    // stars
    for (const s of stars) {
      s.y += s.s;
      if (s.y > horizon) { s.y = 0; s.x = Math.random() * W; }
      ctx.globalAlpha = .25 + (s.y / horizon) * .65;
      ctx.fillStyle = "#cfe6ff";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // sun glow
    const g = ctx.createRadialGradient(W * .5, horizon, 0, W * .5, horizon, H * .5);
    g.addColorStop(0, "rgba(255,90,160,.30)");
    g.addColorStop(.45, "rgba(123,92,255,.13)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ground
    ctx.fillStyle = "rgba(6,8,16,.72)";
    ctx.fillRect(0, horizon, W, H - horizon);

    // road
    const roadW = W * .46;
    const rg = ctx.createLinearGradient(0, horizon, 0, H);
    rg.addColorStop(0, "rgba(20,26,44,.15)");
    rg.addColorStop(1, "rgba(12,16,28,.95)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(W * .5 - roadW * .04, horizon);
    ctx.lineTo(W * .5 + roadW * .04, horizon);
    ctx.lineTo(W * .5 + roadW * .62, H);
    ctx.lineTo(W * .5 - roadW * .62, H);
    ctx.closePath(); ctx.fill();

    // lane streaks racing toward the camera
    for (const s of streaks) {
      s.z += s.sp;
      if (s.z >= 1) Object.assign(s, newStreak(false));
      const p = s.z * s.z;
      const y = horizon + (H - horizon) * p;
      const hw = (roadW * .04) + (roadW * .58) * p;
      const a = Math.min(1, p * 1.4) * .8;
      for (const off of [-.33, 0, .33]) {
        ctx.globalAlpha = a * (off === 0 ? 1 : .55);
        ctx.fillStyle = off === 0 ? "#00e5ff" : "#7b5cff";
        const x = W * .5 + hw * off;
        const hgt = 2 + 34 * p;
        ctx.fillRect(x - (1 + 5 * p), y - hgt, 2 + 10 * p, hgt);
      }
    }
    ctx.globalAlpha = 1;

    // edge light lines
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(W * .5 + side * roadW * .04, horizon);
      ctx.lineTo(W * .5 + side * roadW * .62, H);
      ctx.strokeStyle = "rgba(0,229,255,.55)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // horizon line
    ctx.fillStyle = "rgba(255,255,255,.30)";
    ctx.fillRect(0, horizon - 1, W, 2);

    t += 1;
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  frame();
})();

/* ---------------- Ticker ---------------- */
(function ticker() {
  const el = document.getElementById("ticker");
  if (!el) return;
  const items = [
    "◆ 8 Tracks", "◆ 6 Cars", "◆ Nitro Boost", "◆ Drift Combo x5", "◆ Checkpoints",
    "◆ Off-road Penalty", "◆ Near-miss Bonus", "◆ Driver Ranks", "◆ 3 Time-of-Day Palettes",
    "◆ Storm + Rain Weather", "◆ Neon Night City", "◆ 500 Starting Points", "◆ Save Your Progress"
  ];
  const html = items.map(i => `<div>${i}</div>`).join("");
  el.innerHTML = html + html;
})();

/* ---------------- Lineup ---------------- */
(function lineup() {
  const g = document.getElementById("carGrid");
  if (g) g.innerHTML = window.VSCARZ_DATA.CARS.map(c => carCardHTML(c)).join("");
})();

/* ---------------- Tracks ---------------- */
(function tracks() {
  const g = document.getElementById("trackGrid");
  if (!g) return;
  g.innerHTML = window.VSCARZ_DATA.LEVELS.map(lv => {
    const th = window.VSCARZ_DATA.THEMES[lv.theme];
    const unlocked = window.VS.isLevelUnlocked(lv);
    const best = window.VS.save.best[lv.id];
    return `
    <div class="card track ${unlocked ? "" : "locked"}">
      <div class="no" style="${levelNoStyle(lv)}">${lv.n}</div>
      <div>
        <h3>${lv.name}</h3>
        <p style="color:var(--dim);font-size:14px">${th.name} · ${lv.len}m${best ? " · Best " + window.VS.fmtNum(best.score) : ""}</p>
        <div class="meta">
          <span class="chip">Reward <b>${window.VS.fmtNum(lv.reward)}</b></span>
          <span class="chip">Traffic <b>${Math.round(lv.traffic * 100)}%</b></span>
          <span class="chip">Rank <b>${lv.unlock}</b></span>
        </div>
      </div>
      ${unlocked
        ? `<a class="btn btn-primary" href="play.html?lv=${lv.id}">Race</a>`
        : `<div style="text-align:center"><div style="font-size:26px">🔒</div><div style="font-size:12px;color:var(--dim);margin-top:6px">Rank ${lv.unlock}</div></div>`}
    </div>`;
  }).join("");
})();
