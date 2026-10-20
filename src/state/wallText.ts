/**
 * Plain-text wall spec (.wall.md): a Markdown-like description of a project's walls and openings.
 *
 *   # Project title
 *   ## Defaults
 *   - studs: 2x6 @ 16
 *   ## Wall A · south
 *   - length: 20-0
 *   ### Openings
 *   - W1: window 3-9 x 3-7 1/2, 4-6 from left
 *   ### Posts
 *   - P1: 6x6, 8-0 from right
 *   ### Balloon framing
 *   - Stair: 10-1 7/8 tall, 12-6 to 24-1 from left
 *   ### Intersections
 *   - Bath: 2x4 wall, 7-2 from left
 *   ### Beams
 *   - B2: 5 1/2 x 11 7/8 gl, 2 3/4 from right
 *
 * Headings split the file into project, defaults and walls; list items are settings, openings, posts
 * or tall stretches; any other text is kept as notes. Opening and post positions are to the
 * centerline; a tall stretch gives both of its ends.
 */
import { HEADER_TYPES, POST_TYPES, headerName, headerType, postType, type HeaderTypeId, type PostTypeId } from '../lib/lumber';
import type { CornerType } from '../lib/sheathing';
import { parseLength, toFraction } from '../lib/units';
import {
  DEFAULT_SETTINGS,
  parseSize,
  roughOpening,
  type OpeningInput,
  type BeamInput,
  type IntersectionInput,
  type PostInput,
  type TallInput,
  type WallInput,
  type WallSettings,
} from './wall';
import type { Project } from './project';

export interface TextError {
  line: number;
  message: string;
}

export interface ParseResult {
  project: Project | null;
  errors: TextError[];
}

// ---------- Values ----------

const words = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
const clauses = (v: string) => v.split(',').map((c) => c.trim()).filter(Boolean);
/** Length text as stored: what was typed, without a trailing inch mark. */
const lengthText = (v: string) => v.trim().replace(/"$/, '').trim();
const isLen = (v: string) => Number.isFinite(parseLength(v));
/** Adds an inch mark to plain inch values so "2" reads as 2" in prose like `2" thick`. */
const inchText = (v: string) => (/^[\d\s/.]+$/.test(v) ? `${v}"` : v);

const ASCII_FRACTIONS: Record<string, string> = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const headerKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[½¼¾⅛⅜⅝⅞]/g, (c) => ASCII_FRACTIONS[c]!)
    .replace(/×/g, 'x')
    .replace(/\s+/g, '');

/** Matches a header by its listed name, ignoring spaces, case and fraction style ("3 1/2 x 11 7/8 lvl"). */
function findHeader(text: string): HeaderTypeId | null {
  const k = headerKey(text);
  const h = HEADER_TYPES.find((t) => headerKey(t.label) === k || headerKey(t.label).replace(/^p\/t/, '') === k || t.id === k);
  return h ? h.id : null;
}

/** Matches a post size: "6x6", "(3) studs" or "3 studs". */
function findPost(text: string): PostTypeId | null {
  const k = text.toLowerCase().replace(/^post\s+/, '').replace(/[()\s]/g, '').replace(/×/g, 'x');
  const p = POST_TYPES.find((t) => t.label.replace(/[()\s]/g, '') === k || t.id === k);
  return p ? p.id : null;
}

type SettingParser = (value: string) => Partial<WallSettings> | string;

const yesNo = (v: string): 'yes' | 'no' | null => (/^(yes|true|y)$/.test(v) ? 'yes' : /^(no|false|n)$/.test(v) ? 'no' : null);
const singleDouble = (v: string): '1' | '2' | null => (v === 'single' ? '1' : v === 'double' ? '2' : null);
const lengthSetting =
  (key: keyof WallSettings, what: string): SettingParser =>
  (v) =>
    isLen(lengthText(v)) ? { [key]: lengthText(v) } : `${what} must be a length, like 82 1/2 or 6-10 1/2`;
