import {
  DEPTH,
  PRECUTS,
  T,
  WALL_DEPTH,
  headerName,
  headerType,
  type HeaderType,
  type HeaderTypeId,
} from './lumber';
import { sheathingLayout, type SheathingLayout, type SheathingSpec } from './sheathing';
import { round16, toFraction, type Formatter } from './units';

// ---------- Inputs ----------

export type OpeningType = 'window' | 'door';
export type LayoutFrom = 'left' | 'right';

export interface OpeningSpec {
  id: string;
  label: string;
  type: OpeningType;
  /** Wall's left end to the left edge of the rough opening. */
  x: number;
  /** Rough opening width. */
  width: number;
  /** Rough opening height. */
  height: number;
  /** Floor to bottom of rough opening (windows only; doors are 0). */
  sill: number;
  header: HeaderTypeId | 'auto';
  jacksPerSide: 'auto' | 1 | 2;
  /** Size of the window or door unit itself, for labeling. */
  unit?: { width: number; height: number };
}

export interface WallSpec {
  /** Overall wall length. */
  length: number;
  /** Floor (bottom of bottom plate) to top of top plate. */
  height: number;
  /** Stud spacing on center. */
  spacing: number;
  layoutFrom: LayoutFrom;
  topPlates: 1 | 2;
  /**
   * dropped: header tight under the top plates, cripples down to a flat head plate at the top of
   * the rough opening (10/S4.1). onJacks: header sits on the jacks at the top of the opening.
   */
  headerMount: 'dropped' | 'onJacks';
  /** Header used by openings set to Auto (4x8 typical per plan note 3). */
  defaultHeader: HeaderTypeId;
  /** Exterior walls get doubled head plates on long openings and A35 clips on long headers. */
  exterior: boolean;
  sillPlies: 1 | 2;
  sheathing: SheathingSpec;
  openings: OpeningSpec[];
}

// ---------- Outputs ----------

export type Role =
  | 'plate'
  | 'topPlate'
  | 'stud'
  | 'seamStud'
  | 'king'
  | 'jack'
  | 'header'
  | 'headPlate'
  | 'sill'
  | 'crippleTop'
  | 'crippleBottom'
  | 'filler'
  | 'blocking';

export const ROLES: Record<Role, { name: string; order: number }> = {
  plate: { name: 'Bottom plate', order: 1 },
  topPlate: { name: 'Top plate', order: 2 },
  stud: { name: 'Stud', order: 3 },
  seamStud: { name: 'Seam stud', order: 3.5 },
  king: { name: 'King stud', order: 4 },
  jack: { name: 'Jack stud (trimmer)', order: 5 },
  header: { name: 'Header', order: 6 },
  headPlate: { name: 'Head plate', order: 6.5 },
  sill: { name: 'Rough sill', order: 7 },
  crippleTop: { name: 'Cripple, above opening', order: 8 },
  crippleBottom: { name: 'Cripple, below sill', order: 9 },
  filler: { name: 'Filler, above opening', order: 10 },
  blocking: { name: 'Seam blocking', order: 11 },
};

/** A single piece of lumber in elevation. x from the wall's left end, z up from the floor. */
export interface Member {
  id: string;
  role: Role;
  x: number;
  z: number;
  w: number;
  h: number;
  /** Lumber size, or the header's name. */
  size: string;
  /** Cut length of the piece. */
  length: number;
  /** Cut-list group this piece belongs to. */
  group: string;
  openingId?: string;
  isEnd?: boolean;
  /** Height of the sheathing seam a block sits behind. */
  seamHeight?: number;
  /** Layout center for common studs. */
  layoutCenter?: number;
  /** Height of a ripped filler strip. */
  fillHeight?: number;
}

