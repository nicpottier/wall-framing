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
 * header, and the beam/joist schedule gives the members called out by mark.
 */
export const HEADER_TYPES = [
  { id: '4x8', label: '4x8', mark: null, width: 3.5, depth: 7.25 },
  { id: '4x10', label: '4x10', mark: 'B4', width: 3.5, depth: 9.25 },
  { id: '6x10-pt', label: 'P/T 6x10', mark: 'B5', width: 5.5, depth: 9.5 },
  { id: 'lvl-3.5x11.875', label: '3½ × 11⅞ LVL', mark: 'B1', width: 3.5, depth: 11.875 },
  { id: 'gl-5.5x11.875', label: '5½ × 11⅞ GL', mark: 'B2', width: 5.5, depth: 11.875 },
  { id: 'lvl-5.25x14', label: '5¼ × 14 LVL', mark: 'B3', width: 5.25, depth: 14 },
  { id: 'lvl-3.5x18', label: '3½ × 18 LVL', mark: 'B6', width: 3.5, depth: 18 },
] as const;

export type HeaderTypeId = (typeof HEADER_TYPES)[number]['id'];
export type HeaderType = (typeof HEADER_TYPES)[number];

/** Plan note 3: beams over interior and exterior openings are 4x8, U.O.N. */
export const TYPICAL_HEADER: HeaderTypeId = '4x8';

export const headerType = (id: HeaderTypeId): HeaderType => HEADER_TYPES.find((h) => h.id === id)!;
export const isHeaderTypeId = (id: string): id is HeaderTypeId => HEADER_TYPES.some((h) => h.id === id);

/** Short name for drawings and the cut list, e.g. "B1 3½ × 11⅞ LVL" or "4x8". */
export const headerName = (h: HeaderType) => (h.mark ? `${h.mark} ${h.label}` : h.label);

/** Common precut stud lengths and the wall heights they produce with a double top plate. */
export const PRECUTS: Record<string, string> = {
  '92.625': '92 5/8" precut',
  '104.625': '104 5/8" precut',
  '116.625': '116 5/8" precut',
};
