# VSCARZ — Land Racing

A browser land-racing game. No engine, no build step, no dependencies — plain HTML, CSS and a
custom Canvas renderer. Push it to GitHub and it deploys to Vercel for free.

```
index.html      Landing page (hero, lineup, tracks, controls, progression)
garage.html     3D-turntable showroom + car shop (spend points)
play.html       The game
css/site.css    Landing + garage styles
css/game.css    Game HUD + overlays
js/data.js      All content: 6 cars, 8 levels, themes, economy  ← edit this first
js/save.js      Points, driver ranks, XP, garage, records (localStorage)
js/site.js      Shared UI helpers
js/landing.js   Hero animation + lineup rendering
js/garage.js    Showroom + buying logic
js/game.js      The engine
assets/cars/    Car sprites (swap in your own)
```

---

## 1. Put YOUR car in the game

The placeholder cars are vector placeholders. To use your own photo, drop it into
`assets/cars/` and point the game at it.

**Step 1 — copy your image in**

```
assets/cars/th.jpg        ← your photo
```

**Step 2 — point the car at it** in `js/data.js`:

```js
{
  id: "swift",
  name: "VSCARZ Swift",
  sprite: "assets/cars/th.jpg",   // ← was assets/cars/swift.svg
  ...
}
```

**Step 3 — make it point UP.** The game looks down at the track, so the sprite must face the
top of the image. If your photo faces sideways, rotate it first (any image editor, or
[rotatemyimg](https://rotatemyimg.com)). A square-ish image works best; the engine draws it
at 140 × 232 world units.

**Transparent background (recommended):** remove the background with
[remove.bg](https://remove.bg) so the car does not sit in a white box.

If the image fails to load (some browsers block images over `file://`), the engine falls back
to a procedurally drawn car automatically — the game still works.

---

## 2. Edit the content

Everything that matters is in **`js/data.js`**.

### Add or rebalance a car

```js
{
  id: "myname",                    // unique, used in the save file
  name: "VSCARZ My Name",
  tier: "Pro",                     // Starter | Pro | Legend  (drives the badge colour)
  tagline: "One line of sales copy.",
  price: 2000,                     // points to buy; 0 = free
  stats: { speed: 7, accel: 6, grip: 4, nitro: 6 },   // each 1–10
  body: "#ff7a1a",                 // used for the showroom glow + fallback car
  accent: "#ffd7a8", rim: "#fff4e6",
  sprite: "assets/cars/myname.jpg",
  topSpeed: 262,                   // shown in the garage (display only)
  zeroTo: 4.3
}
```

The four stats really change how the car drives:

| Stat | Effect |
|------|--------|
| `speed` | top speed |
| `accel` | how fast you reach it |
| `grip`   | steering response — low grip = loose and drift-happy |
| `nitro`  | boost strength and how fast the N2O bar refills |

### Add or edit a level

```js
{ id: "lv9", n: 9, name: "Volcano Run", theme: "dawn", len: 5000,
  diff: 4, reward: 2600, unlock: 14, traffic: 0.8, gap: 120 }
```

- `len` — metres to the finish line
- `diff` — scales road curvature, prop density, traffic and the reward
- `traffic` — 0 to 1, chance of a second/third car per row
- `gap` — metres between traffic rows (smaller = denser)
- `unlock` — the **driver rank** required to see the track
- `theme` — any key in `THEMES` (sky, ground, road, rumble, fog, props, weather)

### Balance the economy

```js
const ECONOMY = {
  pointPerScore: 0.6,      // score → spendable points
  xpPerScore: 0.4,         // score → rank XP
  levelUpKeepPoints: 0.55, // you keep this share of points after a crash
  checkpointPoints: 200,
  nearMissPoints: 30,
  startPoints: 500         // one-time welcome bonus
};
```

Rank thresholds are in `xpNeeded()` in `js/save.js`:
`600 + 400·(n−1) + 90·(n−1)²`.

---

## 3. Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer |
| `Shift` | Nitro boost |
| `Space` | Handbrake — kick the rear out for drift points |
| `R` | Restart the run |
| `Esc` | Pause |
| `M` | Mute |

Touch devices get an on-screen pad automatically.

**How to score:** drive on the road for distance points, hold `Space` through a corner to
bank drift points, squeeze past traffic for near-miss bonuses, and hit every checkpoint.
Checkpoints refill nitro and repair a little body damage. Finishing under par time and with
health left adds a big bonus. A crash at 0 % body ends the run and you keep 55 % of the points.

---

## 4. Run it locally

Because the game uses `localStorage` and image loading, run it through a local server rather
than double-clicking the HTML:

```bash
cd vscarz
npx serve -l 8080 .
# or:  python -m http.server 8080
```

Then open <http://localhost:8080>.

---

## 5. Push to GitHub

```bash
cd vscarz
git init
git add .
git commit -m "VSCARZ v1.0 - land racing game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vscarz.git
git push -u origin main
```

Create the empty repo on GitHub first (do **not** tick "add a README"), otherwise the push
rejects.

---

## 6. Deploy to Vercel

**Option A — dashboard (easiest)**

1. Go to <https://vercel.com/new>
2. Import the `vscarz` GitHub repo
3. Framework preset: **Other**  ·  Build command: *(leave empty)*  ·  Output directory: *(leave empty)*
4. Deploy

**Option B — CLI**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

`vercel.json` is already configured, so there is no build step and nothing to compile.

**Option C — GitHub Pages (free alternative)**

Settings → Pages → Deploy from a branch → `main` / `/ (root)`. The site works as-is because all
paths are relative.

---

## 7. Reset progress

Garage page → **Reset all progress**, or in the browser console:

```js
localStorage.removeItem('vscarz.save.v1'); location.reload();
```

---

## Notes

- Progress lives in `localStorage` under `vscarz.save.v1` — per browser, per device. Clearing
  site data wipes it. Swapping in a real account system means replacing `js/save.js` only.
- Add more tracks cheaply: duplicate a `THEMES` entry and add a `LEVELS` row.
- The engine is a single file (`js/game.js`) with no dependencies, so you can rewrite any part
  of the rendering or physics without touching the rest.
