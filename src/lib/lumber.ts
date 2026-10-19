/** Actual thickness of dimensional 2x lumber. */
export const T = 1.5;

/** Actual width of a 2x6 (the wall depth). */
export const WALL_DEPTH = 5.5;

/** Dimensional lumber used for wall members other than headers. */
export type LumberSize = '2x4' | '2x6';

/** Actual face width of each 2x size. */
export const DEPTH: Record<LumberSize, number> = {
  '2x4': 3.5,
  '2x6': 5.5,
};

/**
 * Headers available on this project, from the Buckley-Watanabe structural plans
 * (Harezlak Engineering, Rev. 1, 05/22/26): plan note 3 on S2.1/S2.2 makes 4x8 the typical
 * header, the beam/joist schedule gives the larger members, and S2.2 calls out a 4x12 on grid C.
 */
export const HEADER_TYPES = [
  { id: '4x8', label: '4x8', width: 3.5, depth: 7.25 },
  { id: '4x10', label: '4x10', width: 3.5, depth: 9.25 },
  { id: '4x12', label: '4x12', width: 3.5, depth: 11.25 },
  { id: '6x10-pt', label: 'P/T 6x10', width: 5.5, depth: 9.5 },
  { id: 'lvl-3.5x11.875', label: '3½ × 11⅞ LVL', width: 3.5, depth: 11.875 },
  { id: 'gl-5.5x11.875', label: '5½ × 11⅞ GL', width: 5.5, depth: 11.875 },
  { id: 'lvl-5.25x14', label: '5¼ × 14 LVL', width: 5.25, depth: 14 },
  { id: 'lvl-3.5x18', label: '3½ × 18 LVL', width: 3.5, depth: 18 },
] as const;

export type HeaderTypeId = (typeof HEADER_TYPES)[number]['id'];
export type HeaderType = (typeof HEADER_TYPES)[number];

/** Plan note 3: beams over interior and exterior openings are 4x8, U.O.N. */
export const TYPICAL_HEADER: HeaderTypeId = '4x8';

export const headerType = (id: HeaderTypeId): HeaderType => HEADER_TYPES.find((h) => h.id === id)!;
export const isHeaderTypeId = (id: string): id is HeaderTypeId => HEADER_TYPES.some((h) => h.id === id);

/** Name for drawings and the cut list, e.g. "3½ × 11⅞ LVL" or "4x8". */
export const headerName = (h: HeaderType) => h.label;

/**
 * Posts in a wall. Plan note 5 (S2.2): posts or jamb studs at the ends of supporting beams are
 * (3) studs minimum; the post schedule (S2.1) lists P1 6x6, P2 P/T 6x6 and P3 P/T 4x4.
 * width runs along the wall; built-up posts are that many 2x6 studs nailed together.
 */
export const POST_TYPES = [
  { id: '6x6', label: '6x6', width: 5.5, plies: 1 },
  { id: '4x6', label: '4x6', width: 3.5, plies: 1 },
  { id: '4x4', label: '4x4', width: 3.5, plies: 1 },
  { id: 'studs-2', label: '(2) studs', width: 2 * T, plies: 2 },
  { id: 'studs-3', label: '(3) studs', width: 3 * T, plies: 3 },
  { id: 'studs-4', label: '(4) studs', width: 4 * T, plies: 4 },
] as const;

export type PostTypeId = (typeof POST_TYPES)[number]['id'];
export type PostType = (typeof POST_TYPES)[number];
export const postType = (id: PostTypeId): PostType => POST_TYPES.find((p) => p.id === id)!;
export const isPostTypeId = (id: string): id is PostTypeId => POST_TYPES.some((p) => p.id === id);

/** Common precut stud lengths and the wall heights they produce with a double top plate. */
export const PRECUTS: Record<string, string> = {
  '92.625': '92 5/8" precut',
  '104.625': '104 5/8" precut',
  '116.625': '116 5/8" precut',
};
