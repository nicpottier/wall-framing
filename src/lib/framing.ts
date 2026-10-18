import { DEPTH, HEADER_SIZES, PRECUTS, T, suggestedHeader, type HeaderSize, type LumberSize } from './lumber';
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
  header: HeaderSize | 'auto';
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
  headerPlies: 2 | 3;
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
  sill: { name: 'Rough sill', order: 7 },
  crippleTop: { name: 'Cripple, above header', order: 8 },
  crippleBottom: { name: 'Cripple, below sill', order: 9 },
  filler: { name: 'Header filler', order: 10 },
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
  size: LumberSize;
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
  headerSize: HeaderSize;
  headerX: number;
  headerLength: number;
  headerTop: number;
  kingLeft: number;
  kingRight: number;
  /** Horizontal extent of all framing for the opening (outside of king to outside of king). */
  zoneStart: number;
  zoneEnd: number;
  /** Header top to underside of top plate. */
  gapAbove: number;
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
  size: LumberSize;
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

/** Smallest gap above a header that gets cripples; anything shorter becomes a ripped filler. */
export const MIN_CRIPPLE = 3;
/** Bays narrower than this next to a king stud get flagged. */
export const TIGHT_BAY = 2;
/** Openings wider than this get doubled jacks on Auto. */
export const DOUBLE_JACK_SPAN = 72;

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
  const add = (m: Omit<Member, 'id' | 'group' | 'size'> & { size?: LumberSize }) => {
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

  const openings: OpeningFrame[] = [];
  for (const spec of wall.openings) {
    const tag = spec.label || '?';
    const n = spec.jacksPerSide === 'auto' ? (spec.width > DOUBLE_JACK_SPAN ? 2 : 1) : spec.jacksPerSide;
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

    // Header size: honor an explicit choice, otherwise use the rule of thumb and step down if it can't fit.
    const fits = (s: HeaderSize) => roTop + DEPTH[s] <= plateBottom + EPS;
    let headerSize: HeaderSize;
    if (spec.header === 'auto') {
      const pref = suggestedHeader(spec.width);
      headerSize = pref;
      if (!fits(pref)) {
        const smaller = HEADER_SIZES.slice(0, HEADER_SIZES.indexOf(pref)).reverse().find(fits);
        if (smaller) {
          headerSize = smaller;
          issue('warning', `${tag}: header reduced to ${smaller} to fit under the top plate. Confirm it can carry a ${fmt(spec.width)} span.`, spec.id);
        } else {
          headerSize = '2x6';
          hasError = true;
          issue('error', `${tag}: no header fits. The rough opening is ${fmt(roTop + DEPTH['2x6'] - plateBottom)} too tall for even a 2x6 header.`, spec.id);
        }
      }
    } else {
      headerSize = spec.header;
      if (!fits(headerSize)) {
        hasError = true;
        issue('error', `${tag}: a ${headerSize} header runs ${fmt(roTop + DEPTH[headerSize] - plateBottom)} into the top plate. Lower the opening or pick a smaller header.`, spec.id);
      }
    }
    const headerTop = roTop + DEPTH[headerSize];

    const frame: OpeningFrame = {
      spec,
      jacksPerSide: n,
      roBottom: sill,
      roTop,
      headerSize,
      headerX,
      headerLength,
      headerTop,
      kingLeft,
      kingRight,
      zoneStart: kingLeft,
      zoneEnd: kingRight + T,
      gapAbove: plateBottom - headerTop,
      hasError,
    };
    openings.push(frame);

    const oid = spec.id;
    add({ role: 'king', x: kingLeft, z: T, w: T, h: studLength, length: studLength, openingId: oid });
    add({ role: 'king', x: kingRight, z: T, w: T, h: studLength, length: studLength, openingId: oid });
    const jackLength = roTop - T;
    for (let i = 0; i < n; i++) {
      add({ role: 'jack', x: spec.x - (i + 1) * T, z: T, w: T, h: jackLength, length: jackLength, openingId: oid });
      add({ role: 'jack', x: spec.x + spec.width + i * T, z: T, w: T, h: jackLength, length: jackLength, openingId: oid });
    }
    add({ role: 'header', x: headerX, z: roTop, w: headerLength, h: DEPTH[headerSize], size: headerSize, length: headerLength, openingId: oid });

    // Above the header: cripples on layout, or a filler strip when the gap is too short for cripples.
    const gap = frame.gapAbove;
    if (gap >= MIN_CRIPPLE - EPS) {
      for (const x of centersWithin(headerX, headerX + headerLength)) {
        add({ role: 'crippleTop', x, z: headerTop, w: T, h: gap, length: gap, openingId: oid });
      }
    } else if (gap > 1 / 32) {
      add({ role: 'filler', x: headerX, z: headerTop, w: headerLength, h: gap, length: headerLength, fillHeight: gap, openingId: oid });
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
        const xs = [spec.x, spec.x + spec.width - T];
        for (const x of centersWithin(spec.x, spec.x + spec.width)) {
          if (xs.every((e) => Math.abs(e - x) >= T - EPS)) xs.push(x);
        }
        xs.sort((a, b) => a - b).forEach((x) =>
          add({ role: 'crippleBottom', x, z: T, w: T, h: cl, length: cl, openingId: oid }),
        );
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

type AddMember = (m: Omit<Member, 'id' | 'group' | 'size'> & { size?: LumberSize }) => Member;
type AddIssue = (level: IssueLevel, message: string, openingId?: string) => void;

const FULL_HEIGHT: Role[] = ['stud', 'seamStud', 'king'];
const VERTICAL: Role[] = ['stud', 'seamStud', 'king', 'jack', 'crippleTop', 'crippleBottom'];
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
 * Adds a block on edge, centered on each horizontal seam, in every bay that has framing on both
 * sides at that height and isn't a rough opening, header or sill.
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
    const bz = Math.min(Math.max(z - T / 2, T), plateBottom - T);
    const posts = members
      .filter((m) => VERTICAL.includes(m.role) && m.z <= bz + EPS && m.z + m.h >= bz + T - EPS)
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < posts.length; i++) {
      const x0 = posts[i - 1]!.x + T;
      const x1 = posts[i]!.x;
      if (x1 - x0 < 0.25) continue;
      const hitsFlat = members.some(
        (m) => (m.role === 'header' || m.role === 'sill' || m.role === 'filler') && overlapsX(m, x0, x1) && m.z < bz + T - EPS && m.z + m.h > bz + EPS,
      );
      const inOpening = openings.some(
        (o) => x0 < o.spec.x + o.spec.width - EPS && x1 > o.spec.x + EPS && bz < o.roTop - EPS && bz + T > o.roBottom + EPS,
      );
      if (hitsFlat || inOpening) continue;
      add({ role: 'blocking', x: x0, z: bz, w: x1 - x0, h: T, length: x1 - x0, seamHeight: z });
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
    g.qty += m.role === 'header' ? wall.headerPlies : 1;
    if (m.role === 'filler' && m.fillHeight != null && !g.notes.length) {
      g.notes.push(`Rip to ${toFraction(m.fillHeight)}" tall from 2x stock or plywood`);
    }
  }

  const doors = openings.filter((o) => o.plateCut);
  for (const g of groups.values()) {
    if (g.role === 'plate' || g.role === 'topPlate') {
      if (g.length > 192) g.notes.push("Longer than 16' stock; splice over a stud");
      if (g.role === 'topPlate' && wall.topPlates === 2) g.notes.push('Offset top plate splices at least 24"');
      if (g.role === 'plate' && doors.length) {
        g.notes.push(`Cut out at ${doors.map((d) => d.spec.label).join(', ')} after the wall is stood`);
      }
    }
    if (g.role === 'header') {
      g.notes.push(wall.headerPlies === 2 ? 'Two plies + 2 1/2" rigid foam core = 5 1/2"' : 'Three plies + 1" rigid foam = 5 1/2"');
    }
    if (g.role === 'seamStud') {
      g.notes.push(wall.sheathing.seamStuds === 'double' ? 'Pairs straddle vertical sheathing seams' : 'Centered under vertical sheathing seams');
    }
    if (g.role === 'blocking' && !g.notes.length) g.notes.push('On edge, centered on horizontal sheathing seams');
    if ((g.role === 'stud' || g.role === 'seamStud' || g.role === 'king') && g.length === round16(studLength)) {
      const pre = PRECUTS[String(g.length)];
      if (pre) g.notes.push(`Matches ${pre} studs`);
    }
  }

  return [...groups.values()].sort((a, b) => ROLES[a.role].order - ROLES[b.role].order || b.length - a.length);
}