const allowance =
  (w: keyof WallSettings, h: keyof WallSettings): SettingParser =>
  (v) => {
    const m = v.match(/^\+?\s*(.+?)\s+[x×]\s+\+?\s*(.+)$/i);
    if (!m || !isLen(lengthText(m[1]!)) || !isLen(lengthText(m[2]!))) return 'write the allowance as +width x +height, like +3 x +3';
    return { [w]: lengthText(m[1]!), [h]: lengthText(m[2]!) };
  };

const SETTINGS: Record<string, SettingParser> = {
  height: lengthSetting('height', 'height'),
  studs: (v) => {
    const m = words(v).match(/^(?:(2x4|2x6)\s*)?(?:@\s*)?(\d+(?:\.\d+)?)(?:\s*(?:"|in|o\.?c\.?))*$/);
    const spacing = m?.[2];
    if (!spacing || !['12', '16', '19.2', '24'].includes(spacing)) return 'studs must be 2x4 or 2x6 @ 12, 16, 19.2 or 24';
    return m[1] ? { spacing, studSize: m[1] as '2x4' | '2x6' } : { spacing };
  },
  layout: (v) => {
    const m = words(v).match(/^(?:from )?(left|right)$/);
    return m ? { layoutFrom: m[1] as 'left' | 'right' } : 'layout must be from left or from right';
  },
  'top plate': (v) => {
    const p = singleDouble(words(v));
    return p ? { topPlates: p } : 'top plate must be single or double';
  },
  exterior: (v) => {
    const e = yesNo(words(v));
    return e ? { exterior: e } : 'exterior must be yes or no';
  },
  'rough sill': (v) => {
    const p = singleDouble(words(v));
    return p ? { sillPlies: p } : 'rough sill must be single or double';
  },
  headers: (v) => {
    const out: Partial<WallSettings> = {};
    for (const c of clauses(v)) {
      const w = words(c);
      if (/^(tight )?under (the )?(top )?plate$/.test(w)) out.headerMount = 'dropped';
      else if (/^on (top of )?(the )?opening$|^on jacks$/.test(w)) out.headerMount = 'onJacks';
      else {
        const h = findHeader(c);
        if (!h) return `unknown header "${c}". Use one of: ${HEADER_TYPES.map((t) => t.label).join(', ')}`;
        out.defaultHeader = h;
      }
    }
    return out;
  },
  'head height': lengthSetting('windowHeadHeight', 'head height'),
  'window ro': allowance('windowRoWidth', 'windowRoHeight'),
  'door ro': allowance('doorRoWidth', 'doorRoHeight'),
  sheathing: (v) => {
    if (/^(none|no)$/.test(words(v))) return { sheathed: 'no' };
    const out: Partial<WallSettings> = { sheathed: 'yes' };
    for (const c of clauses(v)) {
      const w = words(c);
      let m: RegExpMatchArray | null;
      if (w === 'vertical' || w === 'horizontal') out.sheathingOrientation = w;
      else if ((m = c.match(/^(.+?)\s+thick$/i)) && isLen(lengthText(m[1]!))) out.sheathingThickness = lengthText(m[1]!);
      else if ((m = c.match(/^start\s+(.+)$/i)) && isLen(lengthText(m[1]!))) out.sheathingStart = lengthText(m[1]!);
      else if ((m = w.match(/^(single|double) seam studs?$/))) out.seamStuds = m[1] as 'single' | 'double';
      else if (/^block(ed)? seams$/.test(w)) out.blockSeams = 'yes';
      else if (/^no block(ing)?$|^unblocked seams$/.test(w)) out.blockSeams = 'no';
      else return `unknown sheathing option "${c}"`;
    }
    return out;
  },
  'california corners': (v) => {
    const out: Partial<WallSettings> = { californiaLeft: 'none', californiaRight: 'none' };
    if (words(v) === 'none') return out;
    for (const c of clauses(v)) {
      const m = words(c).match(/^(left|right|both)(?: (2x4|2x6))?$/);
      if (!m) return 'write california corners like "left 2x6, right 2x4" (the wall butting in), "both" or "none"';
      const size = (m[2] ?? '2x6') as '2x4' | '2x6';
      if (m[1] !== 'right') out.californiaLeft = size;
      if (m[1] !== 'left') out.californiaRight = size;
    }
    return out;
  },
  corners: (v) => {
    const out: Partial<WallSettings> = {};
    for (const c of clauses(v)) {
      const m = words(c).match(/^(left|right) (none|outside|inside)$/);
      if (!m) return `write corners like "left outside, right inside" (each none, outside or inside)`;
      out[m[1] === 'left' ? 'cornerLeft' : 'cornerRight'] = m[2] as CornerType;
    }
    return out;
  },
};
SETTINGS.spacing = SETTINGS.studs!;

/** Text for each setting, in the order they're written out. */
const FORMAT: [string, (s: WallSettings) => string][] = [
  ['studs', (s) => `${s.studSize} @ ${s.spacing}`],
  ['height', (s) => s.height],
  ['layout', (s) => `from ${s.layoutFrom}`],
  ['top plate', (s) => (s.topPlates === '1' ? 'single' : 'double')],
  ['exterior', (s) => s.exterior],
  ['headers', (s) => `${headerName(headerType(s.defaultHeader))}, ${s.headerMount === 'dropped' ? 'tight under plate' : 'on opening'}`],
  ['head height', (s) => s.windowHeadHeight],
  ['rough sill', (s) => (s.sillPlies === '1' ? 'single' : 'double')],
  ['window ro', (s) => `+${s.windowRoWidth} x +${s.windowRoHeight}`],
  ['door ro', (s) => `+${s.doorRoWidth} x +${s.doorRoHeight}`],
  [
    'sheathing',
    (s) =>
      s.sheathed === 'no'
        ? 'none'
        : [
            s.sheathingOrientation,
            `${inchText(s.sheathingThickness)} thick`,
            `start ${s.sheathingStart}`,
            `${s.seamStuds} seam studs`,
            s.blockSeams === 'yes' ? 'block seams' : 'no blocking',
          ].join(', '),
  ],
  ['corners', (s) => `left ${s.cornerLeft}, right ${s.cornerRight}`],
  [
    'california corners',
    (s) =>
      [s.californiaLeft !== 'none' ? `left ${s.californiaLeft}` : '', s.californiaRight !== 'none' ? `right ${s.californiaRight}` : ''].filter(Boolean).join(', ') ||
      'none',
  ],
];

// ---------- Parsing ----------

interface PendingPosition {
  opening: OpeningInput;
  line: number;
  kind: 'after' | 'centered' | 'sill';
  ref?: string;
  value?: number;
}

interface WallDraft {
  wall: WallInput;
  line: number;
  hasLength: boolean;
  pending: PendingPosition[];
  /** Posts centered on the wall, placed once its length is known. */
  pendingPosts: PostInput[];
}

export function parseProjectText(text: string): ParseResult {
  const errors: TextError[] = [];
  const err = (line: number, message: string) => errors.push({ line, message });

  // Hidden comments come out first, keeping line numbers intact.
  const lines = text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split(/\r?\n/);

  let title = '';
  const projectNotes: string[] = [];
  const defaults: WallSettings = { ...DEFAULT_SETTINGS };
  const walls: WallDraft[] = [];
  let section: 'none' | 'defaults' | 'wall' | 'openings' | 'posts' | 'tall' | 'intersections' | 'beams' = 'none';
  let notesTarget: string[] = projectNotes;
  const wallNotes = new Map<WallDraft, string[]>();
  const current = () => walls[walls.length - 1]!;

  lines.forEach((rawLine, i) => {
    const line = i + 1;
    const t = rawLine.trim();
    let m: RegExpMatchArray | null;

    if (!t) {
      if (notesTarget.length && notesTarget[notesTarget.length - 1] !== '') notesTarget.push('');
      return;
    }
    if ((m = t.match(/^#\s+(.+)$/))) {
      title = m[1]!.trim();
      return;
    }
    if ((m = t.match(/^##\s+(.+)$/))) {
      const name = m[1]!.trim();
      if (/^defaults$/i.test(name)) {
        if (walls.length) err(line, 'Put ## Defaults before the first wall.');
        section = 'defaults';
        notesTarget = projectNotes;
      } else {
        const draft: WallDraft = {
          wall: { ...defaults, id: `w${walls.length + 1}`, name, length: '', notes: '', planX: '', planY: '', planRun: '', openings: [], posts: [], tall: [], intersections: [], beams: [] },
          line,
          hasLength: false,
          pending: [],
          pendingPosts: [],
        };
        walls.push(draft);
        notesTarget = [];
        wallNotes.set(draft, notesTarget);
        section = 'wall';
      }
      return;
    }
    if ((m = t.match(/^###\s+(.+)$/))) {
      const name = words(m[1]!);
      const sub =
        name === 'openings'
          ? 'openings'
          : name === 'posts'
            ? 'posts'
            : /^(balloon( framing)?|tall (sections|stretches))$/.test(name)
              ? 'tall'
              : /^(intersections|intersecting walls|tees)$/.test(name)
                ? 'intersections'
                : name === 'beams'
                  ? 'beams'
                  : null;
      if (!walls.length || !sub) {
        err(
          line,
          walls.length ? `Unknown section "${m[1]}". Walls have ### Openings, ### Posts, ### Beams, ### Intersections and ### Balloon framing.` : `### ${m[1]} must be inside a wall.`,
        );
        return;
      }
      section = sub;
      return;
    }
    if ((m = t.match(/^[-*]\s+(.*)$/))) {
      const item = m[1]!.trim();
      if (section === 'none') return err(line, 'Put settings under ## Defaults or a ## wall heading.');
      if (section === 'openings') return parseOpening(item, line, current(), err);
      if (section === 'posts') return parsePost(item, line, current(), err);
      if (section === 'tall') return parseTall(item, line, current(), err);
      if (section === 'intersections') return parseIntersection(item, line, current(), err);
      if (section === 'beams') return parseBeam(item, line, current(), err);

      const kv = item.match(/^([^:]+):\s*(.*)$/);
      if (!kv) return err(line, `Settings are written "key: value". Got "${item}".`);
      const key = words(kv[1]!);
      const value = kv[2]!.trim();
      if (key === 'plan') {
        if (section !== 'wall') return err(line, 'plan belongs to a wall, not the defaults.');
        const pm = value.match(/^(.+?)\s*,\s*(.+?)\s*,\s*running\s+(east|west|north|south)$/i);
        if (!pm || !isLen(lengthText(pm[1]!)) || !isLen(lengthText(pm[2]!))) {
          return err(line, `plan is written "x, y, running east": the wall's left end on its seen face, east and north of the plan origin. Got "${value}".`);
        }
        Object.assign(current().wall, { planX: lengthText(pm[1]!), planY: lengthText(pm[2]!), planRun: pm[3]!.toLowerCase() });
        return;
      }
      if (key === 'length') {
        if (section !== 'wall') return err(line, 'length belongs to a wall, not the defaults.');
        if (!isLen(lengthText(value))) return err(line, `length must be a length, like 20-0 or 240. Got "${value}".`);
        current().wall.length = lengthText(value);
        current().hasLength = true;
        return;
      }
      const parse = SETTINGS[key];
      if (!parse) return err(line, `Unknown setting "${kv[1]!.trim()}". Settings are: length, plan, ${Object.keys(SETTINGS).filter((k) => k !== 'spacing').join(', ')}.`);
      const out = parse(value);
      if (typeof out === 'string') return err(line, out.charAt(0).toUpperCase() + out.slice(1) + '.');
      Object.assign(section === 'defaults' ? defaults : current().wall, out);
      return;
    }
    notesTarget.push(t);
  });

  for (const draft of walls) {
    if (!draft.hasLength) err(draft.line, `${draft.wall.name}: add a length, like "- length: 20-0".`);
    resolvePending(draft, err);
    draft.wall.notes = joinNotes(wallNotes.get(draft) ?? []);
  }
  if (!walls.length) err(lines.length, 'Add at least one wall, starting with a heading like "## Wall A".');

  errors.sort((a, b) => a.line - b.line);
  if (errors.length) return { project: null, errors };
  return {
    project: { title, notes: joinNotes(projectNotes), defaults, walls: walls.map((d) => d.wall), selected: 0 },
    errors,
  };
}

const joinNotes = (lines: string[]) => lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

function parseOpening(item: string, line: number, draft: WallDraft, err: (line: number, message: string) => void) {
  const m = item.match(/^(.+?):\s*(window|door)\s+(.+)$/i);
  if (!m) return err(line, `Openings are written "W1: window 3-0 x 4-0, 4-6 from left". Got "${item}".`);
  const label = m[1]!.trim();
  const type = m[2]!.toLowerCase() as 'window' | 'door';
  const [sizeText = '', ...rest] = clauses(m[3]!);
  const tag = `${label}:`;
  if (draft.wall.openings.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
    return err(line, `${tag} another opening on this wall already uses that label.`);
  }

  const size = parseSize(sizeText);
  if (!size) return err(line, `${tag} the size should be width x height (like 3-0 x 4-6) or a callout like 3046. Got "${sizeText}".`);
  const callout = sizeText.trim().match(/^(\d)(\d)(\d)(\d)$/);
  const opening: OpeningInput = {
    id: `${draft.wall.id}-${label.replace(/[^\w-]/g, '')}`,
    type,
    label,
    from: 'left',
    offset: '',
    width: callout ? `${callout[1]}-${callout[2]}` : lengthText(sizeText.split(/\s+[x×]\s+/i)[0]!),
    height: callout ? `${callout[3]}-${callout[4]}` : lengthText(sizeText.split(/\s+[x×]\s+/i)[1]!),
    ro: '',
    headHeight: '',
    header: 'auto',
    jacksPerSide: 'auto',
  };

  let placed = false;
  let hasSill = false;
  for (const c of rest) {
    const w = words(c);
    let k: RegExpMatchArray | null;
    if ((k = c.match(/^(.+?)\s+from\s+(left|right)$/i))) {
      if (!isLen(lengthText(k[1]!))) return err(line, `${tag} "${k[1]}" isn't a length.`);
      opening.from = k[2]!.toLowerCase() as 'left' | 'right';
      opening.offset = lengthText(k[1]!);
      placed = true;
    } else if ((k = c.match(/^(.+?)\s+after\s+(\S+)$/i))) {
      const gap = parseLength(lengthText(k[1]!));
      if (!Number.isFinite(gap)) return err(line, `${tag} "${k[1]}" isn't a length.`);
      draft.pending.push({ opening, line, kind: 'after', ref: k[2]!, value: gap });
      placed = true;
    } else if (w === 'centered' || w === 'center') {
      draft.pending.push({ opening, line, kind: 'centered' });
      placed = true;
    } else if ((k = c.match(/^head\s+(.+)$/i))) {
      if (type !== 'window') return err(line, `${tag} only windows take a head height.`);
      if (!isLen(lengthText(k[1]!))) return err(line, `${tag} head "${k[1]}" isn't a length.`);
      opening.headHeight = lengthText(k[1]!);
    } else if ((k = c.match(/^sill\s+(.+)$/i))) {
      if (type !== 'window') return err(line, `${tag} only windows take a sill height.`);
      const sill = parseLength(lengthText(k[1]!));
      if (!Number.isFinite(sill)) return err(line, `${tag} sill "${k[1]}" isn't a length.`);
      draft.pending.push({ opening, line, kind: 'sill', value: sill });
      hasSill = true;
    } else if ((k = c.match(/^header\s+(.+)$/i))) {
      if (words(k[1]!) === 'auto') opening.header = 'auto';
      else {
        const h = findHeader(k[1]!);
        if (!h) return err(line, `${tag} unknown header "${k[1]}". Use one of: ${HEADER_TYPES.map((t) => t.label).join(', ')}.`);
        opening.header = h;
      }
    } else if ((k = w.match(/^jacks (1|2|auto)$/))) {
      opening.jacksPerSide = k[1] as OpeningInput['jacksPerSide'];
    } else if ((k = c.match(/^ro\s+(.+)$/i))) {
      if (!parseSize(k[1]!)) return err(line, `${tag} write the rough opening as width x height, like 48 x 46 1/2.`);
      opening.ro = k[1]!.trim();
    } else {
      return err(line, `${tag} I don't understand "${c}".`);
    }
  }
  if (hasSill && opening.headHeight) return err(line, `${tag} give a head or a sill height, not both.`);
  if (!placed) return err(line, `${tag} add a position, like "4-6 from left", "5-0 from right", "4-0 after W1" or "centered".`);
  draft.wall.openings.push(opening);
}

function parsePost(item: string, line: number, draft: WallDraft, err: (line: number, message: string) => void) {
  const m = item.match(/^(.+?):\s*(.+)$/);
  if (!m) return err(line, `Posts are written "P1: 6x6, 8-0 from left". Got "${item}".`);
  const label = m[1]!.trim();
  const [sizeText = '', ...rest] = clauses(m[2]!);
  const tag = `${label}:`;
  if (draft.wall.posts.some((p) => p.label.toLowerCase() === label.toLowerCase())) {
    return err(line, `${tag} another post on this wall already uses that label.`);
  }
  const type = findPost(sizeText);
  if (!type) return err(line, `${tag} unknown post "${sizeText}". Use one of: ${POST_TYPES.map((t) => t.label).join(', ')}.`);
  const post: PostInput = { id: `${draft.wall.id}-post-${label.replace(/[^\w-]/g, '')}`, label, from: 'left', offset: '', type };
  let placed = false;
  for (const c of rest) {
    let k: RegExpMatchArray | null;
    if ((k = c.match(/^(.+?)\s+from\s+(left|right)$/i))) {
      if (!isLen(lengthText(k[1]!))) return err(line, `${tag} "${k[1]}" isn't a length.`);
      post.from = k[2]!.toLowerCase() as 'left' | 'right';
      post.offset = lengthText(k[1]!);
      placed = true;
    } else if (/^cent(er|ered)$/.test(words(c))) {
      draft.pendingPosts.push(post);
      placed = true;
    } else {
      return err(line, `${tag} I don't understand "${c}".`);
    }
  }
  if (!placed) return err(line, `${tag} add a position to its centerline, like "8-0 from right" or "centered".`);
  draft.wall.posts.push(post);
}

function parseBeam(item: string, line: number, draft: WallDraft, err: (line: number, message: string) => void) {
  const m = item.match(/^(.+?):\s*(.+)$/);
  const parts = m ? clauses(m[2]!) : [];
  if (!m || parts.length !== 2) return err(line, `Beams are written "B2: 5 1/2 x 11 7/8 gl, 2-6 from left" (crossing, to its centerline), "…, 0 to 12-2 from left" (along a stretch) or "…, full length". Got "${item}".`);
  const label = m[1]!.trim();
  const type = findHeader(parts[0]!);
  if (!type) return err(line, `${label}: unknown beam "${parts[0]}". Use one of: ${HEADER_TYPES.map((t) => t.label).join(', ')}.`);
  if (draft.wall.beams.some((b) => b.label.toLowerCase() === label.toLowerCase())) return err(line, `${label}: another beam on this wall already uses that label.`);
  const beam: BeamInput = { id: `${draft.wall.id}-beam-${label.replace(/[^\w-]/g, '')}`, label, type, span: 'full', from: 'left', offset: '', start: '', end: '' };
  const where = parts[1]!;
  let k: RegExpMatchArray | null;
  if (/^(full length|the full length|along the wall|whole wall)$/.test(words(where))) beam.span = 'full';
  else if ((k = where.match(/^(.+?)\s+to\s+(.+?)\s+from\s+(left|right)$/i))) {
    if (!isLen(lengthText(k[1]!)) || !isLen(lengthText(k[2]!))) return err(line, `${label}: "${k[1]} to ${k[2]}" should be two lengths.`);
    Object.assign(beam, { span: 'along', start: lengthText(k[1]!), end: lengthText(k[2]!), from: k[3]!.toLowerCase() });
  } else if ((k = where.match(/^(.+?)\s+from\s+(left|right)$/i))) {
    if (!isLen(lengthText(k[1]!))) return err(line, `${label}: "${k[1]}" isn't a length.`);
    Object.assign(beam, { span: 'cross', offset: lengthText(k[1]!), from: k[2]!.toLowerCase() });
  } else return err(line, `${label}: I don't understand "${where}".`);
  draft.wall.beams.push(beam);
}

function parseIntersection(item: string, line: number, draft: WallDraft, err: (line: number, message: string) => void) {
  const m = item.match(/^(.+?):\s*(2x4|2x6)(?:\s+wall)?\s*,\s*(.+?)\s+from\s+(left|right)$/i);
  if (!m) return err(line, `Intersections are written "Bath: 2x4 wall, 7-2 from left", to the wall's centerline. Got "${item}".`);
  const label = m[1]!.trim();
  if (!isLen(lengthText(m[3]!))) return err(line, `${label}: "${m[3]}" isn't a length.`);
  if (draft.wall.intersections.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
    return err(line, `${label}: another intersection on this wall already uses that label.`);
  }
  const it: IntersectionInput = {
    id: `${draft.wall.id}-tee-${label.replace(/[^\w-]/g, '')}`,
    label,
    from: m[4]!.toLowerCase() as 'left' | 'right',
    offset: lengthText(m[3]!),
    size: m[2]!.toLowerCase() as '2x4' | '2x6',
  };
  draft.wall.intersections.push(it);
}

function parseTall(item: string, line: number, draft: WallDraft, err: (line: number, message: string) => void) {
  const m = item.match(/^(.+?):\s*(.+)$/);
  if (!m) return err(line, `Tall stretches are written "Stair: 10-1 7/8 tall, 12-6 to 24-1 from left". Got "${item}".`);
  const label = m[1]!.trim();
  const tag = `${label}:`;
  const tall: TallInput = { id: `${draft.wall.id}-tall-${label.replace(/[^\w-]/g, '')}`, label, from: 'left', start: '', end: '', height: '' };
  for (const c of clauses(m[2]!)) {
    let k: RegExpMatchArray | null;
    if ((k = c.match(/^(.+?)\s+(?:tall|high)$/i) ?? c.match(/^height\s+(.+)$/i))) {
      if (!isLen(lengthText(k[1]!))) return err(line, `${tag} height "${k[1]}" isn't a length.`);
      tall.height = lengthText(k[1]!);
    } else if ((k = c.match(/^(.+?)\s+to\s+(.+?)\s+from\s+(left|right)$/i))) {
      if (!isLen(lengthText(k[1]!)) || !isLen(lengthText(k[2]!))) return err(line, `${tag} "${k[1]} to ${k[2]}" should be two lengths.`);
      tall.start = lengthText(k[1]!);
      tall.end = lengthText(k[2]!);
      tall.from = k[3]!.toLowerCase() as 'left' | 'right';
    } else {
      return err(line, `${tag} I don't understand "${c}".`);
    }
  }
  if (!tall.height) return err(line, `${tag} add its height, like "10-1 7/8 tall".`);
  if (!tall.start) return err(line, `${tag} add where it runs, like "12-6 to 24-1 from left".`);
  draft.wall.tall.push(tall);
}

/** Positions that depend on the wall length, another opening, or the rough opening height. */
function resolvePending(draft: WallDraft, err: (line: number, message: string) => void) {
  const { wall } = draft;
  const L = parseLength(wall.length);
  const centerOf = (o: OpeningInput) => {
    const offset = parseLength(o.offset);
    return o.from === 'left' ? offset : L - offset;
  };
  for (const p of draft.pendingPosts) {
    if (Number.isFinite(L)) p.offset = toFraction(L / 2);
  }
  for (const p of draft.pending) {
    const tag = `${p.opening.label}:`;
    if (p.kind === 'centered') {
      if (!Number.isFinite(L)) continue;
      p.opening.from = 'left';
      p.opening.offset = toFraction(L / 2);
    } else if (p.kind === 'after') {
      const ref = wall.openings.find((o) => o.label.toLowerCase() === p.ref!.toLowerCase());
      const before = ref && wall.openings.indexOf(ref) < wall.openings.indexOf(p.opening);
      if (!ref || !before) {
        err(p.line, `${tag} "after ${p.ref}" needs an opening labelled ${p.ref} listed earlier on this wall.`);
        continue;
      }
      const center = centerOf(ref) + p.value!;
      if (!Number.isFinite(center)) continue;
      p.opening.from = 'left';
      p.opening.offset = toFraction(center);
    } else {
      const ro = roughOpening(p.opening, wall);
      if (typeof ro === 'string') continue;
      p.opening.headHeight = toFraction(p.value! + ro.height);
    }
  }
}

// ---------- Writing ----------

export function projectToText(project: Project): string {
  const out: string[] = [];
  if (project.title) out.push(`# ${project.title}`, '');
  if (project.notes) out.push(project.notes, '');

  out.push('## Defaults');
  for (const [key, format] of FORMAT) out.push(`- ${key}: ${format(project.defaults)}`);

  for (const wall of project.walls) {
    out.push('', `## ${wall.name || 'Wall'}`, `- length: ${wall.length}`);
    if (wall.planRun) out.push(`- plan: ${wall.planX}, ${wall.planY}, running ${wall.planRun}`);
    for (const [key, format] of FORMAT) {
      const value = format(wall);
      if (value !== format(project.defaults)) out.push(`- ${key}: ${value}`);
    }
    if (wall.notes) out.push('', wall.notes);
    if (wall.openings.length) {
      out.push('', '### Openings');
      for (const o of wall.openings) out.push(`- ${openingText(o)}`);
    }
    if (wall.posts.length) {
      out.push('', '### Posts');
      for (const p of wall.posts) out.push(`- ${p.label}: ${postType(p.type).label}, ${p.offset} from ${p.from}`);
    }
    if (wall.tall.length) {
      out.push('', '### Balloon framing');
      for (const t of wall.tall) out.push(`- ${t.label || 'Tall'}: ${t.height} tall, ${t.start} to ${t.end} from ${t.from}`);
    }
    if (wall.beams.length) {
      out.push('', '### Beams');
      for (const b of wall.beams) {
        const where = b.span === 'full' ? 'full length' : b.span === 'along' ? `${b.start} to ${b.end} from ${b.from}` : `${b.offset} from ${b.from}`;
        out.push(`- ${b.label || 'Beam'}: ${headerName(headerType(b.type))}, ${where}`);
      }
    }
    if (wall.intersections.length) {
      out.push('', '### Intersections');
      for (const t of wall.intersections) out.push(`- ${t.label || 'Wall'}: ${t.size} wall, ${t.offset} from ${t.from}`);
    }
  }
  return out.join('\n') + '\n';
}

function openingText(o: OpeningInput): string {
  const parts = [`${o.label}: ${o.type} ${o.width} x ${o.height}`, `${o.offset} from ${o.from}`];
  if (o.type === 'window' && o.headHeight.trim()) parts.push(`head ${o.headHeight}`);
  if (o.header !== 'auto') parts.push(`header ${headerName(headerType(o.header))}`);
  if (o.jacksPerSide !== 'auto') parts.push(`jacks ${o.jacksPerSide}`);
  if (o.ro.trim()) parts.push(`ro ${o.ro.trim()}`);
  return parts.join(', ');
}
