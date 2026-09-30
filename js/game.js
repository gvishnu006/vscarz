/* ============================================================
   VSCARZ  ·  game.js
   Top-down land racing engine (custom canvas renderer)
   ============================================================ */

(function () {
  "use strict";

  const D = window.VSCARZ_DATA;
  const K = window.VS.K;
  const num = n => Math.round(n).toLocaleString("en-US");
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  const $ = id => document.getElementById(id);
  const stage = $("stage"), cv = $("cv"), ctx = cv.getContext("2d", { alpha: false });

  /* ============================================================
     AUDIO
     ============================================================ */
  const A = { ctx: null, o1: null, o2: null, g: null, f: null, noise: null, started: false, muted: false };
  function audioStart() {
    if (A.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC();
      A.g = A.ctx.createGain(); A.g.gain.value = 0.0001; A.g.connect(A.ctx.destination);
      A.f = A.ctx.createBiquadFilter(); A.f.type = "lowpass"; A.f.frequency.value = 900; A.f.Q.value = 3;
      A.f.connect(A.g);
      A.o1 = A.ctx.createOscillator(); A.o1.type = "sawtooth"; A.o1.frequency.value = 60; A.o1.connect(A.f); A.o1.start();
      A.o2 = A.ctx.createOscillator(); A.o2.type = "square"; A.o2.frequency.value = 30; A.o2.connect(A.f); A.o2.start();
      A.started = true;
    } catch (e) { A.started = false; }
  }
  function audioEngine(rpm, load, on) {
    if (!A.started || A.muted) return;
    const t = A.ctx.currentTime;
    A.o1.frequency.setTargetAtTime(42 + rpm * 150, t, .08);
    A.o2.frequency.setTargetAtTime(21 + rpm * 74, t, .08);
    A.f.frequency.setTargetAtTime(320 + rpm * 2100 + load * 500, t, .1);
    A.g.gain.setTargetAtTime(on ? .035 + load * .05 : .012, t, .12);
  }
  function blip(freq, dur, type, vol) {
    if (!A.started || A.muted) return;
    try {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || .12, A.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, A.ctx.currentTime + dur);
      o.connect(g); g.connect(A.ctx.destination); o.start(); o.stop(A.ctx.currentTime + dur + .02);
    } catch (e) {}
  }
  function boom() {
    if (!A.started || A.muted) return;
    try {
      const n = A.ctx.createBufferSource();
      const buf = A.ctx.createBuffer(1, A.ctx.sampleRate * .34, A.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.6);
      n.buffer = buf;
      const f = A.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400;
      const g = A.ctx.createGain(); g.gain.value = .34;
      n.connect(f); f.connect(g); g.connect(A.ctx.destination); n.start();
    } catch (e) {}
  }

  /* ============================================================
     SPRITES
     ============================================================ */
  const IMG = {};
  function loadImg(url) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    });
  }

  /* ============================================================
     STATE
     ============================================================ */
  const S = {
    mode: "menu",            // menu | count | race | paused | end
    level: null, theme: null, car: null,
    t: 0, last: 0, raf: 0,
    y: 0, x: 0, camX: 0,
    speed: 0, latVel: 0, steer: 0,
    nitro: 1, hp: 100, drift: 0, drifting: false, boosting: false,
    score: 0, driftPts: 0, combo: 1, comboTimer: 0,
    checkpoints: 0, cpNext: 0, passed: new Set(),
    time: 0, shake: 0, flash: 0, hitFlash: 0, offroad: false,
    objects: [], particles: [], marks: [], pops: [],
    parallax: 0, rain: [], lightning: 0, finished: false,
    amp: [190, 66, 28], wl: [2700, 880, 410], ph: [0, 0, 0],
    par: 60, result: null, muted: false
  };

  /* ============================================================
     TRACK MATH
     ============================================================ */
  function centerAt(y) {
    return S.amp[0] * Math.sin(y / S.wl[0] + S.ph[0])
         + S.amp[1] * Math.sin(y / S.wl[1] + S.ph[1])
         + S.amp[2] * Math.sin(y / S.wl[2] + S.ph[2]);
  }
  function slopeAt(y) {
    return S.amp[0] / S.wl[0] * Math.cos(y / S.wl[0] + S.ph[0])
         + S.amp[1] / S.wl[1] * Math.cos(y / S.wl[1] + S.ph[1])
         + S.amp[2] / S.wl[2] * Math.cos(y / S.wl[2] + S.ph[2]);
  }
  function halfAt(y) {
    return (K.TRACK_W / 2) * (1 + 0.055 * Math.sin(y / 1450 + S.ph[1]));
  }
  const projK = d => K.DEPTH / (K.DEPTH + d);
  const projY = k => K.HORIZON + (K.PLAYER_Y - K.HORIZON) * Math.pow(k, 0.9);
  const projX = (wx, k) => K.VW / 2 + (wx - S.camX) * k * K.ZOOM;

  /* ============================================================
     TRACK BUILD
     ============================================================ */
  const THEME_PROP = { dawn: ["rock", "cactus", "bush"], sunset: ["pine", "bush", "rock"], nightcity: ["building", "neon", "bush"], rain: ["pine", "palm", "bush"], mountain: ["rock", "pine", "guardrail"], storm: ["guardrail", "wind", "rock"], canyon: ["rock", "cactus", "boulder"], grandprix: ["stand", "banner", "neon"] };
  const SOLID_TYPES = { block: 1, rock: 1, boulder: 1, tree: 1, pine: 1, palm: 1, cactus: 1, building: 1, stand: 1, banner: 1, neon: 1, guardrail: 1 };
  const SMASH_TYPES = { cone: 1, barrel: 1, tyre: 1 };
  const OBSTACLES = ["cone", "barrel", "block", "tyre"];

  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function buildTrack(level, seed) {
    const R = rng(seed);
    S.objects.length = 0;
    const len = level.len;
    const props = THEME_PROP[level.theme] || THEME_PROP.dawn;
    const dense = 34 + level.diff * 5;

    // --- roadside scenery ---
    for (let y = -500; y < len + 900; y += dense + R() * dense) {
      const hw = halfAt(y), c = centerAt(y);
      for (let side = -1; side <= 1; side += 2) {
        const type = props[(R() * props.length) | 0];
        if (type === "guardrail") {
          S.objects.push({ t: "guardrail", x: c + side * (hw + 34), y: y, sz: 165, r: 0, v: 0, prop: 1 });
          continue;
        }
        const off = hw + 90 + R() * 900;
        S.objects.push({
          t: type, x: c + side * off, y: y + (R() - .5) * dense,
          sz: 70 + R() * 95, r: R() * 6.28, v: R(), prop: 1
        });
        if (R() < .35) {
          S.objects.push({
            t: props[(R() * props.length) | 0], x: c + side * (hw + 120 + R() * 1000),
            y: y + (R() - .5) * dense, sz: 60 + R() * 80, r: R() * 6.28, v: R(), prop: 1
          });
        }
      }
      if (S.theme.lights && (Math.round(y / dense) % 3 === 0)) {
        for (let side = -1; side <= 1; side += 2) {
          S.objects.push({ t: "lamp", x: c + side * (hw + 52), y: y, sz: 150, r: 0, v: 0, prop: 1 });
        }
      }
    }

    // --- checkpoints ---
    const cpGap = 780;
    for (let y = cpGap; y < len; y += cpGap) {
      S.objects.push({ t: "gate", x: centerAt(y), y: y, sz: 0, r: 0, v: 0, prop: 0, cp: S.objects.filter(o => o.t === "gate").length + 1 });
    }
    S.objects.push({ t: "finish", x: centerAt(len), y: len, sz: 0, r: 0, v: 0, prop: 0 });

    // --- traffic + obstacles ---
    let gap = level.gap;
    for (let y = 520; y < len - 260; y += gap) {
      gap = level.gap * (0.78 + R() * 0.5);
      const hw = halfAt(y), c = centerAt(y);
      const laneW = (hw * 2) / 3;
      // keep at least one lane clear
      const blocked = [];
      const count = 1 + (R() < level.traffic * .55 ? 1 : 0) + (R() < level.traffic * .25 ? 1 : 0);
      let tries = 0;
      while (blocked.length < count && tries++ < 12) {
        const lane = (R() * 3) | 0;
        if (blocked.includes(lane)) continue;
        blocked.push(lane);
        const x = c - hw + laneW * (lane + .5);
        const isCar = R() < .52;
        S.objects.push({
          t: isCar ? "car" : OBSTACLES[(R() * OBSTACLES.length) | 0],
          x: x + (R() - .5) * 40, y: y, sz: isCar ? 150 : 76,
          r: 0, v: 0, prop: 0,
          col: isCar ? ["#e5484d", "#f2b705", "#2f7cf6", "#17c9a3", "#c9c9d4", "#7b5cff"][(R() * 6) | 0] : null,
          vy: isCar ? 170 + R() * 260 : 0, dead: 0, spin: 0
        });
      }
    }
    S.objects.sort((a, b) => a.y - b.y);
  }

  /* ============================================================
     SETUP
     ============================================================ */
  function pickLevel(id) {
    const lv = D.LEVELS.find(l => l.id === id);
    if (!lv) return D.LEVELS[0];
    return lv;
  }
  function unlockedDefault() {
    const s = window.VS.save;
    for (let i = D.LEVELS.length - 1; i >= 0; i--) {
      const lv = D.LEVELS[i];
      if (window.VS.isLevelUnlocked(lv) && !s.best[lv.id]) return lv;
    }
    for (let i = D.LEVELS.length - 1; i >= 0; i--) if (window.VS.isLevelUnlocked(D.LEVELS[i])) return D.LEVELS[i];
    return D.LEVELS[0];
  }

  function loadLevel(id) {
    S.level = pickLevel(id);
    S.theme = D.THEMES[S.level.theme];
    S.par = S.level.len / 620 + 12;
    const seed = 1000 + S.level.n * 977;
    const R = rng(seed);
    S.amp = [120 + S.level.diff * 26 + R() * 60, 40 + S.level.diff * 9, 14 + S.level.diff * 5];
    S.wl = [2300 + R() * 1500, 700 + R() * 500, 340 + R() * 180];
    S.ph = [R() * 6.28, R() * 6.28, R() * 6.28];
    buildTrack(S.level, seed);

    S.rain = Array.from({ length: 220 }, () => ({
      x: R(), y: R(), s: 0.6 + R() * 0.8, l: 0.05 + R() * 0.09
    }));
  }

  function resetRun() {
    S.y = 0; S.x = centerAt(0); S.camX = S.x;
    S.speed = 0; S.latVel = 0; S.steer = 0;
    S.nitro = 1; S.hp = 100; S.drift = 0; S.drifting = false; S.boosting = false;
    S.score = 0; S.driftPts = 0; S.combo = 1; S.comboTimer = 0;
    S.checkpoints = 0; S.passed.clear();
    S.time = 0; S.shake = 0; S.flash = 0; S.hitFlash = 0; S.offroad = false;
    S.particles.length = 0; S.marks.length = 0; S.pops.length = 0;
    S.finished = false; S.result = null; S.lightning = 0; S.goT = 0; S._lastCount = null;
  }

  /* ============================================================
     INPUT
     ============================================================ */
  const KEY = { up: 0, down: 0, left: 0, right: 0, nitro: 0, drift: 0 };
  const MAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ShiftLeft: "nitro", ShiftRight: "nitro",
    Space: "drift"
  };
  addEventListener("keydown", e => {
    audioStart();
    const k = MAP[e.code];
    if (k) { KEY[k] = 1; e.preventDefault(); }
    if (e.code === "KeyR") doRestart();
    if (e.code === "Escape") togglePause();
    if (e.code === "KeyM") toggleMute();
    if (e.code === "Enter" || e.code === "Space") {
      if (S.mode === "menu") startRace();
      else if (S.mode === "end") { /* handled by buttons */ }
    }
  });
  addEventListener("keyup", e => { const k = MAP[e.code]; if (k) { KEY[k] = 0; e.preventDefault(); } });
  addEventListener("blur", () => { for (const k in KEY) KEY[k] = 0; if (S.mode === "race") togglePause(); });

  // touch
  document.querySelectorAll("#touch .tb").forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); audioStart(); KEY[k] = 1; b.classList.add("act"); };
    const off = e => { e.preventDefault(); KEY[k] = 0; b.classList.remove("act"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  });
  if (matchMedia("(pointer: coarse)").matches) $("touch").classList.add("on");

  /* ============================================================
     PARTICLES
     ============================================================ */
  function part(x, y, vx, vy, life, size, col, kind) {
    if (S.particles.length > 460) S.particles.shift();
    S.particles.push({ x, y, vx, vy, l: life, L: life, s: size, c: col, k: kind || "smoke" });
  }
  function pop(text, col, sx, sy) {
    if (S.pops.length > 14) S.pops.shift();
    S.pops.push({ t: text, c: col, x: sx === undefined ? K.VW / 2 : sx, y: sy === undefined ? K.PLAYER_Y - 130 : sy, l: 1.15, L: 1.15 });
  }

  /* ============================================================
     UPDATE
     ============================================================ */
  function update(dt) {
    const car = S.car, th = S.theme;

    if (S.mode === "count") {
      S.count -= dt;
      if (S.count <= 0) { S.mode = "race"; S.goT = .8; blip(880, .18, "square", .16); }
      return;
    }
    if (S.mode !== "race") return;
    if (S.goT > 0) { S.goT -= dt; centreOn("GO!", ""); if (S.goT <= 0) centreOff(); }

    S.time += dt;

    const maxBase = 690 + car.stats.speed * 56;
    const accel = 185 + car.stats.accel * 44;
    const boost = (KEY.nitro && S.nitro > .02) ? 1 : 0;
    S.boosting = !!boost;
    const offroadPenalty = S.offroad ? 0.42 : 1;
    const maxS = maxBase * offroadPenalty * (boost ? 1.2 : 1);

    if (boost) S.nitro = Math.max(0, S.nitro - dt * .3);
    else S.nitro = Math.min(1, S.nitro + dt * .085);

    // longitudinal
    if (KEY.up) S.speed += accel * (boost ? 1.75 : 1) * dt;
    if (KEY.down) S.speed -= (S.speed > 0 ? 1050 : -1) * dt * (S.speed > 0 ? 1 : -0.5);
    if (S.speed > 0) {
      S.speed -= S.speed * (KEY.up ? 0.16 : 0.72) * dt;
      S.speed -= 0.00030 * S.speed * S.speed * dt;
    } else S.speed = Math.min(0, S.speed + 260 * dt);
    if (S.offroad) S.speed -= 260 * dt;
    S.speed = clamp(S.speed, -230, maxS);

    // steering
    const sin = (KEY.right ? 1 : 0) - (KEY.left ? 1 : 0);
    S.steer = lerp(S.steer, sin, Math.min(1, dt * 9));
    S.drifting = !!KEY.drift && S.speed > 220;
    if (S.drifting) S.speed -= 170 * dt;

    const grip = 0.72 + car.stats.grip * 0.055;
    const latT = S.steer * (118 + Math.abs(S.speed) * 0.30) * (S.drifting ? 1.5 : 1) * grip;
    S.latVel = lerp(S.latVel, latT, Math.min(1, dt * (S.drifting ? 3.1 : 7.6)));
    S.x += S.latVel * dt;
    S.x -= slopeAt(S.y) * S.speed * dt * 0.95;           // centrifugal push

    S.y += S.speed * dt;
    const c = centerAt(S.y), hw = halfAt(S.y);
    S.x = clamp(S.x, c - hw - 620, c + hw + 620);

    const wasOff = S.offroad;
    S.offroad = Math.abs(S.x - c) > hw - K.OFFROAD_MARGIN;
    if (S.offroad && !wasOff) { S.shake = Math.max(S.shake, 4); pop("OFF ROAD", "#ff6b6b"); }
    S.camX = lerp(S.camX, c * 0.82 + S.x * 0.18, Math.min(1, dt * 6));

    // drift
    const ang = Math.abs(S.latVel) / 240;
    S.drift = clamp((ang - 0.22) / 0.9, 0, 1) * (S.drifting ? 1 : 0.55) * clamp(S.speed / 700, 0, 1);
    if (S.drift > 0.14) {
      S.driftPts += S.drift * S.speed * dt * 1.15;
      S.score += S.drift * S.speed * dt * 1.15 * S.combo;
      S.combo = Math.min(5, S.combo + dt * 0.7);
      S.comboTimer = 1.7;
      if (S.drifting) {
        const k = K.ZOOM;
        S.marks.push({ x: S.x - 42, y: S.y - 60, a: 1 });
        S.marks.push({ x: S.x + 42, y: S.y - 60, a: 1 });
        if (S.marks.length > 420) S.marks.splice(0, 120);
        if (Math.random() < .9) part(S.x - 42, S.y - 60, (Math.random() - .5) * 70, -50 - Math.random() * 90, .7, 16 + Math.random() * 18, S.offroad ? "#c8a06a" : "#c9d2e4", "smoke");
        if (Math.random() < .9) part(S.x + 42, S.y - 60, (Math.random() - .5) * 70, -50 - Math.random() * 90, .7, 16 + Math.random() * 18, S.offroad ? "#c8a06a" : "#c9d2e4", "smoke");
      }
    } else {
      S.comboTimer -= dt;
      if (S.comboTimer <= 0) S.combo = Math.max(1, S.combo - dt * 2.2);
    }

    // on-road distance points
    if (!S.offroad && S.speed > 0) S.score += S.speed * dt * 0.5;

    // nitro / offroad particles
    if (S.boosting) {
      part(S.x, S.y - 105, (Math.random() - .5) * 40, -260 - Math.random() * 160, .34, 20 + Math.random() * 16, "#4de2ff", "flame");
      if (Math.random() < .4) part(S.x + (Math.random() - .5) * 90, S.y - 100, 0, -120, .3, 10, "#ffffff", "flame");
    }
    if (S.offroad && Math.abs(S.speed) > 120 && Math.random() < .8) {
      part(S.x + (Math.random() - .5) * 130, S.y - 70, (Math.random() - .5) * 130, -40 - Math.random() * 120, .8, 18 + Math.random() * 22, th.groundLine, "smoke");
    }
    if (S.theme.weather === "rain" && Math.random() < .5) {
      part(S.x + (Math.random() - .5) * 200, S.y - 100, 0, -260, .3, 4, "#bfe9ff", "rain");
    }

    // world
    for (const o of S.objects) {
      if (o.vy) { o.y += o.vy * dt; if (o.y > S.level.len + 1200) o.dead = 1; }
      if (o.dead) continue;
      const dy = o.y - S.y;
      if (dy < -260 || dy > K.DRAW) continue;
      if (S.passed.has(o)) continue;
      if (dy < 0) {                                   // passed the player
        if (o.t === "gate") { onCheckpoint(o); continue; }
        if (o.t === "finish") { onFinish(); continue; }
        if (!o.prop) {
          const gap = Math.abs(o.x - S.x);
          if (gap < 105) {
            S.score += D.ECONOMY.nearMissPoints * S.combo;
            S.combo = Math.min(5, S.combo + .35);
            S.comboTimer = 1.7;
            S.nitro = Math.min(1, S.nitro + .07);
            pop("NEAR MISS  +" + Math.round(D.ECONOMY.nearMissPoints * S.combo), "#2fe0a8");
            blip(660, .07, "triangle", .08);
          }
        }
        S.passed.add(o);
        continue;
      }
      // collision
      const hx = K.CAR_HIT_W / 2, hy = K.CAR_HIT_H / 2;
      const ow = o.t === "car" ? 78 : o.prop ? 44 : 40;
      const oh = o.t === "car" ? 150 : o.prop ? 44 : 40;
      if (Math.abs(o.x - S.x) < hx + ow && Math.abs(dy) < hy + oh) collide(o);
    }

    // particles / marks / pops
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.l -= dt;
      if (p.l <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - dt * 1.2); p.vy *= (1 - dt * .8);
    }
    for (const m of S.marks) m.a -= dt * 0.22;
    while (S.marks.length && S.marks[0].a <= 0) S.marks.shift();
    for (let i = S.pops.length - 1; i >= 0; i--) {
      const q = S.pops[i];
      q.l -= dt; q.y -= dt * 46;
      if (q.l <= 0) S.pops.splice(i, 1);
    }

    S.shake = Math.max(0, S.shake - dt * 22);
    S.hitFlash = Math.max(0, S.hitFlash - dt * 2.4);
    S.flash = Math.max(0, S.flash - dt * 3);
    if (S.theme.weather === "storm" && Math.random() < .0025) { S.lightning = 1; boom(); }
    S.lightning = Math.max(0, S.lightning - dt * 3.4);

    audioEngine(clamp(S.speed / (maxBase || 1), 0, 1), KEY.up ? 1 : 0, true);

    // finished?
    if (S.hp <= 0) onCrash();
  }

  function onCheckpoint(o) {
    S.passed.add(o);
    S.checkpoints++;
    const pts = D.ECONOMY.checkpointPoints * (1 + S.level.diff * .35);
    S.score += pts;
    S.nitro = Math.min(1, S.nitro + .38);
    S.hp = Math.min(100, S.hp + 7);
    S.flash = .55;
    pop("CHECKPOINT  +" + Math.round(pts), "#00e5ff");
    blip(1046, .12, "triangle", .14);
    setTimeout(() => blip(1568, .1, "triangle", .1), 90);
  }

  function collide(o) {
    const spd = Math.abs(S.speed);
    if (SMASH_TYPES[o.t]) {
      o.dead = 1;
      S.speed *= 0.965;
      S.score += 12 * S.combo;
      for (let i = 0; i < 12; i++) part(o.x, o.y, (Math.random() - .5) * 340, (Math.random() - .5) * 340, .5, 8 + Math.random() * 8, i % 2 ? "#ffb020" : "#ffffff", "spark");
      S.shake = Math.max(S.shake, 3);
      blip(220, .06, "square", .07);
      S.passed.add(o);
      return;
    }
    if (S.passed.has(o)) return;
    S.passed.add(o);
    const heavy = 16 + spd * 0.012;
    S.hp -= heavy;
    S.speed *= -0.24;
    S.latVel = (o.x > S.x ? -1 : 1) * 260;
    S.shake = 16;
    S.hitFlash = 1;
    S.combo = 1;
    boom();
    pop("CRASH  -" + Math.round(heavy), "#ff4d4d");
    for (let i = 0; i < 30; i++) part(o.x, o.y, (Math.random() - .5) * 620, (Math.random() - .5) * 620, .7, 6 + Math.random() * 12, i % 3 ? "#ffb020" : "#ffffff", "spark");
    if (o.t === "car") { o.vy = 0; o.dead = 1; }
  }

  function onFinish() {
    if (S.finished) return;
    S.finished = true;
    const timeBonus = Math.max(0, (S.par - S.time)) * 55;
    const hpBonus = S.hp * 8;
    const reward = S.level.reward;
    const bonus = timeBonus + hpBonus + reward;
    S.score += bonus;
    endRun(true, { timeBonus, hpBonus, reward });
  }

  function onCrash() {
    if (S.finished) return;
    S.finished = true;
    endRun(false, {});
  }

  function endRun(finished, extra) {
    S.mode = "end";
    audioEngine(0, 0, false);
    const out = window.VS.recordRun({
      levelId: S.level.id, carId: S.car.id,
      score: S.score, drift: S.driftPts, distance: S.y,
      time: S.time, finished: finished, health: S.hp
    });
    S.result = { finished, extra, out, score: S.score, drift: S.driftPts, dist: S.y, time: S.time, hp: S.hp, cps: S.checkpoints, par: S.par };
    showResults();
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  let SKY = [];
  function buildSky() {
    let sd = 99;
    const R = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    SKY = Array.from({ length: 90 }, () => ({ h: R(), w: R(), d: R() < .5 ? -1 : 1 }));
  }
  buildSky();

  function drawSky() {
    const th = S.theme;
    const g = ctx.createLinearGradient(0, 0, 0, K.HORIZON + 30);
    g.addColorStop(0, th.sky[0]);
    g.addColorStop(.55, th.sky[1]);
    g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, K.VW, K.HORIZON + 30);

    if (th.lights) {
      ctx.save(); ctx.globalAlpha = .8;
      for (let i = 0; i < 70; i++) {
        const s = SKY[i];
        const x = ((s.w * K.VW * 1.4) - S.y * 0.00016 * s.d + K.VW * 4) % K.VW;
        const y = s.h * (K.HORIZON - 14);
        ctx.fillStyle = i % 7 ? "rgba(255,255,255,.8)" : "rgba(180,220,255,.9)";
        ctx.fillRect(x, y, 1.6, 1.6);
      }
      ctx.restore();
    }

    // sun / moon
    const sunX = K.VW * 0.5, sunY = K.HORIZON - 30;
    const rg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 190);
    rg.addColorStop(0, th.lights ? "rgba(230,240,255,.85)" : "rgba(255,240,200,.95)");
    rg.addColorStop(.22, th.lights ? "rgba(190,215,255,.28)" : "rgba(255,190,120,.5)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg; ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = th.lights ? "#e9f1ff" : "#fff3d0";
    ctx.beginPath(); ctx.arc(sunX, sunY, th.lights ? 20 : 30, 0, 6.2832); ctx.fill();

    drawSkyline();
  }

  function sky(i) { return SKY[((i % SKY.length) + SKY.length) % SKY.length]; }

  function drawSkyline() {
    const th = S.theme;
    const city = S.level.theme === "nightcity" || S.level.theme === "grandprix";
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.00016 * (layer + 1) * 1.7;
      const off = (S.y * par) % 640;
      ctx.fillStyle = layer ? "rgba(0,0,0,.30)" : "rgba(0,0,0,.48)";
      ctx.beginPath();
      ctx.moveTo(-40, K.HORIZON + 2);
      for (let i = -1; i < 26; i++) {
        const s = sky(i * 3 + layer * 11);
        const x = i * 56 - off;
        const hgt = (city ? 26 + s.w * 120 : 24 + s.h * 110) * (layer ? .68 : 1);
        if (city) {
          ctx.lineTo(x, K.HORIZON - hgt); ctx.lineTo(x + 46, K.HORIZON - hgt);
        } else {
          ctx.lineTo(x + 26, K.HORIZON - hgt); ctx.lineTo(x + 52, K.HORIZON);
        }
      }
      ctx.lineTo(K.VW + 60, K.HORIZON + 2);
      ctx.closePath(); ctx.fill();
      // window lights
      if (th.lights && city) {
        ctx.fillStyle = "rgba(255,214,120,.5)";
        for (let i = 0; i < 60; i++) {
          const s = sky(i * 7 + layer * 3);
          const x = ((i * 37 - off * 1.0) % (K.VW + 60) + K.VW + 60) % (K.VW + 60) - 30;
          const hgt = 26 + s.w * 120;
          ctx.fillRect(x, K.HORIZON - hgt + 8 + s.h * (hgt - 20), 2.5, 3.5);
        }
      }
    }
    // fog band on the horizon
    const fg = ctx.createLinearGradient(0, K.HORIZON - 70, 0, K.HORIZON + 10);
    fg.addColorStop(0, "rgba(0,0,0,0)");
    fg.addColorStop(1, hexA(S.theme.fog, .75));
    ctx.fillStyle = fg; ctx.fillRect(0, K.HORIZON - 70, K.VW, 80);
  }

  function hexA(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  let SL = [];
  function buildSlices() {
    const N = K.SLICES;
    SL.length = N + 1;
    for (let i = 0; i <= N; i++) {
      const k = Math.pow(i / N, 2.35);
      const d = K.DEPTH * (1 - k) / k;
      SL[i] = SL[i] || {};
      SL[i].k = k; SL[i].d = d;
    }
  }
  buildSlices();

  function drawGround() {
    const th = S.theme;
    ctx.fillStyle = th.ground;
    ctx.fillRect(0, K.HORIZON, K.VW, K.VH - K.HORIZON);

    for (let i = 0; i < K.SLICES; i++) {
      const a = SL[i], b = SL[i + 1];
      const dmid = (a.d + b.d) / 2;
      ctx.fillStyle = (Math.floor(dmid / 300) % 2) ? th.groundAlt : th.ground;
      const ya = projY(a.k), yb = projY(b.k);
      ctx.fillRect(0, ya, K.VW, yb - ya + 1);
      // texture speckles
      if (i % 2 === 0) {
        const hash = (Math.floor(dmid / 60) * 2654435761) >>> 0;
        for (let j = 0; j < 3; j++) {
          const hx = (hash * (j + 3)) % 1000 / 1000;
          const x = hx * K.VW;
          ctx.globalAlpha = .16;
          ctx.fillStyle = th.groundLine;
          ctx.fillRect(x, ya, 3 + hx * 26, Math.max(1.5, (yb - ya) * .4));
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawRoad() {
    const th = S.theme, N = K.SLICES;
    // rumble outer
    for (let i = 0; i < N; i++) {
      const a = SL[i], b = SL[i + 1];
      const ya = projY(a.k), yb = projY(b.k);
      const ca = centerAt(S.y + a.d), cb = centerAt(S.y + b.d);
      const ha = halfAt(S.y + a.d), hb = halfAt(S.y + b.d);
      const l1 = projX(ca - ha, a.k), r1 = projX(ca + ha, a.k);
      const l2 = projX(cb - hb, b.k), r2 = projX(cb + hb, b.k);
      const band = Math.floor(((a.d + b.d) / 2) / 105) % 2;
      ctx.fillStyle = th.rumble[band];
      const oa = 34 * a.k, ob = 34 * b.k;
      ctx.beginPath();
      ctx.moveTo(l1 - oa, ya); ctx.lineTo(l1, ya); ctx.lineTo(l2, yb); ctx.lineTo(l2 - ob, yb);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r1 + oa, ya); ctx.lineTo(r1, ya); ctx.lineTo(r2, yb); ctx.lineTo(r2 + ob, yb);
      ctx.closePath(); ctx.fill();
    }
    // surface
    for (let i = 0; i < N; i++) {
      const a = SL[i], b = SL[i + 1];
      const ya = projY(a.k), yb = projY(b.k);
      const ca = centerAt(S.y + a.d), cb = centerAt(S.y + b.d);
      const ha = halfAt(S.y + a.d), hb = halfAt(S.y + b.d);
      const l1 = projX(ca - ha, a.k), r1 = projX(ca + ha, a.k);
      const l2 = projX(cb - hb, b.k), r2 = projX(cb + hb, b.k);
      ctx.fillStyle = (Math.floor(((a.d + b.d) / 2) / 210) % 2) ? th.road : th.roadAlt;
      ctx.beginPath();
      ctx.moveTo(l1, ya); ctx.lineTo(r1, ya); ctx.lineTo(r2, yb); ctx.lineTo(l2, yb);
      ctx.closePath(); ctx.fill();
    }
    // edge lines + lane dashes
    ctx.lineWidth = Math.max(1, 4);
    ctx.strokeStyle = th.edge;
    ctx.globalAlpha = .85;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= N; i += 2) {
        const a = SL[i], wy = S.y + a.d;
        const x = projX(centerAt(wy) + sgn * halfAt(wy), a.k), y = projY(a.k);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = .8;
    ctx.strokeStyle = th.lane;
    ctx.lineWidth = Math.max(1, 3.4);
    for (const sgn of [-1, 1]) {
      ctx.setLineDash([46, 46]);
      ctx.lineDashOffset = -(S.y % 92);
      ctx.beginPath();
      for (let i = 0; i <= N; i += 2) {
        const a = SL[i], wy = S.y + a.d;
        const x = projX(centerAt(wy) + sgn * halfAt(wy) / 3, a.k), y = projY(a.k);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawMarks() {
    if (!S.marks.length) return;
    ctx.fillStyle = "rgba(20,20,26,.42)";
    for (const m of S.marks) {
      const d = m.y - S.y;
      if (d < -40 || d > 420) continue;
      const k = projK(d);
      const x = projX(m.x, k), y = projY(k);
      ctx.globalAlpha = Math.max(0, m.a) * .8;
      ctx.fillRect(x - 5 * k, y, 10 * k, Math.max(2, 26 * k));
    }
    ctx.globalAlpha = 1;
  }

  function drawObject(o) {
    const d = o.y - S.y;
    const k = projK(d);
    const x = projX(o.x, k), y = projY(k);
    const s = k * K.ZOOM;
    if (x < -260 || x > K.VW + 260 || y < K.HORIZON - 20 || y > K.VH + 120) return;

    if (o.t === "gate" || o.t === "finish") { drawGate(o, x, y, k, d); return; }

    const sz = o.sz * s;
    if (sz < 1.2) return;
    ctx.save();
    ctx.translate(x, y + sz * .5);
    // ground shadow
    ctx.globalAlpha = .3;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(0, 0, sz * .34, sz * .12, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    switch (o.t) {
      case "pine": prop(0, 0, sz * .8, "#1f5c39", "#2f7d4d", 1); break;
      case "tree": prop(0, 0, sz * .85, "#2b6b3a", "#3f8f4f", 0); break;
      case "palm": prop(0, 0, sz * .8, "#8a6a2a", "#3f8f4f", 2); break;
      case "cactus": prop(0, 0, sz * .8, "#2f6b34", "#3f8f4a", 3); break;
      case "bush": prop(0, 0, sz * .55, "#2c5c34", "#3a7042", 4); break;
      case "rock": case "boulder": prop(0, 0, sz * .8, "#5c5f66", "#787c85", 5); break;
      case "building": prop(0, 0, sz, "#1b2030", "#2a3346", 6, o); break;
      case "neon": prop(0, 0, sz * 1.3, "#0d1020", "#00e5ff", 7); break;
      case "stand": prop(0, 0, sz * 1.1, "#1a1e2a", "#39425a", 8); break;
      case "banner": prop(0, 0, sz * .9, "#101828", "#ff2e93", 9); break;
      case "guardrail": prop(0, 0, sz * .9, "#8a8f99", "#c3c8d2", 10); break;
      case "wind": prop(0, 0, sz * 1.1, "#9aa3b2", "#d7dde8", 11, o); break;
      case "lamp": prop(0, 0, sz * 1.1, "#2a3040", "#ffe9a8", 12); break;
      case "cone": prop(0, 0, sz, "#ff7a1a", "#fff4e6", 13); break;
      case "barrel": prop(0, 0, sz, "#e5484d", "#f6f7fb", 14); break;
      case "tyre": prop(0, 0, sz, "#15171d", "#2c3038", 15); break;
      case "block": prop(0, 0, sz, "#8a8375", "#c9c2ae", 16); break;
      case "car": drawTraffic(o, sz); break;
    }
    ctx.restore();
  }

  function prop(x, y, s, c1, c2, kind, o) {
    switch (kind) {
      case 1: // pine
        ctx.fillStyle = "#3a2a18"; ctx.fillRect(x - s * .05, y - s * .1, s * .1, s * .2);
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .3, y + s * .05); ctx.lineTo(x - s * .3, y + s * .05); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.moveTo(x, y - s * .72); ctx.lineTo(x + s * .22, y - s * .18); ctx.lineTo(x - s * .22, y - s * .18); ctx.closePath(); ctx.fill();
        break;
      case 0: // round tree
        ctx.fillStyle = "#3a2a18"; ctx.fillRect(x - s * .06, y - s * .1, s * .12, s * .2);
        ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x - s * .1, y - s * .38, s * .26, 0, 6.2832); ctx.arc(x + s * .12, y - s * .34, s * .24, 0, 6.2832); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y - s * .5, s * .22, 0, 6.2832); ctx.fill();
        break;
      case 2: // palm
        ctx.strokeStyle = c1; ctx.lineWidth = Math.max(1, s * .07);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * .12, y - s * .5, x, y - s * .8); ctx.stroke();
        ctx.fillStyle = c2;
        for (let i = 0; i < 5; i++) {
          const a = -1.9 + i * .48;
          ctx.beginPath();
          ctx.moveTo(x, y - s * .8);
          ctx.quadraticCurveTo(x + Math.cos(a) * s * .5, y - s * .85 + Math.sin(a) * s * .3, x + Math.cos(a) * s * .55, y - s * .62 + Math.sin(a) * s * .34);
          ctx.quadraticCurveTo(x + Math.cos(a) * s * .3, y - s * .72, x, y - s * .78);
          ctx.closePath(); ctx.fill();
        }
        break;
      case 3: // cactus
        ctx.fillStyle = c1; rr(x - s * .16, y - s * .9, s * .32, s * .95, s * .16); ctx.fill();
        ctx.fillRect(x - s * .46, y - s * .55, s * .16, s * .4);
        ctx.fillRect(x + s * .3, y - s * .68, s * .16, s * .5);
        ctx.fillStyle = c2; ctx.fillRect(x - s * .1, y - s * .86, s * .06, s * .9);
        break;
      case 4: // bush
        ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x - s * .16, y - s * .14, s * .2, 0, 6.2832); ctx.arc(x + s * .16, y - s * .16, s * .19, 0, 6.2832); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y - s * .28, s * .18, 0, 6.2832); ctx.fill();
        break;
      case 5: // rock
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(x - s * .42, y); ctx.lineTo(x - s * .3, y - s * .42); ctx.lineTo(x - s * .02, y - s * .55);
        ctx.lineTo(x + s * .3, y - s * .4); ctx.lineTo(x + s * .44, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.moveTo(x - s * .02, y - s * .55); ctx.lineTo(x + s * .3, y - s * .4); ctx.lineTo(x + s * .1, y - s * .18); ctx.closePath(); ctx.fill();
        break;
      case 6: { // building
        const w = s * .7, h = s * 1.5;
        ctx.fillStyle = c1; ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = c2; ctx.fillRect(x - w / 2, y - h, w * .18, h);
        if (S.theme.lights) {
          ctx.fillStyle = "rgba(255,214,120,.75)";
          for (let r = 0; r < 6; r++) for (let cI = 0; cI < 3; cI++) {
            if ((r * 3 + cI + (o_v(o))) % 3) continue;
            ctx.fillRect(x - w / 2 + w * .24 + cI * w * .22, y - h + h * .1 + r * h * .14, w * .13, h * .06);
          }
        }
        break;
      }
      case 7: { // neon sign
        ctx.fillStyle = c1; ctx.fillRect(x - s * .3, y - s * 1.1, s * .6, s * 1.1);
        ctx.save();
        ctx.shadowColor = c2; ctx.shadowBlur = s * .6;
        ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1.5, s * .07);
        ctx.beginPath();
        ctx.moveTo(x, y - s * .95); ctx.lineTo(x, y - s * .3);
        ctx.moveTo(x - s * .16, y - s * .8); ctx.lineTo(x + s * .16, y - s * .8);
        ctx.moveTo(x - s * .16, y - s * .55); ctx.lineTo(x + s * .16, y - s * .55);
        ctx.stroke(); ctx.restore();
        break;
      }
      case 8: { // grandstand
        const w = s * 1.2, h = s * .8;
        ctx.fillStyle = c1; ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = c2;
        for (let r = 0; r < 4; r++) ctx.fillRect(x - w / 2, y - h + r * h * .22, w, h * .1);
        ctx.fillStyle = "rgba(255,255,255,.5)";
        for (let i = 0; i < 12; i++) ctx.fillRect(x - w / 2 + i * (w / 12), y - h * .95, w / 22, h * .8);
        break;
      }
      case 9: { // banner
        ctx.fillStyle = "#8a8f99"; ctx.fillRect(x - s * .04, y - s * 1.1, s * .08, s * 1.1);
        ctx.fillStyle = c2; ctx.beginPath();
        ctx.moveTo(x + s * .04, y - s * 1.1); ctx.lineTo(x + s * .5, y - s * .95);
        ctx.lineTo(x + s * .04, y - s * .75); ctx.closePath(); ctx.fill();
        break;
      }
      case 10: { // guardrail
        const w = s * 1.5;
        ctx.fillStyle = c1; ctx.fillRect(x - w / 2, y - s * .22, w, s * .2);
        ctx.fillStyle = c2;
        for (let i = 0; i < 5; i++) ctx.fillRect(x - w / 2 + i * (w / 5), y - s * .22, w / 12, s * .2);
        break;
      }
      case 11: { // wind turbine
        ctx.fillStyle = c1; ctx.fillRect(x - s * .05, y - s * .9, s * .1, s * .9);
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y - s * .92, s * .1, 0, 6.2832); ctx.fill();
        ctx.save(); ctx.translate(x, y - s * .92); ctx.rotate(S.t * 2.4 + (o_v2(o)));
        for (let i = 0; i < 3; i++) { ctx.rotate(2.094); ctx.fillRect(-s * .03, -s * .5, s * .06, s * .5); }
        ctx.restore();
        break;
      }
      case 12: { // street lamp + glow pool
        const gg = ctx.createRadialGradient(x, y - s * .1, 0, x, y - s * .1, s * .9);
        gg.addColorStop(0, "rgba(255,226,150,.34)"); gg.addColorStop(1, "rgba(255,226,150,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(x, y - s * .05, s * .9, s * .3, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = c1; ctx.fillRect(x - s * .05, y - s, s * .1, s);
        ctx.fillRect(x - s * .05, y - s, s * .42, s * .07);
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(x + s * .34, y - s * .93, s * .16, s * .1, 0, 0, 6.2832); ctx.fill();
        break;
      }
      case 13: // cone
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.moveTo(x, y - s * .9); ctx.lineTo(x + s * .3, y); ctx.lineTo(x - s * .3, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2; ctx.fillRect(x - s * .17, y - s * .42, s * .34, s * .13);
        ctx.fillStyle = "#1b1e26"; ctx.fillRect(x - s * .36, y - s * .06, s * .72, s * .09);
        break;
      case 14: // barrel
        ctx.fillStyle = c1; rr(x - s * .26, y - s * .8, s * .52, s * .82, s * .1); ctx.fill();
        ctx.fillStyle = c2; ctx.fillRect(x - s * .26, y - s * .62, s * .52, s * .16);
        ctx.fillRect(x - s * .26, y - s * .3, s * .52, s * .14);
        break;
      case 15: // tyre
        ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y - s * .3, s * .32, 0, 6.2832); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y - s * .3, s * .14, 0, 6.2832); ctx.fill();
        break;
      case 16: // concrete block
        ctx.fillStyle = c1; rr(x - s * .42, y - s * .5, s * .84, s * .5, s * .05); ctx.fill();
        ctx.fillStyle = c2; ctx.fillRect(x - s * .42, y - s * .5, s * .84, s * .1);
        ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(x - s * .42, y - s * .12, s * .84, s * .05);
        break;
    }
  }
  function o_v(o) { return (o.x | 0) % 7; }
  function o_v2(o) { return (o.y | 0) % 6; }

  function drawTraffic(o, sz) {
    const w = sz * .52, h = sz * 1.0;
    ctx.fillStyle = o.col || "#ccc";
    rr(-w / 2, -h, w, h, w * .22); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.28)"; rr(-w / 2 + w * .1, -h * .84, w * .8, h * .4, w * .1); ctx.fill();
    ctx.fillStyle = "rgba(180,220,255,.5)"; rr(-w / 2 + w * .16, -h * .8, w * .68, h * .2, w * .06); ctx.fill();
    ctx.fillStyle = "#15171d";
    rr(-w / 2 - w * .05, -h * .82, w * .16, h * .3, w * .06); ctx.fill();
    rr(w / 2 - w * .11, -h * .82, w * .16, h * .3, w * .06); ctx.fill();
    ctx.fillRect(-w / 2 - w * .05, -h * .26, w * .16, h * .3);
    ctx.fillRect(w / 2 - w * .11, -h * .26, w * .16, h * .3);
    ctx.fillStyle = "#ff4d4d"; ctx.fillRect(-w / 2 + w * .12, -h * .06, w * .2, h * .05);
    ctx.fillRect(w / 2 - w * .32, -h * .06, w * .2, h * .05);
    ctx.fillStyle = "#fff2c4"; ctx.fillRect(-w / 2 + w * .12, -h * .98, w * .2, h * .05);
    ctx.fillRect(w / 2 - w * .32, -h * .98, w * .2, h * .05);
  }

  function drawGate(o, x, y, k, d) {
    const isFinish = o.t === "finish";
    const hw = halfAt(o.y);
    const l = projX(o.x - hw - 30, k), r = projX(o.x + hw + 30, k);
    const hgt = 150 * k * K.ZOOM * 1.6;
    const col = isFinish ? "#ffffff" : "#00e5ff";
    const got = S.passed.has(o);
    ctx.save();
    ctx.globalAlpha = clamp(1 - d / (K.DRAW * .92), 0, 1) * (got ? .22 : 1);
    // light beam
    const g = ctx.createLinearGradient(0, y - hgt, 0, y);
    g.addColorStop(0, hexA(col, 0));
    g.addColorStop(1, hexA(col, .34));
    ctx.fillStyle = g; ctx.fillRect(l, y - hgt, r - l, hgt);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 9 * k * K.ZOOM);
    ctx.shadowColor = col; ctx.shadowBlur = 20 * k;
    ctx.beginPath();
    ctx.moveTo(l, y); ctx.lineTo(l, y - hgt); ctx.lineTo(r, y - hgt); ctx.lineTo(r, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (isFinish) {
      ctx.fillStyle = col;
      for (let i = 0; i < 14; i++) {
        if (i % 2) continue;
        ctx.fillRect(l + (r - l) * (i / 14), y - hgt, (r - l) / 14, hgt * .17);
      }
    }
    ctx.fillStyle = col;
    ctx.font = "700 " + Math.max(11, 26 * k * K.ZOOM) + "px 'Segoe UI',sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isFinish ? "FINISH" : "CHECKPOINT " + o.cp, (l + r) / 2, y - hgt - 8 * k);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of S.particles) {
      const d = p.y - S.y;
      if (d < -60 || d > 1200) continue;
      const k = projK(d);
      const x = projX(p.x, k), y = projY(k);
      const a = clamp(p.l / p.L, 0, 1);
      if (p.k === "spark") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.c;
        const s = p.s * k * K.ZOOM * .8;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      } else if (p.k === "flame") {
        ctx.globalAlpha = a * .85;
        const g = ctx.createRadialGradient(x, y, 0, x, y, p.s * k * K.ZOOM);
        g.addColorStop(0, "#ffffff"); g.addColorStop(.4, p.c); g.addColorStop(1, "rgba(0,229,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, p.s * k * K.ZOOM, 0, 6.2832); ctx.fill();
      } else {
        ctx.globalAlpha = a * .5;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(x, y, p.s * k * K.ZOOM * (.6 + (1 - a) * .9), 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const k = 1;
    const x = projX(S.x, k), y = projY(k);
    const w = K.CAR_W * K.ZOOM, h = K.CAR_H * K.ZOOM;

    // shadow
    ctx.globalAlpha = .34; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(x + 6, y + h * .16, w * .5, h * .34, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;

    // headlight cone at night
    if (S.theme.lights) {
      const g = ctx.createLinearGradient(x, y - h * .5, x, y - h * 2.6);
      g.addColorStop(0, "rgba(255,240,190,.20)");
      g.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * .3, y - h * .45);
      ctx.lineTo(x - w * 1.5, y - h * 2.7);
      ctx.lineTo(x + w * 1.5, y - h * 2.7);
      ctx.lineTo(x + w * .3, y - h * .45);
      ctx.closePath(); ctx.fill();
    }

    const rot = clamp(Math.atan2(S.latVel, Math.max(320, Math.abs(S.speed))) * .62, -.5, .5) + S.steer * .05;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    if (S.drifting || S.drift > .3) {
      ctx.save();
      ctx.globalAlpha = .5; ctx.shadowColor = "#7b5cff"; ctx.shadowBlur = 26;
      ctx.strokeStyle = "#b18bff"; ctx.lineWidth = 3;
      rr(-w * .5, -h * .5, w, h, w * .16); ctx.stroke();
      ctx.restore();
    }

    if (S.boosting) {
      const g = ctx.createRadialGradient(0, h * .42, 0, 0, h * .42, w * .9);
      g.addColorStop(0, "rgba(255,255,255,.95)");
      g.addColorStop(.35, "rgba(0,229,255,.8)");
      g.addColorStop(1, "rgba(123,92,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, h * .46, w * .5, h * .3, 0, 0, 6.2832); ctx.fill();
    }

    if (S.img) ctx.drawImage(S.img, -w / 2, -h / 2, w, h);
    else drawCarFallback(w, h, S.car);

    if (S.hitFlash > 0) {
      ctx.globalAlpha = S.hitFlash * .5;
      ctx.fillStyle = "#ff2e2e";
      rr(-w / 2, -h / 2, w, h, w * .16); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawCarFallback(w, h, car) {
    ctx.fillStyle = car.body;
    rr(-w * .46, -h * .5, w * .92, h, w * .18); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.22)";
    rr(-w * .46, -h * .5, w * .92, h * .3, w * .18); ctx.fill();
    ctx.fillStyle = "#0d1526";
    rr(-w * .32, -h * .18, w * .64, h * .34, w * .1); ctx.fill();
    ctx.fillStyle = "#15171d";
    ctx.fillRect(-w * .5, -h * .38, w * .1, h * .2); ctx.fillRect(w * .4, -h * .38, w * .1, h * .2);
    ctx.fillRect(-w * .5, h * .2, w * .1, h * .2); ctx.fillRect(w * .4, h * .2, w * .1, h * .2);
  }

  function drawWeather() {
    const th = S.theme;
    if (th.weather === "rain" || th.weather === "storm") {
      ctx.strokeStyle = th.weather === "storm" ? "rgba(180,210,255,.34)" : "rgba(190,230,255,.3)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const r of S.rain) {
        const y = ((r.y + S.t * r.s * .55) % 1) * K.VH;
        const x = ((r.x + S.t * .06 * r.s) % 1) * (K.VW + 200) - 100;
        ctx.moveTo(x, y); ctx.lineTo(x - 8, y + r.l * 190);
      }
      ctx.stroke();
      if (S.lightning > 0) {
        ctx.fillStyle = "rgba(200,225,255," + (S.lightning * .34) + ")";
        ctx.fillRect(0, 0, K.VW, K.VH);
      }
    }
    if (th.weather === "dust") {
      ctx.globalAlpha = .16; ctx.fillStyle = th.fog;
      for (let i = 0; i < 40; i++) {
        const x = ((i * 197 + S.t * 90) % (K.VW + 300)) - 150;
        const y = K.HORIZON + 40 + ((i * 91) % (K.VH - K.HORIZON - 60));
        ctx.beginPath(); ctx.ellipse(x, y, 60 + (i % 5) * 30, 5 + (i % 3) * 3, 0, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (th.weather === "sparks") {
      ctx.globalAlpha = .3; ctx.fillStyle = "#ff8ad4";
      for (let i = 0; i < 26; i++) {
        const x = ((i * 263 + S.t * 160) % (K.VW + 200)) - 100;
        const y = ((i * 137 - S.t * 60) % (K.VH + 200) + K.VH + 200) % (K.VH + 200) - 100;
        ctx.fillRect(x, y, 3, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawSpeedFX() {
    const ratio = clamp(Math.abs(S.speed) / 1300, 0, 1);
    if (ratio > .55 || S.boosting) {
      const a = (ratio - .5) * .5 + (S.boosting ? .22 : 0);
      ctx.globalAlpha = clamp(a, 0, .5);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      const cx = K.VW / 2, cy = K.PLAYER_Y;
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * 6.2832 + S.t * .6;
        const r0 = 260 + ((i * 37) % 120);
        const r1 = r0 + 90 + ratio * 220;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * .62);
        ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * .62);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // vignette
    const v = ctx.createRadialGradient(K.VW / 2, K.VH * .48, K.VH * .32, K.VW / 2, K.VH * .48, K.VH * .95);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, K.VW, K.VH);
    if (S.flash > 0) { ctx.fillStyle = hexA("#00e5ff", S.flash * .3); ctx.fillRect(0, 0, K.VW, K.VH); }
    if (S.hitFlash > 0) { ctx.fillStyle = hexA("#ff2e2e", S.hitFlash * .28); ctx.fillRect(0, 0, K.VW, K.VH); }
  }

  function drawPops() {
    ctx.textAlign = "center";
    for (const q of S.pops) {
      const a = clamp(q.l / q.L, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = q.c;
      ctx.font = "900 30px 'Segoe UI',sans-serif";
      ctx.fillText(q.t, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    const sh = S.shake;
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    if (sh > .2) ctx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);

    drawSky();
    drawGround();
    drawRoad();
    drawMarks();

    // visible objects, far → near
    const vis = [];
    for (const o of S.objects) {
      if (o.dead) continue;
      const d = o.y - S.y;
      if (d < -120 || d > K.DRAW) continue;
      vis.push(o);
    }
    vis.sort((a, b) => b.y - a.y);
    for (const o of vis) drawObject(o);

    // depth fog
    const fg = ctx.createLinearGradient(0, K.HORIZON - 6, 0, K.HORIZON + 210);
    fg.addColorStop(0, hexA(S.theme.fog, .9));
    fg.addColorStop(1, hexA(S.theme.fog, 0));
    ctx.fillStyle = fg; ctx.fillRect(0, K.HORIZON - 6, K.VW, 220);

    drawParticles();
    drawPlayer();
    drawWeather();
    drawSpeedFX();
    drawPops();
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
  }

  /* ============================================================
     HUD
     ============================================================ */
  function hud() {
    const lv = S.level;
    const prog = clamp(S.y / lv.len, 0, 1);
    $("hLvName").textContent = lv.n + ". " + lv.name;
    $("hLvSub").textContent = num(Math.min(S.y, lv.len)) + " / " + num(lv.len) + " m  ·  " + window.VS.fmtTime(S.time);
    const pb = $("hPbar");
    pb.firstElementChild.style.width = (prog * 100).toFixed(1) + "%";
    pb.classList.toggle("done", prog >= 1);

    $("hScore").textContent = num(S.score);
    $("hPts").textContent = num(S.score * D.ECONOMY.pointPerScore);
    $("hDrift").textContent = num(S.driftPts);
    $("hTime").textContent = window.VS.fmtTime(S.time);

    const kmh = Math.abs(S.speed) * K.KMH;
    $("hSpeed").textContent = Math.round(kmh);
    const maxKmh = (690 + S.car.stats.speed * 56) * 1.2 * K.KMH;
    $("hArc").setAttribute("stroke-dasharray", (226 * clamp(kmh / maxKmh, 0, 1)).toFixed(1) + " 302");

    const cb = $("hCombo");
    if (S.combo > 1.05) { cb.classList.add("on"); cb.textContent = "COMBO x" + S.combo.toFixed(1); }
    else cb.classList.remove("on");

    const np = clamp(S.nitro, 0, 1);
    $("nitroFill").style.width = (np * 100).toFixed(0) + "%";
    $("hNitroTxt").textContent = Math.round(np * 100) + "%";
    const hp = clamp(S.hp, 0, 100);
    const hf = $("hpFill");
    hf.style.width = hp + "%";
    hf.className = hp < 30 ? "crit" : hp < 60 ? "warn" : "";
    $("hHpTxt").textContent = Math.round(hp) + "%";
  }

  function centreOn(big, sub) {
    const c = $("centre");
    c.style.display = "block";
    $("cBig").textContent = big;
    $("cSub").textContent = sub || "";
  }
  function centreOff() { $("centre").style.display = "none"; }

  /* ============================================================
     SCREENS
     ============================================================ */
  function paintLevelPicker() {
    const s = window.VS.save;
    $("lvPick").innerHTML = D.LEVELS.map(lv => {
      const un = window.VS.isLevelUnlocked(lv);
      const best = s.best[lv.id];
      const th = D.THEMES[lv.theme];
      return `<button class="lvbtn ${lv.id === S.level.id ? "on" : ""} ${un ? "" : "lock"}" data-lv="${lv.id}" ${un ? "" : "disabled"}>
        <div class="n">TRACK ${lv.n}</div>
        <div class="t">${lv.name}</div>
        <div class="m">${un ? (best ? "Best " + num(best.score) : th.name) : "Rank " + lv.unlock + " required"}</div>
      </button>`;
    }).join("");
    $("lvPick").querySelectorAll("[data-lv]").forEach(b => {
      b.addEventListener("click", () => {
        if (b.disabled) return;
        S.level = pickLevel(b.dataset.lv);
        loadLevel(S.level.id);
        resetRun();
        paintLevelPicker();
        paintCarLine();
      });
    });
  }
  function paintCarLine() {
    const c = S.car;
    $("stCarImg").src = c.sprite;
    $("stCarName").textContent = c.name;
    $("stCarTier").textContent = c.tier + " · " + c.topSpeed + " km/h · 0–100 in " + c.zeroTo.toFixed(1) + "s";
  }

  function showResults() {
    const r = S.result;
    $("eTitle").innerHTML = r.finished ? 'TRACK <span style="color:var(--green)">CLEAR</span>' : 'ENGINE <span style="color:var(--red)">FAILURE</span>';
    $("eSub").textContent = S.level.n + ". " + S.level.name + " — " + (r.finished ? "You crossed the line." : "You ran out of bodywork at " + num(r.dist) + " m.");
    const timeBonus = r.extra.timeBonus || 0, hpBonus = r.extra.hpBonus || 0, reward = r.extra.reward || 0;
    const rows = [
      ["Distance", num(r.dist) + " m", false],
      ["Drift points", num(r.drift), false],
      ["Checkpoints", r.cps, false],
      ["Finish time", window.VS.fmtTime(r.time) + "  (par " + window.VS.fmtTime(r.par) + ")", false]
    ];
    if (r.finished) {
      rows.push(["Time bonus", "+" + num(timeBonus), false]);
      rows.push(["Body bonus", "+" + num(hpBonus), false]);
      rows.push(["Track reward", "+" + num(reward), false]);
    }
    rows.push(["Total score", num(r.score), true]);
    rows.push(["Points earned", "+" + num(r.out.points), true]);
    $("eRes").innerHTML = rows.map(([k, v, hi]) =>
      `<div class="r ${hi ? "tot" : ""}"><span>${k}</span><b>${v}</b></div>`).join("");

    const best = window.VS.save.best[S.level.id];
    let lv = "";
    if (r.out.levelsGained > 0) {
      lv = `<div class="levelup">★ DRIVER RANK UP → ${r.out.driverLevel} · ${window.VS.title()}</div>`;
    }
    if (best && best.score === Math.round(r.score)) lv += `<div class="tip">🏆 New personal best on this track!</div>`;
    const unlocked = D.LEVELS.filter(l => l.unlock === r.out.driverLevel);
    if (unlocked.length) lv += `<div class="tip">🔓 Unlocked: ${unlocked.map(l => l.name).join(", ")}</div>`;
    $("eLevel").innerHTML = lv;

    const idx = D.LEVELS.indexOf(S.level);
    const nx = D.LEVELS[idx + 1];
    $("bNext").style.display = nx ? "" : "none";
    if (nx) $("bNext").disabled = !window.VS.isLevelUnlocked(nx);
    $("ovEnd").classList.add("on");
  }

  /* ============================================================
     FLOW
     ============================================================ */
  function startRace() {
    audioStart();
    resetRun();
    $("ovStart").classList.remove("on");
    $("ovEnd").classList.remove("on");
    $("ovPause").classList.remove("on");
    S.mode = "count";
    S.count = 3.2;
    centreOn("3", "");
  }
  function doRestart() {
    if (S.mode === "menu") return;
    $("ovEnd").classList.remove("on");
    $("ovPause").classList.remove("on");
    resetRun();
    S.mode = "count"; S.count = 3.2;
    centreOn("3", "");
  }
  function togglePause() {
    if (S.mode === "race" || S.mode === "count") {
      S.pausedFrom = S.mode;
      S.mode = "paused";
      $("ovPause").classList.add("on");
      audioEngine(0, 0, false);
    } else if (S.mode === "paused") {
      S.mode = S.pausedFrom === "count" ? "count" : "race";
      S.pausedFrom = null;
      $("ovPause").classList.remove("on");
    }
  }
  function toggleMute() {
    A.muted = !A.muted;
    window.VS.save.settings.sfx = !A.muted;
    window.VS.persist();
    $("bMute").textContent = A.muted ? "🔇" : "🔊";
  }
  function toMenu() {
    S.mode = "menu";
    resetRun();
    $("ovPause").classList.remove("on");
    $("ovEnd").classList.remove("on");
    $("ovStart").classList.add("on");
    paintLevelPicker();
    paintCarLine();
    audioEngine(0, 0, false);
  }

  $("bStart").addEventListener("click", startRace);
  $("bAgain").addEventListener("click", doRestart);
  $("bRestart").addEventListener("click", doRestart);
  $("bResume").addEventListener("click", togglePause);
  $("bPause").addEventListener("click", togglePause);
  $("bMute").addEventListener("click", toggleMute);
  $("bQuit").addEventListener("click", toMenu);
  $("bQuit2").addEventListener("click", toMenu);
  $("bGarage").addEventListener("click", () => location.href = "garage.html");
  $("bGarage2").addEventListener("click", () => location.href = "garage.html");
  $("bHome").addEventListener("click", () => location.href = "index.html");
  $("bNext").addEventListener("click", () => {
    const idx = D.LEVELS.indexOf(S.level);
    const nx = D.LEVELS[idx + 1];
    if (!nx) return;
    S.level = nx; loadLevel(nx.id); doRestart();
  });

  /* ============================================================
     LOOP
     ============================================================ */
  let Q = 1;
  function fit() {
    const r = cv.getBoundingClientRect();
    stage.style.setProperty("--s", (r.width / K.VW).toFixed(4));
    const dpr = window.devicePixelRatio || 1;
    Q = Math.max(0.75, Math.min(2, (r.width * dpr) / K.VW));
    cv.width = Math.round(K.VW * Q);
    cv.height = Math.round(K.VH * Q);
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
  }
  addEventListener("resize", fit);

  function frame(ts) {
    S.raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - S.last) / 1000 || .016);
    S.last = ts; S.t += dt;

    if (S.mode === "count") {
      const n = Math.ceil(S.count - .2);
      if (n !== S._lastCount) {
        S._lastCount = n;
        if (n > 0) { centreOn(String(Math.min(3, n)), ""); blip(440, .1, "square", .13); }
        else centreOn("GO!", "");
      }
    }
    update(dt);
    render();
    hud();
  }

  /* ============================================================
     BOOT
     ============================================================ */
  (async function boot() {
    fit();
    const params = new URLSearchParams(location.search);
    const want = params.get("lv");
    const save = window.VS.save;
    S.car = window.VS.selectedCar();
    S.img = await loadImg(S.car.sprite);
    A.muted = !save.settings.sfx;
    $("bMute").textContent = A.muted ? "🔇" : "🔊";

    const lv = (want && window.VS.isLevelUnlocked(pickLevel(want))) ? pickLevel(want) : unlockedDefault();
    loadLevel(lv.id);
    resetRun();
    paintLevelPicker();
    paintCarLine();
    S.last = performance.now();
    S.raf = requestAnimationFrame(frame);
    document.addEventListener("pointerdown", () => audioStart(), { once: true });
  })();
})();