export interface OpeningFrame {
  spec: OpeningSpec;
  jacksPerSide: number;
  roBottom: number;
  roTop: number;
  header: HeaderType;
  headerX: number;
  headerLength: number;
  headerTop: number;
  headerBottom: number;
  /** Flat plates under a dropped header (0 when the header sits on the jacks). */
  headPlies: number;
  /** Header raised into the lower top plate, which is cut around it. */
  topPlateCut?: [number, number];
  kingLeft: number;
  kingRight: number;
  /** Horizontal extent of all framing for the opening (outside of king to outside of king). */
  zoneStart: number;
  zoneEnd: number;
  /** Space filled by cripples or filler above the opening, bottom and top. */
  crippleZone: [number, number];
  /** Height of that space. */
  gapAbove: number;
  /** Horizontal extent of the cripples or filler. */
  crippleSpan: [number, number];
  /** Cripple length below a window sill. */
  crippleBelow?: number;
  /** Portion of the bottom plate removed at a door. */
  plateCut?: [number, number];
  hasError: boolean;
}

export type IssueLevel = 'error' | 'warning' | 'note';
export interface Issue {
  level: IssueLevel;
  message: string;
  openingId?: string;
}

export interface CutGroup {
  key: string;
  role: Role;
  size: string;
  length: number;
  qty: number;
  notes: string[];
}

export interface LayoutMark {
  /** Position from the wall's left end. */
  center: number;
  /** Distance from the framing end the layout is pulled from (what you'd read off the tape). */
  distance: number;
}

export interface Framing {
  ok: true;
  wall: WallSpec;
  plateBottom: number;
  studLength: number;
  members: Member[];
  openings: OpeningFrame[];
  layout: LayoutMark[];
  sheathing: SheathingLayout;
  issues: Issue[];
  cutList: CutGroup[];
  stats: { fullStuds: number; jacks: number; cripples: number; blocks: number; headers: number; pieces: number; linealFeet: number };
}

export interface FramingFailure {
  ok: false;
  message: string;
}

const EPS = 1e-6;

/** Smallest gap that gets cripples; anything shorter becomes a ripped filler. */
export const MIN_CRIPPLE = 2;
/** Bays narrower than this next to a king stud get flagged. */
export const TIGHT_BAY = 2;
/** 10/S4.1: headers over 6'-0" get (2) trimmers each side, and A35 clips when exterior. */
export const LONG_HEADER = 72;
/** 10/S4.1: exterior openings over 8'-0" get a doubled head plate. */
export const LONG_HEAD_PLATE = 96;

