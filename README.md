# Wall Framing Planner

Lays out 2x6 wall framing from a wall length, height, stud spacing, and window/door rough openings. It draws a dimensioned elevation and builds a cut list.

## Getting started

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run build      # typecheck + production build to dist/
```

## Deploying

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. The build uses relative asset paths, so it works at `https://<user>.github.io/<repo>/`.

## How it's organized

```
src/
  lib/            Pure TypeScript, no React. Everything here is unit-tested.
    units.ts      Tape-measure parsing ("8'-1 1/8\"", "92 5/8") and 1/16" formatting
    sheathing.ts  4x8 panel seams and corner offsets
    lumber.ts     Lumber constants (actual sizes), header rule of thumb, precut lengths
    framing.ts    The framing engine: WallSpec in -> members, openings, issues, cut list out
  state/
    wall.ts       Form state as typed text, rough-opening resolution, reducer, parsing to WallSpec, localStorage
  components/
    Elevation.tsx SVG elevation drawing and dimensions
    Dimensions.tsx Drafting primitives (HDim / VDim)
    WallSettings.tsx, OpeningsEditor.tsx, Report.tsx (cut list, checks, legend, title block)
  App.tsx         Wires state -> engine -> views
```

The data flow is one way: **form text → `toWallSpec` → `computeFraming` → views**. The engine knows nothing about React or the DOM, so new framing rules belong in `lib/` along with a test.

## Framing conventions

- Wall height is measured from the floor to the top of the top plate. Stud length = height − bottom plate − top plate(s). A 97 1/8" wall gets 92 5/8" precuts.
- Openings are entered by unit size (the window or door itself). The rough opening is the unit size plus the wall's allowances, set separately for window and door width and height.
- Window sills come from the head height (floor to top of rough opening). It is set once for the wall and can be overridden per window. Sill = head height − rough opening height.
- Each opening is located from the left or right end of the wall, to the near edge of its rough opening.
- Layout marks put stud centers on the spacing, measured from the chosen end, so sheathing edges land on studs. End studs sit flush at both ends.
- Each opening gets a king stud on each side, jack studs (trimmers) under the header, and a header sized by span. Auto picks the size; openings wider than 72" get double jacks.
- Above the header, a gap of 3" or more gets cripples on layout. A smaller gap gets a ripped filler strip.
- Windows get a rough sill (single or double) on cripples: one at each end plus one on each layout mark.
- At doors, the bottom plate is cut out between the jacks after the wall is stood.
- Headers are 2 plies with a rigid-foam core, or 3 plies with 1" foam, to fill the 5 1/2" wall.

### Sheathing (4x8)

- Panels run vertical (4' wide, 8' tall) or horizontal (8' wide, 4' tall). Sheathing and stud layout are both pulled from the layout end, so panel seams land on studs.
- **Corners** shift where the sheathing starts relative to the framing end: *outside* (this wall runs past) adds the sheathing thickness; *inside* (this wall butts in) adds the wall depth plus the sheathing thickness. A 2" panel on an outside corner puts the first layout mark at 14" and the first 4' seam at 46".
- **Seam studs**: *double* puts two studs straddling each vertical seam (replacing the layout stud); *single* makes sure one stud is centered under it. Seams that fall inside an opening's framing with nothing behind them are flagged.
- **Start height** is the bottom of the first full panel row; horizontal seams repeat every panel height above it. With blocking on, a 2x6 on edge is centered behind each seam in every bay, skipping rough openings, headers and sills.

Auto header sizes are a rule of thumb, not engineering. Check them against IRC Table R602.7 or an engineer's schedule.

## Ideas for next steps

- Corner and T-intersection framing at wall ends (California corners, ladder blocking)
- Fire blocking, mid-height blocking, and sheathing layout overlay
- Multiple walls per project with a combined lumber order (stock-length optimization)
- Point loads / engineered headers (LVL), load-based header sizing
- Plate layout marking sheet and printable / PDF export
- Undo/redo, keyboard nudge for openings, metric units
