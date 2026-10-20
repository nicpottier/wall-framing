import {
  DEPTH,
  PRECUTS,
  T,
  headerName,
  headerType,
  postType,
  type HeaderType,
  type HeaderTypeId,
  type LumberSize,
  type PostType,
  type PostTypeId,
} from './lumber';
import { panelRows, sheathingLayout, type SheathingLayout, type SheathingSpec } from './sheathing';
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

/** A post in the wall under a beam or girder bearing above. */
export interface PostSpec {
  id: string;
  label: string;
  /** Wall's left end to the post's left face. */
  x: number;
  type: PostTypeId;
}

/**
 * A stretch of wall framed to a different height from the rest, like balloon framing past the floor
 * at a stair opening. The top plates step at each end of it per 3/S4.1.
 */
export interface TallSpec {
  id: string;
  label: string;
  /** Wall's left end to each end of the stretch. */
  x0: number;
  x1: number;
  /** Floor to the top of its top plate. */
  height: number;
}

/**
 * A dropped beam bearing on the wall (11/S4.2): its top is flush with the top of the top plates, so
 * the plates stop where it passes. Crossing the wall, it sits on a post; running along the wall, the
 * wall is framed to its underside.
 */
export interface BeamSpec {
  id: string;
  label: string;
  /** Wall's left end to each side of the beam (or each end of the stretch it runs along). */
  x0: number;
  x1: number;
  depth: number;
  /** Size, for labels: "5½ × 11⅞ GL". */
  size: string;
}