export function computeFraming(wall: WallSpec, fmt: Formatter): Framing | FramingFailure {
  const { length: L, height: H, spacing, topPlates } = wall;
  if (!(L >= 24) || L > 1200) return { ok: false, message: 'Enter a wall length between 2 and 100 feet.' };
  if (!(H >= 48) || H > 240) return { ok: false, message: 'Enter a wall height between 4 and 20 feet.' };
  if (!(spacing >= 8) || spacing > 48) return { ok: false, message: 'Enter a stud spacing between 8" and 48".' };
  if (!(wall.sheathing.thickness >= 0) || wall.sheathing.thickness > 6) return { ok: false, message: 'Enter a sheathing thickness between 0 and 6".' };
  if (!(wall.sheathing.startHeight >= 0) || wall.sheathing.startHeight > H) return { ok: false, message: 'Enter a sheathing start height within the wall height.' };

  const plateBottom = H - topPlates * T;
  const studLength = plateBottom - T;

  const members: Member[] = [];
  const issues: Issue[] = [];
  let seq = 0;
  const add = (m: Omit<Member, 'id' | 'group' | 'size'> & { size?: string }) => {
    const size = m.size ?? '2x6';
    const member: Member = { ...m, size, id: `m${seq++}`, group: `${m.role}|${size}|${round16(m.length)}` };
    members.push(member);
    return member;
  };
  const issue = (level: IssueLevel, message: string, openingId?: string) => issues.push({ level, message, openingId });

  add({ role: 'plate', x: 0, z: 0, w: L, h: T, length: L });
  for (let i = 0; i < topPlates; i++) add({ role: 'topPlate', x: 0, z: H - (i + 1) * T, w: L, h: T, length: L });

  // Stud centers at every spacing interval, pulled from where the sheathing starts at the layout end.
  // At a corner that is past the framing end, so the first mark comes in by that extension.
  const sheet = sheathingLayout(wall);
  const layout: LayoutMark[] = [];
  for (let k = 1; ; k++) {
    const d = k * spacing - sheet.extOrigin;
    if (d >= L - EPS) break;
    if (d <= EPS) continue;
    layout.push({ center: wall.layoutFrom === 'right' ? L - d : d, distance: d });
  }
  const centersWithin = (lo: number, hi: number) =>
    layout.map((l) => l.center - T / 2).filter((x) => x >= lo - EPS && x + T <= hi + EPS);

  // Cripples between two flat members: one at each end plus one on each layout mark between.
  const crippleXs = (lo: number, hi: number) => {
    const xs = [lo, hi - T];
    for (const x of centersWithin(lo, hi)) if (xs.every((e) => Math.abs(e - x) >= T - EPS)) xs.push(x);
    return xs.sort((a, b) => a - b);
  };

  const openings: OpeningFrame[] = [];
  for (const spec of wall.openings) {
    const tag = spec.label || '?';
    // 10/S4.1: (2) trimmer studs at headers over 6'-0" long.
    const n = spec.jacksPerSide === 'auto' ? (spec.width + 2 * T > LONG_HEADER ? 2 : 1) : spec.jacksPerSide;
    const sill = spec.type === 'window' ? spec.sill : 0;
    const roTop = sill + spec.height;
    const headerX = spec.x - n * T;
    const headerLength = spec.width + 2 * n * T;
    const kingLeft = headerX - T;
    const kingRight = spec.x + spec.width + n * T;
    let hasError = false;

    if (kingLeft < T - EPS) {
      hasError = true;
      issue('error', `${tag}: king stud runs into the end stud. Move the opening at least ${fmt(T - kingLeft)} to the right.`, spec.id);
    }
    if (kingRight + T > L - T + EPS) {
      hasError = true;
      issue('error', `${tag}: king stud runs into the end stud. Move the opening at least ${fmt(kingRight + T - (L - T))} to the left.`, spec.id);
    }

    const header = headerType(spec.header === 'auto' ? wall.defaultHeader : spec.header);
    const name = headerName(header);
    const dropped = wall.headerMount === 'dropped';
    let headerTop: number;
    let headPlies = 0;
    let topPlateCut: [number, number] | undefined;
    if (dropped) {
      // Tight under the top plates, with a flat plate at the head of the opening (10/S4.1).
      headPlies = wall.exterior && spec.width > LONG_HEAD_PLATE ? 2 : 1;
      const headPlateTop = roTop + headPlies * T;
      headerTop = plateBottom;
      if (headerTop - header.depth < headPlateTop - EPS && topPlates === 2 && headerTop + T - header.depth >= headPlateTop - EPS) {
        headerTop += T;
        topPlateCut = [headerX, headerX + headerLength];
        issue('note', `${tag}: the ${name} header rises into the double top plate. Cut the lower plate and strap across it with MSTA24 (10/S4.1).`, spec.id);
      }
      if (headerTop - header.depth < headPlateTop - EPS) {
        hasError = true;
        issue('error', `${tag}: a ${name} header doesn't fit above a ${fmt(roTop)} head; it is ${fmt(headPlateTop - (headerTop - header.depth))} short. Lower the head or pick a shallower header.`, spec.id);
      }
    } else {
      headerTop = roTop + header.depth;
      if (headerTop > plateBottom + EPS) {
        hasError = true;
        issue('error', `${tag}: a ${name} header runs ${fmt(headerTop - plateBottom)} into the top plate. Lower the opening or pick a shallower header.`, spec.id);
      }
    }
    const headerBottom = headerTop - header.depth;
    const crippleZone: [number, number] = dropped ? [roTop + headPlies * T, headerBottom] : [headerTop, plateBottom];
    const crippleSpan: [number, number] = dropped ? [spec.x, spec.x + spec.width] : [headerX, headerX + headerLength];

    const frame: OpeningFrame = {
      spec,
      jacksPerSide: n,
      roBottom: sill,
      roTop,
      header,
      headerX,
      headerLength,
      headerTop,
      headerBottom,
      headPlies,
      topPlateCut,
      kingLeft,
      kingRight,
      zoneStart: kingLeft,
      zoneEnd: kingRight + T,
      crippleZone,
      gapAbove: crippleZone[1] - crippleZone[0],
      crippleSpan,
      hasError,
    };
    openings.push(frame);

    const oid = spec.id;
    add({ role: 'king', x: kingLeft, z: T, w: T, h: studLength, length: studLength, openingId: oid });
    add({ role: 'king', x: kingRight, z: T, w: T, h: studLength, length: studLength, openingId: oid });
    const jackLength = headerBottom - T;
    for (let i = 0; i < n; i++) {
      add({ role: 'jack', x: spec.x - (i + 1) * T, z: T, w: T, h: jackLength, length: jackLength, openingId: oid });
      add({ role: 'jack', x: spec.x + spec.width + i * T, z: T, w: T, h: jackLength, length: jackLength, openingId: oid });
    }
    add({ role: 'header', x: headerX, z: headerBottom, w: headerLength, h: header.depth, size: name, length: headerLength, openingId: oid });
    for (let p = 0; p < headPlies; p++) {
      add({ role: 'headPlate', x: spec.x, z: roTop + p * T, w: spec.width, h: T, length: spec.width, openingId: oid });
    }

    // Between the opening and the header (dropped) or the header and the plates: cripples, or a filler.
    const gap = frame.gapAbove;
    const [x0, x1] = crippleSpan;
    if (gap >= MIN_CRIPPLE - EPS) {
      for (const x of dropped ? crippleXs(x0, x1) : centersWithin(x0, x1)) {
        add({ role: 'crippleTop', x, z: crippleZone[0], w: T, h: gap, length: gap, openingId: oid });
      }
    } else if (gap > 1 / 32) {
      add({ role: 'filler', x: x0, z: crippleZone[0], w: x1 - x0, h: gap, length: x1 - x0, fillHeight: gap, openingId: oid });
    }

    if (spec.type === 'window') {
      for (let p = 0; p < wall.sillPlies; p++) {
        add({ role: 'sill', x: spec.x, z: sill - (p + 1) * T, w: spec.width, h: T, length: spec.width, openingId: oid });
      }
      const cl = sill - wall.sillPlies * T - T;
      frame.crippleBelow = cl;
      if (cl < 0) {
        frame.hasError = true;
        issue('error', `${tag}: the sill is too low to frame. Raise the head height or use a shorter window so the sill is at least ${fmt((wall.sillPlies + 1) * T)} off the floor.`, oid);
      } else if (cl < MIN_CRIPPLE) {
        issue('warning', `${tag}: cripples under the sill are only ${fmt(cl)} long. Consider flat blocking instead.`, oid);
      }
      if (cl > 1 / 32) {
        // End cripples carry the sill ends; layout cripples fill between.
        for (const x of crippleXs(spec.x, spec.x + spec.width)) {
          add({ role: 'crippleBottom', x, z: T, w: T, h: cl, length: cl, openingId: oid });
        }
      }
    } else {
      frame.plateCut = [spec.x, spec.x + spec.width];
    }
  }

  // Openings whose framing collides.
  const sorted = [...openings].sort((a, b) => a.zoneStart - b.zoneStart);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    if (b.zoneStart < a.zoneEnd - EPS) {
      a.hasError = b.hasError = true;
      issue('error', `${a.spec.label} and ${b.spec.label}: framing overlaps by ${fmt(a.zoneEnd - b.zoneStart)}. Move them apart.`, b.spec.id);
    }
  }

  // End studs, then common studs on layout wherever no opening framing sits.
  add({ role: 'stud', x: 0, z: T, w: T, h: studLength, length: studLength, isEnd: true });
  add({ role: 'stud', x: L - T, z: T, w: T, h: studLength, length: studLength, isEnd: true });
  for (const { center } of layout) {
    const x = center - T / 2;
    if (x < T - EPS || x + T > L - T + EPS) continue;
    if (openings.some((o) => x + T > o.zoneStart + EPS && x < o.zoneEnd - EPS)) continue;
    add({ role: 'stud', x, z: T, w: T, h: studLength, length: studLength, layoutCenter: center });
  }

  placeSeamStuds(wall, sheet, members, openings, add, issue, studLength, fmt);
  if (wall.sheathing.blockSeams) placeSeamBlocking(sheet, members, openings, add, plateBottom);

  // Flag slivers of bay between a layout stud and a king.
  const verticals = members.filter((m) => FULL_HEIGHT.includes(m.role)).sort((a, b) => a.x - b.x);
  for (let i = 1; i < verticals.length; i++) {
    const a = verticals[i - 1]!;
    const b = verticals[i]!;
    const g = b.x - (a.x + T);
    const common = [a, b].find((m) => m.layoutCenter != null);
    if (g > EPS && g < TIGHT_BAY && common && (a.role === 'king' || b.role === 'king')) {
      issue('note', `The layout stud at ${fmt(common.layoutCenter!)} leaves a ${fmt(g)} bay beside a king stud. Many framers leave that stud out.`);
    }
  }

  const cutList = buildCutList(wall, members, openings, studLength);
  const count = (...roles: Role[]) => members.filter((m) => roles.includes(m.role)).length;
  const stats = {
    fullStuds: count('stud', 'seamStud', 'king'),
    jacks: count('jack'),
    cripples: count('crippleTop', 'crippleBottom'),
    blocks: count('blocking'),
    headers: openings.length,
    pieces: cutList.reduce((a, g) => a + g.qty, 0),
    linealFeet: cutList.reduce((a, g) => a + g.qty * g.length, 0) / 12,
  };

  return { ok: true, wall, plateBottom, studLength, members, openings, layout, sheathing: sheet, issues, cutList, stats };
}

