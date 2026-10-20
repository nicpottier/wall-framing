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
    wall.ts       One wall's form state as typed text, rough-opening resolution, reducer, parsing to WallSpec
    project.ts    Several walls with shared defaults, display preferences, localStorage and migrations
    wallText.ts   The .wall.md text format: parser (errors by line) and writer
  components/
    Elevation.tsx SVG elevation drawing and dimensions
    Dimensions.tsx Drafting primitives (HDim / VDim)
    Overview.tsx, WallCard.tsx  All walls at a glance, cut list and text tabs
    WallEditor.tsx  One wall: form, drawing, cut list, checks
    WallSettings.tsx, OpeningsEditor.tsx, StructureEditor.tsx (posts, tall stretches)
    Report.tsx    Cut list, checks, legend, title block
  useRoute.ts     Overview vs wall editor from the address (#/wall/N)
  App.tsx         Wires state -> engine -> screens
```

The data flow is one way: **form or `.wall.md` text → `toWallSpec` → `computeFraming` → views**. The engine knows nothing about React or the DOM, so new framing rules belong in `lib/` along with a test.

## Projects and the example

A project holds several walls. The **overview** opens with a **plan**: every wall placed to scale, north up, with its sheathing, openings, posts and beams, linking to its editor, and any two walls whose framing shares floor flagged in red. Below it, the overview shows every wall as a card (size, openings, anything to fix, and a small drawing at a shared scale), with tabs for the project's combined **Cut list** and its **Text**. Clicking a card opens that wall's **editor** (form, dimensioned drawing, cut list and checks) at `#/wall/N`; **← All walls**, the browser's Back button, and the ‹ › arrows move between them.

The example (**Load example**) is the first floor of the Buckley-Watanabe residence, written as [`src/state/examples/first-floor.wall.md`](src/state/examples/first-floor.wall.md): the main house's walls, exterior and interior, and the living-room bump-out, split where a framer would build them separately (the garage walls and the balloon-framed west wall along the stairs are left out) from the architectural plans (A101, A007, A200, A302), with beams and posts from the structural plans (S2.2). Its notes record the assumptions made reading the plans.

## Wall spec text (`.wall.md`)

The overview's **Text** tab edits the whole project as plain text, kept in sync with the form. Text that reads cleanly updates the drawing as you type; problems are listed by line.

```markdown
# Buckley-Watanabe residence

## Defaults
- studs: 2x6 @ 16
- headers: 4x8, tight under plate
- head height: 6-10 1/2
- window ro: +3 x +3
- door ro: +2 x +2 1/2
- sheathing: vertical, 2" thick, start 12, double seam studs, block seams

## Wall A · south
- length: 20-0
- corners: left outside, right inside

### Openings
- W1: window 3-9 x 3-7 1/2, 4-6 from left
- W2: window 3046, 4-1 1/2 after W1, head 7-0
- D1: door 3068, 5-9 from right, header 4x10

### Posts
- P1: 6x6, 8-0 from right

### Balloon framing
- Stair: 10-1 7/8 tall, 12-6 to 24-1 from left

### Intersections
- Bath: 2x4 wall, 7-2 from left

### Beams
- B2: 5 1/2 x 11 7/8 GL, 2 3/4 from right
```

- `## Defaults` applies to every wall below it; a wall's own settings override it. Other text is kept as notes; `<!-- -->` comments are dropped.
- Settings: `length`, `height`, `studs`, `layout`, `top plate`, `exterior`, `headers`, `head height`, `rough sill`, `window ro`, `door ro`, `sheathing`, `corners`.
- Openings: `<label>: <window|door> <W x H or callout>, <position>`, then any of `head`, `sill`, `header`, `jacks`, `ro W x H`.
- Posts (under `### Posts`): `<label>: <6x6|4x6|4x4|(2) studs|(3) studs|(4) studs>, <position to centerline>`.
- Plan position: `plan: <x>, <y>, running <east|west|north|south>`, the wall's left end on the face it is seen from, measured east and north from the plan origin, and the way it runs to its right end. Its depth goes away from the viewer, so an exterior wall seen from inside runs with its outside face away. Walls without one are listed as not on the plan.
- Beams (under `### Beams`): `<label>: <size>, <where>`, where is `X from left|right` for a beam crossing the wall (to its centerline), `X to Y from left|right` along a stretch, or `full length`.
- Intersections (under `### Intersections`): `<label>: <2x4|2x6> wall, <position to its centerline>`, for a wall butting in partway along.
- Interior walls: `studs: 2x4 @ 16`, `exterior: no`, `sheathing: none`. California corners: `california corners: left 2x6, right 2x4` (the size of the wall butting into each end), `both` or `none`.
- Tall stretches (under `### Balloon framing`): `<label>: <height> tall, <near> to <far> from <left|right>`, giving both ends of the stretch.
- Positions are to the centerline: `4-6 from left`, `5-9 from right`, `4-1 1/2 after W1` (centerline to centerline), or `centered`. "after" and "centered" become plain positions when the form rewrites the text.

## Framing conventions

- Wall height is measured from the floor to the top of the top plate. Stud length = height − bottom plate − top plate(s). A 97 1/8" wall gets 92 5/8" precuts.
- Openings are entered by unit size (the window or door itself). The rough opening is the unit size plus the wall's allowances, set separately for window and door width and height.
- Window sills come from the head height (floor to top of rough opening). It is set once for the wall and can be overridden per window. Sill = head height − rough opening height.
- Each opening is located from the left or right end of the wall to its **centerline**; the rough opening is centered on it.
- Lengths can be typed framer-style: `4-6` is 4'-6", `4-6 1/2` adds a fraction, `92-5/8` is 92 5/8", plain numbers are inches. Opening sizes also take four-digit callouts: `3046` is 3'-0" × 4'-6".
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
- **What's drawn** is the sheathing hung on the deck before the wall is stood: from the first full row up to the last row that is mostly on this wall. A row mostly above the top plate belongs to the wall above, and the strip below the first row goes on after the wall is stood.
- **Start height** is the bottom of the first full panel row; horizontal seams repeat every panel height above it. With blocking on, a 2x4 on the flat is centered behind each seam, giving 1 3/4" of nailing to each panel edge, in every bay, skipping rough openings, headers and sills.

### Headers (Buckley-Watanabe structural plans, Harezlak Engineering, Rev. 1, 05/22/26)

- **Types**: 4x8 is typical over all openings (S2.1/S2.2 plan note 3, U.O.N.). The header picker also lists the larger sizes from the beam schedule and plan: 4x10, 4x12, P/T 6x10, 3½×11⅞ LVL, 5½×11⅞ GL, 5¼×14 LVL and 3½×18 LVL. Auto uses 4x8; pick the larger size where the plans call one out. Headers narrower than the 5½" wall get rigid foam to fill.
- **Under plate** (default, 10/S4.1): the header sits tight under the top plates. A flat head plate defines the top of the rough opening, doubled at exterior openings over 8'-0", with cripples (2" or more) or a ripped filler between it and the header. If a deep header only fits by rising into the double top plate, the lower plate is cut and an MSTA24 strap is noted.
- **On opening**: the header sits on the jacks at the top of the rough opening, with cripples or filler up to the plates.
- **Trimmers**: (2) per side at headers over 6'-0" long, otherwise (1) (10/S4.1). Exterior headers over 6'-0" get A35 clips.

### Posts and balloon framing

- **Posts** sit where a beam bears on the wall (S2.2 shows a post below each end of B2; plan note 5 calls for (3) studs minimum at beam ends). A post replaces the layout studs it covers, or the end stud at a wall end, backs any sheathing seam that lands on it, and is an error over an opening's framing or a plate step. Built-up posts list each stud.
- **Tall stretches** frame part of a wall to its own height where its top plate steps (3/S4.1). A stretch whose bottom plate also changes, or that runs two stories, is better built as its own wall. The stretch gets its own double top plate and stud length; openings inside it frame to it. At each step (3/S4.1): (2) studs each side, 2x4 flat blocking on the tall side in line with the lower plates for at least 4'-0", and a CS16 strap over the sheathing ((14) 8d to the plates, (5) 8d to each block). Sheathing rows and seam blocking follow each stretch's height.

### Beams

Beams are dropped (11/S4.2): the top is flush with the top of the top plates and the joists bear on it, so the plates stop wherever a beam passes. A beam **crossing** a wall sits in a pocket on a post, with no plates over it; the post runs up to the beam's underside, and the plates either side are noted for strapping across it. A beam running **along** a wall caps it: the wall is framed to the beam's underside with a single plate, cut at the posts that carry the beam. Because the plates break at a crossing beam, a framer builds that wall in two pieces, and the example does the same.

### Intersections and corners

- **Intersections**: where a wall butts into another partway along, the wall it meets gets a backer stud each side (3/4" of drywall nailing past each face) with 2x4 ladder blocking on the flat every 24" between. Kings, jacks, posts or end studs already there serve as backers; common layout studs in the way are moved. A wall meeting inside a rough opening is flagged.
- **California corners**: at an end where another wall butts in, a stud laid flat at the inside face, nailed against the end stud so the two make an L, reaches past that wall to back the drywall in the inside corner and catch the butting wall's end stud. In a wall too shallow to reach past the corner that way, it moves along just far enough. Skipped where a king, jack or post already backs it; a single stud is used when an opening leaves no room to lay one flat, and a note suggests drywall clips when there's no room at all.
- **2x4 walls and unsheathed walls**: stud size is per wall, and interior walls can have no sheathing (no seams, seam studs or seam blocking).

## Ideas for next steps

- Find intersections and corners from the plan automatically, and flag gaps between walls that should meet
- Fire blocking, mid-height blocking, and sheathing layout overlay
- Multiple walls per project with a combined lumber order (stock-length optimization)
- Built-up stud counts from the structural plans' diamonds, stud wall type A (1¾×5½ LSL @ 12")
- The garage walls, with their lower foundation and taller plates
- Plate layout marking sheet and printable / PDF export
- Undo/redo, keyboard nudge for openings, metric units
