/**
 * Floor plan geometry. Each wall is placed by its left end on the face it is seen from, and the
 * compass direction it runs to its right end; its depth goes away from the viewer. Plan x is east and
 * y is north, in inches.
 */

export type PlanRun = 'east' | 'west' | 'north' | 'south';

type Vec = readonly [number, number];

/** Direction along the wall (left to right) and into it, away from the viewer. */
export const RUN: Record<PlanRun, { along: Vec; into: Vec }> = {
  // Facing a wall, its left-to-right direction turned a quarter turn left points away from you.
  east: { along: [1, 0], into: [0, 1] },
  west: { along: [-1, 0], into: [0, -1] },
  north: { along: [0, 1], into: [-1, 0] },
  south: { along: [0, -1], into: [1, 0] },
};

export interface PlacedWall {
  /** Position in the project's wall list. */
  index: number;
  name: string;
  x: number;
  y: number;
  run: PlanRun;
  length: number;
  /** Framing depth. */
  depth: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Plan point at a distance s along the wall from its left end and t into it from its seen face. */
export function planPoint(w: Pick<PlacedWall, 'x' | 'y' | 'run'>, s: number, t: number): Vec {
  const { along, into } = RUN[w.run];
  return [w.x + s * along[0] + t * into[0], w.y + s * along[1] + t * into[1]];
}

/** Plan box covering a stretch of the wall, s0 to s1 along it and t0 to t1 into it. */
export function planBox(w: Pick<PlacedWall, 'x' | 'y' | 'run'>, s0: number, s1: number, t0: number, t1: number): Box {
  const [ax, ay] = planPoint(w, s0, t0);
  const [bx, by] = planPoint(w, s1, t1);
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
}

export const wallBox = (w: PlacedWall) => planBox(w, 0, w.length, 0, w.depth);

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
}

export interface PlanOverlap {
  a: PlacedWall;
  b: PlacedWall;
  box: Box;
}

/** Overlaps deeper than this both ways count; anything thinner is rounding in the measurements. */
export const OVERLAP_TOLERANCE = 1 / 4;

/** Pairs of walls whose framing occupies the same floor. */
export function planOverlaps(walls: PlacedWall[]): PlanOverlap[] {
  const out: PlanOverlap[] = [];
  const boxes = walls.map(wallBox);
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const p = boxes[i]!;
      const q = boxes[j]!;
      const box = { x0: Math.max(p.x0, q.x0), y0: Math.max(p.y0, q.y0), x1: Math.min(p.x1, q.x1), y1: Math.min(p.y1, q.y1) };
      if (box.x1 - box.x0 > OVERLAP_TOLERANCE && box.y1 - box.y0 > OVERLAP_TOLERANCE) out.push({ a: walls[i]!, b: walls[j]!, box });
    }
  }
  return out;
}