type AddMember = (m: Omit<Member, 'id' | 'group' | 'size'> & { size?: string }) => Member;
type AddIssue = (level: IssueLevel, message: string, openingId?: string) => void;

const FULL_HEIGHT: Role[] = ['stud', 'seamStud', 'king'];
const VERTICAL: Role[] = ['stud', 'seamStud', 'king', 'jack', 'crippleTop', 'crippleBottom'];
/** Seam blocking is a 2x4 laid flat, so its wide face shows in elevation. */
const BLOCK_FACE = DEPTH['2x4'];
const overlapsX = (m: Member, x0: number, x1: number) => m.x < x1 - EPS && m.x + m.w > x0 + EPS;

/**
 * Puts framing under each vertical sheathing seam: two studs straddling it (double) or one
 * centered on it (single). Layout studs in the way are replaced; end studs and kings stay.
 */
function placeSeamStuds(
  wall: WallSpec,
  sheet: SheathingLayout,
  members: Member[],
  openings: OpeningFrame[],
  add: AddMember,
  issue: AddIssue,
  studLength: number,
  fmt: Formatter,
) {
  const L = wall.length;
  const end = wall.layoutFrom;
  const double = wall.sheathing.seamStuds === 'double';

  for (const seam of sheet.verticalSeams) {
    const s = seam.x;
    // Lands on an end stud.
    if (s <= T + EPS || s >= L - T - EPS) continue;

    const o = openings.find((op) => s > op.zoneStart + EPS && s < op.zoneEnd - EPS);
    if (o) {
      const covered = members.some(
        (m) => VERTICAL.includes(m.role) && m.openingId === o.spec.id && s >= m.x - EPS && s <= m.x + T + EPS,
      );
      if (!covered) {
        issue(
          'note',
          `The sheathing seam ${fmt(seam.distance)} from the ${end} end falls inside ${o.spec.label}'s framing with nothing behind it. Add a cripple there or move the opening.`,
          o.spec.id,
        );
      }
      continue;
    }

    if (!double && members.some((m) => m.layoutCenter != null && Math.abs(m.layoutCenter - s) < EPS)) continue;

    const want = double ? [s - T, s] : [s - T / 2];
    const lo = want[0]!;
    const hi = want[want.length - 1]! + T;
    // Layout studs that collide with the seam studs give way to them.
    for (let i = members.length - 1; i >= 0; i--) {
      const m = members[i]!;
      if (m.role === 'stud' && m.layoutCenter != null && overlapsX(m, lo, hi)) members.splice(i, 1);
    }
    for (const x of want) {
      if (members.some((m) => FULL_HEIGHT.includes(m.role) && overlapsX(m, x, x + T))) continue;
      add({ role: 'seamStud', x, z: T, w: T, h: studLength, length: studLength });
    }
  }
}

