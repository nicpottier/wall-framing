/** Actual thickness of dimensional 2x lumber. */
export const T = 1.5;

/** Actual width of a 2x6 (the wall depth). */
export const WALL_DEPTH = 5.5;

export const HEADER_SIZES = ['2x6', '2x8', '2x10', '2x12'] as const;
export type HeaderSize = (typeof HEADER_SIZES)[number];
export type LumberSize = '2x4' | HeaderSize;

/** Actual face depth of each 2x size. */
export const DEPTH: Record<LumberSize, number> = {
  '2x4': 3.5,
  '2x6': 5.5,
  '2x8': 7.25,
  '2x10': 9.25,
  '2x12': 11.25,
};

/**
 * Rule-of-thumb header size for a bearing wall rough opening.
 * This is a starting point only; real sizing depends on loads (IRC R602.7).
 */
export function suggestedHeader(roWidth: number): HeaderSize {
  if (roWidth <= 36) return '2x6';
  if (roWidth <= 48) return '2x8';
  if (roWidth <= 60) return '2x10';
  return '2x12';
}

/** Common precut stud lengths and the wall heights they produce with a double top plate. */
export const PRECUTS: Record<string, string> = {
  '92.625': '92 5/8" precut',
  '104.625': '104 5/8" precut',
  '116.625': '116 5/8" precut',
};
