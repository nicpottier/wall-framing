import { DEPTH, TYPICAL_HEADER, headerName, headerType, isHeaderTypeId, isPostTypeId, postType, type HeaderTypeId, type LumberSize, type PostTypeId } from '../lib/lumber';
import type { PlanRun } from '../lib/plan';
import type { BeamSpec, IntersectionSpec, Issue, LayoutFrom, OpeningSpec, OpeningType, PostSpec, TallSpec, WallSpec } from '../lib/framing';
import type { CornerType, PanelOrientation } from '../lib/sheathing';
import { parseLength, toFraction } from '../lib/units';

export type WallEnd = 'left' | 'right';
export type { PlanRun } from '../lib/plan';

/** What the user typed. Length fields stay as text until parsed so "92 5/8" or "4-6" can be entered naturally. */
export interface OpeningInput {
  id: string;
  type: OpeningType;
  label: string;
  /** Which end of the wall the position is measured from. */
  from: WallEnd;
  /** Wall end to the centerline of the opening. */
  offset: string;
  /** Window or door unit size; the rough opening adds the wall's allowance. */
  width: string;
  height: string;
  /** Rough opening as "W x H" when it shouldn't come from the allowance. Blank uses the allowance. */
  ro: string;
  /** Windows only. Blank uses the wall's window head height. */
  headHeight: string;
  header: HeaderTypeId | 'auto';
  jacksPerSide: 'auto' | '1' | '2';
}

/** A post in the wall, positioned to its centerline like an opening. */
export interface PostInput {
  id: string;
  label: string;
  from: WallEnd;
  offset: string;
  type: PostTypeId;
}

/** A stretch framed to its own height (balloon framing), measured from one end of the wall to each of its ends. */
export interface TallInput {
  id: string;
  label: string;
  from: WallEnd;
  start: string;
  end: string;
  height: string;
}

/**
 * A dropped beam bearing on the wall: crossing it (positioned to its centerline, over a post), along a
 * stretch of it (both ends), or along its full length.
 */
export interface BeamInput {
  id: string;
  label: string;
  type: HeaderTypeId;
  span: 'cross' | 'along' | 'full';
  from: WallEnd;
  /** Crossing: to the beam's centerline. */
  offset: string;
  /** Along: each end of the stretch. */
  start: string;
  end: string;
}

/** Another wall butting into this one partway along, positioned to its centerline. */
export interface IntersectionInput {
  id: string;
  label: string;
  from: WallEnd;
  offset: string;
  size: LumberSize;
}

/** Settings a wall can inherit from a project's defaults. */
export interface WallSettings {
  height: string;
  studSize: LumberSize;
  spacing: string;
  layoutFrom: LayoutFrom;
  topPlates: '1' | '2';
  exterior: 'yes' | 'no';
  sillPlies: '1' | '2';
  headerMount: 'dropped' | 'onJacks';
  /** Header for openings set to Auto. */
  defaultHeader: HeaderTypeId;
  /** Floor to the top of window rough openings. */
  windowHeadHeight: string;
  /** How much larger the rough opening is than the unit. */
  /** Windows: rough opening past the unit at each side, at the top, and at the bottom (for the sill pan and shims). */
  windowRoSide: string;
  windowRoTop: string;
  windowRoBottom: string;
  doorRoWidth: string;
  doorRoHeight: string;
  sheathingOrientation: PanelOrientation;
  sheathingThickness: string;
  /** Floor to the bottom of the first full panel row. */
  sheathingStart: string;
  cornerLeft: CornerType;
  cornerRight: CornerType;
  seamStuds: 'single' | 'double';
  blockSeams: 'yes' | 'no';
  /** Interior walls usually have none. */
  sheathed: 'yes' | 'no';
  /** California corner at each end: the size of the wall butting in there, or none. */
  californiaLeft: 'none' | LumberSize;
  californiaRight: 'none' | LumberSize;
}

export interface WallInput extends WallSettings {
  id: string;
  name: string;
  length: string;
  /** Free text kept with the wall; doesn't affect framing. */
  notes: string;
  /**
   * Where the wall sits on the floor plan: its left end, on the face it is seen from, measured east (x)
   * and north (y) from the plan origin, and the direction it runs. Blank leaves it off the plan.
   */
  planX: string;
  planY: string;
  planRun: '' | PlanRun;
  openings: OpeningInput[];
  posts: PostInput[];
  tall: TallInput[];
  intersections: IntersectionInput[];
  beams: BeamInput[];
}