/**
 * Adds a 2x4 on the flat, centered on each horizontal seam, in every bay that has framing on both
 * sides at that height and isn't a rough opening, header or sill. Flat, its 3 1/2" face backs the seam.
 */
function placeSeamBlocking(
  sheet: SheathingLayout,
  members: Member[],
  openings: OpeningFrame[],
  add: AddMember,
  plateBottom: number,
) {
  for (const z of sheet.horizontalSeams) {
    // Seams on the plates already have backing.
    if (z <= T + EPS || z >= plateBottom - EPS) continue;
    const bz = Math.min(Math.max(z - BLOCK_FACE / 2, T), plateBottom - BLOCK_FACE);
    const posts = members
      .filter((m) => VERTICAL.includes(m.role) && m.z <= bz + EPS && m.z + m.h >= bz + BLOCK_FACE - EPS)
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < posts.length; i++) {
      const x0 = posts[i - 1]!.x + T;
      const x1 = posts[i]!.x;
      if (x1 - x0 < 0.25) continue;
      const hitsFlat = members.some(
        (m) => (m.role === 'header' || m.role === 'headPlate' || m.role === 'sill' || m.role === 'filler') && overlapsX(m, x0, x1) && m.z < bz + BLOCK_FACE - EPS && m.z + m.h > bz + EPS,
      );
      const inOpening = openings.some(
        (o) => x0 < o.spec.x + o.spec.width - EPS && x1 > o.spec.x + EPS && bz < o.roTop - EPS && bz + BLOCK_FACE > o.roBottom + EPS,
      );
      if (hitsFlat || inOpening) continue;
      add({ role: 'blocking', x: x0, z: bz, w: x1 - x0, h: BLOCK_FACE, size: '2x4', length: x1 - x0, seamHeight: z });
    }
  }
}

