import type { HeaderSize } from '../lib/lumber';
import type { Issue, LayoutFrom, OpeningSpec, OpeningType, WallSpec } from '../lib/framing';
import { parseLength, toFraction, type Units } from '../lib/units';

export type WallEnd = 'left' | 'right';

/** What the user typed. Length fields stay as text until parsed so "92 5/8" can be entered naturally. */
export interface OpeningInput {
  id: string;
  type: OpeningType;
  label: string;
  /** Which end of the wall the position is measured from. */
  from: WallEnd;
  /** Wall end to the near edge of the rough opening. */
  offset: string;
  /** Window or door unit size; the rough opening adds the wall's allowance. */
  width: string;
  height: string;
  /** Windows only. Blank uses the wall's window head height. */
  headHeight: string;
  header: HeaderSize | 'auto';
  jacksPerSide: 'auto' | '1' | '2';
}

export interface WallInput {
  name: string;
  length: string;
  height: string;
  spacing: string;
  layoutFrom: LayoutFrom;
  topPlates: '1' | '2';
  headerPlies: '2' | '3';
  sillPlies: '1' | '2';
  units: Units;
  /** Floor to the top of window rough openings. */
  windowHeadHeight: string;
  /** How much larger the rough opening is than the unit. */
  windowRoWidth: string;
  windowRoHeight: string;
  doorRoWidth: string;
  doorRoHeight: string;
  openings: OpeningInput[];
}

export type WallSettingKey = Exclude<keyof WallInput, 'openings'>;

