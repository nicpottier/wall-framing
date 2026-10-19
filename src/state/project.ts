import { isHeaderTypeId } from '../lib/lumber';
import { parseLength, toFraction, type Units } from '../lib/units';
import {
  DEFAULT_SETTINGS,
  EXAMPLE_WALL,
  newId,
  roughOpening,
  wallReducer,
  type OpeningInput,
  type WallAction,
  type WallInput,
  type WallSettings,
} from './wall';

/** A set of walls that share default settings. */
export interface Project {
  title: string;
  notes: string;
  /** Settings every wall starts from; a wall's own values override them. */
  defaults: WallSettings;
  walls: WallInput[];
  /** Index of the wall shown in the form and drawing. */
  selected: number;
}

/** How the app shows a wall; not part of the wall itself. */
export interface DisplayPrefs {
  units: Units;
  view: 'standing' | 'deck';
  showSheathing: 'on' | 'off';
}

export const DEFAULT_PREFS: DisplayPrefs = { units: 'in', view: 'standing', showSheathing: 'on' };

export const EXAMPLE_PROJECT: Project = {
  title: 'Buckley-Watanabe residence',
  notes: '',
  defaults: { ...DEFAULT_SETTINGS },
  walls: [EXAMPLE_WALL],
  selected: 0,
};

export const currentWall = (p: Project): WallInput => p.walls[Math.min(p.selected, p.walls.length - 1)]!;

export type ProjectAction =
  | { type: 'wall'; action: WallAction }
  | { type: 'selectWall'; index: number }
  | { type: 'addWall' }
  | { type: 'removeWall'; index: number }
  | { type: 'replace'; project: Project }
  | { type: 'reset' };

/** Next unused "Wall A", "Wall B", ... name. */
function nextWallName(walls: WallInput[]) {
  for (let i = 0; i < 26; i++) {
    const name = `Wall ${String.fromCharCode(65 + i)}`;
    if (!walls.some((w) => w.name === name)) return name;
  }
  return `Wall ${walls.length + 1}`;
}

export function projectReducer(state: Project, action: ProjectAction): Project {
  switch (action.type) {
    case 'wall': {
      const i = Math.min(state.selected, state.walls.length - 1);
      const walls = state.walls.map((w, k) => (k === i ? wallReducer(w, action.action) : w));
      return { ...state, walls };
    }
    case 'selectWall':
      return { ...state, selected: Math.max(0, Math.min(action.index, state.walls.length - 1)) };
    case 'addWall': {
      const wall: WallInput = { ...state.defaults, id: newId('w'), name: nextWallName(state.walls), length: '10-0', notes: '', openings: [] };
      return { ...state, walls: [...state.walls, wall], selected: state.walls.length };
    }
    case 'removeWall': {
      if (state.walls.length <= 1) return state;
      const walls = state.walls.filter((_, k) => k !== action.index);
      return { ...state, walls, selected: Math.min(state.selected, walls.length - 1) };
    }
    case 'replace':
      return { ...action.project, selected: Math.min(state.selected, action.project.walls.length - 1) };
    case 'reset':
      return structuredClone(EXAMPLE_PROJECT);
  }
}

// ---------- Persistence ----------

const STORAGE_KEY = 'wall-framing-planner.v3';
/** Single wall saved before projects, with positions measured to the rough opening edge. */
const V2_KEY = 'wall-framing-planner.v2';

interface Saved {
  project: Project;
  prefs: DisplayPrefs;
}

/** Brings an older saved wall up to date: new settings get defaults, unknown headers become Auto. */
function upgradeWall(w: Partial<WallInput>, index: number): WallInput {
  const openings = (w.openings ?? []).map(
    (o): OpeningInput => ({ ...o, ro: o.ro ?? '', header: isHeaderTypeId(o.header) ? o.header : 'auto' }),
  );
  return { ...DEFAULT_SETTINGS, ...w, id: w.id ?? `w${index + 1}`, notes: w.notes ?? '', openings } as WallInput;
}

/** v2 positions were to the near rough-opening edge; move them to the centerline so nothing shifts. */
function migrateV2(raw: Record<string, unknown>): Saved {
  const wall = upgradeWall(raw as Partial<WallInput>, 0);
  wall.openings = wall.openings.map((o) => {
    const ro = roughOpening(o, wall);
    const offset = parseLength(o.offset);
    return typeof ro === 'string' || !Number.isFinite(offset) ? o : { ...o, offset: toFraction(offset + ro.width / 2) };
  });
  const prefs: DisplayPrefs = {
    units: raw.units === 'ftin' ? 'ftin' : 'in',
    view: raw.view === 'deck' ? 'deck' : 'standing',
    showSheathing: raw.showSheathing === 'off' ? 'off' : 'on',
  };
  const settings = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, wall[k as keyof WallSettings]])) as unknown as WallSettings;
  return { project: { ...structuredClone(EXAMPLE_PROJECT), defaults: settings, walls: [wall], selected: 0 }, prefs };
}

export function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      if (Array.isArray(saved.project?.walls) && saved.project.walls.length) {
        return {
          project: {
            ...saved.project,
            defaults: { ...DEFAULT_SETTINGS, ...saved.project.defaults },
            walls: saved.project.walls.map(upgradeWall),
          },
          prefs: { ...DEFAULT_PREFS, ...saved.prefs },
        };
      }
    }
    const old = localStorage.getItem(V2_KEY);
    if (old) {
      const parsed = JSON.parse(old) as Record<string, unknown>;
      if (Array.isArray(parsed.openings)) return migrateV2(parsed);
    }
  } catch {
    // storage unavailable or corrupt; fall through to the example
  }
  return { project: structuredClone(EXAMPLE_PROJECT), prefs: { ...DEFAULT_PREFS } };
}

export function saveProject(project: Project, prefs: DisplayPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, prefs }));
  } catch {
    // ignore
  }
}