function buildCutList(wall: WallSpec, members: Member[], openings: OpeningFrame[], studLength: number): CutGroup[] {
  const groups = new Map<string, CutGroup>();
  for (const m of members) {
    let g = groups.get(m.group);
    if (!g) {
      g = { key: m.group, role: m.role, size: m.size, length: round16(m.length), qty: 0, notes: [] };
      groups.set(m.group, g);
    }
    g.qty += 1;
    if (m.role === 'filler' && m.fillHeight != null && !g.notes.length) {
      g.notes.push(`Rip to ${toFraction(m.fillHeight)}" tall from 2x stock or plywood`);
    }
  }

  const doors = openings.filter((o) => o.plateCut);
  for (const g of groups.values()) {
    if (g.role === 'plate' || g.role === 'topPlate') {
      if (g.length > 192) g.notes.push("Longer than 16' stock; splice over a stud");
      if (g.role === 'topPlate' && wall.topPlates === 2) g.notes.push('Offset top plate splices at least 24"');
      const cut = openings.filter((o) => o.topPlateCut);
      if (g.role === 'topPlate' && cut.length) {
        g.notes.push(`Lower plate cut at ${cut.map((o) => o.spec.label).join(', ')} header; MSTA24 across`);
      }
      if (g.role === 'plate' && doors.length) {
        g.notes.push(`Cut out at ${doors.map((d) => d.spec.label).join(', ')} after the wall is stood`);
      }
    }
    if (g.role === 'header') {
      const h = openings.find((o) => headerName(o.header) === g.size)!.header;
      if (h.width < WALL_DEPTH) g.notes.push(`${toFraction(WALL_DEPTH - h.width)}" rigid foam to fill the wall`);
      if (wall.exterior && g.length > LONG_HEADER) g.notes.push('A35 clip each end (10/S4.1)');
    }
    if (g.role === 'headPlate') g.notes.push(`Flat under the header; doubled at exterior openings over 8'-0" (10/S4.1)`);
    if (g.role === 'seamStud') {
      g.notes.push(wall.sheathing.seamStuds === 'double' ? 'Pairs straddle vertical sheathing seams' : 'Centered under vertical sheathing seams');
    }
    if (g.role === 'blocking' && !g.notes.length) g.notes.push('2x4 on the flat, centered on horizontal sheathing seams');
    if ((g.role === 'stud' || g.role === 'seamStud' || g.role === 'king') && g.length === round16(studLength)) {
      const pre = PRECUTS[String(g.length)];
      if (pre) g.notes.push(`Matches ${pre} studs`);
    }
  }

  return [...groups.values()].sort((a, b) => ROLES[a.role].order - ROLES[b.role].order || b.length - a.length);
}