export const EXAMPLE_WALL: WallInput = {
  name: 'Wall A, south elevation',
  length: "20'",
  height: '97 1/8',
  spacing: '16',
  layoutFrom: 'left',
  topPlates: '2',
  headerPlies: '2',
  sillPlies: '1',
  units: 'in',
  windowHeadHeight: '82 1/2',
  windowRoWidth: '3',
  windowRoHeight: '3',
  doorRoWidth: '2',
  doorRoHeight: '2 1/2',
  openings: [
    { id: 'o1', type: 'window', label: 'W1', from: 'left', offset: '30', width: '45', height: '43 1/2', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
    { id: 'o2', type: 'door', label: 'D1', from: 'right', offset: '50', width: '36', height: '80', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
  ],
};

const UNIT_DEFAULTS: Record<OpeningType, Pick<OpeningInput, 'width' | 'height'>> = {
  window: { width: '36', height: '48' },
  door: { width: '36', height: '80' },
};

// ---------- Resolving an opening ----------

export type ResolvedOpening =
  | {
      ok: true;
      /** Wall's left end to the left edge of the rough opening. */
      x: number;
      roWidth: number;
      roHeight: number;
      /** Floor to the bottom of the rough opening (0 for doors). */
      sill: number;
      /** Floor to the top of the rough opening. */
      headHeight: number;
      unitWidth: number;
      unitHeight: number;
      /** True when a window uses the wall's head height. */
      defaultHead: boolean;
    }
  | { ok: false; message: string };

const isLength = (v: number) => Number.isFinite(v) && v >= 0;

/** Turns a unit size, position and the wall's allowances into a rough opening. */
export function resolveOpening(o: OpeningInput, wall: WallInput): ResolvedOpening {
  const tag = o.label || '?';
  const window = o.type === 'window';
  const unitWidth = parseLength(o.width);
  const unitHeight = parseLength(o.height);
  const offset = parseLength(o.offset);
  if (!(unitWidth > 0) || !(unitHeight > 0) || !isLength(offset)) {
    return { ok: false, message: `${tag}: enter a valid ${window ? 'window' : 'door'} width, height and position.` };
  }

  const addW = parseLength(window ? wall.windowRoWidth : wall.doorRoWidth);
  const addH = parseLength(window ? wall.windowRoHeight : wall.doorRoHeight);
  if (!isLength(addW) || !isLength(addH)) {
    return { ok: false, message: `${tag}: enter valid ${window ? 'window' : 'door'} rough opening allowances.` };
  }
  const roWidth = unitWidth + addW;
  const roHeight = unitHeight + addH;

  let x = offset;
  if (o.from === 'right') {
    const L = parseLength(wall.length);
    if (!Number.isFinite(L)) return { ok: false, message: `${tag}: enter a wall length to measure from the right end.` };
    x = L - offset - roWidth;
  }

  if (!window) {
    return { ok: true, x, roWidth, roHeight, sill: 0, headHeight: roHeight, unitWidth, unitHeight, defaultHead: false };
  }

  const defaultHead = o.headHeight.trim() === '';
  const headHeight = parseLength(defaultHead ? wall.windowHeadHeight : o.headHeight);
  if (!(headHeight > 0)) {
    return { ok: false, message: defaultHead ? `${tag}: enter a valid window head height for the wall.` : `${tag}: enter a valid head height.` };
  }
  const sill = headHeight - roHeight;
  if (sill < 0) {
    return { ok: false, message: `${tag}: the rough opening (${toFraction(roHeight)}") is taller than its head height (${toFraction(headHeight)}"). Raise the head height or use a shorter window.` };
  }
  return { ok: true, x, roWidth, roHeight, sill, headHeight, unitWidth, unitHeight, defaultHead };
}

// ---------- Reducer ----------

export type WallAction =
  | { type: 'set'; key: WallSettingKey; value: string }
  | { type: 'addOpening'; kind: OpeningType }
  | { type: 'updateOpening'; id: string; patch: Partial<OpeningInput> }
  | { type: 'setOpeningType'; id: string; kind: OpeningType }
  | { type: 'removeOpening'; id: string }
  | { type: 'reset' };

const nextLabel = (openings: OpeningInput[], kind: OpeningType, except?: string) => {
  const p = kind === 'door' ? 'D' : 'W';
  let k = 1;
  while (openings.some((o) => o.id !== except && o.label === `${p}${k}`)) k++;
  return `${p}${k}`;
};

export function wallReducer(state: WallInput, action: WallAction): WallInput {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'addOpening': {
      const L = parseLength(state.length) || 240;
      const opening: OpeningInput = {
        id: `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        type: action.kind,
        label: nextLabel(state.openings, action.kind),
        from: 'left',
        offset: '0',
        ...UNIT_DEFAULTS[action.kind],
        headHeight: '',
        header: 'auto',
        jacksPerSide: 'auto',
      };
      // Place it 24" past the rightmost opening, or centered if that runs off the wall.
      const placed = state.openings.map((o) => resolveOpening(o, state)).filter((r) => r.ok);
      const probe = resolveOpening(opening, state);
      const roWidth = probe.ok ? probe.roWidth : parseLength(opening.width);
      let x = placed.length ? Math.max(...placed.map((r) => r.x + r.roWidth)) + 24 : 24;
      if (x + roWidth + 6 > L) x = Math.max(6, Math.round((L - roWidth) / 2));
      opening.offset = toFraction(x);
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
    case 'reset':
      return structuredClone(EXAMPLE_WALL);
  }
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
      header: o.header,
      jacksPerSide: o.jacksPerSide === 'auto' ? 'auto' : (Number(o.jacksPerSide) as 1 | 2),
      unit: { width: r.unitWidth, height: r.unitHeight },
    });
  }
  return {
    spec: {
      length: parseLength(input.length),
      height: parseLength(input.height),
      spacing: parseFloat(input.spacing),
      layoutFrom: input.layoutFrom,
      topPlates: input.topPlates === '1' ? 1 : 2,
      headerPlies: input.headerPlies === '3' ? 3 : 2,
      sillPlies: input.sillPlies === '2' ? 2 : 1,
      openings,
    },
    inputIssues,
  };
}

// ---------- Persistence ----------

const STORAGE_KEY = 'wall-framing-planner.v2';

export function loadWall(): WallInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WallInput>;
      if (Array.isArray(parsed.openings)) return { ...structuredClone(EXAMPLE_WALL), ...parsed } as WallInput;
    }
  } catch {
    // storage unavailable or corrupt; fall through to the example
  }
  return structuredClone(EXAMPLE_WALL);
}

export function saveWall(wall: WallInput) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wall));
  } catch {
    // ignore
  }
}
