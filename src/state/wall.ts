import type { HeaderSize } from '../lib/lumber';
import type { Issue, LayoutFrom, OpeningSpec, OpeningType, WallSpec } from '../lib/framing';
import { parseLength, toFraction, type Units } from '../lib/units';

/** What the user typed. Length fields stay as text until parsed so "92 5/8" can be entered naturally. */
export interface OpeningInput {
  id: string;
  type: OpeningType;
  label: string;
  x: string;
  width: string;
  height: string;
  sill: string;
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
  openings: [
    { id: 'o1', type: 'window', label: 'W1', x: '30', width: '48', height: '46 1/2', sill: '36', header: 'auto', jacksPerSide: 'auto' },
    { id: 'o2', type: 'door', label: 'D1', x: '152', width: '38', height: '82 1/2', sill: '', header: 'auto', jacksPerSide: 'auto' },
  ],
};

const DEFAULTS: Record<OpeningType, Pick<OpeningInput, 'width' | 'height' | 'sill'>> = {
  window: { width: '36', height: '48', sill: '34 1/2' },
  door: { width: '38', height: '82 1/2', sill: '' },
};

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
      const d = DEFAULTS[action.kind];
      const w = parseLength(d.width);
      const ends = state.openings.map((o) => parseLength(o.x) + parseLength(o.width)).filter(Number.isFinite);
      let x = ends.length ? Math.max(...ends) + 24 : 24;
      if (x + w + 6 > L) x = Math.max(6, Math.round((L - w) / 2));
      const opening: OpeningInput = {
        id: `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        type: action.kind,
        label: nextLabel(state.openings, action.kind),
        x: toFraction(x),
        ...d,
        header: 'auto',
        jacksPerSide: 'auto',
      };
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
          if (action.kind === 'window' && !o.sill) next.sill = DEFAULTS.window.sill;
          if (action.kind === 'door' && o.height === DEFAULTS.window.height) next.height = DEFAULTS.door.height;
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
    const x = parseLength(o.x);
    const width = parseLength(o.width);
    const height = parseLength(o.height);
    const sill = o.type === 'window' ? parseLength(o.sill) : 0;
    if (!(x >= 0) || !(width > 0) || !(height > 0) || !(sill >= 0)) {
      inputIssues.push({
        level: 'error',
        openingId: o.id,
        message: `${o.label || '?'}: enter a valid position, width and height${o.type === 'window' ? ' and sill height' : ''}.`,
      });
      continue;
    }
    openings.push({
      id: o.id,
      label: o.label || '?',
      type: o.type,
      x,
      width,
      height,
      sill,
      header: o.header,
      jacksPerSide: o.jacksPerSide === 'auto' ? 'auto' : (Number(o.jacksPerSide) as 1 | 2),
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

const STORAGE_KEY = 'wall-framing-planner.v1';

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