/** Another wall butting into this one, with its framing depth (3 1/2" or 5 1/2"). */
export interface IntersectionSpec {
  id: string;
  label: string;
  /** Wall's left end to the intersecting wall's centerline. */
  x: number;
  width: number;
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
  posts?: PostSpec[];
  tall?: TallSpec[];
  /** Stud size; 2x6 unless set. */
  studs?: LumberSize;
  /** Walls butting into this one partway along it, backed with ladder blocking. */
  intersections?: IntersectionSpec[];
  /**
   * California corners: at each end where another wall butts in, the depth of that wall (0 for
   * none). A stud laid flat at the inside face just past it backs the drywall in the corner.
   */
  california?: { left: number; right: number };
  beams?: BeamSpec[];
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
  | 'post'
  | 'blocking'
  | 'stepBlocking'
  | 'cornerBacker'
  | 'partitionStud'
  | 'ladder';

export const ROLES: Record<Role, { name: string; order: number }> = {
  plate: { name: 'Bottom plate', order: 1 },
  topPlate: { name: 'Top plate', order: 2 },
  stud: { name: 'Stud', order: 3 },
  seamStud: { name: 'Seam stud', order: 3.5 },
  king: { name: 'King stud', order: 4 },
  jack: { name: 'Jack stud (trimmer)', order: 5 },
  post: { name: 'Post', order: 5.5 },
  cornerBacker: { name: 'Corner backer (California corner)', order: 5.6 },
  partitionStud: { name: 'Partition backer stud', order: 5.7 },
  header: { name: 'Header', order: 6 },
  headPlate: { name: 'Head plate', order: 6.5 },
  sill: { name: 'Rough sill', order: 7 },
  crippleTop: { name: 'Cripple, above opening', order: 8 },
  crippleBottom: { name: 'Cripple, below sill', order: 9 },
  filler: { name: 'Filler, above opening', order: 10 },
  blocking: { name: 'Seam blocking', order: 11 },
  stepBlocking: { name: 'Step blocking, at strap', order: 12 },
  ladder: { name: 'Ladder blocking', order: 13 },
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
  postId?: string;
  isEnd?: boolean;
  /** One of the (2) studs each side of a plate step. */
  isStep?: boolean;
  /** The lower of a double top plate. */
  lowerPlate?: boolean;
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

/** A stretch of the wall at one height: the whole wall, unless parts of it are framed taller. */
export interface WallSection {
  x0: number;
  x1: number;
  height: number;
  plateBottom: number;
  studLength: number;
  /** Set for a stretch framed to its own height. */
  tall?: TallSpec;
  /** Set where a beam sits on top in place of the top plates. */
  beam?: BeamSpec;
  /** Top plates over this stretch: the wall's, one under a beam running along it, none in a beam pocket. */
  plates: number;
  /** Posts run to the underside of a beam, or to the plates. */
  postLength: number;
  /** Horizontal sheathing seams and the top of the sheathing hung on the deck over this stretch. */
  seams: number[];
  sheathTop: number;
}

/** Where the top plates change height (3/S4.1). */
export interface PlateStep {
  /** Position from the wall's left end. */
  x: number;
  /** Which side of the step is lower. */
  low: 'left' | 'right';
  lowHeight: number;
  highHeight: number;
  /** Extent of the flat blocking on the tall side, at the lower plates' strap line. */
  blocking: [number, number] | null;
  strapZ: number;
}

export interface PostFrame {
  spec: PostSpec;
  type: PostType;
  x0: number;
  x1: number;
  hasError: boolean;
}

export interface IntersectionFrame {
  spec: IntersectionSpec;
  /** Faces of the intersecting wall's framing. */
  x0: number;
  x1: number;
  /** Space between backers filled with ladder blocking, if any. */
  bay: [number, number] | null;
  hasError: boolean;
}

export interface Framing {
  ok: true;
  wall: WallSpec;
  /** For the wall's base height; taller stretches have their own in sections. */
  plateBottom: number;
  studLength: number;
  /** Tallest top plate in the wall. */
  maxHeight: number;
  sections: WallSection[];
  steps: PlateStep[];
  posts: PostFrame[];
  intersections: IntersectionFrame[];
  members: Member[];
  openings: OpeningFrame[];
  layout: LayoutMark[];
  sheathing: SheathingLayout;
  issues: Issue[];
  cutList: CutGroup[];
  stats: { fullStuds: number; jacks: number; cripples: number; blocks: number; headers: number; pieces: number; linealFeet: number };
}

export type FramingStats = Framing['stats'];

/** Adds up cut lists from several walls: same member, size and length become one row. */
export function mergeCutLists(lists: CutGroup[][]): CutGroup[] {
  const groups = new Map<string, CutGroup>();
  for (const list of lists) {
    for (const g of list) {
      const m = groups.get(g.key);
      if (!m) groups.set(g.key, { ...g, notes: [...g.notes] });
      else {
        m.qty += g.qty;
        for (const n of g.notes) if (!m.notes.includes(n)) m.notes.push(n);
      }
    }
  }
  return [...groups.values()].sort((a, b) => ROLES[a.role].order - ROLES[b.role].order || b.length - a.length);
}

export function sumStats(stats: FramingStats[]): FramingStats {
  const total: FramingStats = { fullStuds: 0, jacks: 0, cripples: 0, blocks: 0, headers: 0, pieces: 0, linealFeet: 0 };
  for (const s of stats) for (const k of Object.keys(total) as (keyof FramingStats)[]) total[k] += s[k];
  return total;
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
/** Seam blocks shorter than this are left out. */
export const MIN_BLOCK = 3;
/** 10/S4.1: headers over 6'-0" get (2) trimmers each side, and A35 clips when exterior. */
export const LONG_HEADER = 72;
/** 10/S4.1: exterior openings over 8'-0" get a doubled head plate. */
export const LONG_HEAD_PLATE = 96;
/** 3/S4.1: flat blocking runs at least 4'-0" past a plate step on the tall side. */
export const STEP_BLOCKING = 48;
/** A beam stretch this narrow is a pocket over a post, with no plate under the beam. */
const POCKET = 6;
/** 3/S4.1: (2) studs each side of a plate step, minimum. */
const STEP_STUDS = 2;

export function computeFraming(wall: WallSpec, fmt: Formatter): Framing | FramingFailure {
  const { length: L, height: H, spacing, topPlates } = wall;
  if (!(L >= 12) || L > 1200) return { ok: false, message: 'Enter a wall length between 1 and 100 feet.' };
  if (!(H >= 48) || H > 240) return { ok: false, message: 'Enter a wall height between 4 and 20 feet.' };
  if (!(spacing >= 8) || spacing > 48) return { ok: false, message: 'Enter a stud spacing between 8" and 48".' };
  if (!(wall.sheathing.thickness >= 0) || wall.sheathing.thickness > 6) return { ok: false, message: 'Enter a sheathing thickness between 0 and 6".' };
  if (wall.sheathing.enabled !== false && (!(wall.sheathing.startHeight >= 0) || wall.sheathing.startHeight > H)) return { ok: false, message: 'Enter a sheathing start height within the wall height.' };


  const stock: LumberSize = wall.studs ?? '2x6';
  const members: Member[] = [];
  const issues: Issue[] = [];
  const issue = (level: IssueLevel, message: string, openingId?: string) => issues.push({ level, message, openingId });
  const sections = buildSections(wall, issue, fmt);
  const sectionAt = (x: number) => sections.find((p) => x < p.x1 - EPS) ?? sections[sections.length - 1]!;
  /** Section a vertical member from x to x + w stands in. */
  const sectionOf = (x: number, w = T) => sectionAt(x + w / 2);
  const maxHeight = Math.max(...sections.map((p) => p.height));
  // The wall's own plate and stud length are those of its longest stretch.
  const main = sections.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
  const { plateBottom, studLength } = main;
  let seq = 0;
  const add = (m: Omit<Member, 'id' | 'group' | 'size'> & { size?: string }) => {
    const size = m.size ?? stock;
    const member: Member = { ...m, size, id: `m${seq++}`, group: `${m.role}|${size}|${round16(m.length)}` };
    members.push(member);
    return member;
  };

  add({ role: 'plate', x: 0, z: 0, w: L, h: T, length: L });
  for (const p of sections) {
    if (p.beam) continue;
    for (let i = 0; i < p.plates; i++) {
      const w = p.x1 - p.x0;
      add({ role: 'topPlate', x: p.x0, z: p.height - (i + 1) * T, w, h: T, length: w, lowerPlate: p.plates === 2 && i === 1 });
    }
  }

  // Plate steps: (2) studs each side, the low side's stopping under its plates (3/S4.1).
  const steps: PlateStep[] = [];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1]!;
    const b = sections[i]!;
    if (Math.abs(a.height - b.height) < EPS) continue;
    const x = a.x1;
    const lowHeight = Math.min(a.height, b.height);
    steps.push({ x, low: a.height < b.height ? 'left' : 'right', lowHeight, highHeight: Math.max(a.height, b.height), blocking: null, strapZ: lowHeight - (topPlates * T) / 2 });
    for (let k = 1; k <= STEP_STUDS; k++) {
      add({ role: 'stud', x: x - k * T, z: T, w: T, h: a.studLength, length: a.studLength, isStep: true });
      add({ role: 'stud', x: x + (k - 1) * T, z: T, w: T, h: b.studLength, length: b.studLength, isStep: true });
    }
  }
  const stepZones = steps.map((st) => [st.x - STEP_STUDS * T, st.x + STEP_STUDS * T] as const);

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

    const sec = sectionAt(spec.x + spec.width / 2);
    const plateBottom = sec.plateBottom;
    const studLength = sec.studLength;
    const step = stepZones.find(([s0, s1]) => kingLeft < s1 - EPS && kingRight + T > s0 + EPS);
    if (step) {
      hasError = true;
      issue('error', `${tag}: framing runs into the plate step ${fmt(step[0] + STEP_STUDS * T)} from the left end. Keep it ${fmt(STEP_STUDS * T)} clear of the step.`, spec.id);
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
      if (headerTop - header.depth < headPlateTop - EPS && sec.plates === 2 && headerTop + T - header.depth >= headPlateTop - EPS) {
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

  const posts = placePosts(wall, sectionOf, openings, stepZones, add, issue, fmt);
  placeBeamPlates(sections, posts, add, issue, fmt);

  // End studs (unless a post sits at the end), then common studs on layout wherever nothing else sits.
  const studAt = (x: number) => {
    const len = sectionOf(x).studLength;
    return { z: T, w: T, h: len, length: len };
  };
  if (!posts.some((p) => !p.hasError && p.x0 <= EPS)) add({ role: 'stud', x: 0, ...studAt(0), isEnd: true });
  if (!posts.some((p) => !p.hasError && p.x1 >= L - EPS)) add({ role: 'stud', x: L - T, ...studAt(L - T), isEnd: true });
  placeCornerBackers(wall, sectionOf, members, add, issue);
  for (const { center } of layout) {
    const x = center - T / 2;
    if (x < T - EPS || x + T > L - T + EPS) continue;
    if (openings.some((o) => x + T > o.zoneStart + EPS && x < o.zoneEnd - EPS)) continue;
    if (stepZones.some(([s0, s1]) => x + T > s0 + EPS && x < s1 - EPS)) continue;
    if (members.some((m) => FULL_HEIGHT.includes(m.role) && overlapsX(m, x, x + T))) continue;
    add({ role: 'stud', x, ...studAt(x), layoutCenter: center });
  }
  const intersections = placeIntersections(wall, openings, members, add, issue, studAt, fmt);

  placeSeamStuds(wall, sheet, members, openings, posts, add, issue, studAt, fmt);
  placeStepBlocking(steps, sections, members, add, issue, fmt);
  if (wall.sheathing.blockSeams && wall.sheathing.enabled !== false) placeSeamBlocking(sections, members, openings, add);
  placeLadderBlocking(intersections, sectionOf, members, add);

  // Flag slivers of bay between a layout stud and a king.
  const verticals = members.filter((m) => FULL_HEIGHT.includes(m.role)).sort((a, b) => a.x - b.x);
  for (let i = 1; i < verticals.length; i++) {
    const a = verticals[i - 1]!;
    const b = verticals[i]!;
    const g = b.x - (a.x + a.w);
    const common = [a, b].find((m) => m.layoutCenter != null);
    if (g > EPS && g < TIGHT_BAY && common && (a.role === 'king' || b.role === 'king')) {
      issue('note', `The layout stud at ${fmt(common.layoutCenter!)} leaves a ${fmt(g)} bay beside a king stud. Many framers leave that stud out.`);
    }
  }

  const cutList = buildCutList(wall, members, openings, sections, posts, intersections);
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

  return { ok: true, wall, plateBottom, studLength, maxHeight, sections, steps, posts, intersections, members, openings, layout, sheathing: sheet, issues, cutList, stats };
}

type AddMember = (m: Omit<Member, 'id' | 'group' | 'size'> & { size?: string }) => Member;
type AddIssue = (level: IssueLevel, message: string, openingId?: string) => void;

const FULL_HEIGHT: Role[] = ['stud', 'seamStud', 'king', 'post', 'cornerBacker', 'partitionStud'];
const VERTICAL: Role[] = ['stud', 'seamStud', 'king', 'post', 'cornerBacker', 'partitionStud', 'jack', 'crippleTop', 'crippleBottom'];
/** Flat members a block can't pass through. */
const FLAT: Role[] = ['header', 'headPlate', 'sill', 'filler', 'blocking', 'stepBlocking', 'ladder'];
/** Members that stay put: everything full height except common layout studs, plus jacks (with the header over them). */
const isFixed = (m: Member) =>
  (FULL_HEIGHT.includes(m.role) && m.layoutCenter == null) || m.role === 'jack';
/** Drywall wants about this much backing past an inside corner or a partition face. */
const DRYWALL_BACKING = 0.75;
/** Ladder blocks go in at this spacing up the wall. */
const LADDER_SPACING = 24;
/** Seam blocking is a 2x4 laid flat, so its wide face shows in elevation. */
const BLOCK_FACE = DEPTH['2x4'];
const overlapsX = (m: Member, x0: number, x1: number) => m.x < x1 - EPS && m.x + m.w > x0 + EPS;

/**
 * Splits the wall into stretches by height. A taller (or shorter) stretch needs room for its own
 * step studs, so it can't be shorter than (2) studs each side or leave less than that to its neighbors.
 */
function buildSections(wall: WallSpec, issue: AddIssue, fmt: Formatter): WallSection[] {
  const { length: L, height: H } = wall;
  const stepWidth = STEP_STUDS * T;
  const accepted: TallSpec[] = [];
  for (const t of [...(wall.tall ?? [])].sort((a, b) => a.x0 - b.x0)) {
    const tag = t.label || 'Tall section';
    const fail = (message: string) => issue('error', `${tag}: ${message}`, t.id);
    if (!(t.x1 > t.x0)) {
      fail('its far end must be past its near end.');
      continue;
    }
    if (t.x0 < -EPS || t.x1 > L + EPS) {
      fail(`runs ${fmt(Math.max(-t.x0, t.x1 - L))} past the end of the wall.`);
      continue;
    }
    if (!(t.height >= 48) || t.height > 480) {
      fail('enter a height between 4 and 40 feet.');
      continue;
    }
    if (Math.abs(t.height - H) < EPS) continue;
    const own = (t.x0 > EPS ? stepWidth : 0) + (t.x1 < L - EPS ? stepWidth : 0) || T;
    if (t.x1 - t.x0 < own - EPS) {
      fail(`make it at least ${fmt(own)} long to fit the step studs.`);
      continue;
    }
    const prev = accepted[accepted.length - 1];
    const before = prev ? prev.x1 : 0;
    if (t.x0 < before - EPS) {
      fail(`overlaps ${prev!.label || 'another tall section'}.`);
      continue;
    }
    // Room for the step studs plus the end stud (or the other step's studs) on the stretch left over.
    const need = prev ? 2 * stepWidth : stepWidth + T;
    const gap = t.x0 - before;
    if (gap > EPS && gap < need - EPS) {
      fail(`leaves only ${fmt(gap)} to its left; start it at ${prev ? `${prev.label || 'the other section'}'s end` : 'the wall end'} or at least ${fmt(need)} away.`);
      continue;
    }
    const after = L - t.x1;
    if (after > EPS && after < stepWidth + T - EPS) {
      fail(`leaves only ${fmt(after)} to the right end; run it to the end or stop at least ${fmt(stepWidth + T)} short.`);
      continue;
    }
    accepted.push(t);
  }

  const spans: { x0: number; x1: number; height: number; tall?: TallSpec; beam?: BeamSpec }[] = [];
  let x = 0;
  for (const t of accepted) {
    if (t.x0 > x + EPS) spans.push({ x0: x, x1: t.x0, height: H });
    spans.push({ x0: Math.max(0, t.x0), x1: Math.min(L, t.x1), height: t.height, tall: t });
    x = Math.min(L, t.x1);
  }
  if (x < L - EPS) spans.push({ x0: x, x1: L, height: H });

  // Beams carve their stretch out of a span at the wall's own height.
  for (const b of [...(wall.beams ?? [])].sort((p, q) => p.x0 - q.x0)) {
    const fail = (message: string) => issue('error', `${b.label || 'Beam'}: ${message}`, b.id);
    if (!(b.x1 > b.x0) || b.x0 < -EPS || b.x1 > L + EPS) {
      fail('runs past the end of the wall.');
      continue;
    }
    if (!(b.depth < H - T - 24)) {
      fail('is too deep for this wall.');
      continue;
    }
    const i = spans.findIndex((sp) => !sp.tall && !sp.beam && b.x0 >= sp.x0 - EPS && b.x1 <= sp.x1 + EPS);
    if (i < 0) {
      fail('overlaps another beam or a tall stretch.');
      continue;
    }
    const sp = spans[i]!;
    const pieces = [
      ...(b.x0 > sp.x0 + EPS ? [{ x0: sp.x0, x1: b.x0, height: H }] : []),
      { x0: Math.max(sp.x0, b.x0), x1: Math.min(sp.x1, b.x1), height: H, beam: b },
      ...(b.x1 < sp.x1 - EPS ? [{ x0: b.x1, x1: sp.x1, height: H }] : []),
    ];
    spans.splice(i, 1, ...pieces);
  }

  return spans.map((sp) => {
    // A beam crossing the wall sits on a post in a pocket; one running along it gets a single plate under it.
    const plates = sp.beam ? (sp.x1 - sp.x0 <= POCKET + EPS ? 0 : 1) : wall.topPlates;
    const top = sp.beam ? sp.height - sp.beam.depth : sp.height;
    const plateBottom = top - plates * T;
    const rows = panelRows(wall.sheathing, sp.height);
    return { ...sp, plates, plateBottom, studLength: plateBottom - T, postLength: (sp.beam ? top : plateBottom) - T, seams: rows.horizontalSeams, sheathTop: rows.top };
  });
}

/** Single plates under beams running along the wall, cut around the posts that carry them; notes for each beam. */
function placeBeamPlates(sections: WallSection[], posts: PostFrame[], add: AddMember, issue: AddIssue, fmt: Formatter) {
  const full = sections.length === 1;
  for (const sec of sections) {
    const b = sec.beam;
    if (!b) continue;
    const z = sec.height - b.depth - T;
    const under = posts.filter((p) => !p.hasError && p.x1 > sec.x0 + EPS && p.x0 < sec.x1 - EPS).sort((p, q) => p.x0 - q.x0);
    if (sec.plates) {
      let x = sec.x0;
      for (const p of [...under.map((p) => [p.x0, p.x1] as const), [sec.x1, sec.x1] as const]) {
        if (p[0] - x > EPS) add({ role: 'topPlate', x, z, w: p[0] - x, h: T, length: p[0] - x });
        x = Math.max(x, p[1]);
      }
    } else if (!under.length) {
      issue('warning', `${b.label}: nothing carries it. Add a post under the beam.`, b.id);
    }
    issue(
      'note',
      full
        ? `${b.label} (${b.size}) caps this wall, its top flush with the other walls' plates (11/S4.2): frame to its underside, ${fmt(sec.height - b.depth)} off the floor, with a single top plate${under.length ? ' and posts running up to the beam' : ''}.`
        : `${b.label} (${b.size}) breaks the top plates ${fmt(sec.x0)} to ${fmt(sec.x1)} from the left end, its underside ${fmt(sec.height - b.depth)} off the floor (11/S4.2). Tie the plates across it with straps, as with MSTA24 where a header interrupts them (10/S4.1); confirm with the engineer.`,
      b.id,
    );
  }
}

/**
 * Posts replace the layout studs they cover; one at a wall end replaces the end stud. They can't share
 * space with an opening's framing, a plate step or another post.
 */
function placePosts(
  wall: WallSpec,
  sectionOf: (x: number, w?: number) => WallSection,
  openings: OpeningFrame[],
  stepZones: (readonly [number, number])[],
  add: AddMember,
  issue: AddIssue,
  fmt: Formatter,
): PostFrame[] {
  const L = wall.length;
  const out: PostFrame[] = [];
  for (const spec of wall.posts ?? []) {
    const type = postType(spec.type);
    const x0 = spec.x;
    const x1 = spec.x + type.width;
    const tag = spec.label || 'Post';
    const frame: PostFrame = { spec, type, x0, x1, hasError: true };
    out.push(frame);
    const fail = (message: string) => issue('error', `${tag}: ${message}`, spec.id);
    const overlaps = (a: number, b: number) => x0 < b - EPS && x1 > a + EPS;

    if (x0 < -EPS || x1 > L + EPS) {
      fail(`runs ${fmt(Math.max(-x0, x1 - L))} past the end of the wall.`);
      continue;
    }
    if ((x0 > EPS && x0 < T - EPS) || (x1 < L - EPS && x1 > L - T + EPS)) {
      fail(`runs into the end stud. Put it at the end of the wall, or at least ${fmt(T)} in from it.`);
      continue;
    }
    const o = openings.find((op) => overlaps(op.zoneStart, op.zoneEnd));
    if (o) {
      o.hasError = true;
      fail(`overlaps ${o.spec.label}'s framing. Move one of them, or let the opening's king studs carry the beam.`);
      continue;
    }
    if (stepZones.some(([a, b]) => overlaps(a, b))) {
      fail('overlaps the studs at a plate step. Move it clear of the step.');
      continue;
    }
    const other = out.find((p) => p !== frame && !p.hasError && overlaps(p.x0, p.x1));
    if (other) {
      fail(`overlaps ${other.spec.label || 'another post'}.`);
      continue;
    }
    const sec = sectionOf(x0, type.width);
    if (x0 < sec.x0 - EPS || x1 > sec.x1 + EPS) {
      fail('straddles a change in wall height.');
      continue;
    }
    frame.hasError = false;
    const len = sec.postLength;
    if (type.plies === 1) {
      add({ role: 'post', x: x0, z: T, w: type.width, h: len, size: type.label, length: len, postId: spec.id });
    } else {
      for (let i = 0; i < type.plies; i++) add({ role: 'post', x: x0 + i * T, z: T, w: T, h: len, length: len, postId: spec.id });
    }
  }
  return out;
}

/**
 * 3/S4.1: on the tall side of each plate step, 2x flat blocking in line with the lower plates for at
 * least 4'-0", so a CS16 strap over the sheathing can tie the lower plates to it.
 */
function placeStepBlocking(steps: PlateStep[], sections: WallSection[], members: Member[], add: AddMember, issue: AddIssue, fmt: Formatter) {
  for (const st of steps) {
    const tallRight = st.low === 'left';
    const sec = sections.find((p) => (tallRight ? Math.abs(p.x0 - st.x) < EPS : Math.abs(p.x1 - st.x) < EPS))!;
    const bz = st.strapZ - BLOCK_FACE / 2;
    const verticals = members
      .filter((m) => VERTICAL.includes(m.role) && m.x >= sec.x0 - EPS && m.x + m.w <= sec.x1 + EPS && m.z <= bz + EPS && m.z + m.h >= bz + BLOCK_FACE - EPS)
      .sort((a, b) => (tallRight ? a.x - b.x : b.x - a.x));
    let reach = STEP_STUDS * T;
    let extent: [number, number] | null = null;
    for (let i = 1; i < verticals.length && reach < STEP_BLOCKING - EPS; i++) {
      const a = verticals[i - 1]!;
      const b = verticals[i]!;
      const x0 = tallRight ? a.x + a.w : b.x + b.w;
      const x1 = tallRight ? b.x : a.x;
      if (x1 - x0 < EPS) continue;
      const flats = members.filter((m) => FLAT.includes(m.role) && overlapsX(m, x0, x1) && m.z < bz + BLOCK_FACE - EPS && m.z + m.h > bz + EPS);
      // Another step's blocking already fills the bay when two steps are close together.
      if (flats.some((m) => m.role !== 'stepBlocking')) break;
      if (!flats.length && x1 - x0 >= MIN_BLOCK - EPS) add({ role: 'stepBlocking', x: x0, z: bz, w: x1 - x0, h: BLOCK_FACE, size: '2x4', length: x1 - x0 });
      extent = extent ? [Math.min(extent[0], x0), Math.max(extent[1], x1)] : [x0, x1];
      reach = Math.abs((tallRight ? x1 : x0) - st.x);
    }
    st.blocking = extent;
    const where = `The plate step ${fmt(st.x)} from the left end`;
    if (reach < STEP_BLOCKING - EPS) {
      issue('warning', `${where} only has ${fmt(reach)} of blocking on its tall side; 3/S4.1 calls for 4'-0" minimum.`);
    }
    issue('note', `${where}: (2) studs each side, flat blocking in line with the lower plates and a CS16 strap over the sheathing, (14) 8d to the plates and (5) 8d to each block (3/S4.1).`);
  }
}

/**
 * California corners: where another wall butts into an end of this one, a stud laid flat at the inside
 * face, nailed against the end stud so the two make an L, runs past the inside corner so the drywall has
 * something to land on there and the butting wall's end stud nails to it. It moves along only when this
 * wall is too shallow for it to reach past the corner. Skipped where framing is already there (a king,
 * jack or post), and swapped for a single stud, or a note to use drywall clips, when an opening leaves
 * no room for it.
 */
function placeCornerBackers(wall: WallSpec, sectionOf: (x: number, w?: number) => WallSection, members: Member[], add: AddMember, issue: AddIssue) {
  const L = wall.length;
  const face = DEPTH[wall.studs ?? '2x6'];
  for (const side of ['left', 'right'] as const) {
    const d = wall.california?.[side] ?? 0;
    if (!(d > 0)) continue;
    const corner = side === 'left' ? d : L - d;
    const band: [number, number] = side === 'left' ? [corner, corner + DRYWALL_BACKING] : [corner - DRYWALL_BACKING, corner];
    // A king, jack or post already giving most of that nailing is enough.
    const backed = members.filter(isFixed).reduce((n, m) => n + Math.max(0, Math.min(m.x + m.w, band[1]) - Math.max(m.x, band[0])), 0);
    if (backed >= DRYWALL_BACKING * 0.6) continue;
    const blocked = (a: number, b: number) =>
      a < -EPS || b > L + EPS || members.some((m) => m.role !== 'plate' && m.role !== 'topPlate' && m.layoutCenter == null && overlapsX(m, a, b));
    // Flush against the end stud, reaching at least a stud's thickness past the corner.
    const start = Math.max(T, d + T - face);
    const flat: [number, number] = side === 'left' ? [start, start + face] : [L - start - face, L - start];
    const single: [number, number] = side === 'left' ? [corner, corner + T] : [corner - T, corner];
    const piece = [flat, single].find(([a, b]) => !blocked(a, b));
    if (!piece) {
      issue('note', `No room for a California corner at the ${side} end; use drywall clips in that corner.`);
      continue;
    }
    // Common layout studs in the way give way to it.
    for (let i = members.length - 1; i >= 0; i--) {
      const m = members[i]!;
      if (m.layoutCenter != null && overlapsX(m, piece[0], piece[1])) members.splice(i, 1);
    }
    const w = piece[1] - piece[0];
    const len = sectionOf(piece[0], w).studLength;
    add({ role: 'cornerBacker', x: piece[0], z: T, w, h: len, length: len });
  }
}

/**
 * Where another wall butts in partway along this one: framing each side of it with ladder blocking
 * between, so its end stud and the drywall on both faces have something to fasten to. Framing already
 * there (a post, king or end stud) counts; common layout studs in the way are moved.
 */
function placeIntersections(
  wall: WallSpec,
  openings: OpeningFrame[],
  members: Member[],
  add: AddMember,
  issue: AddIssue,
  studAt: (x: number) => { z: number; w: number; h: number; length: number },
  fmt: Formatter,
): IntersectionFrame[] {
  const L = wall.length;
  const out: IntersectionFrame[] = [];
  for (const spec of wall.intersections ?? []) {
    const tag = spec.label || 'Wall';
    const x0 = spec.x - spec.width / 2;
    const x1 = spec.x + spec.width / 2;
    const frame: IntersectionFrame = { spec, x0, x1, bay: null, hasError: true };
    out.push(frame);
    if (x0 < -EPS || x1 > L + EPS) {
      issue('error', `${tag}: runs ${fmt(Math.max(-x0, x1 - L))} past the end of the wall.`, spec.id);
      continue;
    }
    const o = openings.find((op) => x0 < op.spec.x + op.spec.width - EPS && x1 > op.spec.x + EPS);
    if (o) {
      issue('warning', `${tag}: meets this wall inside ${o.spec.label}'s rough opening, with nothing to fasten to below the header. Move one of them.`, spec.id);
      continue;
    }
    frame.hasError = false;

    // The stretch that needs backing: the intersecting wall plus drywall nailing each side.
    const b0 = x0 - DRYWALL_BACKING;
    const b1 = x1 + DRYWALL_BACKING;
    const fixed = members.filter(isFixed);
    const gaps: [number, number][] = [];
    let at = b0;
    for (const m of [...fixed].filter((m) => overlapsX(m, b0, b1)).sort((a, b) => a.x - b.x)) {
      if (m.x > at + EPS) gaps.push([at, m.x]);
      at = Math.max(at, m.x + m.w);
    }
    if (at < b1 - EPS) gaps.push([at, b1]);
    if (!gaps.length) continue;

    let a = gaps[0]![0];
    let b = gaps[gaps.length - 1]![1];
    const added: [number, number][] = [];
    if (Math.abs(a - b0) < EPS) {
      const near = fixed.filter((m) => m.x + m.w <= b0 + EPS && m.x + m.w >= b0 - T - EPS).sort((p, q) => q.x + q.w - (p.x + p.w))[0];
      if (near) a = near.x + near.w;
      else added.push([b0 - T, b0]);
    }
    if (Math.abs(b - b1) < EPS) {
      const near = fixed.filter((m) => m.x >= b1 - EPS && m.x <= b1 + T + EPS).sort((p, q) => p.x - q.x)[0];
      if (near) b = near.x;
      else added.push([b1, b1 + T]);
    }
    const lo = Math.min(a, ...added.map((s) => s[0]));
    const hi = Math.max(b, ...added.map((s) => s[1]));
    for (let i = members.length - 1; i >= 0; i--) {
      const m = members[i]!;
      if (m.layoutCenter != null && overlapsX(m, lo, hi)) members.splice(i, 1);
    }
    for (const [s0] of added) {
      if (s0 < -EPS || s0 + T > L + EPS || members.some((m) => isFixed(m) && overlapsX(m, s0, s0 + T))) {
        issue('warning', `${tag}: no room for a backer stud beside it; check the framing there.`, spec.id);
        continue;
      }
      add({ role: 'partitionStud', x: s0, ...studAt(s0) });
    }
    frame.bay = [a, b];
  }
  return out;
}

/** 2x4 flat blocks across each intersection's bay, every 24" up the wall. */
function placeLadderBlocking(intersections: IntersectionFrame[], sectionOf: (x: number, w?: number) => WallSection, members: Member[], add: AddMember) {
  for (const it of intersections) {
    if (!it.bay) continue;
    const [a, b] = it.bay;
    const top = sectionOf(a, b - a).plateBottom;
    for (let zc = LADDER_SPACING; zc + BLOCK_FACE / 2 <= top - T; zc += LADDER_SPACING) {
      const bz = zc - BLOCK_FACE / 2;
      const inside = members
        .filter((m) => VERTICAL.includes(m.role) && m.x > a + EPS && m.x + m.w < b - EPS && m.z <= bz + EPS && m.z + m.h >= bz + BLOCK_FACE - EPS)
        .sort((p, q) => p.x - q.x);
      let x = a;
      for (const end of [...inside.map((m) => [m.x, m.x + m.w] as const), [b, b] as const]) {
        const [e0, e1] = end;
        if (e0 - x >= MIN_BLOCK - EPS && !members.some((m) => FLAT.includes(m.role) && overlapsX(m, x, e0) && m.z < bz + BLOCK_FACE - EPS && m.z + m.h > bz + EPS)) {
          add({ role: 'ladder', x, z: bz, w: e0 - x, h: BLOCK_FACE, size: '2x4', length: e0 - x });
        }
        x = e1;
      }
    }
  }
}

/**
 * Puts framing under each vertical sheathing seam: two studs straddling it (double) or one
 * centered on it (single). Layout studs in the way are replaced; end studs and kings stay.
 */
function placeSeamStuds(
  wall: WallSpec,
  sheet: SheathingLayout,
  members: Member[],
  openings: OpeningFrame[],
  posts: PostFrame[],
  add: AddMember,
  issue: AddIssue,
  studAt: (x: number) => { z: number; w: number; h: number; length: number },
  fmt: Formatter,
) {
  const L = wall.length;
  const end = wall.layoutFrom;
  const double = wall.sheathing.seamStuds === 'double';

  for (const seam of sheet.verticalSeams) {
    const s = seam.x;
    // Lands on an end stud or a post.
    if (s <= T + EPS || s >= L - T - EPS) continue;
    if (posts.some((p) => !p.hasError && s > p.x0 + EPS && s < p.x1 - EPS)) continue;

    const o = openings.find((op) => s > op.zoneStart + EPS && s < op.zoneEnd - EPS);
    if (o) {
      const own = members.filter((m) => m.openingId === o.spec.id);
      const under = (m: Member) => s >= m.x - EPS && s <= m.x + m.w + EPS;
      const onJambs = own.some((m) => (m.role === 'king' || m.role === 'jack') && under(m));
      // Over the opening the sheathing is cut away; it needs backing above (cripple, or the header or
      // filler filling the space) and below (a cripple under a sill; doors have nothing below).
      const above = o.gapAbove < 1 / 32 || own.some((m) => (m.role === 'crippleTop' || m.role === 'filler') && under(m));
      const below = o.spec.type === 'door' || !own.some((m) => m.role === 'crippleBottom') || own.some((m) => m.role === 'crippleBottom' && under(m));
      const covered = onJambs || (above && below);
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
      add({ role: 'seamStud', x, ...studAt(x) });
    }
  }
}

/**
 * Adds a 2x4 on the flat, centered on each horizontal seam, in every bay that has framing on both
 * sides at that height and isn't a rough opening, header or sill. Flat, its 3 1/2" face backs the seam.
 */
function placeSeamBlocking(sections: WallSection[], members: Member[], openings: OpeningFrame[], add: AddMember) {
  for (const sec of sections) {
    for (const z of sec.seams) {
      // Seams on the plates already have backing.
      if (z <= T + EPS || z >= sec.plateBottom - EPS) continue;
      const bz = Math.min(Math.max(z - BLOCK_FACE / 2, T), sec.plateBottom - BLOCK_FACE);
      const verticals = members
        .filter(
          (m) =>
            VERTICAL.includes(m.role) &&
            m.x >= sec.x0 - EPS &&
            m.x + m.w <= sec.x1 + EPS &&
            m.z <= bz + EPS &&
            m.z + m.h >= bz + BLOCK_FACE - EPS,
        )
        .sort((a, b) => a.x - b.x);
      for (let i = 1; i < verticals.length; i++) {
        const x0 = verticals[i - 1]!.x + verticals[i - 1]!.w;
        const x1 = verticals[i]!.x;
        // Studs this close back the seam themselves; a sliver of block can't be nailed.
        if (x1 - x0 < MIN_BLOCK) continue;
        const hitsFlat = members.some((m) => FLAT.includes(m.role) && overlapsX(m, x0, x1) && m.z < bz + BLOCK_FACE - EPS && m.z + m.h > bz + EPS);
        const inOpening = openings.some(
          (o) => x0 < o.spec.x + o.spec.width - EPS && x1 > o.spec.x + EPS && bz < o.roTop - EPS && bz + BLOCK_FACE > o.roBottom + EPS,
        );
        if (hitsFlat || inOpening) continue;
        add({ role: 'blocking', x: x0, z: bz, w: x1 - x0, h: BLOCK_FACE, size: '2x4', length: x1 - x0, seamHeight: z });
      }
    }
  }
}

function buildCutList(
  wall: WallSpec,
  members: Member[],
  openings: OpeningFrame[],
  sections: WallSection[],
  posts: PostFrame[],
  intersections: IntersectionFrame[],
): CutGroup[] {
  const depth = DEPTH[wall.studs ?? '2x6'];
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
      if (h.width < depth) g.notes.push(`${toFraction(depth - h.width)}" rigid foam to fill the wall`);
      else if (h.width > depth) g.notes.push(`${toFraction(h.width - depth)}" wider than the wall`);
      if (wall.exterior && g.length > LONG_HEADER) g.notes.push('A35 clip each end (10/S4.1)');
    }
    if (g.role === 'headPlate') g.notes.push(`Flat under the header; doubled at exterior openings over 8'-0" (10/S4.1)`);
    if (g.role === 'seamStud') {
      g.notes.push(wall.sheathing.seamStuds === 'double' ? 'Pairs straddle vertical sheathing seams' : 'Centered under vertical sheathing seams');
    }
    if (g.role === 'blocking' && !g.notes.length) g.notes.push('2x4 on the flat, centered on horizontal sheathing seams');
    if (g.role === 'cornerBacker') g.notes.push(members.some((m) => m.group === g.key && m.w > T) ? 'Laid flat against the end stud at the inside face, past the wall butting in' : 'Just past the wall butting in, for drywall');
    if (g.role === 'partitionStud') {
      const labels = intersections.filter((i) => i.bay && !i.hasError).map((i) => i.spec.label);
      g.notes.push(`Each side of ${labels.join(', ') || 'an intersecting wall'}`);
    }
    if (g.role === 'ladder') g.notes.push(`2x4 on the flat every 24" between the backers, for the intersecting wall and its drywall`);
    if (g.role === 'stepBlocking') g.notes.push(`2x4 on the flat in line with the lower plates, 4'-0" min past each plate step; CS16 strap over (3/S4.1)`);
    if (g.role === 'post') {
      const builtUp = g.size === (wall.studs ?? '2x6');
      const labels = posts.filter((p) => !p.hasError && (p.type.plies === 1 ? p.type.label === g.size : builtUp)).map((p) => p.spec.label);
      if (labels.length) g.notes.push(`At ${labels.join(', ')}`);
      if (builtUp) g.notes.push('Built-up: nail the plies together');
      else if (g.size === '4x4' && depth > 3.5) g.notes.push(`${toFraction(depth - 3.5)}" short of the wall depth`);
    }
    if (g.role === 'stud' || g.role === 'seamStud' || g.role === 'king') {
      const tall = sections.find((p) => p.tall && round16(p.studLength) === g.length);
      if (tall) g.notes.push(`Full height at ${tall.tall!.label || 'the tall section'}`);
      const pre = PRECUTS[String(g.length)];
      if (pre) g.notes.push(`Matches ${pre} studs`);
    }
  }

  return [...groups.values()].sort((a, b) => ROLES[a.role].order - ROLES[b.role].order || b.length - a.length);
}
