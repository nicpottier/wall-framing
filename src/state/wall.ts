import { TYPICAL_HEADER, isHeaderTypeId, type HeaderTypeId } from '../lib/lumber';
import type { Issue, LayoutFrom, OpeningSpec, OpeningType, WallSpec } from '../lib/framing';
import type { CornerType, PanelOrientation } from '../lib/sheathing';
import { parseLength, toFraction } from '../lib/units';

export type WallEnd = 'left' | 'right';

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

/** Settings a wall can inherit from a project's defaults. */
export interface WallSettings {
  height: string;
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
  windowRoWidth: string;
  windowRoHeight: string;
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
}

export interface WallInput extends WallSettings {
  id: string;
  name: string;
  length: string;
  /** Free text kept with the wall; doesn't affect framing. */
  notes: string;
  openings: OpeningInput[];
}

export type WallSettingKey = keyof WallSettings | 'name' | 'length' | 'notes';

export const DEFAULT_SETTINGS: WallSettings = {
  height: '97 1/8',
  spacing: '16',
  layoutFrom: 'left',
  topPlates: '2',
  exterior: 'yes',
  sillPlies: '1',
  headerMount: 'dropped',
  defaultHeader: TYPICAL_HEADER,
  windowHeadHeight: '82 1/2',
  windowRoWidth: '3',
  windowRoHeight: '3',
  doorRoWidth: '2',
  doorRoHeight: '2 1/2',
  sheathingOrientation: 'vertical',
  sheathingThickness: '2',
  sheathingStart: '12',
  cornerLeft: 'none',
  cornerRight: 'none',
  seamStuds: 'double',
  blockSeams: 'yes',
};

export const EXAMPLE_WALL: WallInput = {
  ...DEFAULT_SETTINGS,
  id: 'w1',
  name: 'Wall A, south elevation',
  length: '20-0',
  notes: '',
  openings: [
    { id: 'o1', type: 'window', label: 'W1', from: 'left', offset: '4-6', width: '3-9', height: '3-7 1/2', ro: '', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
    { id: 'o2', type: 'door', label: 'D1', from: 'right', offset: '5-9', width: '3-0', height: '6-8', ro: '', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
  ],
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
  const addW = parseLength(o.type === 'window' ? wall.windowRoWidth : wall.doorRoWidth);
  const addH = parseLength(o.type === 'window' ? wall.windowRoHeight : wall.doorRoHeight);
  if (!isLength(addW) || !isLength(addH)) return `enter valid ${kind} rough opening allowances`;
  return { width: unitWidth + addW, height: unitHeight + addH };
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
  const base = { x, center, roWidth: ro.width, roHeight: ro.height, unitWidth, unitHeight };

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
  | { type: 'removeOpening'; id: string };

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
      header: isHeaderTypeId(o.header) ? o.header : 'auto',
      jacksPerSide: o.jacksPerSide === 'auto' ? 'auto' : (Number(o.jacksPerSide) as 1 | 2),
      unit: r.unitWidth > 0 && r.unitHeight > 0 ? { width: r.unitWidth, height: r.unitHeight } : undefined,
    });
  }
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
        orientation: input.sheathingOrientation,
        thickness: parseLength(input.sheathingThickness),
        startHeight: parseLength(input.sheathingStart),
        corners: { left: input.cornerLeft, right: input.cornerRight },
        seamStuds: input.seamStuds,
        blockSeams: input.blockSeams === 'yes',
      },
      openings,
    },
    inputIssues,
  };
}
