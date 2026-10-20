import type { CutGroup } from '../lib/framing';
import { headerName, headerType, isHeaderTypeId, postType, type HeaderTypeId, type PostTypeId } from '../lib/lumber';
import firstFloorText from './examples/first-floor.wall.md?raw';
import { parseProjectText } from './wallText';
import { parseLength, round16, toFraction, type Units } from '../lib/units';
import {
  DEFAULT_SETTINGS,
  EXAMPLE_WALL,
  newId,
  roughOpening,
  upgradeSettings,
  wallReducer,
  type OpeningInput,
  type WallAction,
  type WallInput,
  type WallSettings,
} from './wall';

/**
 * A post standing on its own under a beam: on the subfloor, up to the beam's underside, with the walls
 * either side ending at it and their end studs nailed to it. Placed on the plan by its center.
 */
export interface ProjectPost {
  id: string;
  label: string;
  type: PostTypeId;
  /** The beam it carries, which sets its length. */
  beam: HeaderTypeId;
  x: string;
  y: string;
}

/** A set of walls that share default settings. */
export interface Project {
  title: string;
  notes: string;
  /** Settings every wall starts from; a wall's own values override them. */
  defaults: WallSettings;
  walls: WallInput[];
  /** Freestanding posts under beams. */
  posts: ProjectPost[];
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

/** The first floor of the Buckley-Watanabe residence, from its architectural and structural plans. */
export const EXAMPLE_PROJECT: Project = parseProjectText(firstFloorText).project ?? {
  title: '',
  notes: '',
  defaults: { ...DEFAULT_SETTINGS },
  walls: [EXAMPLE_WALL],
  posts: [],
  selected: 0,
};

export const currentWall = (p: Project): WallInput => p.walls[Math.min(p.selected, p.walls.length - 1)]!;

export type ProjectAction =
  | { type: 'wall'; action: WallAction }
  | { type: 'selectWall'; index: number }
  | { type: 'addWall' }
  | { type: 'removeWall'; index: number }
  | { type: 'addPost' }
  | { type: 'updatePost'; id: string; patch: Partial<ProjectPost> }
  | { type: 'removePost'; id: string }
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
      const wall: WallInput = { ...state.defaults, id: newId('w'), name: nextWallName(state.walls), length: '10-0', notes: '', planX: '', planY: '', planRun: '', openings: [], posts: [], tall: [], intersections: [], beams: [] };
      return { ...state, walls: [...state.walls, wall], selected: state.walls.length };
    }
    case 'removeWall': {
      if (state.walls.length <= 1) return state;
      const walls = state.walls.filter((_, k) => k !== action.index);
      return { ...state, walls, selected: Math.min(state.selected, walls.length - 1) };
    }
    case 'addPost': {
      let k = 1;
      while (state.posts.some((p) => p.label === `P${k}`)) k++;
      const post: ProjectPost = { id: newId('pp'), label: `P${k}`, type: '6x6', beam: 'gl-5.5x11.875', x: '0', y: '0' };
      return { ...state, posts: [...state.posts, post] };
    }
    case 'updatePost':
      return { ...state, posts: state.posts.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'removePost':
      return { ...state, posts: state.posts.filter((p) => p.id !== action.id) };
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
  return { ...DEFAULT_SETTINGS, ...upgradeSettings(w), id: w.id ?? `w${index + 1}`, notes: w.notes ?? '', planX: w.planX ?? '', planY: w.planY ?? '', planRun: w.planRun ?? '', openings, posts: w.posts ?? [], tall: w.tall ?? [], intersections: w.intersections ?? [], beams: w.beams ?? [] } as WallInput;
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
    ...DEFAULT_PREFS,
    units: raw.units === 'ftin' ? 'ftin' : 'in',
    view: raw.view === 'deck' ? 'deck' : 'standing',
    showSheathing: raw.showSheathing === 'off' ? 'off' : 'on',
  };
  const settings = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, wall[k as keyof WallSettings]])) as unknown as WallSettings;
  return { project: { ...structuredClone(EXAMPLE_PROJECT), defaults: settings, walls: [wall], posts: [], selected: 0 }, prefs };
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
            defaults: { ...DEFAULT_SETTINGS, ...upgradeSettings(saved.project.defaults) },
            walls: saved.project.walls.map(upgradeWall),
            posts: saved.project.posts ?? [],
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

export interface ResolvedPost {
  post: ProjectPost;
  /** Plan position of its center. */
  x: number;
  y: number;
  width: number;
  /** Subfloor to the beam's underside, using the project's wall height. */
  length: number;
}

/** A freestanding post's plan position and length, or a message. */
export function resolveProjectPost(post: ProjectPost, defaults: WallSettings): ResolvedPost | string {
  const tag = post.label || 'Post';
  const x = parseLength(post.x);
  const y = parseLength(post.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return `${tag}: enter its plan position.`;
  const H = parseLength(defaults.height);
  const length = H - headerType(post.beam).depth;
  if (!(length > 12)) return `${tag}: the wall height leaves no room under the beam.`;
  return { post, x, y, width: postType(post.type).width, length };
}

/** Cut list rows for the freestanding posts. */
export function postCutList(project: Project): CutGroup[] {
  const groups = new Map<string, CutGroup>();
  for (const p of project.posts) {
    const r = resolveProjectPost(p, project.defaults);
    if (typeof r === 'string') continue;
    const t = postType(p.type);
    const size = t.plies === 1 ? t.label : '2x6';
    const key = `post|${size}|${round16(r.length)}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, role: 'post', size, length: round16(r.length), qty: 0, notes: [] };
      groups.set(key, g);
    }
    g.qty += t.plies;
    const note = `Freestanding under ${headerName(headerType(p.beam))}, on the subfloor; walls either side nail to it`;
    if (!g.notes.includes(note)) g.notes.push(note);
  }
  return [...groups.values()];
}

export function saveProject(project: Project, prefs: DisplayPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, prefs }));
  } catch {
    // ignore
  }
}
