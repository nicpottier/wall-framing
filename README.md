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
    lumber.ts     Lumber constants, the project's header types (from the structural plans), precut lengths
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
- Each opening gets a king stud on each side and jack studs (trimmers) under the header.
- Windows get a rough sill (single or double) on cripples: one at each end plus one on each layout mark.
- At doors, the bottom plate is cut out between the jacks after the wall is stood.

### Views

Left and right are always as seen **from inside** the building. Enter opening positions and corner conditions that way.

- **Standing**: elevation seen from inside.
- **On the deck**: the wall as it's framed lying on the subfloor before lifting, sheathing side up, seen from the top-plate side. You face the same way as from inside, so left and right stay put and only top and bottom flip: the bottom plate is at the top (the deck edge it pivots on). Text stays upright and dimensions follow their side of the wall. Sheathing that runs past the top plate is left off, since it is not on the wall yet.

### Sheathing (4x8)

- Panels run vertical (4' wide, 8' tall) or horizontal (8' wide, 4' tall). Sheathing and stud layout are both pulled from the layout end, so panel seams land on studs.
- **Corners** shift where the sheathing starts relative to the framing end: *outside* (this wall runs past) adds the sheathing thickness; *inside* (this wall butts in) adds the wall depth plus the sheathing thickness. A 2" panel on an outside corner puts the first layout mark at 14" and the first 4' seam at 46".
- **Seam studs**: *double* puts two studs straddling each vertical seam (replacing the layout stud); *single* makes sure one stud is centered under it. Seams that fall inside an opening's framing with nothing behind them are flagged.
- **Start height** is the bottom of the first full panel row; horizontal seams repeat every panel height above it. With blocking on, a 2x4 on the flat is centered behind each seam, giving 1 3/4" of nailing to each panel edge, in every bay, skipping rough openings, headers and sills.

### Headers (Buckley-Watanabe structural plans, Harezlak Engineering, Rev. 1, 05/22/26)

- **Types**: 4x8 is typical over all openings (S2.1/S2.2 plan note 3, U.O.N.). The header picker also lists the beam schedule: B1 3½×11⅞ LVL, B2 5½×11⅞ GL, B3 5¼×14 LVL, B4 4x10, B5 P/T 6x10, B6 3½×18 LVL. Auto uses 4x8; pick the mark the plans call out for a specific opening. Headers narrower than the 5½" wall get rigid foam to fill.
- **Under plate** (default, 10/S4.1): the header sits tight under the top plates. A flat head plate defines the top of the rough opening, doubled at exterior openings over 8'-0", with cripples (2" or more) or a ripped filler between it and the header. If a deep header only fits by rising into the double top plate, the lower plate is cut and an MSTA24 strap is noted.
- **On opening**: the header sits on the jacks at the top of the rough opening, with cripples or filler up to the plates.
- **Trimmers**: (2) per side at headers over 6'-0" long, otherwise (1) (10/S4.1). Exterior headers over 6'-0" get A35 clips.

## Ideas for next steps

- Corner and T-intersection framing at wall ends (California corners, ladder blocking)
- Fire blocking, mid-height blocking, and sheathing layout overlay
- Multiple walls per project with a combined lumber order (stock-length optimization)
- Point loads and posts ((3) studs min. under beam ends per plan note 4), stud wall type A (1¾×5½ LSL @ 12")
- Plate layout marking sheet and printable / PDF export
- Undo/redo, keyboard nudge for openings, metric units
