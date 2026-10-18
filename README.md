# Wall Framing Planner

Lays out 2x6 wall framing from a wall length, height, stud spacing, and window/door rough openings. It draws a dimensioned elevation and builds a cut list.

## Getting started

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run build      # typecheck + production build to dist/
```

## How it's organized

```
src/
  lib/            Pure TypeScript, no React. Everything here is unit-tested.
    units.ts      Tape-measure parsing ("8'-1 1/8\"", "92 5/8") and 1/16" formatting
    lumber.ts     Lumber constants (actual sizes), header rule of thumb, precut lengths
    framing.ts    The framing engine: WallSpec in -> members, openings, issues, cut list out
  state/
    wall.ts       Form state as typed text, reducer actions, parsing to WallSpec, localStorage
  components/
    Elevation.tsx SVG elevation drawing, dimensions, drag-to-move openings
    Dimensions.tsx Drafting primitives (HDim / VDim)
    WallSettings.tsx, OpeningsEditor.tsx, Report.tsx (cut list, checks, legend, title block)
  App.tsx         Wires state -> engine -> views
```

The data flow is one way: **form text → `toWallSpec` → `computeFraming` → views**. The engine knows nothing about React or the DOM, so new framing rules belong in `lib/` along with a test.

## Framing conventions

- Wall height is measured from the floor to the top of the top plate. Stud length = height − bottom plate − top plate(s). A 97 1/8" wall gets 92 5/8" precuts.
- Layout marks put stud centers on the spacing, measured from the chosen end, so sheathing edges land on studs. End studs sit flush at both ends.
- Each opening gets a king stud on each side, jack studs (trimmers) under the header, and a header sized by span. Auto picks the size; openings wider than 72" get double jacks.
- Above the header, a gap of 3" or more gets cripples on layout. A smaller gap gets a ripped filler strip.
- Windows get a rough sill (single or double) on cripples: one at each end plus one on each layout mark.
- At doors, the bottom plate is cut out between the jacks after the wall is stood.
- Headers are 2 plies with a rigid-foam core, or 3 plies with 1" foam, to fill the 5 1/2" wall.

Auto header sizes are a rule of thumb, not engineering. Check them against IRC Table R602.7 or an engineer's schedule.

## Ideas for next steps

- Corner and T-intersection framing at wall ends (California corners, ladder blocking)
- Fire blocking, mid-height blocking, and sheathing layout overlay
- Multiple walls per project with a combined lumber order (stock-length optimization)
- Point loads / engineered headers (LVL), load-based header sizing
- Plate layout marking sheet and printable / PDF export
- Undo/redo, keyboard nudge for openings, metric units