export type WallSettingKey = keyof WallSettings | 'name' | 'length' | 'notes' | 'planX' | 'planY' | 'planRun';

export const DEFAULT_SETTINGS: WallSettings = {
  height: '97 1/8',
  studSize: '2x6',
  spacing: '16',
  layoutFrom: 'left',
  topPlates: '2',
  exterior: 'yes',
  sillPlies: '1',
  headerMount: 'dropped',
  defaultHeader: TYPICAL_HEADER,
  windowHeadHeight: '82 1/2',
  windowRoSide: '3/8',
  windowRoTop: '3/8',
  windowRoBottom: '1 1/2',
  doorRoWidth: '2',
  doorRoHeight: '2 1/2',
  sheathingOrientation: 'vertical',
  sheathingThickness: '2',
  sheathingStart: '12',
  cornerLeft: 'none',
  cornerRight: 'none',
  seamStuds: 'double',
  blockSeams: 'yes',
  sheathed: 'yes',
  californiaLeft: 'none',
  californiaRight: 'none',
};

export const EXAMPLE_WALL: WallInput = {
  ...DEFAULT_SETTINGS,
  id: 'w1',
  name: 'Wall A, south elevation',
  length: '20-0',
  notes: '',
  planX: '',
  planY: '',
  planRun: '',
  openings: [
    { id: 'o1', type: 'window', label: 'W1', from: 'left', offset: '4-6', width: '3-9', height: '3-7 1/2', ro: '', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
    { id: 'o2', type: 'door', label: 'D1', from: 'right', offset: '5-9', width: '3-0', height: '6-8', ro: '', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
  ],
  posts: [],
  tall: [],
  intersections: [],
  beams: [],
};

const UNIT_DEFAULTS: Record<OpeningType, Pick<OpeningInput, 'width' | 'height'>> = {
  window: { width: '3-0', height: '4-0' },
  door: { width: '3-0', height: '6-8' },
};

/**
 * Reads an opening size: "W x H" with any lengths ("45 x 43 1/2", "3-0 x 4-6"), or the four-digit
 * callout used on window and door schedules, feet and inches of width then height ("3046" is
 * 3'-0" × 4'-6", "2868" is 2'-8" × 6'-8").
 */
export function parseSize(text: string): { width: number; height: number } | null {
  const t = text.trim();
  const callout = t.match(/^(\d)(\d)(\d)(\d)$/);
  if (callout) {
    const [, wf, wi, hf, hi] = callout.map(Number) as [number, number, number, number, number];
    return { width: wf * 12 + wi, height: hf * 12 + hi };
  }
  const parts = t.split(/\s+[x×]\s+/i);
  if (parts.length !== 2) return null;
  const width = parseLength(parts[0]);
  const height = parseLength(parts[1]);
  return width > 0 && height > 0 ? { width, height } : null;
}

// ---------- Resolving an opening ----------

export type ResolvedOpening =
  | {
      ok: true;
      /** Wall's left end to the left edge of the rough opening. */
      x: number;
      /** Wall's left end to the centerline. */
      center: number;
      roWidth: number;
      roHeight: number;
      /** Floor to the bottom of the rough opening (0 for doors). */
      sill: number;
      /** Floor to the top of the rough opening. */
      headHeight: number;
      unitWidth: number;
      unitHeight: number;
      /** Rough opening bottom to the bottom of the unit. */
      unitBottom: number;
      /** True when a window uses the wall's head height. */
      defaultHead: boolean;
    }
  | { ok: false; message: string };

const isLength = (v: number) => Number.isFinite(v) && v >= 0;

/** Rough opening size: an explicit R.O., or the unit size plus the wall's allowance. */
export function roughOpening(o: OpeningInput, wall: WallSettings): { width: number; height: number } | string {
  const kind = o.type === 'window' ? 'window' : 'door';
  if (o.ro.trim()) return parseSize(o.ro) ?? `enter the rough opening as width x height, like 48 x 46 1/2`;
  const unitWidth = parseLength(o.width);
  const unitHeight = parseLength(o.height);
  if (!(unitWidth > 0) || !(unitHeight > 0)) return `enter a valid ${kind} width and height`;
  const a = allowances(o.type, wall);
  if (!a) return `enter valid ${kind} rough opening allowances`;
  return { width: unitWidth + a.width, height: unitHeight + a.height };
}

/** Rough opening past the unit: overall width and height, and how much of the height is below the unit. */
export function allowances(type: OpeningType, wall: WallSettings): { width: number; height: number; bottom: number } | null {
  if (type === 'window') {
    const side = parseLength(wall.windowRoSide);
    const top = parseLength(wall.windowRoTop);
    const bottom = parseLength(wall.windowRoBottom);
    return isLength(side) && isLength(top) && isLength(bottom) ? { width: 2 * side, height: top + bottom, bottom } : null;
  }
  const width = parseLength(wall.doorRoWidth);
  const height = parseLength(wall.doorRoHeight);
  return isLength(width) && isLength(height) ? { width, height, bottom: 0 } : null;
}

/**
 * Settings saved before windows had separate side, top and bottom allowances: split the old
 * overall width and height evenly.
 */
export function upgradeSettings<S extends Partial<WallSettings>>(s: S & { windowRoWidth?: string; windowRoHeight?: string }): S {
  const { windowRoWidth, windowRoHeight, ...rest } = s;
  if (rest.windowRoSide != null || windowRoWidth == null) return rest as S;
  const w = parseLength(windowRoWidth);
  const h = parseLength(windowRoHeight ?? '');
  return {
    ...rest,
    windowRoSide: Number.isFinite(w) ? toFraction(w / 2) : DEFAULT_SETTINGS.windowRoSide,
    windowRoTop: Number.isFinite(h) ? toFraction(h / 2) : DEFAULT_SETTINGS.windowRoTop,
    windowRoBottom: Number.isFinite(h) ? toFraction(h / 2) : DEFAULT_SETTINGS.windowRoBottom,
  } as S;
}

/** Turns a unit size, centerline position and the wall's allowances into a rough opening. */
export function resolveOpening(o: OpeningInput, wall: WallInput): ResolvedOpening {
  const tag = o.label || '?';
  const window = o.type === 'window';
  const ro = roughOpening(o, wall);
  if (typeof ro === 'string') return { ok: false, message: `${tag}: ${ro}.` };
  const unitWidth = parseLength(o.width);
  const unitHeight = parseLength(o.height);
  const offset = parseLength(o.offset);
  if (!isLength(offset)) return { ok: false, message: `${tag}: enter a valid position.` };

  let center = offset;
  if (o.from === 'right') {
    const L = parseLength(wall.length);
    if (!Number.isFinite(L)) return { ok: false, message: `${tag}: enter a wall length to measure from the right end.` };
    center = L - offset;
  }
  const x = center - ro.width / 2;
  // The unit sits the bottom allowance up from the rough sill, or as close to that as an explicit R.O. allows.
  const below = allowances(o.type, wall)?.bottom ?? 0;
  const unitBottom = unitHeight > 0 ? Math.max(0, Math.min(below, ro.height - unitHeight)) : 0;
  const base = { x, center, roWidth: ro.width, roHeight: ro.height, unitWidth, unitHeight, unitBottom };

  if (!window) return { ok: true, ...base, sill: 0, headHeight: ro.height, defaultHead: false };

  const defaultHead = o.headHeight.trim() === '';
  const headHeight = parseLength(defaultHead ? wall.windowHeadHeight : o.headHeight);
  if (!(headHeight > 0)) {
    return { ok: false, message: defaultHead ? `${tag}: enter a valid window head height for the wall.` : `${tag}: enter a valid head height.` };
  }
  const sill = headHeight - ro.height;
  if (sill < 0) {
    return { ok: false, message: `${tag}: the rough opening (${toFraction(ro.height)}") is taller than its head height (${toFraction(headHeight)}"). Raise the head height or use a shorter window.` };
  }
  return { ok: true, ...base, sill, headHeight, defaultHead };
}

// ---------- Reducer ----------

export type WallAction =
  | { type: 'set'; key: WallSettingKey; value: string }
  | { type: 'addOpening'; kind: OpeningType }
  | { type: 'updateOpening'; id: string; patch: Partial<OpeningInput> }
  | { type: 'setOpeningType'; id: string; kind: OpeningType }
  | { type: 'removeOpening'; id: string }
  | { type: 'addPost' }
  | { type: 'updatePost'; id: string; patch: Partial<PostInput> }
  | { type: 'removePost'; id: string }
  | { type: 'addTall' }
  | { type: 'updateTall'; id: string; patch: Partial<TallInput> }
  | { type: 'removeTall'; id: string }
  | { type: 'addIntersection' }
  | { type: 'updateIntersection'; id: string; patch: Partial<IntersectionInput> }
  | { type: 'removeIntersection'; id: string }
  | { type: 'addBeam' }
  | { type: 'updateBeam'; id: string; patch: Partial<BeamInput> }
  | { type: 'removeBeam'; id: string };

const nextLabel = (openings: OpeningInput[], kind: OpeningType, except?: string) => {
  const p = kind === 'door' ? 'D' : 'W';
  let k = 1;
  while (openings.some((o) => o.id !== except && o.label === `${p}${k}`)) k++;
  return `${p}${k}`;
};

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function wallReducer(state: WallInput, action: WallAction): WallInput {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'addOpening': {
      const L = parseLength(state.length) || 240;
      const opening: OpeningInput = {
        id: newId('o'),
        type: action.kind,
        label: nextLabel(state.openings, action.kind),
        from: 'left',
        offset: '0',
        ...UNIT_DEFAULTS[action.kind],
        ro: '',
        headHeight: '',
        header: 'auto',
        jacksPerSide: 'auto',
      };
      // Place it 24" past the rightmost opening, or centered if that runs off the wall.
      const placed = state.openings.map((o) => resolveOpening(o, state)).filter((r) => r.ok);
      const ro = roughOpening(opening, state);
      const roWidth = typeof ro === 'string' ? 36 : ro.width;
      let x = placed.length ? Math.max(...placed.map((r) => r.x + r.roWidth)) + 24 : 24;
      if (x + roWidth + 6 > L) x = Math.max(6, Math.round((L - roWidth) / 2));
      opening.offset = toFraction(x + roWidth / 2);
      return { ...state, openings: [...state.openings, opening] };
    }
    case 'updateOpening':
      return { ...state, openings: state.openings.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)) };
    case 'setOpeningType':
      return {
        ...state,
        openings: state.openings.map((o) => {
          if (o.id !== action.id || o.type === action.kind) return o;
          const next: OpeningInput = { ...o, type: action.kind };
          if (/^[DW]\d+$/.test(o.label)) next.label = nextLabel(state.openings, action.kind, o.id);
          const was = UNIT_DEFAULTS[o.type];
          if (o.width === was.width && o.height === was.height) Object.assign(next, UNIT_DEFAULTS[action.kind]);
          return next;
        }),
      };
    case 'removeOpening':
      return { ...state, openings: state.openings.filter((o) => o.id !== action.id) };
    case 'addPost': {
      let k = 1;
      while (state.posts.some((p) => p.label === `P${k}`)) k++;
      const L = parseLength(state.length) || 240;
      const post: PostInput = { id: newId('p'), label: `P${k}`, from: 'left', offset: toFraction(Math.round(L / 2)), type: '6x6' };
      return { ...state, posts: [...state.posts, post] };
    }
    case 'updatePost':
      return { ...state, posts: state.posts.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'removePost':
      return { ...state, posts: state.posts.filter((p) => p.id !== action.id) };
    case 'addTall': {
      const L = parseLength(state.length) || 240;
      const H = parseLength(state.height) || 97.125;
      const start = Math.round(L / 3);
      const tall: TallInput = {
        id: newId('t'),
        label: state.tall.length ? `Tall ${state.tall.length + 1}` : 'Stair',
        from: 'left',
        start: toFraction(start),
        end: toFraction(Math.min(L, start + 96)),
        height: toFraction(H + 12),
      };
      return { ...state, tall: [...state.tall, tall] };
    }
    case 'updateTall':
      return { ...state, tall: state.tall.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case 'removeTall':
      return { ...state, tall: state.tall.filter((t) => t.id !== action.id) };
    case 'addIntersection': {
      const L = parseLength(state.length) || 240;
      let k = 1;
      while (state.intersections.some((t) => t.label === `T${k}`)) k++;
      const it: IntersectionInput = { id: newId('i'), label: `T${k}`, from: 'left', offset: toFraction(Math.round(L / 2)), size: '2x4' };
      return { ...state, intersections: [...state.intersections, it] };
    }
    case 'updateIntersection':
      return { ...state, intersections: state.intersections.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case 'removeIntersection':
      return { ...state, intersections: state.intersections.filter((t) => t.id !== action.id) };
    case 'addBeam': {
      const L = parseLength(state.length) || 240;
      let k = 1;
      while (state.beams.some((b) => b.label === `B${k}`)) k++;
      const beam: BeamInput = { id: newId('b'), label: `B${k}`, type: 'gl-5.5x11.875', span: 'cross', from: 'left', offset: toFraction(Math.round(L / 2)), start: '', end: '' };
      return { ...state, beams: [...state.beams, beam] };
    }
    case 'updateBeam':
      return { ...state, beams: state.beams.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) };
    case 'removeBeam':
      return { ...state, beams: state.beams.filter((b) => b.id !== action.id) };
  }
}

/** A beam's sides (or ends) from the wall's left end, or a message. */
export function resolveBeam(b: BeamInput, wall: WallInput): { x0: number; x1: number } | string {
  const tag = b.label || 'Beam';
  const L = parseLength(wall.length);
  if (!Number.isFinite(L)) return `${tag}: enter a wall length first.`;
  if (!isHeaderTypeId(b.type)) return `${tag}: pick a beam size.`;
  if (b.span === 'full') return { x0: 0, x1: L };
  const flip = (a: number, c: number) => (b.from === 'left' ? [a, c] : [L - c, L - a]) as [number, number];
  if (b.span === 'cross') {
    const offset = parseLength(b.offset);
    if (!isLength(offset)) return `${tag}: enter a valid position.`;
    const w = headerType(b.type).width;
    const [x0, x1] = flip(offset - w / 2, offset + w / 2);
    return { x0, x1 };
  }
  const a = parseLength(b.start);
  const c = parseLength(b.end);
  if (!isLength(a) || !isLength(c)) return `${tag}: enter valid positions for both ends.`;
  const [x0, x1] = flip(Math.min(a, c), Math.max(a, c));
  return { x0, x1 };
}

export interface Placement {
  /** Plan position of the left end, on the face the wall is seen from. */
  x: number;
  y: number;
  run: PlanRun;
}

/** The wall's plan position, null when it has none, or a message when it can't be read. */
export function resolvePlacement(wall: WallInput): Placement | null | string {
  if (!wall.planRun) return null;
  const x = parseLength(wall.planX);
  const y = parseLength(wall.planY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return `${wall.name || 'Wall'}: enter a plan position for its left end.`;
  return { x, y, run: wall.planRun };
}

/** Wall's left end to an intersecting wall's centerline, or a message. */
export function resolveIntersection(t: IntersectionInput, wall: WallInput): number | string {
  const tag = t.label || 'Wall';
  const offset = parseLength(t.offset);
  if (!isLength(offset)) return `${tag}: enter a valid position.`;
  if (t.from === 'left') return offset;
  const L = parseLength(wall.length);
  return Number.isFinite(L) ? L - offset : `${tag}: enter a wall length to measure from the right end.`;
}

/** Wall's left end to the post's centerline, or a message. */
export function resolvePost(p: PostInput, wall: WallInput): { x: number; center: number } | string {
  const tag = p.label || 'Post';
  const offset = parseLength(p.offset);
  if (!isLength(offset)) return `${tag}: enter a valid position.`;
  if (!isPostTypeId(p.type)) return `${tag}: pick a post size.`;
  let center = offset;
  if (p.from === 'right') {
    const L = parseLength(wall.length);
    if (!Number.isFinite(L)) return `${tag}: enter a wall length to measure from the right end.`;
    center = L - offset;
  }
  return { x: center - postType(p.type).width / 2, center };
}

/** A tall stretch's ends from the wall's left end, and its height, or a message. */
export function resolveTall(t: TallInput, wall: WallInput): { x0: number; x1: number; height: number } | string {
  const tag = t.label || 'Tall section';
  const a = parseLength(t.start);
  const b = parseLength(t.end);
  const height = parseLength(t.height);
  if (!isLength(a) || !isLength(b)) return `${tag}: enter valid positions for both ends.`;
  if (!(height > 0)) return `${tag}: enter a valid height.`;
  let [x0, x1] = [Math.min(a, b), Math.max(a, b)];
  if (t.from === 'right') {
    const L = parseLength(wall.length);
    if (!Number.isFinite(L)) return `${tag}: enter a wall length to measure from the right end.`;
    [x0, x1] = [L - x1, L - x0];
  }
  return { x0, x1, height };
}

// ---------- Parsing ----------

export interface ParsedWall {
  spec: WallSpec;
  /** Openings left out of the spec because a field couldn't be read. */
  inputIssues: Issue[];
}

export function toWallSpec(input: WallInput): ParsedWall {
  const inputIssues: Issue[] = [];
  const openings: OpeningSpec[] = [];
  for (const o of input.openings) {
    const r = resolveOpening(o, input);
    if (!r.ok) {
      inputIssues.push({ level: 'error', openingId: o.id, message: r.message });
      continue;
    }
    openings.push({
      id: o.id,
      label: o.label || '?',
      type: o.type,
      x: r.x,
      width: r.roWidth,
      height: r.roHeight,
      sill: r.sill,
      header: isHeaderTypeId(o.header) ? o.header : 'auto',
      jacksPerSide: o.jacksPerSide === 'auto' ? 'auto' : (Number(o.jacksPerSide) as 1 | 2),
      unit: r.unitWidth > 0 && r.unitHeight > 0 ? { width: r.unitWidth, height: r.unitHeight, bottom: r.unitBottom } : undefined,
    });
  }
  const posts: PostSpec[] = [];
  for (const p of input.posts) {
    const r = resolvePost(p, input);
    if (typeof r === 'string') inputIssues.push({ level: 'error', openingId: p.id, message: r });
    else posts.push({ id: p.id, label: p.label || 'Post', x: r.x, type: p.type });
  }
  const tall: TallSpec[] = [];
  for (const t of input.tall) {
    const r = resolveTall(t, input);
    if (typeof r === 'string') inputIssues.push({ level: 'error', openingId: t.id, message: r });
    else tall.push({ id: t.id, label: t.label, ...r });
  }
  const intersections: IntersectionSpec[] = [];
  for (const t of input.intersections) {
    const r = resolveIntersection(t, input);
    if (typeof r === 'string') inputIssues.push({ level: 'error', openingId: t.id, message: r });
    else intersections.push({ id: t.id, label: t.label || 'Wall', x: r, width: DEPTH[t.size] });
  }
  const beams: BeamSpec[] = [];
  for (const b of input.beams) {
    const r = resolveBeam(b, input);
    if (typeof r === 'string') inputIssues.push({ level: 'error', openingId: b.id, message: r });
    else beams.push({ id: b.id, label: b.label || 'Beam', ...r, depth: headerType(b.type).depth, size: headerName(headerType(b.type)) });
  }
  const californiaDepth = (v: WallSettings['californiaLeft']) => (v === 'none' ? 0 : DEPTH[v]);
  return {
    spec: {
      length: parseLength(input.length),
      height: parseLength(input.height),
      spacing: parseFloat(input.spacing),
      layoutFrom: input.layoutFrom,
      topPlates: input.topPlates === '1' ? 1 : 2,
      headerMount: input.headerMount === 'onJacks' ? 'onJacks' : 'dropped',
      defaultHeader: isHeaderTypeId(input.defaultHeader) ? input.defaultHeader : TYPICAL_HEADER,
      exterior: input.exterior !== 'no',
      sillPlies: input.sillPlies === '2' ? 2 : 1,
      sheathing: {
        enabled: input.sheathed !== 'no',
        orientation: input.sheathingOrientation,
        thickness: parseLength(input.sheathingThickness),
        startHeight: parseLength(input.sheathingStart),
        corners: { left: input.cornerLeft, right: input.cornerRight },
        seamStuds: input.seamStuds,
        blockSeams: input.blockSeams === 'yes',
      },
      openings,
      posts,
      tall,
      studs: input.studSize === '2x4' ? '2x4' : '2x6',
      intersections,
      beams,
      california: { left: californiaDepth(input.californiaLeft), right: californiaDepth(input.californiaRight) },
    },
    inputIssues,
  };
}
